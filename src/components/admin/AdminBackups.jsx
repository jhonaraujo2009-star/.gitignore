import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../../config/firebase";
import { useApp } from "../../context/AppContext";
import { getAdminAuthHeader } from "../../utils/cloudinaryUpload";
import toast from "react-hot-toast";

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

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatDateES(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function AdminBackups() {
  const { serverOnline } = useApp();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Calcular fecha del próximo día 1 del mes
  const now = new Date();
  const nextFirstOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthFormatted = nextFirstOfMonth.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 1. Escuchar metadatos de respaldos en Firestore (funciona 24/7 aunque la PC esté apagada)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "backups_meta"),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setBackups(docs);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Si el servidor local está encendido, sincronizar también con /api/backups
  const syncWithLocalServer = useCallback(async () => {
    if (!serverOnline) return;
    try {
      const headers = await getAdminAuthHeader();
      const res = await fetch("/api/backups", { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.backups) && data.backups.length > 0) {
          setBackups((prev) => {
            const map = new Map();
            for (const b of prev) map.set(b.id, b);
            for (const b of data.backups) map.set(b.id, b);
            return Array.from(map.values()).sort(
              (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
            );
          });
        }
      }
    } catch {
      // fallback silencioso a Firestore
    }
  }, [serverOnline]);

  useEffect(() => {
    syncWithLocalServer();
  }, [syncWithLocalServer]);

  // 3. Crear copia de seguridad ahora mismo (con permisos completos de Admin en Firebase)
  const handleCreateBackup = async (backupType = "manual", silent = false) => {
    setCreating(true);
    const toastId = !silent ? toast.loading("Creando copia de seguridad de Firebase...") : null;
    try {
      const dNow = new Date();
      const y = dNow.getFullYear();
      const m = String(dNow.getMonth() + 1).padStart(2, "0");
      const d = String(dNow.getDate()).padStart(2, "0");
      const hh = String(dNow.getHours()).padStart(2, "0");
      const mm = String(dNow.getMinutes()).padStart(2, "0");
      const ss = String(dNow.getSeconds()).padStart(2, "0");

      const backupId = `backup-${y}-${m}-${d}_${hh}-${mm}-${ss}`;
      const filename = `${backupId}.json`;

      const data = {};
      const collectionCounts = {};
      let totalDocuments = 0;

      for (const colName of FIRESTORE_COLLECTIONS) {
        const snap = await getDocs(collection(db, colName));
        const docs = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        data[colName] = docs;
        collectionCounts[colName] = docs.length;
        totalDocuments += docs.length;
      }

      const payload = {
        id: backupId,
        filename,
        projectId: "tiendajhonaraujo",
        createdAt: dNow.toISOString(),
        timestamp: dNow.getTime(),
        monthKey: `${y}-${m}`,
        type: typeof backupType === "string" ? backupType : "manual",
        triggeredBy: auth.currentUser?.email || "admin",
        stats: {
          totalDocuments,
          collections: collectionCounts,
        },
        data,
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const sizeBytes = new Blob([jsonStr]).size;
      payload.sizeBytes = sizeBytes;

      await setDoc(doc(db, "backups_meta", backupId), {
        id: backupId,
        filename,
        createdAt: payload.createdAt,
        timestamp: payload.timestamp,
        monthKey: payload.monthKey,
        type: payload.type,
        triggeredBy: payload.triggeredBy,
        sizeBytes,
        stats: payload.stats,
      });

      if (serverOnline) {
        // Guardar también en el disco duro de la PC (/backups)
        const headers = await getAdminAuthHeader();
        const res = await fetch("/api/backups/create", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ payload }),
        });

        if (res.ok) {
          if (!silent) {
            toast.success(
              `✅ Copia de seguridad guardada en PC y Firebase (${totalDocuments} registros)`,
              { id: toastId }
            );
          }
          await syncWithLocalServer();
          return;
        }
      }

      // Si la PC está apagada, descargar copia inmediatamente al dispositivo
      if (!silent) {
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(
          `✅ Copia de seguridad creada y descargada (${totalDocuments} registros)`,
          { id: toastId }
        );
      }
    } catch (err) {
      if (!silent) {
        toast.error(err.message || "Error al crear copia de seguridad", { id: toastId });
      }
    } finally {
      setCreating(false);
    }
  };

  // 4. Descargar un archivo de respaldo (.JSON)
  const handleDownloadBackup = async (backup) => {
    setDownloadingId(backup.id);
    try {
      if (serverOnline && backup.filename) {
        const headers = await getAdminAuthHeader();
        const res = await fetch(
          `/api/backups/download/${encodeURIComponent(backup.filename)}`,
          { headers }
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = backup.filename;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("📥 Respaldo descargado");
          return;
        }
      }

      // Fallback: exportar en vivo desde Firestore si el archivo físico está en la PC apagada
      toast.loading("Generando archivo desde Firebase...", { id: "dl-fb" });
      const data = {};
      for (const colName of FIRESTORE_COLLECTIONS) {
        const snap = await getDocs(collection(db, colName));
        data[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob(
        [JSON.stringify({ ...backup, data }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.filename || `${backup.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("📥 Respaldo descargado desde Firebase", { id: "dl-fb" });
    } catch {
      toast.error("No se pudo descargar el respaldo", { id: "dl-fb" });
    } finally {
      setDownloadingId(null);
    }
  };

  // 5. Eliminar un respaldo antiguo
  const handleDeleteBackup = async (backup) => {
    if (!confirm(`¿Eliminar el respaldo ${backup.filename || backup.id}?`)) return;
    try {
      if (serverOnline && backup.filename) {
        const headers = await getAdminAuthHeader();
        await fetch(`/api/backups/${encodeURIComponent(backup.filename)}`, {
          method: "DELETE",
          headers,
        });
      }
      await deleteDoc(doc(db, "backups_meta", backup.id));
      toast.success("Respaldo eliminado");
    } catch {
      toast.error("Error al eliminar respaldo");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Cabecera y Estado del Programador Automático */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-black text-gray-900">
                💾 Copias de Seguridad (Firebase Database)
              </h2>
              <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Auto-Backup Mensual Activo
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              El sistema realiza automáticamente una copia completa de toda la base de datos de{" "}
              <strong>Firebase Firestore</strong> (productos, pedidos, clientes, facturas, pagos y configuración) el{" "}
              <strong>día 1 de cada mes</strong>.
            </p>
          </div>

          <button
            onClick={() => handleCreateBackup("manual")}
            disabled={creating}
            className="px-5 py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-wider shadow-lg hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
            style={{ background: "var(--primary)" }}
          >
            <span>{creating ? "⏳" : "➕"}</span>
            <span>{creating ? "Respaldando..." : "Crear Respaldo Ahora"}</span>
          </button>
        </div>

        {/* Tarjetas informativas del ciclo de respaldo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
              Frecuencia Automática
            </span>
            <span className="text-sm font-black text-gray-800 mt-1 block">
              🗓️ Día 1 de cada mes
            </span>
          </div>

          <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
              Próximo Respaldo Automático
            </span>
            <span className="text-sm font-black text-pink-600 mt-1 block capitalize">
              ⏳ {nextMonthFormatted}
            </span>
          </div>

          <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
              Respaldos Disponibles
            </span>
            <span className="text-sm font-black text-emerald-700 mt-1 block">
              ✅ {backups.length} {backups.length === 1 ? "copia guardada" : "copias guardadas"}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Respaldos Disponibles */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center justify-between">
          <span>📂 Historial de Respaldos Disponibles</span>
          <span className="text-xs font-semibold text-gray-400">
            Guardados en PC (/backups) y registrados en Firebase
          </span>
        </h3>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400 font-semibold animate-pulse">
            Cargando respaldos de la base de datos...
          </div>
        ) : backups.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-3xl">📦</p>
            <p className="text-sm font-bold text-gray-600">
              Aún no hay copias de seguridad listadas.
            </p>
            <p className="text-xs text-gray-400">
              Pulsa el botón &ldquo;Crear Respaldo Ahora&rdquo; arriba para generar una copia inmediata.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((b) => {
              const cols = b.stats?.collections || {};
              const isMonthly = b.type === "mensual-automatico";

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-gray-50/80 hover:bg-gray-50 border border-gray-200/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs sm:text-sm text-gray-900 truncate">
                        {b.filename || `${b.id}.json`}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isMonthly
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isMonthly ? "🗓️ Mensual Automático" : "👤 Manual / Inmediato"}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-gray-200/80 text-gray-700 text-[10px] font-bold">
                        {formatBytes(b.sizeBytes)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 font-medium flex items-center gap-3 flex-wrap">
                      <span>🕒 {formatDateES(b.createdAt)}</span>
                      <span>•</span>
                      <span className="font-bold text-gray-700">
                        📊 {b.stats?.totalDocuments || 0} documentos en total
                      </span>
                    </div>

                    {/* Desglose por colecciones */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {cols.products !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-600">
                          📦 {cols.products} productos
                        </span>
                      )}
                      {cols.sessions !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-600">
                          📂 {cols.sessions} sesiones
                        </span>
                      )}
                      {cols.orders !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-600">
                          🛍️ {cols.orders} pedidos
                        </span>
                      )}
                      {cols.invoices !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-600">
                          🧾 {cols.invoices} facturas
                        </span>
                      )}
                      {cols.payments !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-600">
                          🏦 {cols.payments} métodos pago
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownloadBackup(b)}
                      disabled={downloadingId === b.id}
                      className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span>⬇️</span>
                      <span>
                        {downloadingId === b.id ? "Descargando..." : "Descargar .JSON"}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(b)}
                      className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 text-xs font-bold transition-colors"
                      title="Eliminar respaldo"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
