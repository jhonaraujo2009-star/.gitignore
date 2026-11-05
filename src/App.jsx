import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Contextos
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

// Protegida
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Página principal de la tienda (carga inmediata para máxima velocidad al cliente)
import StorePage from "./pages/StorePage";

// Páginas secundarias y Panel Admin (Code-Splitting: solo se descargan cuando se visitan)
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const QuestionsPage = lazy(() => import("./pages/QuestionsPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    // 🌟 AQUÍ ESTÁ LA MAGIA: El Fondo de Seda Premium 🌟
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50/60 to-pink-50/20 text-gray-900 selection:bg-pink-200 selection:text-pink-900 transition-colors duration-500">
      <BrowserRouter>
        <AuthProvider>
          <AppProvider>
            <CartProvider>
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3000,
                  style: {
                    borderRadius: "16px",
                    background: "#fff",
                    color: "#333",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    fontSize: "14px",
                    fontWeight: "500",
                  },
                }}
              />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<StorePage />} />
                  <Route path="/preguntas" element={<QuestionsPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute>
                        <AdminPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </CartProvider>
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
