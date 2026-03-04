import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import ProductCard from "./ProductCard";

export default function ProductCatalog({ activeFilter, onProductClick, onFilter }) {
  const [sessions, setSessions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => { setVisibleCount(8); }, [activeFilter]);

  useEffect(() => {
    const unsubSessions = onSnapshot(
      query(collection(db, "sessions"), where("hidden", "==", false)), 
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      const rawProducts = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAtMs: data.createdAt?.toMillis() || 0 };
      });
      setProducts(rawProducts);
      setLoading(false);
    });

    return () => { unsubSessions(); unsubProducts(); };
  }, []);

  if (loading) return <div className="p-20 text-center text-gray-400 italic">Cargando Boutique...</div>;

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
    // CORRECCIÓN EXACTA: Busca oldPrice o si hay una oferta relámpago activa
    filtered = products.filter(p => {
      const hasOldPrice = p.oldPrice && Number(p.oldPrice) > Number(p.price);
      const isFlashOffer = p.offerEndsAt && p.offerEndsAt > Date.now();
      return hasOldPrice || isFlashOffer;
    }).sort((a, b) => {
      const ahorroA = (Number(a.oldPrice) || 0) - Number(a.price);
      const ahorroB = (Number(b.oldPrice) || 0) - Number(b.price);
      return ahorroB - ahorroA; // Los mayores descuentos primero
    });
  } else if (activeFilter && activeFilter !== "all") {
    filtered = products.filter(p => p.sessionId === activeFilter);
  }

  if (!activeFilter || activeFilter === "all") {
    return (
      <div className="px-4 pb-24 space-y-10">
        <div className="py-8 text-center">
          <h2 className="text-[10px] font-black tracking-[0.5em] text-gray-400 uppercase mb-2 text-center">Exclusividad</h2>
          <h1 className="text-3xl font-serif italic text-gray-900 text-center">Nuestras Colecciones</h1>
        </div>
        <div className="grid grid-cols-1 gap-8">
          {sessions.map((session) => {
            const sessionProducts = products.filter(p => p.sessionId === session.id);
            if (sessionProducts.length === 0) return null;
            const img = sessionProducts[0]?.image || sessionProducts[0]?.images?.[0];
            return (
              <div key={session.id} onClick={() => onFilter(session.id)} className="group relative h-[420px] w-full rounded-[3rem] overflow-hidden shadow-2xl transition-all active:scale-95 cursor-pointer">
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

  const visibleProducts = filtered.slice(0, visibleCount);

  return (
    <div className="px-4 pb-24">
      <div className="flex flex-col items-center py-12">
        <h2 className="text-2xl font-light tracking-[0.2em] text-gray-900 uppercase text-center">
          {isTopTen ? "🏆 Ranking Top 10" : isNewArrivals ? "✨ Lo Nuevo" : isOfertas ? "🔥 Ofertas Hot" : "Colección"}
        </h2>
        <button onClick={() => onFilter("all")} className="mt-4 text-[9px] font-black text-pink-500 border-b border-pink-200 pb-1 uppercase tracking-widest">← Regresar</button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 italic">Cargando productos súper exclusivos...</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-12">
          {visibleProducts.map((p, index) => (
            <ProductCard key={p.id} product={p} onClick={onProductClick} rank={isTopTen ? index + 1 : null} />
          ))}
        </div>
      )}

      {visibleCount < filtered.length && (
        <div className="flex justify-center mt-16">
          <button onClick={() => setVisibleCount(prev => prev + 8)} className="px-10 py-4 rounded-full text-xs font-black tracking-[0.3em] uppercase bg-black text-white shadow-xl active:scale-95">Ver Más</button>
        </div>
      )}
    </div>
  );
}