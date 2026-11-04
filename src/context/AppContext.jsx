import { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { checkServerHealth } from "../utils/cloudinaryUpload";

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  exchangeRate: 36.5,
  whatsappNumber: "584120496690",
  freeShippingGoal: 50,
  primaryColor: "#ec4899",
  announcementText: "🚚 Envíos gratis por MRW a partir de $50",
  appName: "Luckathys Shop",
  appShortName: "Luckathys",
  profileImage: "",
  appIcon: "",
  splashImage: "",
  splashEnabled: true,
  heroTitle: "Moda & Belleza ✨",
  heroDescription: "Descubre nuestra colección exclusiva de ropa y maquillaje. Calidad y estilo en un solo lugar.",
  socialLinks: {
    instagram: "",
    tiktok: "",
    facebook: "",
    twitter: "",
  },
  quickButtons: [
    { id: "1", label: "Catálogo", icon: "🛍️", filter: "all" },
    { id: "2", label: "Ofertas", icon: "🔥", filter: "ofertas" },
    { id: "3", label: "Ropa", icon: "👗", filter: "ropa" },
    { id: "4", label: "Maquillaje", icon: "💄", filter: "maquillaje" },
  ],
  legalText: "Todos los precios están expresados en dólares americanos (USD). Los precios en bolívares son referenciales basados en la tasa del día.",
  happyCustomerImages: [],
};

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(true);
  const [checkingServer, setCheckingServer] = useState(false);

  const verifyServer = async () => {
    setCheckingServer(true);
    const isOnline = await checkServerHealth();
    setServerOnline(isOnline);
    setCheckingServer(false);
    return isOnline;
  };

  useEffect(() => {
    verifyServer();
    const interval = setInterval(verifyServer, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "settings"), (snap) => {
      if (snap.exists()) {
        setSettings((prev) => ({ ...prev, ...snap.data() }));
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Apply primary color CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", settings.primaryColor);
  }, [settings.primaryColor]);

  // Actualizar el título, favicon, apple-touch-icon y manifest de la APK automáticamente
  useEffect(() => {
    if (!settings) return;

    if (settings.appName) {
      document.title = settings.appName;
    }

    if (settings.appIcon) {
      // 1. Favicon de la pestaña del navegador
      let linkIcon = document.querySelector("link[rel*='icon']");
      if (!linkIcon) {
        linkIcon = document.createElement("link");
        linkIcon.rel = "icon";
        document.head.appendChild(linkIcon);
      }
      linkIcon.href = settings.appIcon;

      // 2. Icono de pantalla de inicio en iOS (Apple Touch Icon)
      let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
      if (!appleIcon) {
        appleIcon = document.createElement("link");
        appleIcon.rel = "apple-touch-icon";
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = settings.appIcon;

      // 3. Manifiesto dinámico para la instalación de la APK / PWA en Android
      try {
        const manifestData = {
          id: "/",
          start_url: "/",
          scope: "/",
          name: settings.appName || "Luckathys Shop",
          short_name: settings.appShortName || settings.appName || "Luckathys",
          description: "Tienda online",
          theme_color: settings.primaryColor || "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          categories: ["shopping", "lifestyle"],
          lang: "es",
          dir: "ltr",
          icons: [
            {
              src: settings.appIcon,
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: settings.appIcon,
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        };
        const blob = new Blob([JSON.stringify(manifestData)], { type: "application/manifest+json" });
        const manifestUrl = URL.createObjectURL(blob);
        let manifestTag = document.querySelector("link[rel='manifest']");
        if (manifestTag) {
          manifestTag.setAttribute("href", manifestUrl);
        } else {
          manifestTag = document.createElement("link");
          manifestTag.rel = "manifest";
          manifestTag.href = manifestUrl;
          document.head.appendChild(manifestTag);
        }
      } catch (err) {
        console.warn("No se pudo generar el manifiesto dinámico", err);
      }
    }
  }, [settings?.appName, settings?.appShortName, settings?.appIcon, settings?.primaryColor]);

  const updateSettings = async (updates) => {
    await setDoc(doc(db, "config", "settings"), updates, { merge: true });
  };

  const bsPrice = (usdPrice) => {
    return (usdPrice * settings.exchangeRate).toFixed(2);
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        bsPrice,
        serverOnline,
        checkingServer,
        verifyServer,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
