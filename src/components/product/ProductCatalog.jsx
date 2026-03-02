import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import ProductCard from "./ProductCard";

function Countdown({ endsAt }) {
  const [timeLeft, setTimeLeft] = useState(endsAt - Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      const newTime = endsAt - Date.now();
      if (newTime <= 0) { clearInterval(timer); setTimeLeft(0); } else setTimeLeft(newTime);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (timeLeft <= 0) return null;
  const h = Math.floor(timeLeft / (1000 * 60 * 60));
  const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="mt-3 text-center animate-in fade-in zoom-in duration-300">
      <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm">
        <span className="animate-pulse">⏳</span> {h}h {m}m {s}s
      </span>
    </div>
  );
}

export default function ProductCatalog({ activeFilter, onProductClick, onFilter }) {
  const [sessions, setSessions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSessions = onSnapshot(query(collection(db, "sessions"), where("hidden", "==", false)), 
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      const rawProducts = snap.docs.map((d) => {
        const data = d.data();
        const product = { id: d.id, ...data, createdAtMs: data.createdAt?.toMillis() || 0 };
        if (product.offerEndsAt && product.offerEndsAt > Date.now()) {
          const discount = parseFloat(product.offerDiscount) || 0;
          return { ...product, oldPrice: product.price, price: product.price - (product.price * discount / 100), isFlashOffer: true };
        }
        return product;
      });
      setProducts(rawProducts);
      setLoading(false);
    });

    return () => { unsubSessions(); unsubProducts(); };
  }, []);

  if (loading) return <div className="p-20 text-center font-serif italic text-gray-400">Cargando Boutique...</div>;

  if (!activeFilter || activeFilter === "all") {
    return (
      <div className="px-4 pb-24 space-y-10 animate-in fade-in duration-700">
        <div className="py-8 text-center">
          <h2 className="text-[10px] font-black tracking-[0.5em] text-gray-400 uppercase mb-2">Exclusividad</h2>
          <h1 className="text-3xl font-serif italic text-gray-900">Nuestras Colecciones</h1>
        </div>
        <div className="grid grid-cols-1 gap-8">
          {sessions.map((session) => {
            const sessionProducts = products.filter(p => p.sessionId === session.id);
            if (sessionProducts.length === 0) return null;
            const img = sessionProducts[0]?.image || sessionProducts[0]?.images?.[0];
            return (
              <div key={session.id} onClick={() => onFilter(session.id)} className="group relative h-[420px] w-full rounded-[3rem] overflow-hidden shadow-2xl transition-all active:scale-95">
                {img && <img src={img} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110" alt="" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-12">
                  <h3 className="text-3xl font-light text-white uppercase tracking-[0.2em] mb-4">{session.name}</h3>
                  <button className="text-[10px] text-white/90 font-bold uppercase tracking-[0.3em] backdrop-blur-md bg-white/10 px-8 py-2.5 rounded-full border border-white/20">Explorar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  let filtered = [];
  const isTopTen = activeFilter === "top";
  const isNewArrivals = activeFilter === "new";
  const isOfertas = activeFilter === "ofertas";

  if (isTopTen) {
    filtered = [...products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 10);
  } else if (isNewArrivals) {
    const unaSemanaAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
    filtered = products.filter(p => p.createdAtMs >= unaSemanaAtras || p.isNew).sort((a, b) => b.createdAtMs - a.createdAtMs);
  } else if (isOfertas) {
    filtered = products.filter(p => p.isFlashOffer || (p.oldPrice && parseFloat(p.oldPrice) > parseFloat(p.price)));
  } else {
    filtered = products.filter(p => p.sessionId === activeFilter);
  }

  const currentSession = sessions.find(s => s.id === activeFilter);

  return (
    <div className="px-4 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col items-center py-12">
        <h2 className="text-2xl font-light tracking-[0.2em] text-gray-900 uppercase text-center">
          {isTopTen ? "🏆 Top Ventas" : isNewArrivals ? "✨ Lo Nuevo" : isOfertas ? "🔥 Ofertas" : (currentSession?.name || "Colección")}
        </h2>
        <button onClick={() => onFilter("all")} className="mt-4 text-[9px] font-black text-pink-500 border-b border-pink-200 pb-1 uppercase tracking-widest">
          ← Regresar al Menú
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-12">
        {filtered.map((p, index) => (
          <div key={p.id} className="relative">
            {isTopTen && <div className="absolute -top-3 -left-3 z-10 bg-black text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-xl border-2 border-white animate-bounce">#{index + 1}</div>}
            {isOfertas && !p.isFlashOffer && <div className="absolute -top-3 -right-3 z-10 bg-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-xl border-2 border-white animate-pulse">OFERTA</div>}
            {p.isFlashOffer && <div className="absolute -top-3 -right-3 z-10 bg-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-xl border-2 border-white animate-pulse">-{p.offerDiscount}%</div>}
            <ProductCard product={p} onClick={onProductClick} />
            {isTopTen && (
              <div className="mt-2 flex flex-col items-center">
                <span className="text-[9px] font-black text-pink-500 uppercase tracking-tighter">🔥 Tendencia</span>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{p.salesCount || 0} vendidas</p>
              </div>
            )}
            {p.isFlashOffer && <Countdown endsAt={p.offerEndsAt} />}
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center py-20 text-gray-400 font-serif italic">Próximamente más productos...</p>}
    </div>
  );
}