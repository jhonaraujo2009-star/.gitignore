import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";

export default function SplashScreen({ forceShow = false, onClose }) {
  const { settings } = useApp();
  const [visible, setVisible] = useState(() => {
    if (forceShow) return true;
    if (!settings?.splashImage || settings?.splashEnabled === false) return false;
    try {
      return !sessionStorage.getItem("splash_viewed");
    } catch {
      return true;
    }
  });

  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setSecondsLeft(5);
    }
  }, [forceShow]);

  useEffect(() => {
    if (!visible) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          dismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem("splash_viewed", "true");
    } catch {
      // ignore
    }
    if (onClose) onClose();
  };

  if (!visible || !settings?.splashImage) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-300 select-none">
      {/* Imagen a pantalla completa tipo app móvil (Nihao / Shein) */}
      <img
        src={settings.splashImage}
        alt="Bienvenida"
        className="w-full h-full object-cover object-center pointer-events-none"
      />

      {/* Degradado sutil superior e inferior para legibilidad de botones */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />

      {/* Botón flotante superior derecho: Saltar / Cerrar */}
      <div className="absolute top-5 right-5 z-20 flex items-center">
        <button
          onClick={dismiss}
          className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-black tracking-wider flex items-center gap-1.5 shadow-2xl border border-white/20 active:scale-95 transition-all"
        >
          <span>Saltar</span>
          {secondsLeft > 0 && (
            <span className="text-pink-400 font-extrabold">({secondsLeft}s)</span>
          )}
          <span className="text-sm leading-none ml-1">✕</span>
        </button>
      </div>

      {/* Botón inferior: Entrar a la tienda */}
      <div className="absolute bottom-8 left-5 right-5 z-20 flex justify-center">
        <button
          onClick={dismiss}
          className="w-full max-w-sm py-4 px-6 rounded-2xl bg-white/95 hover:bg-white text-gray-900 font-black text-xs uppercase tracking-[0.2em] shadow-2xl backdrop-blur-md border border-white/60 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <span>Entrar a la Tienda</span>
          <span className="text-base">🛍️</span>
        </button>
      </div>
    </div>
  );
}
