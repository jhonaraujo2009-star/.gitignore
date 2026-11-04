// Si se abre desde Vercel (incluyendo PWA y cache viejo), borrar cache y saltar a lkth91ofertas.com
if (window.location.hostname.includes("vercel.app")) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister();
    });
  }
  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) caches.delete(name);
    });
  }
  window.location.replace("https://lkth91ofertas.com" + window.location.pathname + window.location.search);
}

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; 
import App from "./App.jsx";
// Línea mágica para registrar la aplicación móvil
import { registerSW } from 'virtual:pwa-register';

// Registro del Service Worker para que sea instalable
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);