import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  apiKey: "AIzaSyD5iVtSrxvJpZEsjS1YvaRg3B6D2WHjXzY",
  authDomain: "tiendajhonaraujo.firebaseapp.com",
  projectId: "tiendajhonaraujo",
  storageBucket: "tiendajhonaraujo.firebasestorage.app",
  messagingSenderId: "48382191900",
  appId: "1:48382191900:web:08c651b3c3137e153572d9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const uploadsDir = path.join(__dirname, "uploads");

const applyChanges = process.argv.includes("--apply");
const domainArg = process.argv.find((a) => a.startsWith("--domain="));
const baseDomain = domainArg ? domainArg.split("=")[1].replace(/\/$/, "") : "";

// 1. Indexar archivos locales por MD5 desde _zip1, _zip2 y uploads
function buildMd5Index() {
  const md5Map = new Map();
  const dirsToScan = [
    path.join(uploadsDir, "_zip1"),
    path.join(uploadsDir, "_zip2"),
    uploadsDir,
  ];

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith(".zip")) continue;
      const fullPath = path.join(dir, entry.name);
      const buf = fs.readFileSync(fullPath);
      const md5 = crypto.createHash("md5").update(buf).digest("hex");
      if (!md5Map.has(md5)) {
        md5Map.set(md5, fullPath);
      }
    }
  }
  return md5Map;
}

