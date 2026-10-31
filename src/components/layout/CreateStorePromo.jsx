const WORDS = ["CREA", "TU", "TIENDA", "VIRTUAL"];
const HIGHLIGHT_WORD = "GRATIS!";
const PROMO_URL = "https://venezuela-multi-hilos.vercel.app/registro-vendedor";

export default function CreateStorePromo() {
  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pointer-events-auto">
      <a
        href={PROMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="¡Crea tu tienda virtual gratis!"
        aria-label="Crea tu tienda virtual gratis!"
        className="group relative flex flex-col items-center justify-center py-2.5 px-1.5 bg-gray-950/90 hover:bg-gray-950 backdrop-blur-2xl text-white rounded-r-2xl border-y border-r border-pink-500/40 shadow-[4px_0_25px_rgba(236,72,153,0.28)] hover:shadow-[6px_0_35px_rgba(236,72,153,0.5)] hover:pl-2.5 transition-all duration-500 active:scale-95 overflow-hidden"
      >
        {/* Resplandor lateral animado */}
        <span className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-pink-400 via-purple-400 to-amber-300" />
        <span className="absolute -inset-1 bg-gradient-to-b from-pink-500/20 via-purple-500/10 to-pink-500/20 blur-md opacity-75 group-hover:opacity-100 transition-opacity -z-10" />

        {/* Icono superior */}
        <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-[10px] shadow-md shadow-pink-500/40 mb-1.5 group-hover:scale-110 transition-transform">
          🚀
        </span>

        {/* Letras en columna vertical palabra por palabra */}
        <div className="flex flex-col items-center gap-1.5">
          {WORDS.map((word, wIdx) => (
            <div key={word} className="flex flex-col items-center">
              <div className="flex flex-col items-center leading-[1.02]">
                {word.split("").map((char, cIdx) => (
                  <span
                    key={cIdx}
                    className={`text-[8.5px] sm:text-[9px] font-black tracking-tighter select-none ${
                      wIdx === 1
                        ? "text-pink-300"
                        : "text-white/95 group-hover:text-white"
                    }`}
                  >
                    {char}
                  </span>
                ))}
              </div>
              {wIdx < WORDS.length - 1 && (
                <span className="w-1 h-1 rounded-full bg-pink-500/60 mt-1" />
              )}
            </div>
          ))}

          {/* Palabra GRATIS! destacada en cápsula vertical */}
          <div className="mt-0.5 px-1 py-1 rounded-lg bg-gradient-to-b from-pink-500 via-rose-500 to-amber-500 shadow-md shadow-pink-500/30 flex flex-col items-center leading-[1.02] border border-white/25">
            {HIGHLIGHT_WORD.split("").map((char, cIdx) => (
              <span
                key={cIdx}
                className="text-[8.5px] sm:text-[9px] font-black text-white drop-shadow-sm select-none"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      </a>
    </div>
  );
}
