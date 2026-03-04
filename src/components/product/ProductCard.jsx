import { useApp } from "../../context/AppContext";

export default function ProductCard({ product, onClick, rank }) {
  const { bsPrice } = useApp();

  const productThumbnail = product.image || (product.images && product.images[0]) || product.imageUrl;

  const totalStock = product.variants?.length
    ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (product.totalStock ?? 0);

  const isSoldOut = totalStock === 0;
  const lowStock = totalStock > 0 && totalStock <= 5;

  // Lógica de Descuento Corregida (Usando oldPrice y offerEndsAt del Admin)
  const oldPrice = Number(product.oldPrice) || 0;
  const currentPrice = Number(product.price) || 0;
  const isFlashOffer = product.offerEndsAt && product.offerEndsAt > Date.now();
  
  const hasDiscount = (oldPrice > currentPrice) || isFlashOffer;
  
  let discountPercentage = 0;
  if (isFlashOffer && product.offerDiscount) {
    discountPercentage = Number(product.offerDiscount);
  } else if (oldPrice > currentPrice) {
    discountPercentage = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  }

  return (
    <button
      onClick={() => !isSoldOut && onClick(product)}
      className={`relative text-left bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 active:scale-95 border border-gray-100 w-full group ${isSoldOut ? "opacity-70 cursor-default" : "cursor-pointer"}`}
    >
      {/* RANGO TOP VENTAS (Copa y número saltarín - Arriba a la Izquierda) */}
      {rank && (
        <div className="absolute top-3 left-3 z-30 flex flex-col items-center">
          <div className="relative animate-bounce">
             <span className={`flex items-center justify-center w-8 h-8 rounded-full shadow-lg font-black text-xs border-2 ${
               rank === 1 ? "bg-yellow-400 border-yellow-200 text-yellow-900" :
               rank === 2 ? "bg-slate-300 border-slate-100 text-slate-700" :
               rank === 3 ? "bg-orange-400 border-orange-200 text-orange-900" :
               "bg-white border-gray-100 text-gray-400"
             }`}>
               {rank <= 3 ? "🏆" : rank}
             </span>
          </div>
        </div>
      )}

      <div className="relative aspect-[4/5] overflow-hidden bg-gray-50">
        {productThumbnail && (
          <img src={productThumbnail} alt={product.name} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
        )}

        {/* ETIQUETA DE STOCK PRO (Arriba a la Derecha - Titila si queda poco) */}
        {!isSoldOut && (
          <div className="absolute top-3 right-3 z-20">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md border ${
              lowStock 
                ? "bg-red-500/95 text-white border-red-400 animate-pulse" 
                : "bg-white/90 text-gray-800 border-white/50"
            }`}>
              <span className={lowStock ? "text-white" : "text-green-500"}>●</span> Quedan {totalStock}
            </span>
          </div>
        )}

        {/* ETIQUETA DE DESCUENTO PRO 🔥 (Abajo a la Derecha para no chocar) */}
        {hasDiscount && !isSoldOut && discountPercentage > 0 && (
          <div className="absolute bottom-3 right-3 z-20">
            <div className="bg-red-600 text-white flex flex-col items-center justify-center w-11 h-11 rounded-full shadow-xl border-2 border-white animate-pulse">
              <span className="text-[10px] font-black leading-none">-{discountPercentage}%</span>
              <span className="text-[7px] font-bold uppercase">OFF</span>
            </div>
          </div>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="bg-white text-black text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-2xl">Agotado</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-white">
        <h3 className="text-[13px] font-bold text-gray-800 leading-tight line-clamp-2 h-9 mb-1 group-hover:text-pink-600 transition-colors uppercase">
          {product.name}
        </h3>
        
        <div className="flex flex-col">
          {hasDiscount ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-red-600">${product.price}</span>
                {oldPrice > 0 && <span className="text-xs font-bold text-gray-400 line-through">${oldPrice}</span>}
              </div>
              <div className="flex items-center gap-1">
                {isFlashOffer ? (
                  <span className="text-[8px] font-black text-white bg-red-600 px-1.5 rounded-sm uppercase tracking-tighter animate-pulse">⚡ Flash</span>
                ) : (
                  <span className="text-[8px] font-black text-white bg-orange-500 px-1.5 rounded-sm uppercase tracking-tighter">🔥 Oferta</span>
                )}
                <span className="text-[9px] text-gray-400 font-bold uppercase">Bs. {bsPrice(product.price)}</span>
              </div>
            </div>
          ) : (
            <>
              <span className="text-lg font-black text-gray-900">${product.price}</span>
              <span className="text-[9px] text-gray-400 font-bold uppercase">Bs. {bsPrice(product.price)}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}