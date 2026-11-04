import express from "express";
import multer from "multer";
import cors from "cors";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

sharp.cache(false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar que la carpeta uploads exista
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cliente Cloudflare R2 para respaldo automático en la nube
const s3R2 = new S3Client({
  region: "auto",
  endpoint: "https://1810a3e6e46fe12fb0ec663379858a54.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "da234b11a3e00c3568656878409fe385",
    secretAccessKey: "e012621e21c22d7ea6433688447ef106aa6443c7cd5c68be7f31f278186180f9"
  }
});
const R2_BUCKET = "tienda-fotos";

app.use(cors());
app.use(express.json());

// Endpoint de estado de salud (para que el Admin y Cloudflare sepan si la PC está encendida)
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    online: true,
    server: "local_pc",
    timestamp: Date.now(),
  });
});


// Configuración de Multer para guardar imágenes en disco local (/uploads)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const extFromName = path.extname(file.originalname).toLowerCase();
    let ext = extFromName;
    if (!ext) {
      if (file.mimetype === "image/webp") ext = ".webp";
      else if (file.mimetype === "image/png") ext = ".png";
      else if (file.mimetype === "image/jpeg") ext = ".jpg";
      else ext = ".webp";
    }
    const baseName = path
      .basename(file.originalname, extFromName)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${baseName || "img"}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Máximo 15MB por archivo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"));
    }
  },
});

// Endpoint para subir una imagen desde el panel de administración (con optimización HD por sharp)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ningún archivo" });
    }

    const uploadedPath = req.file.path;
    const parsed = path.parse(req.file.filename);
    const webpFilename = `${parsed.name}.webp`;
    const webpPath = path.join(uploadsDir, webpFilename);

    const inputBuffer = await fs.promises.readFile(uploadedPath);
    const optimizedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    await fs.promises.writeFile(webpPath, optimizedBuffer);
    if (webpPath !== uploadedPath && fs.existsSync(uploadedPath)) {
      await fs.promises.unlink(uploadedPath);
    }

    // Respaldo instantáneo a Cloudflare R2 con await (garantiza que esté en R2 antes de responder al navegador)
    try {
      await s3R2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: webpFilename,
          Body: optimizedBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      console.log(`☁️ Imagen ${webpFilename} respaldada exitosamente en Cloudflare R2`);
    } catch (err) {
      console.error(`⚠️ Error respaldando ${webpFilename} en R2:`, err.message);
    }

    const relativeUrl = `/uploads/${webpFilename}`;
    return res.json({
      url: relativeUrl,
      secure_url: relativeUrl,
      filename: webpFilename,
    });
  } catch (err) {
    console.error("Error al subir archivo:", err);
    return res.status(500).json({ error: "Error interno al guardar la imagen" });
  }
});

// Servir la carpeta uploads de forma estática con caché para carga rápida
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "30d",
    etag: true,
  })
);

// Si una imagen en /uploads tiene extensión distinta (.webp vs .jpg/.png), buscar coincidencia por nombre base
app.get("/uploads/:filename", (req, res) => {
  const requested = req.params.filename;
  const parsed = path.parse(requested);
  const candidates = [".webp", ".jpg", ".jpeg", ".png", ".gif"].map(
    (ext) => path.join(uploadsDir, `${parsed.name}${ext}`)
  );
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }
  return res.status(404).send("Imagen no encontrada");
});

// Servir la aplicación React compilada (dist/)
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

// Cualquier otra ruta (SPA fallback de React Router) devuelve index.html
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return next();
  }
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send("Ejecuta 'npm run build' para compilar el frontend.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor de la tienda activo en http://localhost:${PORT}`);
  console.log(`📁 Carpeta de imágenes locales: ${uploadsDir}`);
});
