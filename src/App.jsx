import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Contextos
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

// Protegida
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Páginas
import StorePage from "./pages/StorePage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import QuestionsPage from "./pages/QuestionsPage";

// IMPORTACIÓN DEL BOTÓN DE INSTALACIÓN
import InstallButton from "./InstallButton";

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

            {/* AQUÍ SE MUESTRA EL BOTÓN SI LA APP NO ESTÁ INSTALADA */}
            <InstallButton />
            
          </CartProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}