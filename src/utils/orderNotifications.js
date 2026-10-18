/**
 * Sistema de Notificaciones de Pedidos
 * - Sonido en tiempo real (Web Audio API sintetizador de campanadas/caja registradora)
 * - Vibración para teléfono móvil (navigator.vibrate)
 * - Notificaciones Push del sistema (Notification API / ServiceWorker)
 */

let sharedAudioContext = null;

// Inicializa o reanuda el AudioContext con la interacción del usuario
export function unlockAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume();
    }
    return sharedAudioContext;
  } catch (err) {
    console.warn("No se pudo desbloquear el AudioContext:", err);
    return null;
  }
}

/**
 * Reproduce un sonido de alerta llamativo (campana de venta / caja registradora)
 */
export function playOrderNotificationSound() {
  try {
    const ctx = unlockAudio();
    if (!ctx) return;

    const playTone = (freq, startTime, duration, type = "sine", gainLevel = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(gainLevel, ctx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration + 0.05);
    };

    // Secuencia de arpegio brillante ascendente (Ding-Dong-Chime de caja registradora)
    playTone(523.25, 0.00, 0.18, "triangle", 0.6); // C5
    playTone(659.25, 0.12, 0.18, "triangle", 0.6); // E5
    playTone(783.99, 0.24, 0.22, "sine", 0.7);     // G5
    playTone(1046.50, 0.38, 0.45, "sine", 0.8);    // C6
    playTone(1318.51, 0.50, 0.65, "sine", 0.9);    // E6
    // Campana armónica adicional
    playTone(2093.00, 0.52, 0.70, "sine", 0.4);    // C7
  } catch (err) {
    console.warn("Error al reproducir sonido de pedido:", err);
  }
}

/**
 * Hace vibrar el teléfono móvil con un patrón distintivo de nuevo pedido
 */
export function triggerOrderVibration() {
  try {
    if ("vibrate" in navigator) {
      // Patrón: vibrar 300ms, pausa 100ms, vibrar 300ms, pausa 100ms, vibrar 500ms
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
  } catch (err) {
    console.warn("Vibración no soportada o permitida:", err);
  }
}

/**
 * Solicita permisos de notificación al navegador
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("Error pidiendo permiso de notificación:", err);
    return "denied";
  }
}

/**
 * Lanza una notificación Push al teléfono o escritorio
 */
export async function sendOrderPushNotification(order) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const customer = order?.customerName || "Cliente";
  const total = order?.totalAmount ? `$${order.totalAmount}` : "";
  const phone = order?.customerPhone ? ` (${order.customerPhone})` : "";
  const title = "🛍️ ¡NUEVA COMPRA EN TU TIENDA!";
  const body = `${customer}${phone} acaba de hacer un pedido de ${total}. Toca para abrir Mensajería.`;

  const options = {
    body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    vibrate: [300, 100, 300, 100, 500],
    tag: `order-${order?.id || Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: { url: "/admin/inbox" }
  };

  try {
    // Si la app está registrada como PWA con Service Worker, usamos showNotification
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        return reg.showNotification(title, options);
      }
    }
    // Fallback a Notification estándar
    return new Notification(title, options);
  } catch (err) {
    console.warn("Error mostrando notificación push:", err);
  }
}

/**
 * Disparador completo de alerta cuando entra un nuevo pedido:
 * Sonido + Vibración + Push Notification
 */
export function notifyNewOrder(order) {
  playOrderNotificationSound();
  triggerOrderVibration();
  sendOrderPushNotification(order);
}
