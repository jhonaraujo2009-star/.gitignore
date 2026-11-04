import { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { notifyNewOrder, unlockAudio, shouldNotifyOrder, markOrdersAsKnown } from "../utils/orderNotifications";
import { checkServerHealth } from "../utils/cloudinaryUpload";
import toast from "react-hot-toast";

// Admin sub-panels
import AdminSettings from "../components/admin/AdminSettings";
import AdminInterface from "../components/admin/AdminInterface";
import AdminSessions from "../components/admin/AdminSessions";
import AdminProducts from "../components/admin/AdminProducts";
import AdminInbox from "../components/admin/AdminInbox";
import AdminPayments from "../components/admin/AdminPayments";
import AdminControl from "../components/admin/AdminControl";
import AdminInvoice from "../components/admin/AdminInvoice";

const NAV_ITEMS = [
  { path: "/admin", label: "⚙️ Ajustes", end: true },
  { path: "/admin/control", label: "🎛️ Control" },
  { path: "/admin/facturar", label: "🧾 Facturar" },
  { path: "/admin/interfaz", label: "🎨 Interfaz" },
  { path: "/admin/sesiones", label: "📂 Sesiones" },
  { path: "/admin/productos", label: "📦 Productos" },
  { path: "/admin/inbox", label: "💬 Mensajería", badge: true },
  { path: "/admin/pagos", label: "🏦 Pagos" },
];

export default function AdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [serverOnline, setServerOnline] = useState(true);
  const [checkingServer, setCheckingServer] = useState(false);

  const verifyServer = async () => {
    setCheckingServer(true);
    const isOnline = await checkServerHealth();
    setServerOnline(isOnline);
    setCheckingServer(false);
  };

  useEffect(() => {
    verifyServer();
    const interval = setInterval(verifyServer, 30000); // Chequear cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const isInitialLoad = useRef(true);
  const isWidePage = location.pathname.includes("/admin/control") || location.pathname.includes("/admin/facturar");

  // Desbloqueo de audio global al interactuar con el panel
  useEffect(() => {
    const handleUserInteraction = () => {
      unlockAudio();
    };
    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("touchstart", handleUserInteraction);
    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };
  }, []);

  // Monitor en tiempo real de nuevos pedidos en todo el panel de administración
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPendingOrdersCount(snap.docs.length);

      // Si es la carga inicial, marcar todos los pedidos existentes como ya conocidos
      if (isInitialLoad.current) {
        markOrdersAsKnown(snap.docs.map((d) => d.id));
        isInitialLoad.current = false;
        return;
      }

      // Si entra un pedido nuevo, verificar que nunca haya sido notificado
      snap.docChanges().forEach((change) => {
        if (change.type === "added" && shouldNotifyOrder(change.doc.id)) {
          const newOrder = { id: change.doc.id, ...change.doc.data() };
          notifyNewOrder(newOrder);
          toast.success(`🛍️ ¡Nuevo pedido de ${newOrder.customerName || "Cliente"} ($${newOrder.totalAmount || ""})!`, {
            duration: 8000,
            icon: "🔔"
          });
        }
      });
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("Sesión cerrada");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex flex-col z-40 transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static`}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="font-black text-lg tracking-tight" style={{ color: "var(--primary)" }}>✨ Admin Panel</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Gestión & Tienda</p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Sistema en línea"></span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? "text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: "var(--primary)" } : {}
              }
            >
              <span>{item.label}</span>
              {item.badge && pendingOrdersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500 text-white animate-pulse">
                  {pendingOrdersCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          {/* Indicador de estado del servidor local */}
          <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between text-xs font-bold">
            <span className="text-gray-600">Servidor PC:</span>
            {serverOnline ? (
              <span className="text-emerald-600 flex items-center gap-1.5 font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
              </span>
            ) : (
              <span className="text-amber-600 flex items-center gap-1.5 font-black">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Offline
              </span>
            )}
          </div>

          <NavLink to="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            🏠 Ver tienda
          </NavLink>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-gray-50 text-gray-700">☰</button>
            <span className="font-black text-gray-900 text-sm">Admin Panel</span>
          </div>
          
          <div className="flex items-center gap-2">
            <NavLink
              to="/admin/inbox"
              className="relative p-2 rounded-xl bg-pink-50 text-pink-600 font-bold text-xs flex items-center gap-1"
            >
              <span>💬</span>
              {pendingOrdersCount > 0 && (
                <span className="bg-pink-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {pendingOrdersCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{ background: "var(--primary)" }}
            >
              🏠 Tienda
            </NavLink>
          </div>
        </div>

        <div className={`p-4 lg:p-8 ${isWidePage ? "max-w-6xl" : "max-w-3xl"}`}>
          {/* Banner de Modo Solo Lectura si la PC servidor está apagada */}
          {!serverOnline && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm uppercase tracking-wide text-amber-950">
                    Modo Solo Lectura Activado
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider">
                    PC Desconectada
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1.5 leading-relaxed font-medium">
                  El servidor local de tu PC está apagado. <strong>Tu tienda sigue 100% activa y visible para tus clientes en la nube</strong>, pero no podrás subir imágenes de productos hasta que enciendas tu PC servidor.
                </p>
              </div>
              <button
                onClick={verifyServer}
                disabled={checkingServer}
                className="px-3 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 text-xs font-black transition-colors flex-shrink-0"
              >
                {checkingServer ? "..." : "🔄 Reintentar"}
              </button>
            </div>
          )}

          <Routes>
            <Route index element={<AdminSettings />} />
            <Route path="control" element={<AdminControl />} />
            <Route path="facturar" element={<AdminInvoice />} />
            <Route path="interfaz" element={<AdminInterface />} />
            <Route path="sesiones" element={<AdminSessions />} />
            <Route path="productos" element={<AdminProducts />} />
            <Route path="inbox" element={<AdminInbox />} />
            <Route path="pagos" element={<AdminPayments />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}