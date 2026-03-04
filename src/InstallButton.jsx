import React, { useState, useEffect } from 'react';

const InstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Evita que el navegador muestre el aviso automático por defecto
      e.preventDefault();
      // Guarda el evento para usarlo después
      setDeferredPrompt(e);
      // Muestra nuestro botón personalizado
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Muestra el mensaje de instalación original
    deferredPrompt.prompt();

    // Espera la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('El usuario aceptó instalar la App');
    }

    // Limpiamos el evento y ocultamos el botón
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      width: '90%',
      maxWidth: '400px'
    }}>
      <button
        onClick={handleInstallClick}
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '16px',
          fontWeight: 'bold',
          boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
          cursor: 'pointer'
        }}
      >
        📥 Descargar App de la Tienda
      </button>
    </div>
  );
};

export default InstallButton;