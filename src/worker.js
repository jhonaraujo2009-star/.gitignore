function applySecurityHeaders(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-Content-Type-Options", "nosniff");
  newHeaders.set("X-Frame-Options", "DENY");
  newHeaders.set("X-XSS-Protection", "1; mode=block");
  newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  newHeaders.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  newHeaders.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const decodedPath = decodeURIComponent(url.pathname).toLowerCase();

    // 0. Firewall en la Nube (WAF): Bloquear escáneres de vulnerabilidades y rutas prohibidas
    if (
      decodedPath.includes("..") ||
      decodedPath.startsWith("/.env") ||
      decodedPath.startsWith("/.git") ||
      decodedPath.startsWith("/wp-admin") ||
      decodedPath.startsWith("/wp-login") ||
      decodedPath.startsWith("/phpmyadmin") ||
      decodedPath.endsWith(".php") ||
      decodedPath.endsWith(".asp") ||
      decodedPath.endsWith(".aspx")
    ) {
      return new Response(
        JSON.stringify({ error: "Acceso bloqueado por el firewall de seguridad" }),
        {
          status: 403,
          headers: {
            "content-type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        }
      );
    }

    // 1. Manejo inteligente y seguro de imágenes /uploads/ desde Cloudflare R2 y Servidor Local
    if (url.pathname.startsWith("/uploads/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const rawFilename = url.pathname.replace(/^\/uploads\//, "");
      const filename = rawFilename.split("/").pop();
      if (!filename || filename.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return new Response("Not Found", { status: 404 });
      }

      // A. Intentar servir el archivo desde R2 (fotos.lkth91ofertas.com)
      let res = await fetch(`https://fotos.lkth91ofertas.com/${filename}`);

      // B. Si no existe con esa extensión (ej. se guardó como .webp y se pidió como .jpg), intentar con .webp
      if (res.status === 404) {
        const baseName = filename.replace(/\.[^/.]+$/, "");
        const webpRes = await fetch(`https://fotos.lkth91ofertas.com/${baseName}.webp`);
        if (webpRes.ok) {
          res = webpRes;
        }
      }

      // C. Si R2 aún no la tiene (recién subida o en sincronización), buscar en el servidor local de la PC
      if (res.status === 404) {
        try {
          const localRes = await fetch(`https://api.lkth91ofertas.com/uploads/${filename}`);
          if (localRes.ok) {
            res = localRes;
          }
        } catch {
          // ignore
        }
      }

      // Solo aplicar caché de 1 año si la imagen existe (200 OK). Jamás cachear errores 404.
      const newHeaders = new Headers(res.headers);
      if (res.ok) {
        newHeaders.set("cache-control", "public, max-age=31536000, immutable");
      } else {
        newHeaders.set("cache-control", "no-store, no-cache, must-revalidate");
      }
      newHeaders.set("X-Content-Type-Options", "nosniff");

      return new Response(res.body, {
        status: res.status,
        headers: newHeaders,
      });
    }

    // 2. Proxy de API (/api/...) hacia el servidor local de la PC (vía api.lkth91ofertas.com)
    if (url.pathname.startsWith("/api/")) {
      const targetUrl = `https://api.lkth91ofertas.com${url.pathname}${url.search}`;
      try {
        const localReq = new Request(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
          redirect: "follow",
        });

        const localRes = await fetch(localReq);

        // Si la PC local devolvió error de conexión (túnel caído 502, 503, 504, 530)
        if ([502, 503, 504, 521, 522, 523, 524, 530].includes(localRes.status)) {
          return new Response(
            JSON.stringify({
              error: "Servidor local desconectado",
              offline: true,
              online: false,
            }),
            {
              status: 503,
              headers: {
                "content-type": "application/json",
                "X-Content-Type-Options": "nosniff",
              },
            }
          );
        }

        return applySecurityHeaders(localRes);
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "No se pudo conectar con el servidor local",
            offline: true,
            online: false,
            details: err.message,
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/json",
              "X-Content-Type-Options": "nosniff",
            },
          }
        );
      }
    }

    // 3. Servir los archivos estáticos de la aplicación (HTML, JS, CSS) con cabeceras de seguridad
    const assetRes = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetRes);
  },
};
