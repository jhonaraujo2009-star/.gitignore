import imageCompression from "browser-image-compression";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dp3abweme/image/upload";
const UPLOAD_PRESET = "tienda_maquillaje";

// Opciones de compresión
const compressionOptions = {
  maxSizeMB: 0.8,          // Máximo 800KB por imagen
  maxWidthOrHeight: 1920,  // Máximo 1920px de ancho o alto
  useWebWorker: true,      // Usa un Web Worker para no bloquear la UI
  fileType: "image/webp",  // Convierte a WebP (más liviano que JPG/PNG)
};

/**
 * Comprime una imagen y la sube a Cloudinary.
 * Retorna la URL segura de la imagen subida.
 */
export const compressAndUpload = async (file) => {
  // 1. Comprimir la imagen
  const compressedFile = await imageCompression(file, compressionOptions);

  // 2. Subir a Cloudinary
  const formData = new FormData();
  formData.append("file", compressedFile);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_URL, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Error al subir a Cloudinary");
  const data = await res.json();
  return data.secure_url;
};
