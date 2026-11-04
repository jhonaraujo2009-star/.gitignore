import imageCompression from "browser-image-compression";

const UPLOAD_URL = "/api/upload";
const HEALTH_URL = "/api/health";

// Opciones de compresión HD WebP
const compressionOptions = {
  maxSizeMB: 0.8,          // Máximo 800KB por imagen
  maxWidthOrHeight: 1920,  // Máximo 1920px de ancho o alto
  useWebWorker: true,      // Usa un Web Worker para no bloquear la UI
  fileType: "image/webp",  // Convierte a WebP (más liviano que JPG/PNG)
};

/**
 * Consulta si el servidor local de la PC está encendido y conectado.
 * Retorna true si está online, false si está apagado/desconectado.
 */
export const checkServerHealth = async () => {
  try {
    const res = await fetch(HEALTH_URL, {
      cache: "no-store",
      headers: { "pragma": "no-cache" }
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.online === true;
  } catch {
    return false;
  }
};

/**
 * Comprime una imagen y la sube al servidor local (/api/upload).
 * Si el servidor está apagado, lanza una alerta clara de Solo Lectura.
 * Retorna la URL pública de la imagen subida (/uploads/...).
 */
export const compressAndUpload = async (file) => {
  // Pre-verificación: validar que el servidor local de la PC esté activo
  const isOnline = await checkServerHealth();
  if (!isOnline) {
    throw new Error("⚠️ Servidor local apagado: La tienda está en modo Solo Lectura. Enciende tu PC servidor para subir fotos.");
  }

  // 1. Comprimir la imagen
  const compressedBlob = await imageCompression(file, compressionOptions);

  // Asegurar que el archivo tenga un nombre con extensión .webp
  const originalBase = (file.name || "imagen").replace(/\.[^/.]+$/, "");
  const finalFile = new File([compressedBlob], `${originalBase}.webp`, {
    type: "image/webp",
  });

  // 2. Subir al servidor local
  const formData = new FormData();
  formData.append("file", finalFile);

  try {
    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 503 || res.status === 502) {
        throw new Error("⚠️ Servidor local apagado: La tienda está en modo Solo Lectura. Enciende tu PC servidor para subir fotos.");
      }
      throw new Error(`Error al subir imagen al servidor (${res.status})`);
    }

    const data = await res.json();
    return data.url || data.secure_url;
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      throw new Error("⚠️ Servidor local apagado: La tienda está en modo Solo Lectura. Enciende tu PC servidor para subir fotos.");
    }
    throw err;
  }
};
