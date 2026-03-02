import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Contextos (Están en src/context/)
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

// Protegida (Está en src/components/shared/)
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Páginas (Están en src/pages/)
import StorePage from "./pages/StorePage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import QuestionsPage from "./pages/QuestionsPage";

export default function App() {
  return (
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
          </CartProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
