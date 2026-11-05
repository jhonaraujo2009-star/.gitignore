import express from "express";
import multer from "multer";
import cors from "cors";
import sharp from "sharp";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

sharp.cache(false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. CARGA SEGURA DE VARIABLES DE ENTORNO (.env)
// ============================================================================
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of envLines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || "").trim();
    }
  }
}

const PORT = process.env.PORT || 3000;
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || "AIzaSyD5iVtSrxvJpZEsjS1YvaRg3B6D2WHjXzY";
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "tiendajhonaraujo";
const R2_BUCKET = process.env.R2_BUCKET || "tienda-fotos";

// Inicializar Firebase Client en Node para respaldos de Firestore
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
};
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(fbApp);

// Asegurar carpetas locales (uploads y backups)
const uploadsDir = path.join(__dirname, "uploads");
const backupsDir = path.join(__dirname, "backups");
for (const dir of [uploadsDir, backupsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Cliente Cloudflare R2 (usando variables de entorno seguras)
const s3R2 =
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

const app = express();
app.disable("x-powered-by");

// ============================================================================
// 2. SEGURIDAD ANTI-HACKING: CABECERAS HTTP, WAF LOCAL, CORS Y RATE LIMITING
// ============================================================================
const ALLOWED_ORIGINS = new Set([
  "https://lkth91ofertas.com",
  "https://www.lkth91ofertas.com",
  "https://api.lkth91ofertas.com",
  "https://gitignore.jhonaraujo2009.workers.dev",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones del mismo origen (sin header origin) o de dominios autorizados
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no autorizado por CORS"));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Pragma", "Cache-Control"],
  })
);

// Cabeceras de blindaje HTTP y bloqueo de rutas maliciosas (WAF)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  const decodedUrl = decodeURIComponent(req.url || "").toLowerCase();
  if (
    decodedUrl.includes("..") ||
    decodedUrl.includes(".env") ||
    decodedUrl.includes(".git") ||
    decodedUrl.includes("wp-admin") ||
    decodedUrl.includes("wp-login") ||
    decodedUrl.includes("phpmyadmin")
  ) {
    return res.status(403).json({ error: "Acceso denegado por seguridad" });
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

// Rate Limiter en memoria por IP (protección contra fuerza bruta y DDoS)
const rateLimitMap = new Map();
function createRateLimiter({ windowMs = 60_000, max = 120, message }) {
  return (req, res, next) => {
    const ip =
      req.headers["cf-connecting-ip"] ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";
    const key = `${req.baseUrl || ""}:${ip}`;
    const now = Date.now();
    const record = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }
    record.count += 1;
    rateLimitMap.set(key, record);

    if (record.count > max) {
      return res.status(429).json({
        error: message || "Demasiadas peticiones. Intenta de nuevo en un minuto.",
      });
    }
    next();
  };
}

// Limpieza periódica de la tabla de Rate Limit
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

const apiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 150,
  message: "Límite de peticiones excedido. Espera un momento.",
});
const strictAdminLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 35,
  message: "Límite de operaciones de administrador alcanzado. Espera 1 minuto.",
});

app.use("/api", apiLimiter);

// ============================================================================
// 3. AUTENTICACIÓN CRIPTOGRÁFICA DE ADMINISTRADOR (Firebase Auth Verification)
// ============================================================================
const verifiedTokensCache = new Map();

