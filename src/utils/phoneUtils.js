/**
 * Utilidades para teléfonos y WhatsApp
 * Soluciona el problema de números en Venezuela (0412, 0414, 0424, 0416, 0426)
 * donde el "0" inicial hace que WhatsApp lo rechace con error.
 */

/**
 * Limpia y normaliza un número para formato internacional compatible con wa.me
 * Ejemplo:
 * - 04247173840 -> 584247173840
 * - 4247173840  -> 584247173840
 * - +58 0424 717 3840 -> 584247173840
 * - 0412-0496690 -> 584120496690
 */
export function cleanPhoneForWhatsApp(phone) {
  if (!phone) return "";

  // Convertir a string y eliminar espacios y caracteres no numéricos excepto '+'
  let str = String(phone).trim();
  let cleaned = str.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Caso: +58 0424... -> 580424... (quitar el 0 después de 58)
  if (cleaned.startsWith("580") && cleaned.length >= 13) {
    cleaned = "58" + cleaned.substring(3);
  }

  // Caso típico Venezuela: 11 dígitos empezando con 0 (ej: 04247173840)
  if (cleaned.startsWith("0")) {
    // Quita el 0 y le coloca el código de país de Venezuela (58)
    cleaned = "58" + cleaned.substring(1);
  } else if (cleaned.length === 10 && /^(412|414|424|416|426)/.test(cleaned)) {
    // Si pusieron 10 dígitos directos sin el 0 (ej: 4247173840)
    cleaned = "58" + cleaned;
  }

  return cleaned;
}

/**
 * Genera el enlace directo a WhatsApp (wa.me) con mensaje predeterminado
 */
export function getWhatsAppUrl(phone, message = "") {
  const clean = cleanPhoneForWhatsApp(phone);
  if (!clean) return "";
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${clean}${query}`;
}
