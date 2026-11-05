import { useState } from "react";

const WORDS = ["CREA", "TU", "TIENDA", "VIRTUAL"];
const HIGHLIGHT_WORD = "GRATIS!";
const PROMO_URL = "https://venezuela-multi-hilos.vercel.app/registro-vendedor";

export default function CreateStorePromo() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pointer-events-auto">
      <div className="relative group">
        {/* Aura luminosa exterior tipo neón */}
        <div className="absolute -inset-1.5 rounded-r-3xl bg-gradient-to-b from-pink-500 via-fuchsia-500 to-amber-400 opacity-75 blur-md animate-pulse pointer-events-none" />

        {/* Botón X en la esquina superior derecha para cerrar el banner */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsVisible(false);
          }}
          title="Ocultar anuncio"
          aria-label="Cerrar anuncio"
          className="absolute -top-2.5 -right-2.5 z-50 w-5 h-5 rounded-full bg-gray-950 text-white border-2 border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.9)] flex items-center justify-center text-[10px] font-black leading-none hover:bg-pink-600 hover:scale-110 active:scale-90 transition-all"
        >
          ✕
        </button>

        <a
          href={PROMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="¡Crea tu tienda virtual gratis!"
          aria-label="¡Crea tu tienda virtual gratis!"
          className="relative flex flex-col items-center justify-center py-3 px-2 bg-gradient-to-b from-fuchsia-600 via-pink-600 to-purple-800 text-white rounded-r-2xl border-y-2 border-r-2 border-pink-300 shadow-[0_0_25px_rgba(236,72,153,0.85),0_0_45px_rgba(168,85,247,0.5)] hover:shadow-[0_0_35px_rgba(236,72,153,1),0_0_60px_rgba(251,191,36,0.7)] hover:pl-3 transition-all duration-500 active:scale-95 overflow-hidden"
        >
          {/* Barra lateral izquierda ultra brillante */}
          <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-yellow-300 via-white to-pink-300 shadow-[0_0_10px_#fff]" />

          {/* Destello interno animado */}
          <span className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Icono superior luminoso */}
          <span className="relative z-10 w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-500 flex items-center justify-center text-xs shadow-[0_0_15px_rgba(251,191,36,0.9)] border border-white/80 mb-1.5 animate-bounce">
            🚀
          </span>

          {/* Letras en columna vertical palabra por palabra */}
          <div className="relative z-10 flex flex-col items-center gap-1.5">
            {WORDS.map((word, wIdx) => (
              <div key={word} className="flex flex-col items-center">
                <div className="flex flex-col items-center leading-[1.04]">
                  {word.split("").map((char, cIdx) => (
                    <span
                      key={cIdx}
                      className={`text-[9px] sm:text-[9.5px] font-black tracking-tighter select-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] ${
                        wIdx === 1
                          ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
                          : "text-white"
                      }`}
                    >
                      {char}
                    </span>
                  ))}
                </div>
                {wIdx < WORDS.length - 1 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-[0_0_8px_#fde047] mt-1" />
                )}
              </div>
            ))}

            {/* Palabra GRATIS! destacada en cápsula vertical luminosa */}
            <div className="mt-1 px-1.5 py-1 rounded-lg bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 shadow-[0_0_16px_rgba(251,191,36,0.95)] flex flex-col items-center leading-[1.04] border border-white animate-pulse">
              {HIGHLIGHT_WORD.split("").map((char, cIdx) => (
                <span
                  key={cIdx}
                  className="text-[9px] sm:text-[9.5px] font-black text-gray-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] select-none"
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