async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "No autorizado: Se requiere iniciar sesión como Administrador.",
      });
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken || idToken.length < 50) {
      return res.status(401).json({ error: "Token de sesión inválido." });
    }

    const tokenHash = crypto.createHash("sha256").update(idToken).digest("hex");
    const cached = verifiedTokensCache.get(tokenHash);
    if (cached && cached.expiresAt > Date.now()) {
      req.adminUser = cached.user;
      return next();
    }

    // Verificar el ID Token directamente con Google Identity Toolkit (Firebase Auth)
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!verifyRes.ok) {
      return res.status(401).json({
        error: "Sesión expirada o inválida. Por favor vuelve a iniciar sesión en el Panel Admin.",
      });
    }

    const data = await verifyRes.json();
    const user = data?.users?.[0];
    if (!user || !user.localId || user.disabled) {
      return res.status(403).json({
        error: "Cuenta no autorizada para realizar esta acción.",
      });
    }

    const adminUser = {
      uid: user.localId,
      email: user.email || "admin",
    };

    // Guardar en caché por 5 minutos para no ralentizar subidas múltiples
    verifiedTokensCache.set(tokenHash, {
      user: adminUser,
      expiresAt: Date.now() + 5 * 60_000,
    });

    req.adminUser = adminUser;
    next();
  } catch (err) {
    console.error("Error verificando autenticación admin:", err.message);
    return res.status(500).json({ error: "Error al verificar sesión de seguridad" });
  }
}

// ============================================================================
// 4. ENDPOINT DE SALUD (/api/health)
// ============================================================================
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    online: true,
    server: "local_pc",
    secured: true,
    timestamp: Date.now(),
  });
});

// ============================================================================
// 5. SUBIDA DE IMÁGENES BLINDADA (/api/upload) — SOLO ADMIN AUTENTICADO
// ============================================================================
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function hasValidImageMagicBytes(buf) {
  if (!buf || buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return true;
  // GIF: GIF87a o GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  )
    return true;
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return true;
  // AVIF / HEIC: ....ftyp
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  )
    return true;
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(), // En memoria primero: nada toca el disco sin ser validado
  limits: { fileSize: 12 * 1024 * 1024, files: 1 }, // Máx 12MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo bloqueado. Solo se permiten imágenes (JPG, PNG, WEBP, GIF)."));
    }
  },
});

