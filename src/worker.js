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

    // 2. Servir los archivos estáticos de la aplicación (HTML, JS, CSS)
    return env.ASSETS.fetch(request);
  },
};
