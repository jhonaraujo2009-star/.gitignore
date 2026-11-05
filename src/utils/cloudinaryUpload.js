import imageCompression from "browser-image-compression";
import { auth } from "../config/firebase";

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
 * Obtiene el token de sesión de Firebase del Administrador actual.
 */
export const getAdminAuthHeader = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("🔒 Acceso denegado: Debes iniciar sesión como Administrador.");
  }
  const idToken = await currentUser.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
};

/**
 * Consulta si el servidor local de la PC está encendido y conectado.
 * Retorna true si está online, false si está apagado/desconectado.
 */
export const checkServerHealth = async () => {
  try {
    const res = await fetch(HEALTH_URL, {
      cache: "no-store",
      headers: { pragma: "no-cache" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.online === true;
  } catch {
    return false;
  }
};

/**
 * Comprime una imagen y la sube al servidor local (/api/upload) autenticada con Firebase.
 * Si el servidor está apagado, lanza una alerta clara de Solo Lectura.
 * Retorna la URL pública de la imagen subida (/uploads/...).
 */
export const compressAndUpload = async (file) => {
  // 1. Verificar sesión de administrador antes de procesar nada
  const authHeaders = await getAdminAuthHeader();

  // 2. Pre-verificación: validar que el servidor local de la PC esté activo
  const isOnline = await checkServerHealth();
  if (!isOnline) {
    throw new Error(
      "⚠️ Servidor local apagado: La tienda está en modo Solo Lectura. Enciende tu PC servidor para subir fotos."
    );
  }

  // 3. Comprimir la imagen
  const compressedBlob = await imageCompression(file, compressionOptions);

  // Asegurar que el archivo tenga un nombre con extensión .webp
  const originalBase = (file.name || "imagen").replace(/\.[^/.]+$/, "");
  const finalFile = new File([compressedBlob], `${originalBase}.webp`, {
    type: "image/webp",
  });

  // 4. Subir al servidor local con token de seguridad Firebase
  const formData = new FormData();
  formData.append("file", finalFile);

  try {
    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("🔒 No autorizado: Tu sesión de administrador expiró. Vuelve a iniciar sesión.");
      }
      if (res.status === 503 || res.status === 502) {
        throw new Error(
          "⚠️ Servidor local apagado: La tienda está en modo Solo Lectura. Enciende tu PC servidor para subir fotos."
        );
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error al subir imagen al servidor (${res.status})`);
    }

    const data = await res.json();
    return data.url || data.secure_url;
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      throw new Error(
        "⚠️ Servidor local apagado: La tienda está en modo Solo Lectura. Enciende tu PC servidor para subir fotos."
      );
    }
    throw err;
  }
};
