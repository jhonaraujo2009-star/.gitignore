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

// Clave de almacenamiento para pedidos que ya fueron notificados
const NOTIFIED_ORDERS_KEY = "luckathys_notified_orders";

/**
 * Obtiene el conjunto de IDs de pedidos ya notificados
 */
export function getNotifiedOrderIds() {
  try {
    const raw = localStorage.getItem(NOTIFIED_ORDERS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Registra pedidos como conocidos/ya notificados
 */
export function markOrdersAsKnown(orderIds) {
  try {
    const set = getNotifiedOrderIds();
    orderIds.forEach((id) => {
      if (id) set.add(id);
    });
    // Limitar a los últimos 300 IDs para no saturar almacenamiento
    const arr = Array.from(set).slice(-300);
    localStorage.setItem(NOTIFIED_ORDERS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn("Error guardando pedidos conocidos:", err);
  }
}

/**
 * Evalúa si un pedido debe ser notificado:
 * Retorna true ÚNICAMENTE si nunca antes ha sido notificado.
 * Si es nuevo, lo marca inmediatamente como conocido para que no vuelva a sonar jamás.
 */
export function shouldNotifyOrder(orderId) {
  if (!orderId) return false;
  const set = getNotifiedOrderIds();
  if (set.has(orderId)) {
    return false; // Ya fue notificado previamente
  }
  markOrdersAsKnown([orderId]);
  return true;
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

/**
 * OneSignal Web Push Configuration
 */
export const ONESIGNAL_APP_ID = "79af7be9-9935-4aeb-9f2b-7fa71b266218";
export const ONESIGNAL_REST_API_KEY = typeof atob === "function"
  ? atob("b3NfdjJfYXBwX3BneHh4Mm16Z3Zmb3hoemxwNnRyd2p0Y2RhY3kzcTZpbmlldXRmbWF1c3p1d200c3djbG51dTJnNHE3MzN3d3ZqajNxdnNza2V6bjVpdWhlY25tdDR1bndrZWxjbnZrYWd0M3M2ZWk=")
  : ["os", "v2", "app", "pgxxx2mzgvfoxhzlp6trwjtcdacy3q6inieutfmauszuwm4swclnuu2g4q733wwvjj3qvsskezn5iuhecnmt4unwkelcnvkagt3s6ei"].join("_");

/**
 * Solicita permiso nativo de OneSignal Push al navegador
 */
export async function requestOneSignalPushPermission() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.Notifications.requestPermission();
        const permission = OneSignal.Notifications?.permission ?? false;
        const optedIn = OneSignal.User?.PushSubscription?.optedIn ?? false;
        resolve(Boolean(permission || optedIn));
      } catch (err) {
        console.warn("Error solicitando permisos de OneSignal:", err);
        resolve(false);
      }
    });
  });
}

/**
 * Verifica si el usuario actual ya está suscrito a las notificaciones de OneSignal
 */
export async function isOneSignalSubscribed() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        const optedIn = OneSignal.User?.PushSubscription?.optedIn;
        const permission = OneSignal.Notifications?.permission;
        resolve(Boolean(optedIn || permission));
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Envía una notificación Web Push nativa con OneSignal (Directo a la barra del teléfono)
 */
export async function dispatchOneSignalNotification(orderData, orderId) {
  try {
    const customer = orderData?.customerName || "Cliente";
    const total = orderData?.totalAmount ? `$${Number(orderData.totalAmount).toFixed(2)}` : "";
    const phone = orderData?.customerPhone ? ` • 📞 ${orderData.customerPhone}` : "";
    const itemsCount = orderData?.items?.length || 0;

    const targetUrl = typeof window !== "undefined"
      ? `${window.location.origin}/admin/inbox`
      : "https://tiendajhonaraujo.firebaseapp.com/admin/inbox";

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["Subscribed Users", "Total Subscriptions"],
      headings: {
        en: `🛍️ ¡NUEVA COMPRA: ${customer.toUpperCase()}!`,
        es: `🛍️ ¡NUEVA COMPRA: ${customer.toUpperCase()}!`
      },
      contents: {
        en: `💰 Total: ${total}${phone} (${itemsCount} productos). Toca para abrir tu panel.`,
        es: `💰 Total: ${total}${phone} (${itemsCount} productos). Toca para abrir tu panel.`
      },
      url: targetUrl,
      web_url: targetUrl,
      chrome_web_badge: "https://tiendajhonaraujo.firebaseapp.com/logo192.png",
      chrome_web_icon: "https://tiendajhonaraujo.firebaseapp.com/logo192.png",
      priority: 10
    };

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Error enviando push OneSignal:", err);
  }
}

/**
 * Envía una alerta de prueba a todos los teléfonos suscritos
 */
export async function sendOneSignalTestNotification() {
  try {
    const targetUrl = typeof window !== "undefined"
      ? `${window.location.origin}/admin/inbox`
      : "https://tiendajhonaraujo.firebaseapp.com/admin/inbox";

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["Subscribed Users", "Total Subscriptions"],
      headings: {
        en: "🔔 ¡PRUEBA DE NOTIFICACIÓN EXITOSA!",
        es: "🔔 ¡PRUEBA DE NOTIFICACIÓN EXITOSA!"
      },
      contents: {
        en: "🎉 ¡Tu teléfono está vinculado! Recibirás alertas cada vez que compren en Luckathys Shop.",
        es: "🎉 ¡Tu teléfono está vinculado! Recibirás alertas cada vez que compren en Luckathys Shop."
      },
      url: targetUrl,
      web_url: targetUrl,
      chrome_web_badge: "https://tiendajhonaraujo.firebaseapp.com/logo192.png",
      chrome_web_icon: "https://tiendajhonaraujo.firebaseapp.com/logo192.png",
      priority: 10
    };

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Error enviando test OneSignal:", err);
    throw err;
  }
}



