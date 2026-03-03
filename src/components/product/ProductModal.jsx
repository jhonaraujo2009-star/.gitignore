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
      return toast.error("Selecciona una talla o medida (mg)");

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
      {/* CONTENEDOR OPTIMIZADO (10% MÁS COMPACTO) */}
      <div className="relative bg-white w-[92%] sm:w-full max-w-sm rounded-[2.5rem] sm:rounded-3xl max-h-[88vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-500">

        {/* BOTÓN CERRAR PREMIUM (SIEMPRE VISIBLE) */}
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
                    (i) =>
                      (i - 1 + product.images.length) %
                      product.images.length
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

        {/* CONTENIDO */}
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
                  hasLiked
                    ? "text-pink-500 scale-110 drop-shadow-md"
                    : "text-gray-300 grayscale"
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

          {/* BOTÓN FINAL */}
          <button
            onClick={handleAddToCart}
            disabled={availableStock === 0}
            className="w-full py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{
              background:
                availableStock === 0 ? "#ccc" : "var(--primary)",
            }}
          >
            {availableStock === 0
              ? "No Disponible"
              : "Añadir a la Bolsa"}
            {availableStock > 0 && (
              <span className="text-xl">🛍️</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}