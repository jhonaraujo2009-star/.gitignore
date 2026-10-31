import { useApp } from "../../context/AppContext";
import { cleanPhoneForWhatsApp } from "../../utils/phoneUtils";

function getSocialHref(social, rawValue) {
  if (!rawValue) return "";
  const val = String(rawValue).trim();
  if (social === "whatsapp") {
    if (val.startsWith("http://") || val.startsWith("https://")) return val;
    if (val.startsWith("wa.me/")) return `https://${val}`;
    const cleaned = cleanPhoneForWhatsApp(val);
    return cleaned ? `https://wa.me/${cleaned}` : val;
  }
  if (val.startsWith("http://") || val.startsWith("https://")) return val;
  return `https://${val}`;
}

export default function HeroBanner({ activeFilter }) {
  const { settings } = useApp();
  const isExpanded = activeFilter === "all";

  return (
    <section
      className={`w-full overflow-hidden transition-all duration-500 ease-in-out px-4 flex flex-col items-center justify-center 
        ${isExpanded ? "opacity-100 py-8" : "opacity-0 py-0"}`}
      style={{
        maxHeight: isExpanded ? "100vh" : "0px",
        minHeight: isExpanded ? "40vh" : "0px",
      }}
    >
      <div
        className={`flex flex-col items-center justify-center w-full transition-opacity duration-300 ${
          isExpanded ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Imagen de Perfil */}
        <div className="relative mb-4">
          <div
            className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100"
            style={{ borderColor: "var(--primary)" }}
          >
            {settings.profileImage ? (
              <img
                src={settings.profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">
                ✨
              </div>
            )}
          </div>
        </div>

        {/* Título y Descripción */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {settings.heroTitle || "Mi Tienda"}
        </h1>
        <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
          {settings.heroDescription}
        </p>

        {/* Redes Sociales */}
        <div className="flex items-center gap-4 mt-6">
          {["whatsapp", "instagram", "tiktok"].map((social) => {
            const rawLink = settings.socialLinks?.[social];
            if (!rawLink) return null;
            const href = getSocialHref(social, rawLink);

            if (social === "whatsapp") {
              return (
                <a
                  key={social}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title="WhatsApp"
                  aria-label="WhatsApp"
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#128C7E] via-[#25D366] to-[#2ecc71] text-white flex items-center justify-center shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/40 transition-all duration-300 hover:scale-110 active:scale-95"
                >
                  <svg
                    className="w-6 h-6 fill-current drop-shadow-sm"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.127-.521-1.834-.759-3.003-2.628-3.095-2.75-.088-.124-.736-.98-.736-1.874 0-.893.468-1.333.636-1.514.168-.181.368-.227.49-.227.123 0 .245.001.353.007.113.006.264-.043.412.313.155.372.531 1.298.577 1.393.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.111-.196.248-.28.333-.094.094-.192.196-.083.383.11.187.487.805 1.045 1.302.718.639 1.323.837 1.51.93.187.093.296.079.405-.047.11-.125.468-.544.593-.732.125-.187.249-.156.417-.094.168.063 1.066.503 1.249.596.183.093.305.14.351.218.046.079.046.453-.098.858z" />
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.66 1.438 5.174L2 22l4.981-1.307A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.688 0-3.26-.51-4.577-1.385l-.328-.219-3.037.797.81-2.961-.24-.382A8.134 8.134 0 013.833 12c0-4.503 3.664-8.167 8.167-8.167 4.503 0 8.167 3.664 8.167 8.167 0 4.503-3.664 8.167-8.167 8.167z" />
                  </svg>
                </a>
              );
            }

            return (
              <a
                key={social}
                href={href}
                target="_blank"
                rel="noreferrer"
                title={social}
                aria-label={social}
                className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 hover:scale-110 active:scale-95 overflow-hidden p-2"
              >
                {settings.customIcons?.[social] ? (
                  <img
                    src={settings.customIcons[social]}
                    className="w-full h-full object-contain"
                    alt={social}
                  />
                ) : social === "instagram" ? (
                  <svg
                    className="w-5 h-5 text-pink-600 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-900 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                )}
              </a>
            );
          })}
        </div>

        {/* LOGOS DE LOGÍSTICA / ENVÍOS UNIFORMES Y ESTÉTICOS */}
        <div className="mt-8 pt-5 border-t border-gray-100/80 w-full max-w-xs flex flex-col items-center">
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">
            🚚 Envíos Nacionales
          </span>
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {/* MRW */}
            <div className="h-10 rounded-xl bg-gray-50/90 border border-gray-100/90 shadow-sm flex items-center justify-center px-3 hover:bg-white hover:shadow-md hover:border-pink-100 transition-all duration-300 group">
              <svg
                viewBox="0 0 120 36"
                className="w-full h-4 object-contain opacity-75 group-hover:opacity-100 transition-opacity"
              >
                <rect x="2" y="6" width="6" height="24" rx="2" fill="#E30613" />
                <text
                  x="64"
                  y="25"
                  textAnchor="middle"
                  fill="#1E293B"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="900"
                  fontStyle="italic"
                  fontSize="22"
                  letterSpacing="1.5"
                >
                  MRW
                </text>
              </svg>
            </div>

            {/* TEALCA */}
            <div className="h-10 rounded-xl bg-gray-50/90 border border-gray-100/90 shadow-sm flex items-center justify-center px-2.5 hover:bg-white hover:shadow-md hover:border-pink-100 transition-all duration-300 group">
              <svg
                viewBox="0 0 130 36"
                className="w-full h-4 object-contain opacity-75 group-hover:opacity-100 transition-opacity"
              >
                <circle cx="11" cy="18" r="6" fill="#0055A5" />
                <path d="M9 18l3-3 3 3-3 3z" fill="#38BDF8" />
                <text
                  x="74"
                  y="24"
                  textAnchor="middle"
                  fill="#0055A5"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="900"
                  fontSize="19"
                  letterSpacing="1"
                >
                  TEALCA
                </text>
              </svg>
            </div>

            {/* ZOOM */}
            <div className="h-10 rounded-xl bg-gray-50/90 border border-gray-100/90 shadow-sm flex items-center justify-center px-3 hover:bg-white hover:shadow-md hover:border-pink-100 transition-all duration-300 group">
              <svg
                viewBox="0 0 120 36"
                className="w-full h-4 object-contain opacity-75 group-hover:opacity-100 transition-opacity"
              >
                <rect x="2" y="11" width="8" height="3" rx="1.5" fill="#0284C7" />
                <rect x="0" y="17" width="10" height="3" rx="1.5" fill="#E11D48" />
                <rect x="2" y="23" width="8" height="3" rx="1.5" fill="#0284C7" />
                <text
                  x="67"
                  y="24"
                  textAnchor="middle"
                  fill="#0F172A"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="900"
                  fontStyle="italic"
                  fontSize="20"
                  letterSpacing="1.2"
                >
                  ZOOM
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
