/**
 * CLOUDFLARE WORKER — Respaldo automático de Mantenimiento (Gratis en Cloudflare)
 *
 * ¿Cómo funciona?
 * 1. Este código vive en la nube de Cloudflare (que nunca se apaga aunque se vaya la luz en casa).
 * 2. Cuando un cliente entra a tu dominio, Cloudflare intenta conectar con tu PC servidor.
 * 3. Si tu PC está apagada o sin internet (códigos 502, 503, 504, 530 o error de conexión),
 *    Cloudflare muestra automáticamente esta página de "En Mantenimiento" con el botón directo
 *    a tu WhatsApp 0422-7143050.
 */

const MAINTENANCE_HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Luckathys Shop — Atención por WhatsApp</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #fff5f8 0%, #ffffff 50%, #fdf2f8 100%);
        color: #1f2937;
        padding: 24px;
      }
      .card {
        background: #ffffff;
        max-width: 440px;
        width: 100%;
        border-radius: 32px;
        padding: 40px 28px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(236, 72, 153, 0.12), 0 4px 16px rgba(0, 0, 0, 0.04);
        border: 1px solid #fce7f3;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fdf2f8;
        color: #db2777;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding: 8px 16px;
        border-radius: 999px;
        margin-bottom: 20px;
      }
      .icon { font-size: 54px; margin-bottom: 16px; display: block; }
      h1 { font-size: 24px; font-weight: 900; color: #111827; margin-bottom: 12px; line-height: 1.25; }
      p { font-size: 14px; line-height: 1.6; color: #6b7280; margin-bottom: 28px; }
      .wa-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        color: #ffffff;
        text-decoration: none;
        font-weight: 800;
        font-size: 15px;
        padding: 18px 24px;
        border-radius: 20px;
        box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3);
      }
      .phone-box {
        margin-top: 20px;
        padding: 14px;
        border-radius: 16px;
        background: #f9fafb;
        border: 1px dashed #e5e7eb;
        font-size: 13px;
        color: #4b5563;
      }
      .phone-box strong { color: #ec4899; font-size: 15px; }
      .retry-btn {
        margin-top: 20px;
        display: inline-block;
        font-size: 12px;
        font-weight: 700;
        color: #9ca3af;
        text-decoration: none;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">✨ Luckathys Shop ✨</div>
      <span class="icon">🛍️💖</span>
      <h1>Estamos en mantenimiento momentáneo</h1>
      <p>
        Estamos actualizando nuestro catálogo en este instante. ¡Pero seguimos atendiendo tus pedidos y consultas en vivo por WhatsApp!
      </p>
      <a
        class="wa-btn"
        href="https://wa.me/584227143050?text=%C2%A1Hola%20Luckathys!%20%F0%9F%92%96%20Vi%20que%20la%20web%20est%C3%A1%20en%20mantenimiento%20y%20quiero%20hacer%20una%20consulta."
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>📲</span> Escribir al WhatsApp ahora
      </a>
      <div class="phone-box">
        Atención directa: <strong>0422-7143050</strong>
      </div>
      <a class="retry-btn" href="javascript:location.reload()">🔄 Volver a intentar entrar a la web</a>
    </div>
  </body>
</html>`;

export default {
  async fetch(request) {
    try {
      const response = await fetch(request);
      // Si el túnel de la PC está apagado (502, 503, 504, 521, 522, 523, 524, 530)
      if ([502, 503, 504, 521, 522, 523, 524, 530].includes(response.status)) {
        return new Response(MAINTENANCE_HTML, {
          status: 503,
          headers: {
            "content-type": "text/html;charset=UTF-8",
            "cache-control": "no-store",
          },
        });
      }
      return response;
    } catch {
      return new Response(MAINTENANCE_HTML, {
        status: 503,
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "no-store",
        },
      });
    }
  },
};
