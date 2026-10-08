import { useState, useCallback, useEffect, useRef } from "react";
import AnnouncementBar from "../components/layout/AnnouncementBar";
import Header from "../components/layout/Header";
import HeroBanner from "../components/layout/HeroBanner";
import QuickButtons from "../components/layout/QuickButtons";
import ProductCatalog from "../components/product/ProductCatalog";
import ProductModal from "../components/product/ProductModal";
import CartDrawer from "../components/cart/CartDrawer";
import Footer from "../components/layout/Footer";
import InstallButton from "../InstallButton";
import WhatsAppVIP from "../components/layout/WhatsAppVIP";

import { useCart } from "../context/CartContext";
import { useApp } from "../context/AppContext";

export default function StorePage() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const { itemCount, total, setIsOpen, isOpen } = useCart();
  const { bsPrice } = useApp();

  // Ref para evitar push duplicados al historial
  const isPopStateNav = useRef(false);

  const showFloatingElements = !isOpen && !selectedProduct;

  // Wrapper para cambiar filtro: empuja estado al historial y hace scroll arriba
  const handleFilter = useCallback((filter) => {
    const newFilter = filter || "all";

    // Si la navegación viene del popstate, no empujamos de nuevo al historial
    if (isPopStateNav.current) {
      isPopStateNav.current = false;
      setActiveFilter(newFilter);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Solo empujamos al historial si estamos cambiando de filtro
    if (newFilter !== activeFilter) {
      window.history.pushState({ filter: newFilter }, "");
    }

    setActiveFilter(newFilter);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeFilter]);

  // Listener del botón atrás: navega entre filtros en vez de salir de la app
  useEffect(() => {
    // Guardar el estado inicial en el historial (reemplazamos, no empujamos)
    window.history.replaceState({ filter: "all" }, "");

    const handlePopState = (e) => {
      // Si hay un modal abierto, el modal ya maneja su propio popstate
      if (selectedProduct) return;

      const state = e.state;
      if (state?.filter) {
        // Navegar al filtro anterior
        isPopStateNav.current = true;
        handleFilter(state.filter);
      } else {
        // Si no hay estado de filtro, volver a "all" (inicio)
        isPopStateNav.current = true;
        handleFilter("all");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedProduct, handleFilter]);

  // Cerrar el modal: si se cierra por X o tap afuera, hacer history.back 
  // para remover el state que empujó el modal
  const closeProduct = useCallback(() => {
    if (selectedProduct) {
      setSelectedProduct(null);
      // El popstate listener del modal ya lo manejará si se cierra por botón atrás
      // Solo hacemos back si hay un state modal en el historial
      if (window.history.state?.modal) {
        window.history.back();
      }
    }
  }, [selectedProduct]);

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="fixed top-0 left-0 right-0 z-40">
        <AnnouncementBar />
        {/* 🌟 MAGIA: Le pasamos 'onFilter' al Header para abrir Favoritos */}
        <Header onProductClick={setSelectedProduct} onFilter={handleFilter} />
      </div>

      <div className="pt-28">
        <div className="max-w-md mx-auto">
          <HeroBanner activeFilter={activeFilter} />
          <QuickButtons onFilter={handleFilter} />
          
          <ProductCatalog
            activeFilter={activeFilter}
            onProductClick={setSelectedProduct}
            onFilter={handleFilter} 
          />
          
          <Footer />
        </div>
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={closeProduct}
        />
      )}
      
      <CartDrawer />
      
      {showFloatingElements && <WhatsAppVIP />}
      
      <InstallButton />

      {showFloatingElements && itemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md h-[72px] bg-white/70 backdrop-blur-2xl rounded-full flex items-center justify-between p-1.5 pr-2.5 shadow-[0_20px_50px_rgba(236,72,153,0.15),0_10px_10px_rgba(0,0,0,0.05)] border border-white/60 animate-in slide-in-from-bottom-10 fade-in duration-700 active:scale-[0.98] transition-transform shadow-[0_0_25px_-5px_rgba(236,72,153,0.3)]">
          <div className="flex-1 flex flex-col justify-center px-6">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-gray-500 uppercase tracking-tighter">Total:</span>
              <span className="text-2xl font-black text-gray-950 tracking-tight">${total.toFixed(2)}</span>
            </div>
            <span className="text-[11px] font-bold text-gray-400 mt-[-1px] uppercase tracking-wider">
              Bs. {bsPrice(total)}
            </span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="h-[58px] min-w-[150px] bg-gray-950 text-white rounded-full font-black uppercase tracking-[0.2em] text-[11px] relative overflow-hidden group active:scale-95 transition-all flex items-center justify-center gap-2.5 shadow-inner"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
            Ver Bolsa
            <span className="text-base group-hover:animate-bounce transition-transform">🛍️</span>
            <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-xl shadow-pink-500/30 animate-pulse-subtle">
              {itemCount}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}