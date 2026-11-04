export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Manejo inteligente de imágenes /uploads/ desde Cloudflare R2
    if (url.pathname.startsWith("/uploads/")) {
      const filename = url.pathname.replace(/^\/uploads\//, "");
      if (!filename) {
        return new Response("Not Found", { status: 404 });
      }

      // Intentar servir el archivo desde R2 (fotos.lkth91ofertas.com)
      let res = await fetch(`https://fotos.lkth91ofertas.com/${filename}`);

      // Si no existe con esa extensión (ej. se guardó como .webp y se pidió como .jpg), intentar con .webp
      if (res.status === 404) {
        const baseName = filename.replace(/\.[^/.]+$/, "");
        const webpRes = await fetch(`https://fotos.lkth91ofertas.com/${baseName}.webp`);
        if (webpRes.ok) {
          res = webpRes;
        }
      }

      // Devolver la imagen con caché agresivo en el navegador y Cloudflare CDN
      const newHeaders = new Headers(res.headers);
      newHeaders.set("cache-control", "public, max-age=31536000, immutable");
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
          body: request.body,
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
              headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
            }
          );
        }

        return localRes;
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
            headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
          }
        );
      }
    }

    // 3. Servir los archivos estáticos de la aplicación (HTML, JS, CSS)
    return env.ASSETS.fetch(request);
  },
};
