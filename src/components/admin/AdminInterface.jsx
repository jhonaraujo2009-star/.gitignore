import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import toast from "react-hot-toast";
import { compressAndUpload } from "../../utils/cloudinaryUpload";
import SplashScreen from "../layout/SplashScreen";

export default function AdminInterface() {
  const { settings, loading, updateSettings, serverOnline } = useApp();
  const [form, setForm] = useState({
    appName: settings.appName || "Luckathys Shop",
    appShortName: settings.appShortName || "Luckathys",
    announcementText: settings.announcementText || "",
    heroTitle: settings.heroTitle || "",
    heroDescription: settings.heroDescription || "",
    legalText: settings.legalText || "",
    splashEnabled: settings.splashEnabled !== false,
    socialLinks: { ...settings.socialLinks },
  });

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingSplash, setUploadingSplash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewSplash, setPreviewSplash] = useState(false);

  useEffect(() => {
    if (!loading && settings) {
      setForm({
        appName: settings.appName || "Luckathys Shop",
        appShortName: settings.appShortName || "Luckathys",
        announcementText: settings.announcementText || "",
        heroTitle: settings.heroTitle || "",
        heroDescription: settings.heroDescription || "",
        legalText: settings.legalText || "",
        splashEnabled: settings.splashEnabled !== false,
        socialLinks: { ...settings.socialLinks },
      });
    }
  }, [loading, settings]);

  // 1. Subida de Foto de Perfil (Banner circular)
  const handleProfileImage = async (e) => {
    if (!serverOnline) {
      toast.error("⚠️ Servidor local apagado: Enciende tu PC servidor para subir fotos.");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setUploadingProfile(true);
    try {
      const url = await compressAndUpload(file);
      const finalUrl = `${url}?v=${Date.now()}`;
      await updateSettings({ profileImage: finalUrl });
      toast.success("Foto de perfil actualizada ✅");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error al subir foto de perfil");
    } finally {
      setUploadingProfile(false);
    }
  };

  // 2. Subida del Icono Simple de la Aplicación (Logo)
  const handleAppIcon = async (e) => {
    if (!serverOnline) {
      toast.error("⚠️ Servidor local apagado: Enciende tu PC servidor para subir fotos.");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const url = await compressAndUpload(file);
      const finalUrl = `${url}?v=${Date.now()}`;
      await updateSettings({ appIcon: finalUrl });
      toast.success("Icono de la aplicación actualizado ✅");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error al subir icono");
    } finally {
      setUploadingIcon(false);
    }
  };

  const removeAppIcon = async () => {
    await updateSettings({ appIcon: "" });
    toast.success("Icono eliminado");
  };

  // 3. Subida de Imagen de Bienvenida a Pantalla Completa (Tipo App Nihao)
  const handleSplashImage = async (e) => {
    if (!serverOnline) {
      toast.error("⚠️ Servidor local apagado: Enciende tu PC servidor para subir fotos.");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setUploadingSplash(true);
    try {
      const url = await compressAndUpload(file);
      const finalUrl = `${url}?v=${Date.now()}`;
      await updateSettings({ splashImage: finalUrl, splashEnabled: true });
      setForm((prev) => ({ ...prev, splashEnabled: true }));
      toast.success("Imagen de bienvenida a pantalla completa lista ✅");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error al subir imagen de bienvenida");
    } finally {
      setUploadingSplash(false);
    }
  };

  const removeSplashImage = async () => {
    await updateSettings({ splashImage: "" });
    toast.success("Imagen de bienvenida eliminada");
  };

  const toggleSplash = async () => {
    const nextVal = !form.splashEnabled;
    setForm((prev) => ({ ...prev, splashEnabled: nextVal }));
    await updateSettings({ splashEnabled: nextVal });
    toast.success(nextVal ? "Pantalla de bienvenida activada" : "Pantalla de bienvenida desactivada");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      toast.success("Interfaz actualizada ✅");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-900">🎨 Gestor de Interfaz</h2>
      </div>

      {/* 🌟 1. ICONO Y NOMBRE DE LA APLICACIÓN (APK / PWA) 🌟 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div>
          <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
            <span>📱</span> Icono y Nombre de la Aplicación (APK)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Configura el nombre y el icono que verán tus clientes en la cabecera y al instalar la app en su teléfono.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
          {/* Lado izquierdo: Inputs de Nombre e Icono */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nombre de la Aplicación (APK)
              </label>
              <input
                type="text"
                value={form.appName}
                onChange={(e) => setForm({ ...form, appName: e.target.value })}
                placeholder="Ej. Luckathys Shop"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-pink-300 focus:bg-white transition-all shadow-inner"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Es el título principal que se ve en la tienda, pestañas y al instalar la app.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nombre Corto (Debajo del Icono en el Celular)
              </label>
              <input
                type="text"
                value={form.appShortName}
                maxLength={14}
                onChange={(e) => setForm({ ...form, appShortName: e.target.value })}
                placeholder="Ej. Luckathys"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-pink-300 focus:bg-white transition-all shadow-inner"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Máximo 12-14 letras para que no se corte en la pantalla de inicio del teléfono.
              </span>
            </div>

            {/* Subida del Icono */}
            <div className="pt-1">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Icono de la App (Logo)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <label
                  className={`px-4 py-2.5 rounded-2xl border-2 border-dashed text-xs font-bold transition-all flex items-center gap-2 ${
                    serverOnline
                      ? "cursor-pointer border-pink-300 text-pink-600 hover:bg-pink-50/50"
                      : "cursor-not-allowed border-amber-300 bg-amber-50/50 text-amber-800 opacity-70"
                  }`}
                >
                  <span>{!serverOnline ? "🔒" : uploadingIcon ? "⏳" : "🖼️"}</span>
                  <span>
                    {!serverOnline
                      ? "PC Apagada (Solo Lectura)"
                      : uploadingIcon
                      ? "Subiendo icono..."
                      : settings?.appIcon
                      ? "Cambiar icono"
                      : "Subir icono de la app"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAppIcon}
                    className="hidden"
                    disabled={uploadingIcon || !serverOnline}
                  />
                </label>

                {settings?.appIcon && (
                  <button
                    type="button"
                    onClick={removeAppIcon}
                    className="px-3 py-2.5 rounded-2xl text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lado derecho: Maqueta en vivo de cómo se verá el icono y nombre en la pantalla de un teléfono */}
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-gradient-to-br from-gray-950 to-gray-800 text-white shadow-xl border border-gray-700/80">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
              Vista Previa en Pantalla de Celular
            </span>

            {/* Icono simulado en la pantalla de inicio */}
            <div className="flex flex-col items-center group cursor-pointer">
              <div className="w-20 h-20 rounded-[1.6rem] overflow-hidden bg-white shadow-2xl p-2 border-2 border-white/20 transition-transform group-hover:scale-105 flex items-center justify-center relative">
                {settings?.appIcon ? (
                  <img
                    src={settings.appIcon}
                    alt="App Icon"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-3xl">🛍️</span>
                )}
                {/* Reflejo brillante tipo cristal */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none rounded-[1.6rem]" />
              </div>

              {/* Nombre debajo del icono */}
              <span className="text-xs font-black text-white mt-2.5 tracking-tight text-center max-w-[120px] truncate drop-shadow-md">
                {form.appShortName || form.appName || "Luckathys"}
              </span>
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-4">
              Así aparecerá en la pantalla principal del teléfono del cliente al instalar tu app.
            </p>
          </div>
        </div>
      </div>

      {/* 🌟 2. IMAGEN DE BIENVENIDA A PANTALLA COMPLETA (TIPO APP NIHAO / SHEIN) 🌟 */}
      <div className="bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50 rounded-3xl p-6 shadow-sm border border-purple-100/80">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <h3 className="font-extrabold text-gray-950 text-lg">
                Pantalla de Apertura Completa (Estilo App Nihao)
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-1 max-w-lg leading-relaxed">
              Al abrir la tienda en el celular, esta imagen abarcará el <strong>100% de la pantalla del teléfono</strong> con un botón flotante para saltar o entrar directo al catálogo, tal como las apps de moda de Nihao o Shein.
            </p>
          </div>

          {/* Toggle de activación */}
          {settings?.splashImage && (
            <button
              type="button"
              onClick={toggleSplash}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm ${
                form.splashEnabled
                  ? "bg-emerald-500 text-white shadow-emerald-500/20"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <span>{form.splashEnabled ? "● Activada" : "○ Pausada"}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center mt-5">
          {/* Previsualización en marco simulado de celular */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
              Vista previa en Celular (9:16)
            </span>
            <div className="relative w-44 aspect-[9/16] rounded-[2rem] p-2 bg-gray-900 shadow-2xl border-4 border-gray-800 overflow-hidden flex flex-col justify-between">
              {/* Notcht / speaker */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-10" />

              {settings?.splashImage ? (
                <>
                  <img
                    src={settings.splashImage}
                    alt="Splash Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute top-7 right-3 z-10 bg-black/60 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
                    Saltar (5s) ✕
                  </div>
                  <div className="absolute bottom-5 left-3 right-3 z-10 bg-white/90 text-gray-900 text-[9px] font-black uppercase py-2 text-center rounded-xl shadow-lg">
                    Entrar a la tienda 🛍️
                  </div>
                </>
              ) : (
                <div className="w-full h-full rounded-2xl bg-gray-800/80 flex flex-col items-center justify-center text-center p-3 text-gray-400">
                  <span className="text-3xl mb-2">📲</span>
                  <span className="text-[10px] font-bold leading-tight">Sin imagen de apertura vertical</span>
                  <span className="text-[8px] text-gray-500 mt-1">Sube una foto vertical (ej. 1080x1920)</span>
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="space-y-4">
            <label
              className={`w-full py-4 px-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all ${
                serverOnline
                  ? "cursor-pointer border-purple-300 bg-white hover:bg-purple-50/50 shadow-sm"
                  : "cursor-not-allowed border-amber-300 bg-amber-50/50 text-amber-800 opacity-70"
              }`}
            >
              <span className="text-2xl mb-1">{!serverOnline ? "🔒" : uploadingSplash ? "⏳" : "🖼️"}</span>
              <span className="text-xs font-black text-purple-900">
                {!serverOnline
                  ? "Subida bloqueada (PC Servidor Apagada)"
                  : uploadingSplash
                  ? "Subiendo imagen vertical..."
                  : settings?.splashImage
                  ? "Cambiar imagen de apertura completa"
                  : "Subir imagen vertical (Pantalla completa)"}
              </span>
              <span className="text-[10px] text-gray-400 mt-1">Recomendado: 1080 x 1920 px (Formato teléfono)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleSplashImage}
                className="hidden"
                disabled={uploadingSplash || !serverOnline}
              />
            </label>

            {settings?.splashImage && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewSplash(true)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <span>👁️ Probar en Pantalla Completa</span>
                </button>
                <button
                  type="button"
                  onClick={removeSplashImage}
                  className="py-3 px-4 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold transition-colors"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🌟 3. FOTO DE PERFIL / BANNER CIRCULAR 🌟 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-1">Foto de Perfil Circular (Banner)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Aparece en el círculo central sobre la descripción de bienvenida.
        </p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-pink-200 shadow-sm">
            {settings.profileImage ? (
              <img src={settings.profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">✨</div>
            )}
          </div>
          <label
            className={`px-4 py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-colors ${
              serverOnline
                ? "cursor-pointer border-gray-300 text-gray-600 hover:border-pink-300 hover:bg-pink-50/30"
                : "cursor-not-allowed border-amber-300 bg-amber-50/50 text-amber-800 opacity-70"
            }`}
          >
            {!serverOnline ? "🔒 PC Apagada" : uploadingProfile ? "Subiendo..." : "Cambiar foto"}
            <input
              type="file"
              accept="image/*"
              onChange={handleProfileImage}
              className="hidden"
              disabled={uploadingProfile || !serverOnline}
            />
          </label>
        </div>
      </div>

      {/* 🌟 4. TEXTOS DE LA TIENDA 🌟 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800">Textos de la tienda</h3>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Cintillo promocional</label>
          <input
            value={form.announcementText}
            onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-pink-300"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Título principal</label>
          <input
            value={form.heroTitle}
            onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-pink-300"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Descripción de bienvenida</label>
          <textarea
            value={form.heroDescription}
            onChange={(e) => setForm({ ...form, heroDescription: e.target.value })}
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-pink-300 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Texto legal / políticas</label>
          <textarea
            value={form.legalText}
            onChange={(e) => setForm({ ...form, legalText: e.target.value })}
            rows={4}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-pink-300 resize-none"
          />
        </div>
      </div>

      {/* 🌟 5. REDES SOCIALES 🌟 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-bold text-gray-800">Redes Sociales</h3>
        {["instagram", "tiktok", "facebook", "twitter"].map((net) => (
          <div key={net}>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{net}</label>
            <input
              value={form.socialLinks[net] || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  socialLinks: { ...form.socialLinks, [net]: e.target.value },
                })
              }
              placeholder={`https://${net}.com/tutienda`}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-pink-300"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl text-white font-bold disabled:opacity-50 transition-all active:scale-[0.99] shadow-lg"
        style={{ background: "var(--primary)" }}
      >
        {saving ? "Guardando..." : "Guardar cambios de la interfaz"}
      </button>

      {/* Vista previa en pantalla completa al probarla en el panel admin */}
      {previewSplash && (
        <SplashScreen forceShow={true} onClose={() => setPreviewSplash(false)} />
      )}
    </div>
  );
}