app.post(
  "/api/upload",
  strictAdminLimiter,
  requireAdminAuth,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Archivo inválido" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: "No se recibió ningún archivo" });
      }

      if (!hasValidImageMagicBytes(req.file.buffer)) {
        return res.status(400).json({
          error: "El archivo no es una imagen válida o está corrupto.",
        });
      }

      const extFromName = path.extname(req.file.originalname || "").toLowerCase();
      const baseName = path
        .basename(req.file.originalname || "img", extFromName)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);

      const webpFilename = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${baseName || "img"}.webp`;
      const webpPath = path.join(uploadsDir, webpFilename);

      // Re-codificar con Sharp (destruye cualquier payload oculto en metadatos y optimiza a WebP)
      const optimizedBuffer = await sharp(req.file.buffer)
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

      // Respaldo instantáneo a Cloudflare R2
      if (s3R2) {
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
          console.log(`☁️ Imagen ${webpFilename} respaldada en Cloudflare R2 (por ${req.adminUser?.email})`);
        } catch (err) {
          console.error(`⚠️ Error respaldando ${webpFilename} en R2:`, err.message);
        }
      }

      const relativeUrl = `/uploads/${webpFilename}`;
      return res.json({
        url: relativeUrl,
        secure_url: relativeUrl,
        filename: webpFilename,
      });
    } catch (err) {
      console.error("Error al procesar imagen:", err.message);
      return res.status(500).json({ error: "Error interno al procesar la imagen" });
    }
  }
);

// ============================================================================
// 6. SISTEMA DE COPIAS DE SEGURIDAD (BACKUPS) DE FIREBASE FIRESTORE
//    - Automático el día 1 de cada mes + Manual bajo demanda
// ============================================================================
const FIRESTORE_COLLECTIONS = [
  "products",
  "sessions",
  "orders",
  "invoices",
  "logistics",
  "coupons",
  "payments",
  "config",
  "stats",
  "questions",
];

function getMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getNextFirstOfMonthISO(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0);
  return next.toISOString();
}

export async function createDatabaseBackup(type = "manual", triggeredBy = "system") {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const monthKey = `${y}-${m}`;
  const backupId = `backup-${y}-${m}-${d}_${hh}-${mm}-${ss}`;
  const filename = `${backupId}.json`;
  const filePath = path.join(backupsDir, filename);

  const data = {};
  const collectionCounts = {};
  let totalDocuments = 0;

  for (const colName of FIRESTORE_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      const docs = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      data[colName] = docs;
      collectionCounts[colName] = docs.length;
      totalDocuments += docs.length;
    } catch (err) {
      console.warn(`⚠️ No se pudo leer colección ${colName} en backup:`, err.message);
      data[colName] = [];
      collectionCounts[colName] = 0;
    }
  }

  const backupPayload = {
    id: backupId,
    filename,
    projectId: FIREBASE_PROJECT_ID,
    createdAt: now.toISOString(),
    timestamp: now.getTime(),
    monthKey,
    type, // "mensual-automatico" | "manual"
    triggeredBy,
    stats: {
      totalDocuments,
      collections: collectionCounts,
    },
    data,
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const sizeBytes = Buffer.byteLength(jsonString, "utf8");
  backupPayload.sizeBytes = sizeBytes;

  // 1. Guardar en disco local (/backups)
  await fs.promises.writeFile(filePath, JSON.stringify(backupPayload, null, 2), "utf8");

  // 2. Registrar metadatos en Firestore (colección backups_meta) para que Admin siempre vea el historial
  const metaSummary = {
    id: backupId,
    filename,
    createdAt: backupPayload.createdAt,
    timestamp: backupPayload.timestamp,
    monthKey,
    type,
    triggeredBy,
    sizeBytes,
    stats: backupPayload.stats,
  };

  try {
    await setDoc(doc(db, "backups_meta", backupId), metaSummary);
  } catch (err) {
    console.warn("⚠️ No se pudo guardar metadato en Firestore backups_meta:", err.message);
  }

  console.log(
    `💾 Copia de seguridad creada: ${filename} (${totalDocuments} documentos, ${(sizeBytes / 1024).toFixed(1)} KB) [${type}]`
  );

  return metaSummary;
}

function listLocalBackups() {
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith(".json") && f.startsWith("backup-"));

  const list = [];
  for (const file of files) {
    try {
      const fullPath = path.join(backupsDir, file);
      const stat = fs.statSync(fullPath);
      const raw = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      list.push({
        id: raw.id || path.basename(file, ".json"),
        filename: file,
        createdAt: raw.createdAt || stat.mtime.toISOString(),
        timestamp: raw.timestamp || stat.mtimeMs,
        monthKey: raw.monthKey || (raw.createdAt ? raw.createdAt.slice(0, 7) : ""),
        type: raw.type || "manual",
        triggeredBy: raw.triggeredBy || "system",
        sizeBytes: stat.size,
        stats: raw.stats || { totalDocuments: 0, collections: {} },
      });
    } catch {
      // ignorar archivos malformados
    }
  }

  return list.sort((a, b) => b.timestamp - a.timestamp);
}

// Verificador automático para el Día 1 de cada mes
let isRunningAutoBackup = false;
async function checkAndRunMonthlyBackup() {
  if (isRunningAutoBackup) return;
  try {
    isRunningAutoBackup = true;
    const now = new Date();
    const currentMonthKey = getMonthKey(now);
    const existingBackups = listLocalBackups();

    // Verificar si ya existe un respaldo mensual automático para el mes actual
    const hasMonthlyForCurrentMonth = existingBackups.some(
      (b) => b.monthKey === currentMonthKey && b.type === "mensual-automatico"
    );

    // Ejecutar automáticamente el día 1 de cada mes (o si aún no existe ningún respaldo del mes en curso)
    if (!hasMonthlyForCurrentMonth && (now.getDate() === 1 || existingBackups.length === 0)) {
      console.log(`🗓️ Ejecutando copia de seguridad mensual automática para ${currentMonthKey}...`);
      await createDatabaseBackup("mensual-automatico", "cron-mensual-dia-1");
    }
  } catch (err) {
    console.error("⚠️ Error en el programador de respaldo mensual:", err.message);
  } finally {
    isRunningAutoBackup = false;
  }
}

// Revisar al iniciar el servidor y luego cada 1 hora (para detectar el cambio al día 1 del mes)
setTimeout(checkAndRunMonthlyBackup, 3000);
setInterval(checkAndRunMonthlyBackup, 60 * 60 * 1000);

// Endpoints de Respaldos para el Panel Admin
app.get("/api/backups", requireAdminAuth, (_req, res) => {
  const backups = listLocalBackups();
  res.json({
    backups,
    schedule: {
      enabled: true,
      frequency: "Día 1 de cada mes (Automático)",
      nextBackupDate: getNextFirstOfMonthISO(),
      currentMonthKey: getMonthKey(),
    },
  });
});

app.post(
  "/api/backups/create",
  strictAdminLimiter,
  requireAdminAuth,
  async (req, res) => {
    try {
      const backupType = req.body?.type === "mensual-automatico" ? "mensual-automatico" : "manual";
      const meta = await createDatabaseBackup(backupType, req.adminUser?.email || "admin");
      return res.json({ ok: true, backup: meta });
    } catch (err) {
      console.error("Error creando respaldo:", err.message);
      return res.status(500).json({ error: "No se pudo crear la copia de seguridad" });
    }
  }
);

app.get("/api/backups/download/:filename", requireAdminAuth, (req, res) => {
  const safeName = path.basename(req.params.filename || "");
  if (!safeName.endsWith(".json") || !safeName.startsWith("backup-")) {
    return res.status(400).json({ error: "Nombre de respaldo inválido" });
  }
  const targetPath = path.resolve(backupsDir, safeName);
  if (!targetPath.startsWith(path.resolve(backupsDir)) || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: "Archivo de respaldo no encontrado" });
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  return res.sendFile(targetPath);
});

app.delete("/api/backups/:filename", strictAdminLimiter, requireAdminAuth, async (req, res) => {
  const safeName = path.basename(req.params.filename || "");
  if (!safeName.endsWith(".json") || !safeName.startsWith("backup-")) {
    return res.status(400).json({ error: "Nombre de respaldo inválido" });
  }
  const targetPath = path.resolve(backupsDir, safeName);
  if (!targetPath.startsWith(path.resolve(backupsDir)) || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: "Archivo de respaldo no encontrado" });
  }
  const backupId = path.basename(safeName, ".json");
  await fs.promises.unlink(targetPath);
  try {
    await deleteDoc(doc(db, "backups_meta", backupId));
  } catch {
    // ignore
  }
  return res.json({ ok: true, deleted: safeName });
});

// ============================================================================
// 7. ARCHIVOS ESTÁTICOS (/uploads y SPA React) CON PROTECCIÓN PATH TRAVERSAL
// ============================================================================
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "30d",
    etag: true,
  })
);

app.get("/uploads/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename || "");
  const parsed = path.parse(safeFilename);
  const candidates = [".webp", ".jpg", ".jpeg", ".png", ".gif"].map((ext) =>
    path.resolve(uploadsDir, `${parsed.name}${ext}`)
  );
  const resolvedUploadsDir = path.resolve(uploadsDir);
  for (const candidate of candidates) {
    if (candidate.startsWith(resolvedUploadsDir) && fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }
  return res.status(404).send("Imagen no encontrada");
});

const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

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
  console.log(`🚀 Servidor seguro de la tienda activo en http://localhost:${PORT}`);
  console.log(`📁 Carpeta de imágenes locales: ${uploadsDir}`);
  console.log(`💾 Carpeta de respaldos de BD: ${backupsDir}`);
});
