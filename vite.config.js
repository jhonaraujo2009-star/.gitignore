import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Fuerza a la aplicación a buscar actualizaciones automáticamente
      registerType: 'autoUpdate',
      
      // Archivos estáticos que deben estar disponibles offline por defecto
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      
      // Configuración de Workbox (El "cerebro" del Service Worker)
      workbox: {
        cleanupOutdatedCaches: true, // Elimina versiones antiguas de la app en el celular del cliente
        clientsClaim: true,          // Toma el control de la app inmediatamente sin recargar
        skipWaiting: true,           // Fuerza a que la nueva versión se instale sin esperar
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'] // Asegura que descargue todo lo necesario
      },
      
      // El Manifiesto que lee Android para instalar la App
      manifest: {
        id: '/',                     // 🌟 CRÍTICO: Requisito moderno de Android para identificar la app de forma única
        start_url: '/',              // 🌟 Indica dónde debe empezar la app al abrirse
        scope: '/',                  // Define el alcance de la navegación dentro de la PWA
        name: 'Luckathys Shop',
        short_name: 'Luckathys',
        description: 'La mejor tienda de moda',
        theme_color: '#ffffff',      // Color de la barra de notificaciones del celular
        background_color: '#ffffff', // Color del fondo mientras carga la app
        display: 'standalone',       // Oculta la barra del navegador (se ve como app nativa)
        orientation: 'portrait',     // Fuerza a que se abra en vertical
        categories: ['shopping', 'lifestyle'], // Ayuda a que el sistema operativo la clasifique correctamente
        lang: 'es',                  // Idioma principal (importante para accesibilidad y SO)
        dir: 'ltr',                  // Dirección del texto (Left to Right)
        icons: [
          {
            src: '/logo192.png',
            sizes: '192x192',
            type: 'image/png',
            // 🌟 CRÍTICO: 'maskable' permite a Android adaptar el ícono a las formas 
            // del sistema (círculo, cuadrado redondeado) sin ponerle bordes blancos feos.
            purpose: 'any maskable'  
          },
          {
            src: '/logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
})