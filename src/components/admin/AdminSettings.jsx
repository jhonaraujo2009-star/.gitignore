import { useState } from "react";
import { useApp } from "../../context/AppContext";
import toast from "react-hot-toast";

export default function AdminSettings() {
  const { settings, updateSettings } = useApp();
  
  const [form, setForm] = useState({
    exchangeRate: settings.exchangeRate || "",
    whatsappNumber: settings.whatsappNumber || "",
    primaryColor: settings.primaryColor || "#ec4899",
    quickButtons: settings.quickButtons || [
      { id: 'cat', label: 'Catálogo', icon: '🛍️', filter: 'all' },
      { id: 'ofertas', label: 'Ofertas', icon: '🔥', filter: 'ofertas' },
      { id: 'top', label: 'Top Ventas', icon: '🏆', filter: 'top' },
      { id: 'new', label: 'Lo Último', icon: '✨', filter: 'new' }
    ],
    socialLinks: settings.socialLinks || { instagram: "", tiktok: "", whatsapp: "" },
    customIcons: settings.customIcons || { whatsapp: "", instagram: "", tiktok: "" }
  });

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);

  const updateButton = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      quickButtons: prev.quickButtons.map(b => b.id === id ? { ...b, [field]: value } : b)
    }));
  };

  const handleUpload = async (e, type, category) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(type);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "tienda_maquillaje"); 
    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dp3abweme/image/upload", { method: "POST", body: formData });
      const data = await res.json();
      setForm(prev => ({ ...prev, [category]: { ...prev[category], [type]: data.secure_url } }));
      toast.success("Logo subido con éxito");
    } catch {
      toast.error("Error al subir");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ ...form, exchangeRate: parseFloat(form.exchangeRate) || 0 });
      toast.success("Sistema Sincronizado ✅");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24 space-y-8 max-w-md mx-auto p-4">

      {/* FINANZAS - CAMPO RESTAURADO */}
      <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Finanzas</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">Tasa de Cambio (Bs. por $1)</label>
          <input 
            type="number" 
            step="0.01" 
            value={form.exchangeRate} 
            onChange={(e) => setForm({...form, exchangeRate: e.target.value})} 
            placeholder="Ej: 36.50" 
            className="w-full bg-pink-50 border border-pink-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-pink-400 font-bold text-pink-600" 
          />
        </div>
      </div>
      
      {/* BOTONES VIP */}
      <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Interfaz de Botones</h3>
        <div className="space-y-4">
          {form.quickButtons.map((btn) => (
            <div key={btn.id} className="flex gap-3 bg-gray-50/50 p-3 rounded-3xl border border-gray-100 transition-all focus-within:ring-2 focus-within:ring-pink-100">
              <input value={btn.icon} onChange={(e) => updateButton(btn.id, 'icon', e.target.value)} className="w-14 text-2xl text-center bg-white rounded-2xl shadow-sm outline-none" />
              <input value={btn.label} onChange={(e) => updateButton(btn.id, 'label', e.target.value)} className="flex-1 bg-transparent px-2 text-sm font-bold text-gray-800 outline-none uppercase tracking-wider" />
            </div>
          ))}
        </div>
      </div>

      {/* MEDIA Y REDES */}
      <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white space-y-8">
        <div>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Redes Sociales</h3>
          <div className="grid grid-cols-3 gap-3">
            {['whatsapp', 'instagram', 'tiktok'].map((social) => (
              <label key={social} className="group flex flex-col items-center gap-3 cursor-pointer bg-gray-50/50 p-3 rounded-3xl border border-gray-100 hover:bg-pink-50/30 transition-all">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                  {form.customIcons[social] ? <img src={form.customIcons[social]} className="w-full h-full object-contain" /> : <span className="text-xl">📸</span>}
                </div>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{uploading === social ? "..." : social}</span>
                <input type="file" className="hidden" onChange={(e) => handleUpload(e, social, 'customIcons')} />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ENLACES Y DATOS BÁSICOS */}
      <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Enlaces de Redes</h3>
        <input type="text" value={form.socialLinks.whatsapp} onChange={(e) => setForm({...form, socialLinks: {...form.socialLinks, whatsapp: e.target.value}})} placeholder="Link WhatsApp (wa.me/...)" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none" />
        <input type="text" value={form.socialLinks.instagram} onChange={(e) => setForm({...form, socialLinks: {...form.socialLinks, instagram: e.target.value}})} placeholder="Link Instagram" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none" />
        <input type="text" value={form.socialLinks.tiktok} onChange={(e) => setForm({...form, socialLinks: {...form.socialLinks, tiktok: e.target.value}})} placeholder="Link TikTok" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none" />
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.3em] shadow-[0_10px_40px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-95 transition-all" style={{ background: form.primaryColor || '#ec4899' }}>
        {saving ? "Procesando..." : "Actualizar Sistema"}
      </button>
    </div>
  );
}