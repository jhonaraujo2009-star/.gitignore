import { useState, useEffect } from "react";
import { doc, updateDoc, increment, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useApp } from "../../context/AppContext";
import { useCart } from "../../context/CartContext";
import toast from "react-hot-toast";

export default function ProductModal({ product, onClose }) {
  const { bsPrice } = useApp();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  
  const [hasLiked, setHasLiked] = useState(() => {
    const likedProducts = JSON.parse(localStorage.getItem('userLikes') || '{}');
    return !!likedProducts[product.id];
  });

  const [likesCount, setLikesCount] = useState(product.likes || 0);
  const [isLiking, setIsLiking] = useState(false);

  const variants = product.variants || [];
  const hasVariants = variants.length > 0;
  const availableStock = hasVariants ? selectedVariant?.stock ?? 0 : product.totalStock ?? 0;

  useEffect(() => {
    const productRef = doc(db, "products", product.id);
    const unsubscribe = onSnapshot(productRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.likes !== undefined) setLikesCount(data.likes);
      }
    });
    return () => unsubscribe();
  }, [product.id]);

  const handleLike = async () => {
    if (hasLiked || isLiking) return;
    setIsLiking(true);
    setHasLiked(true);
    setLikesCount(prev => prev + 1);
    
    const likedProducts = JSON.parse(localStorage.getItem('userLikes') || '{}');
    likedProducts[product.id] = true;
    localStorage.setItem('userLikes', JSON.stringify(likedProducts));

    try {
      await updateDoc(doc(db, "products", product.id), { likes: increment(1) });
    } catch (error) {
      await setDoc(doc(db, "products", product.id), { likes: 1 }, { merge: true });
    }
    setIsLiking(false);
  };

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant) return toast.error("Selecciona una talla o medida (mg)");
    if (quantity > availableStock) return toast.error("Supera el stock disponible");
    addItem(product, selectedVariant, quantity);
    toast.success("¡Excelente elección! 🛍️");
  };

  const stockPercentage = Math.min((availableStock / (hasVariants ? 50 : 100)) * 100, 100);
  const isLowStock = availableStock > 0 && availableStock <= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl max-h-[95vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
        
        <div className="sticky top-0 z-20 flex justify-between items-center px-6 pt-4 pb-2 bg-gradient-to-b from-white via-white/95 to-transparent">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full sm:hidden mx-auto absolute left-0 right-0 top-3" />
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-90 transition-all shadow-sm">✕</button>
        </div>

        <div className="relative aspect-square bg-gray-50 mx-4 rounded-3xl overflow-hidden mb-6 shadow-inner group">
          {product.images?.length > 0 ? (
            <img src={product.images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-50">✨</div>
          )}
          {product.images?.length > 1 && (
            <>
              <button onClick={() => setActiveImage((i) => (i - 1 + product.images.length) % product.images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all text-gray-800 font-bold active:scale-95">‹</button>
              <button onClick={() => setActiveImage((i) => (i + 1) % product.images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all text-gray-800 font-bold active:scale-95">›</button>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {product.images.map((_, i) => (
                  <button key={i} onClick={() => setActiveImage(i)} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImage ? "w-6 bg-white shadow-md" : "w-1.5 bg-white/50"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 pb-8 space-y-6">
          
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight mb-2">{product.name}</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black" style={{ color: "var(--primary)" }}>${product.price}</span>
                <span className="text-sm font-semibold text-gray-400">Bs. {bsPrice(product.price)}</span>
              </div>
            </div>

            <button 
              onClick={handleLike}
              className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all duration-500 shadow-sm ${hasLiked ? 'bg-pink-50 border border-pink-100' : 'bg-white border border-gray-100 hover:bg-gray-50 active:scale-90'}`}
            >
              <span className={`text-2xl transition-all duration-500 ${hasLiked ? 'text-pink-500 scale-110 drop-shadow-md' : 'text-gray-300 grayscale'}`}>
                {hasLiked ? '❤️' : '🤍'}
              </span>
              <span className={`text-[10px] font-black tracking-widest ${hasLiked ? 'text-pink-500' : 'text-gray-400'}`}>
                {likesCount}
              </span>
            </button>
          </div>

          {product.description && (
            <div className="text-sm text-gray-500 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: product.description }} />
          )}

          <hr className="border-gray-50" />

          {/* VARIANTES CON ADVERTENCIA PREMIUM */}
          {hasVariants && (
            <div>
              <div className="flex items-start gap-3 bg-amber-50/50 border border-amber-100/60 p-3 rounded-2xl mb-4 shadow-sm">
                <span className="text-amber-500 text-lg">⚠️</span>
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest leading-relaxed">
                  Importante: <span className="font-medium text-amber-600">Selecciona tu talla o medida (mg) antes de añadir a la bolsa.</span>
                </p>
              </div>

              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Opciones Disponibles</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVariant(v); setQuantity(1); }}
                    disabled={v.stock === 0}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      selectedVariant?.id === v.id
                        ? "text-white ring-2 ring-offset-2"
                        : v.stock === 0
                        ? "bg-gray-50 text-gray-300 cursor-not-allowed opacity-50"
                        : "bg-white text-gray-700 border border-gray-100 hover:border-gray-300"
                    }`}
                    style={selectedVariant?.id === v.id ? { background: "var(--primary)", ringColor: "var(--primary)" } : {}}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Cantidad</p>
              <div className="flex items-center gap-4 bg-white rounded-2xl px-2 py-1 shadow-sm border border-gray-50">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors text-lg font-bold">−</button>
                <span className="w-6 text-center font-black text-gray-800">{quantity}</span>
                <button onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors text-lg font-bold">+</button>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-end">
                <span className={`text-[10px] font-black uppercase tracking-widest ${availableStock === 0 ? 'text-red-500' : isLowStock ? 'text-orange-500 animate-pulse' : 'text-green-500'}`}>
                  {availableStock === 0 ? "Agotado" : isLowStock ? "¡Casi agotado!" : "Disponible"}
                </span>
                <span className="text-xs font-bold text-gray-500">{availableStock} uds</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${availableStock === 0 ? 'bg-red-500' : isLowStock ? 'bg-orange-500' : 'bg-green-500'}`} 
                  style={{ width: `${stockPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={availableStock === 0}
            className="w-full py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{ background: availableStock === 0 ? "#ccc" : "var(--primary)" }}
          >
            {availableStock === 0 ? "No Disponible" : "Añadir a la Bolsa"}
            {availableStock > 0 && <span className="text-xl">🛍️</span>}
          </button>
          
        </div>
      </div>
    </div>
  );
}