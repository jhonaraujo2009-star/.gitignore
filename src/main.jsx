import React from "react";
import ReactDOM from "react-dom/client";
// El CSS siempre debe ir ARRIBA de App para que los estilos existan al renderizar
import "./index.css"; 
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);