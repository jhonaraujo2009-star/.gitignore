import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

export default function Header({ onProductClick }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const { itemCount, setIsOpen } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSessions = async () => {
      // HEMOS QUITADO EL 'orderBy' AQUÍ PARA ARREGLAR TU ERROR
      const q = query(collection(db, "sessions"), where("hidden", "==", false));
      const snap = await getDocs(q);
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const snap = await getDocs(collection(db, "products"));
        const q = searchQuery.toLowerCase();
        const results = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (p) =>
              p.name?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q)
          )
          .slice(0, 6);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setSearchOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex-shrink-0">
          <span className="text-xl font-bold" style={{ color: "var(--primary)" }}>
            ✨ Store
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 relative" ref={searchRef}>
          {searchOpen ? (
            <div className="relative">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-1.5 text-sm outline-none focus:border-pink-300"
              />
              {(searchResults.length > 0 || searching) && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {searching ? (
                    <div className="p-4 text-center text-sm text-gray-400">
                      Buscando...
                    </div>
                  ) : (
                    searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onProductClick(p);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                      >
                        {p.images?.[0] && (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-10 h-10 object-cover rounded-xl"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">${p.price}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="mx-auto flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-4 py-1.5 rounded-2xl text-sm text-gray-400 transition-colors w-full max-w-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar...
            </button>
          )}
        </div>

        {/* Cart + Menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsOpen(true)}
            className="relative p-2 rounded-full hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-xs flex items-center justify-center rounded-full text-white font-bold" style={{ background: "var(--primary)" }}>
                {itemCount}
              </span>
            )}
          </button>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-full hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 py-2">
                <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Sesiones
                </p>
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                    onClick={() => {
                      document.getElementById(`session-${s.id}`)?.scrollIntoView({ behavior: "smooth" });
                      setMenuOpen(false);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { navigate("/preguntas"); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                >
                  💬 Zona de Preguntas
                </button>
                <button
                  onClick={() => { navigate(user ? "/admin" : "/login"); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                >
                  🔒 Panel Admin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}