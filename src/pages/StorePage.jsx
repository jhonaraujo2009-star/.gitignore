import { useState } from "react";
import AnnouncementBar from "../components/layout/AnnouncementBar";
import Header from "../components/layout/Header";
import HeroBanner from "../components/layout/HeroBanner";
import QuickButtons from "../components/layout/QuickButtons";
import ProductCatalog from "../components/product/ProductCatalog";
import ProductModal from "../components/product/ProductModal";
import CartDrawer from "../components/cart/CartDrawer";
import Footer from "../components/layout/Footer";
import InstallButton from "../InstallButton"; // Tu botón de App

export default function StorePage() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0 z-40">
        <AnnouncementBar />
        <Header onProductClick={setSelectedProduct} />
      </div>

      <div className="pt-28">
        <div className="max-w-md mx-auto">
          <HeroBanner activeFilter={activeFilter} />
          <QuickButtons onFilter={setActiveFilter} />
          
          <ProductCatalog
            activeFilter={activeFilter}
            onProductClick={setSelectedProduct}
            onFilter={setActiveFilter} 
          />
          
          <Footer />
        </div>
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      <CartDrawer />
      <InstallButton />
    </div>
  );
}