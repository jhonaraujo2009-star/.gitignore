import { useApp } from "../../context/AppContext";

export default function ProductCard({ product, onClick }) {
  const { bsPrice } = useApp();

  const productThumbnail = product.image || (product.images && product.images[0]) || product.imageUrl;

  const totalStock = product.variants?.length
    ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (product.totalStock ?? 0);

  const isSoldOut = totalStock === 0;
  // LÓGICA: Si quedan 5 o menos, la alerta de stock será naranja
  const lowStock = totalStock > 0 && totalStock <= 5;

  return (
    <button
      onClick={() => !isSoldOut && onClick(product)}
      className={`relative text-left bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-95 border border-gray-100 w-full ${isSoldOut ? "opacity-70 cursor-default" : "cursor-pointer"}`}
    >
      <div className="relative aspect-square overflow-hidden bg-pink-50">
        {productThumbnail ? (
          <img
            src={productThumbnail}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-[10px] text-gray-400 p-2 text-center">Error al cargar foto</div>';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <span className="text-2xl mb-1">📷</span>
            <span className="text-[10px]">Sin foto</span>
          </div>
        )}

        {/* NUEVO: Etiqueta de Stock en la foto */}
        {!isSoldOut && (
          <div className="absolute top-2 right-2 z-10">
            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider backdrop-blur-md shadow-sm border ${lowStock ? "bg-orange-500/90 text-white border-orange-400 animate-pulse" : "bg-white/80 text-gray-700 border-white/50"}`}>
              Quedan {totalStock}
            </span>
          </div>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <span className="bg-white text-black text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-[12px] font-bold text-gray-800 leading-tight line-clamp-2 h-8 mb-1">
          {product.name}
        </h3>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-black text-pink-600">
            ${product.price}
          </span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
            Bs. {bsPrice(product.price)}
          </span>
        </div>
      </div>
    </button>
  );
}