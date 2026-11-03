import imageCompression from "browser-image-compression";

const UPLOAD_URL = "/api/upload";

// Opciones de compresión
const compressionOptions = {
  maxSizeMB: 0.8,          // Máximo 800KB por imagen
  maxWidthOrHeight: 1920,  // Máximo 1920px de ancho o alto
  useWebWorker: true,      // Usa un Web Worker para no bloquear la UI
  fileType: "image/webp",  // Convierte a WebP (más liviano que JPG/PNG)
};

/**
 * Comprime una imagen y la sube al servidor local (/api/upload).
 * Retorna la URL pública de la imagen subida (/uploads/...).
 */
export const compressAndUpload = async (file) => {
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

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Error al subir la imagen al servidor");
  const data = await res.json();
  return data.url || data.secure_url;
};
