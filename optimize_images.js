import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "uploads");

// Desactivar caché de sharp para no bloquear archivos en Windows
sharp.cache(false);

async function optimizeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return { skipped: true, savedBytes: 0, before: 0, after: 0 };
  }

  try {
    const originalBuffer = await fs.promises.readFile(filePath);
    const beforeSize = originalBuffer.length;

    let pipeline = sharp(originalBuffer)
      .rotate() // Respeta la orientación EXIF de fotos tomadas con celular
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      });

    if (ext === ".jpg" || ext === ".jpeg") {
      pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    } else if (ext === ".webp") {
      pipeline = pipeline.webp({ quality: 82 });
    } else if (ext === ".png") {
      pipeline = pipeline.png({ quality: 82, compressionLevel: 9, palette: true });
    }

    const optimizedBuffer = await pipeline.toBuffer();
    const afterSize = optimizedBuffer.length;

    // Solo reemplazar si el archivo optimizado pesa menos que el original
    if (afterSize < beforeSize) {
      await fs.promises.writeFile(filePath, optimizedBuffer);
      return {
        skipped: false,
        savedBytes: beforeSize - afterSize,
        before: beforeSize,
        after: afterSize,
      };
    }

    return {
      skipped: true,
      savedBytes: 0,
      before: beforeSize,
      after: beforeSize,
    };
  } catch (err) {
    console.warn(`⚠️ No se pudo optimizar ${path.basename(filePath)}: ${err.message}`);
    return { skipped: true, savedBytes: 0, before: 0, after: 0 };
  }
}

async function runPool(items, concurrency, worker) {
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const current = idx++;
      await worker(items[current], current);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  );
}

async function main() {
  const allEntries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
  const imageFiles = allEntries
    .filter((e) => e.isFile() && [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(uploadsDir, e.name));

  console.log(`🚀 Iniciando optimización HD (máx 1200px, calidad 82%) de ${imageFiles.length} imágenes en /uploads...`);

  let totalBefore = 0;
  let totalAfter = 0;
  let optimizedCount = 0;
  let skippedCount = 0;

  await runPool(imageFiles, 8, async (filePath, i) => {
    const res = await optimizeFile(filePath);
    totalBefore += res.before;
    totalAfter += res.after;
    if (res.skipped) skippedCount++;
    else optimizedCount++;

    if ((i + 1) % 250 === 0 || i + 1 === imageFiles.length) {
      const savedMB = ((totalBefore - totalAfter) / (1024 * 1024)).toFixed(1);
      console.log(
        `   Progreso: ${i + 1}/${imageFiles.length} | Optimizadas: ${optimizedCount} | Ahorrado hasta ahora: ${savedMB} MB`
      );
    }
  });

  const beforeMB = (totalBefore / (1024 * 1024)).toFixed(1);
  const afterMB = (totalAfter / (1024 * 1024)).toFixed(1);
  const savedMB = ((totalBefore - totalAfter) / (1024 * 1024)).toFixed(1);
  const percent = totalBefore > 0 ? (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1) : "0";

  console.log("\n==========================================");
  console.log("✅ OPTIMIZACIÓN HD COMPLETADA:");
  console.log(`   - Imágenes procesadas: ${imageFiles.length}`);
  console.log(`   - Imágenes reducidas:  ${optimizedCount}`);
  console.log(`   - Peso total ANTES:    ${beforeMB} MB`);
  console.log(`   - Peso total DESPUÉS:  ${afterMB} MB`);
  console.log(`   - Espacio ahorrado:    ${savedMB} MB (-${percent}%)`);
  console.log("==========================================\n");
}

main().catch((err) => {
  console.error("Error en optimización:", err);
  process.exit(1);
});