async function resolveAndMaterializeUrl(cloudinaryUrl, md5Map) {
  try {
    const parsedUrl = new URL(cloudinaryUrl);
    const targetFilename = decodeURIComponent(path.basename(parsedUrl.pathname));
    const targetPath = path.join(uploadsDir, targetFilename);
    const publicUrl = `${baseDomain}/uploads/${targetFilename}`;

    if (fs.existsSync(targetPath)) {
      return { status: "already_exists", url: publicUrl };
    }

    // Consultar ETag (MD5) en Cloudinary para emparejar con el archivo local del ZIP
    const headRes = await fetch(cloudinaryUrl, { method: "HEAD" });
    if (headRes.ok) {
      const etag = (headRes.headers.get("etag") || "").replace(/"/g, "");
      if (etag && md5Map.has(etag)) {
        const localSource = md5Map.get(etag);
        fs.copyFileSync(localSource, targetPath);
        return { status: "matched_zip", url: publicUrl };
      }
    }

    // Si no estaba en los ZIPs locales, descargarlo directamente de Cloudinary
    const getRes = await fetch(cloudinaryUrl);
    if (getRes.ok) {
      const buf = Buffer.from(await getRes.arrayBuffer());
      fs.writeFileSync(targetPath, buf);
      return { status: "downloaded", url: publicUrl };
    }

    return { status: "missing", url: cloudinaryUrl };
  } catch (err) {
    console.warn(`⚠️ Error procesando ${cloudinaryUrl}:`, err.message);
    return { status: "missing", url: cloudinaryUrl };
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

async function run() {
  console.log("🗂️ Indexando archivos locales de los archivos ZIP por hash MD5...");
  const md5Map = buildMd5Index();
  console.log(`✅ Archivos únicos indexados localmente: ${md5Map.size}`);

  console.log("📥 Leyendo documentos de Firestore...");
  const productsSnap = await getDocs(collection(db, "products"));
  const settingsRef = doc(db, "config", "settings");
  const settingsSnap = await getDoc(settingsRef);
  const paymentsSnap = await getDocs(collection(db, "payments"));
  const logisticsSnap = await getDocs(collection(db, "logistics"));

  // Recolectar todas las URLs de Cloudinary únicas
  const uniqueUrls = new Set();
  const backupData = {
    timestamp: new Date().toISOString(),
    products: {},
    settings: settingsSnap.exists() ? settingsSnap.data() : null,
  };

  for (const d of productsSnap.docs) {
    const data = d.data();
    backupData.products[d.id] = { images: data.images, image: data.image };
    if (Array.isArray(data.images)) {
      data.images.forEach((u) => {
        if (typeof u === "string" && u.includes("res.cloudinary.com")) uniqueUrls.add(u);
      });
    }
    if (typeof data.image === "string" && data.image.includes("res.cloudinary.com")) {
      uniqueUrls.add(data.image);
    }
  }

  if (settingsSnap.exists()) {
    const s = settingsSnap.data();
    if (typeof s.profileImage === "string" && s.profileImage.includes("res.cloudinary.com")) {
      uniqueUrls.add(s.profileImage);
    }
    if (Array.isArray(s.happyCustomerImages)) {
      s.happyCustomerImages.forEach((u) => {
        if (typeof u === "string" && u.includes("res.cloudinary.com")) uniqueUrls.add(u);
      });
    }
    if (s.customIcons && typeof s.customIcons === "object") {
      Object.values(s.customIcons).forEach((u) => {
        if (typeof u === "string" && u.includes("res.cloudinary.com")) uniqueUrls.add(u);
      });
    }
  }

  // Guardar respaldo de URLs originales antes de modificar
  const backupPath = path.join(__dirname, "firestore_urls_backup.json");
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`💾 Respaldo de URLs originales guardado en: ${backupPath}`);
  }

  const urlList = Array.from(uniqueUrls);
  console.log(`🔍 Procesando ${urlList.length} URLs únicas de Cloudinary...`);

  const urlResolutionMap = new Map();
  let matchedZip = 0;
  let downloaded = 0;
  let alreadyExists = 0;
  let missing = 0;

  await runPool(urlList, 30, async (u, i) => {
    const res = await resolveAndMaterializeUrl(u, md5Map);
    urlResolutionMap.set(u, res.url);
    if (res.status === "matched_zip") matchedZip++;
    else if (res.status === "downloaded") downloaded++;
    else if (res.status === "already_exists") alreadyExists++;
    else missing++;

    if ((i + 1) % 200 === 0 || i + 1 === urlList.length) {
      console.log(`   Progreso: ${i + 1}/${urlList.length} (ZIP: ${matchedZip}, Descargadas: ${downloaded}, Existentes: ${alreadyExists}, Faltantes: ${missing})`);
    }
  });

  if (applyChanges) {
    console.log("✍️ Actualizando documentos en Firestore...");
    let updatedProductsCount = 0;

    await runPool(productsSnap.docs, 20, async (productDoc) => {
      const data = productDoc.data();
      let changed = false;
      const updates = {};

      if (Array.isArray(data.images)) {
        const newImgs = data.images.map((u) => {
          if (urlResolutionMap.has(u) && urlResolutionMap.get(u) !== u) {
            changed = true;
            return urlResolutionMap.get(u);
          }
          return u;
        });
        if (changed) updates.images = newImgs;
      }

      if (typeof data.image === "string" && urlResolutionMap.has(data.image)) {
        const newImg = urlResolutionMap.get(data.image);
        if (newImg !== data.image) {
          updates.image = newImg;
          changed = true;
        }
      }

      if (changed) {
        await updateDoc(doc(db, "products", productDoc.id), updates);
        updatedProductsCount++;
      }
    });

    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      const sUpdates = {};
      let sChanged = false;

      if (typeof s.profileImage === "string" && urlResolutionMap.has(s.profileImage)) {
        sUpdates.profileImage = urlResolutionMap.get(s.profileImage);
        sChanged = true;
      }
      if (Array.isArray(s.happyCustomerImages)) {
        const newHappy = s.happyCustomerImages.map((u) => urlResolutionMap.get(u) || u);
        if (JSON.stringify(newHappy) !== JSON.stringify(s.happyCustomerImages)) {
          sUpdates.happyCustomerImages = newHappy;
          sChanged = true;
        }
      }
      if (s.customIcons && typeof s.customIcons === "object") {
        const newIcons = { ...s.customIcons };
        for (const [k, v] of Object.entries(newIcons)) {
          if (urlResolutionMap.has(v)) {
            newIcons[k] = urlResolutionMap.get(v);
            sChanged = true;
          }
        }
        if (sChanged) sUpdates.customIcons = newIcons;
      }
      if (sChanged) {
        await setDoc(settingsRef, sUpdates, { merge: true });
        console.log("✅ Configuración (config/settings) actualizada en Firestore.");
      }
    }

    console.log(`✅ Productos actualizados en Firestore: ${updatedProductsCount}`);
  }

  console.log("\n==========================================");
  console.log("📊 RESUMEN FINAL DE MIGRACIÓN DE IMÁGENES:");
  console.log(`   - Total URLs únicas procesadas: ${urlList.length}`);
  console.log(`   - Emparejadas desde ZIP local:  ${matchedZip}`);
  console.log(`   - Descargadas desde Cloudinary: ${downloaded}`);
  console.log(`   - Ya existían en /uploads:      ${alreadyExists}`);
  console.log(`   - No encontradas / error:       ${missing}`);
  console.log("==========================================\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
