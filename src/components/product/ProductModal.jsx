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
    const likedProducts = JSON.parse(localStorage.getItem("userLikes") || "{}");
    return !!likedProducts[product.id];
  });

  const [likesCount, setLikesCount] = useState(product.likes || 0);
  const [isLiking, setIsLiking] = useState(false);

  const variants = product.variants || [];
  const hasVariants = variants.length > 0;
  const availableStock = hasVariants
    ? selectedVariant?.stock ?? 0
    : product.totalStock ?? 0;

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
    setLikesCount((prev) => prev + 1);

    const likedProducts = JSON.parse(localStorage.getItem("userLikes") || "{}");
    likedProducts[product.id] = true;
    localStorage.setItem("userLikes", JSON.stringify(likedProducts));

    try {
      await updateDoc(doc(db, "products", product.id), {
        likes: increment(1),
      });
    } catch (error) {
      await setDoc(
        doc(db, "products", product.id),
        { likes: 1 },
        { merge: true }
      );
    }

    setIsLiking(false);
  };

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant)
      return toast.error("Selecciona una talla o medida");

    if (quantity > availableStock)
      return toast.error("Supera el stock disponible");

    addItem(product, selectedVariant, quantity);
    toast.success("¡Excelente elección! 🛍️");
  };

  const stockPercentage = Math.min(
    (availableStock / (hasVariants ? 50 : 100)) * 100,
    100
  );

  const isLowStock = availableStock > 0 && availableStock <= 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative bg-white w-[92%] sm:w-full max-w-sm rounded-[2.5rem] sm:rounded-3xl max-h-[88vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
        
        {/* BOTÓN CERRAR */}
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-90 transition-all text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* IMÁGENES */}
        <div className="relative aspect-square bg-gray-50 mx-5 mt-6 rounded-3xl overflow-hidden mb-6 shadow-inner group">
          {product.images?.length > 0 ? (
            <img
              src={product.images[activeImage]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-50">
              ✨
            </div>
          )}

          {product.images?.length > 1 && (
            <>
              <button
                onClick={() =>
                  setActiveImage(
                    (i) => (i - 1 + product.images.length) % product.images.length
                  )
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all text-gray-800 font-bold active:scale-95"
              >
                ‹
              </button>

              <button
                onClick={() =>
                  setActiveImage((i) => (i + 1) % product.images.length)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all text-gray-800 font-bold active:scale-95"
              >
                ›
              </button>

              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {product.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === activeImage
                        ? "w-6 bg-white shadow-md"
                        : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="px-6 pb-8 space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight mb-2">
                {product.name}
              </h2>

              <div className="flex items-baseline gap-3">
                <span
                  className="text-3xl font-black"
                  style={{ color: "var(--primary)" }}
                >
                  ${product.price}
                </span>
                <span className="text-sm font-semibold text-gray-400">
                  Bs. {bsPrice(product.price)}
                </span>
              </div>
            </div>

            <button
              onClick={handleLike}
              className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all duration-500 shadow-sm ${
                hasLiked
                  ? "bg-pink-50 border border-pink-100"
                  : "bg-white border border-gray-100 hover:bg-gray-50 active:scale-90"
              }`}
            >
              <span
                className={`text-2xl transition-all duration-500 ${
                  hasLiked ? "text-pink-500 scale-110 drop-shadow-md" : "text-gray-300 grayscale"
                }`}
              >
                {hasLiked ? "❤️" : "🤍"}
              </span>
              <span
                className={`text-[10px] font-black tracking-widest ${
                  hasLiked ? "text-pink-500" : "text-gray-400"
                }`}
              >
                {likesCount}
              </span>
            </button>
          </div>

          {product.description && (
            <div
              className="text-sm text-gray-500 leading-relaxed font-medium"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          )}

          {/* SELECTOR DE TALLAS CONECTADO AL ADMIN */}
          {hasVariants && (
            <div className="space-y-3 bg-gray-50 p-4 rounded-3xl border border-gray-100">
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex justify-between">
                <span>Selecciona tu talla</span>
                {!selectedVariant && (
                  <span className="text-red-500 animate-pulse">¡Requerido!</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVariant(v);
                      setQuantity(1);
                    }}
                    disabled={v.stock === 0}
                    className={`px-4 py-2 rounded-xl transition-all flex flex-col items-center border min-w-[70px] ${
                      selectedVariant === v
                        ? "bg-black text-white border-black shadow-lg scale-105"
                        : "bg-white text-gray-600 border-gray-200 shadow-sm hover:bg-gray-100"
                    } ${v.stock === 0 ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                  >
                    {/* AQUÍ ESTÁ LA CORRECCIÓN EXACTA: v.label */}
                    <span className="text-base font-black uppercase">
                      {v.label}
                    </span>
                    <span className={`text-[10px] font-medium mt-0.5 ${
                      selectedVariant === v ? "text-gray-300" : "text-gray-400"
                    }`}>
                      {v.stock > 0 ? `${v.stock} disp.` : "Agotado"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* BARRA DE STOCK Y CANTIDAD */}
          {(selectedVariant || !hasVariants) && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-gray-400">
                  <span>Disponibilidad</span>
                  <span className={isLowStock ? "text-red-500" : "text-green-500"}>
                    {availableStock} en stock
                  </span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isLowStock ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{ width: `${stockPercentage}%` }}
                  />
                </div>
                {isLowStock && availableStock > 0 && (
                  <p className="text-xs text-red-500 font-semibold text-right">
                    ¡Quedan pocas unidades! 🔥
                  </p>
                )}
              </div>

              {availableStock > 0 && (
                <div className="flex items-center justify-between bg-white border border-gray-100 p-2 rounded-2xl shadow-sm">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 pl-3">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center text-2xl font-medium text-gray-500 hover:text-black hover:bg-white rounded-lg transition-all shadow-sm active:scale-95"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-black text-lg">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                      className="w-10 h-10 flex items-center justify-center text-2xl font-medium text-gray-500 hover:text-black hover:bg-white rounded-lg transition-all shadow-sm active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* BOTÓN FINAL */}
          <button
            onClick={handleAddToCart}
            disabled={availableStock === 0 || (hasVariants && !selectedVariant)}
            className="w-full py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4"
            style={{
              background:
                availableStock === 0 || (hasVariants && !selectedVariant)
                  ? "#ccc"
                  : "var(--primary)",
            }}
          >
            {availableStock === 0
              ? "Agotado"
              : hasVariants && !selectedVariant
              ? "Elige una talla"
              : "Añadir a la Bolsa"}
            {availableStock > 0 && (hasVariants ? selectedVariant : true) && (
              <span className="text-xl">🛍️</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}