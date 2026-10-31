import { useApp } from "../../context/AppContext";
import { cleanPhoneForWhatsApp } from "../../utils/phoneUtils";

export default function WhatsAppVIP() {
  const { settings } = useApp();
  const widget = settings?.whatsappWidget;

  // Si está apagado o no hay número, el botón se oculta
  if (!widget?.active || !widget?.number) return null;

  const handleChat = () => {
    const cleanPhone = cleanPhoneForWhatsApp(widget.number);
    const text = encodeURIComponent(widget.message || "Hola Luckathys, necesito asesoría.");
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
  };

  return (
    <button
      onClick={handleChat}
      title="Asesoría VIP por WhatsApp"
      aria-label="Asesoría VIP por WhatsApp"
      className="fixed bottom-48 right-4 z-50 group flex items-center gap-0 bg-white/75 backdrop-blur-3xl rounded-full p-2 hover:pr-6 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 shadow-[0_8px_32px_rgba(37,211,102,0.28)] border border-white/80 animate-float"
    >
      {/* AURA DE LUZ */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/25 to-green-500/20 blur-xl group-hover:scale-150 transition-transform duration-700 -z-10"></div>

      {/* CÍRCULO DEL ÍCONO OFICIAL DE WHATSAPP */}
      <div className="relative w-12 h-12 bg-gradient-to-tr from-[#128C7E] via-[#25D366] to-[#2ecc71] text-white rounded-full flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_5px_15px_rgba(37,211,102,0.35)] transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-105">
        <svg
          className="relative z-10 w-6 h-6 fill-current drop-shadow-sm"
          viewBox="0 0 24 24"
        >
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.127-.521-1.834-.759-3.003-2.628-3.095-2.75-.088-.124-.736-.98-.736-1.874 0-.893.468-1.333.636-1.514.168-.181.368-.227.49-.227.123 0 .245.001.353.007.113.006.264-.043.412.313.155.372.531 1.298.577 1.393.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.111-.196.248-.28.333-.094.094-.192.196-.083.383.11.187.487.805 1.045 1.302.718.639 1.323.837 1.51.93.187.093.296.079.405-.047.11-.125.468-.544.593-.732.125-.187.249-.156.417-.094.168.063 1.066.503 1.249.596.183.093.305.14.351.218.046.079.046.453-.098.858z" />
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.66 1.438 5.174L2 22l4.981-1.307A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.688 0-3.26-.51-4.577-1.385l-.328-.219-3.037.797.81-2.961-.24-.382A8.134 8.134 0 013.833 12c0-4.503 3.664-8.167 8.167-8.167 4.503 0 8.167 3.664 8.167 8.167 0 4.503-3.664 8.167-8.167 8.167z" />
        </svg>

        {/* PUNTO VERDE */}
        <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full z-20">
          <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></span>
        </span>
      </div>

      {/* TEXTO DOBLE */}
      <div className="max-w-0 overflow-hidden group-hover:max-w-[130px] transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col items-start justify-center opacity-0 group-hover:opacity-100">
        <span className="pl-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-950 leading-tight">
          Asesoría VIP
        </span>
        <span className="pl-3 text-[9px] font-bold text-green-600 tracking-widest uppercase mt-0.5 flex items-center gap-1 drop-shadow-sm">
          En línea ahora
        </span>
      </div>
    </button>
  );
}
