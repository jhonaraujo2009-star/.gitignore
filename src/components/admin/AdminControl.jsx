import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs,
  orderBy, query, serverTimestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import toast from "react-hot-toast";

// ==========================================
// ADMIN CONTROL — Gestión Rápida de Inventario
// ==========================================

export default function AdminControl() {
  const [products, setProducts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({ name: "", price: "", stock: "", sessionId: "", image: "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Search
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef(null);

  // New session creation
  const [newSessionName, setNewSessionName] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);

  // Load products & sessions (real-time)
  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubSessions = onSnapshot(
      query(collection(db, "sessions"), orderBy("order")),
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubProducts(); unsubSessions(); };
  }, []);

  // Create new session inline
  const createSession = async () => {
    if (!newSessionName.trim()) return;
    setCreatingSession(true);
    try {
      const docRef = await addDoc(collection(db, "sessions"), {
        name: newSessionName.trim(),
        slug: newSessionName.trim().toLowerCase().replace(/\s+/g, "-"),
        hidden: false,
        order: sessions.length,
        createdAt: serverTimestamp(),
      });
      setForm((prev) => ({ ...prev, sessionId: docRef.id }));
      setNewSessionName("");
      toast.success(`Sección "${newSessionName.trim()}" creada ✅`);
    } catch {
      toast.error("Error al crear sección");
    } finally {
      setCreatingSession(false);
    }
  };

  // Image upload to Cloudinary
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "tienda_maquillaje");
      const res = await fetch("https://api.cloudinary.com/v1_1/dp3abweme/image/upload", {
        method: "POST", body: formData
      });
      const data = await res.json();
      setForm((prev) => ({ ...prev, image: data.secure_url }));
      toast.success("Imagen subida ✅");
    } catch {
      toast.error("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => setForm((prev) => ({ ...prev, image: "" }));

  // Save product (create or update)
  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        totalStock: parseInt(form.stock) || 0,
        sessionId: form.sessionId || "",
        images: form.image ? [form.image] : [],
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), data);
        toast.success("Producto actualizado ✅");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "products"), {
          ...data,
          description: "",
          oldPrice: null,
          variants: [],
          offerDiscount: null,
          offerEndsAt: null,
          salesCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("Producto creado ✅");
      }
      resetForm();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ name: "", price: "", stock: "", sessionId: "", image: "" });
    setEditingId(null);
  };

  // Edit product — populate form
  const startEdit = (p) => {
    setForm({
      name: p.name || "",
      price: p.price?.toString() || "",
      stock: (p.variants?.length
        ? p.variants.reduce((s, v) => s + (v.stock || 0), 0)
        : p.totalStock ?? 0
      ).toString(),
      sessionId: p.sessionId || "",
      image: p.images?.[0] || "",
    });
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete product
  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      toast.success("Producto eliminado");
      if (editingId === id) resetForm();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  // Search filter
  const filteredProducts = searchTerm.trim()
    ? products.filter((p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const getSessionName = (sessionId) => {
    const s = sessions.find((s) => s.id === sessionId);
    return s ? s.name : "";
  };

  const getStock = (p) => {
    if (p.variants?.length) return p.variants.reduce((s, v) => s + (v.stock || 0), 0);
    return p.totalStock ?? 0;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            🎛️ Control Rápido
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            Gestión simplificada de inventario
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
          <span className="text-xs font-black text-gray-500">{products.length}</span>
          <span className="text-[10px] text-gray-400 font-bold uppercase">productos</span>
        </div>
      </div>

      {/* ==========================================
          FORMULARIO DE CREACIÓN/EDICIÓN RÁPIDA
         ========================================== */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        {/* Form Header */}
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner"
              style={{ background: editingId ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
              {editingId ? "✏️" : "➕"}
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-sm">
                {editingId ? "Editando Producto" : "Agregar Producto"}
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {editingId ? "Modifica los campos y guarda" : "Completa los campos para crear"}
              </p>
            </div>
          </div>
          {editingId && (
            <button onClick={resetForm}
              className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 transition-all">
              ✕ Cancelar
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Row 1: Nombre */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Nombre del producto *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Labial MAC Ruby, Truly Lemonade..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-50 transition-all placeholder:text-gray-300"
            />
          </div>

          {/* Row 2: Precio + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                Precio (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-black text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-green-50 border border-green-100 rounded-2xl pl-8 pr-4 py-3 text-sm font-black text-green-700 outline-none focus:border-green-300 focus:ring-4 focus:ring-green-50 transition-all placeholder:text-green-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                Stock
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-sm">📦</span>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="0"
                  className="w-full bg-blue-50 border border-blue-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-black text-blue-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-blue-300"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Sesión (Opcional) + Crear nueva */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Sección / Categoría <span className="text-gray-300">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={form.sessionId}
                onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50 transition-all appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
              >
                <option value="">Sin categoría</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <input
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createSession()}
                  placeholder="Nueva sección..."
                  className="w-36 sm:w-44 bg-purple-50 border border-purple-100 rounded-2xl px-3 py-3 text-sm font-semibold text-purple-700 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50 transition-all placeholder:text-purple-300"
                />
                <button
                  onClick={createSession}
                  disabled={creatingSession || !newSessionName.trim()}
                  className="h-[46px] px-4 rounded-2xl text-white text-sm font-black disabled:opacity-40 transition-all active:scale-95 flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                  title="Crear nueva sección"
                >
                  {creatingSession ? "..." : "+"}
                </button>
              </div>
            </div>
          </div>

          {/* Row 4: Imagen (Opcional) */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Imagen <span className="text-gray-300">(opcional)</span>
            </label>
            {form.image ? (
              <div className="relative inline-block">
                <img src={form.image} alt="" className="w-20 h-20 object-cover rounded-2xl border-2 border-purple-200 shadow-sm" />
                <button onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-3 hover:border-purple-300 hover:bg-purple-50/30 transition-all group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                  {uploading ? "⏳" : "📷"}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 group-hover:text-purple-600 transition-colors">
                    {uploading ? "Subiendo imagen..." : "Subir imagen del producto"}
                  </p>
                  <p className="text-[10px] text-gray-400">JPG, PNG — Max 5MB</p>
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || uploading || !form.name.trim() || !form.price}
            className="w-full py-4 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: editingId
                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                : "linear-gradient(135deg, #7c3aed, #6d28d9)"
            }}
          >
            {saving ? (
              <span className="animate-pulse">Guardando...</span>
            ) : editingId ? (
              <>🔄 Actualizar Producto</>
            ) : (
              <>✨ Crear Producto</>
            )}
          </button>
        </div>
      </div>

      {/* ==========================================
          BUSCADOR DE PRODUCTOS
         ========================================== */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner"
              style={{ background: "linear-gradient(135deg, #60a5fa, #3b82f6)" }}>
              🔍
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-sm">Buscar Productos</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Busca, edita o elimina desde aquí
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-400 text-base">🔎</span>
            </div>
            <input
              ref={searchRef}
              type="text"
              placeholder="Escribe para buscar... ej: truly, labial, crema"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {searchTerm.trim() ? (
            filteredProducts.length === 0 ? (
              <div className="py-12 text-center">
                <span className="text-4xl block mb-3">🕵️‍♂️</span>
                <p className="text-sm font-bold text-gray-400">
                  No se encontró nada para "<span className="text-gray-600">{searchTerm}</span>"
                </p>
                <p className="text-[10px] text-gray-300 mt-1 font-semibold">Intenta con otro nombre</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-2 bg-blue-50/50 border-b border-blue-100/50">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    {filteredProducts.length} resultado{filteredProducts.length !== 1 ? "s" : ""} encontrado{filteredProducts.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredProducts.map((p) => {
                    const stock = getStock(p);
                    const sessionName = getSessionName(p.sessionId);
                    const isEditing = editingId === p.id;

                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 px-5 py-4 transition-all ${
                          isEditing
                            ? "bg-amber-50 border-l-4 border-amber-400"
                            : "hover:bg-gray-50/50"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm border border-gray-100">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center h-full text-gray-300 text-lg">🖼️</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate flex items-center gap-1.5">
                            {p.name}
                            {isEditing && (
                              <span className="px-1.5 py-0.5 bg-amber-200 text-amber-700 text-[8px] rounded-md font-black uppercase">
                                editando
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs font-black text-green-600">${p.price}</span>
                            <span className="text-gray-200">•</span>
                            <span className={`text-[10px] font-bold ${stock > 0 ? "text-blue-500" : "text-red-400"}`}>
                              {stock > 0 ? `${stock} en stock` : "Sin stock"}
                            </span>
                            {sessionName && (
                              <>
                                <span className="text-gray-200">•</span>
                                <span className="text-[10px] font-semibold text-purple-400 bg-purple-50 px-1.5 py-0.5 rounded-md">
                                  {sessionName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => startEdit(p)}
                            className="p-2.5 rounded-xl bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50 transition-all text-sm"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-2.5 rounded-xl bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all text-sm"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            <div className="py-10 text-center">
              <span className="text-4xl block mb-2 opacity-50">⌨️</span>
              <p className="text-xs font-bold text-gray-400">
                Escribe algo para buscar productos
              </p>
              <p className="text-[10px] text-gray-300 mt-1 font-semibold">
                Los resultados aparecerán aquí
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
