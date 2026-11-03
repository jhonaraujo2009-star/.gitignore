# Plan de Migración a Servidor Propio y Almacenamiento Local

Este documento contiene todo el contexto, decisiones y pasos técnicos acordados para continuar la configuración en la nueva PC servidor.

---

## 1. Contexto del Proyecto
- **Frontend actual:** React 18 + Vite + TailwindCSS.
- **Base de Datos y Autenticación:** Firebase Firestore y Firebase Auth (`src/config/firebase.js`).
- **Cambio de arquitectura:**
  - Se deja de usar **Cloudinary** para subir y hospedar imágenes.
  - La nueva PC funcionará como **servidor local de almacenamiento y hosting**.
  - Las imágenes se guardarán físicamente en el disco duro de la PC en la carpeta `/uploads`.
  - Se conectará un **dominio propio** comprado por el usuario.

---

## 2. Componentes que se configurarán en la nueva PC
1. **Backend ligero (Node.js + Express + Multer):**
   - Archivo: `server.js` en la raíz del proyecto.
   - Endpoint `POST /api/upload`: Recibe la imagen desde el panel de administración y la guarda en la carpeta local `uploads/`.
   - Sirve la carpeta `uploads/` de forma estática para que las imágenes sean públicas: `https://tudominio.com/uploads/nombre-imagen.webp`.
   - Sirve la aplicación React compilada (`dist/`).
2. **Frontend:**
   - Adaptar `src/utils/cloudinaryUpload.js` para que suba los archivos a `/api/upload` en vez de a Cloudinary.
3. **Migración de fotos viejas de Cloudinary:**
   - Las fotos descargadas de Cloudinary se colocarán en `TiendaJhon/uploads/`.
   - Script para actualizar en Firestore las URLs que apuntaban a `res.cloudinary.com` para que apunten al nuevo dominio.
4. **Gestión de procesos (24/7):**
   - **PM2** (`pm2 start server.js --name "tienda" && pm2 save`) para que el servidor nunca se apague.
5. **Conexión del Dominio a Internet:**
   - **Cloudflare Tunnels (`cloudflared`)**: Conecta el dominio con el puerto local de la PC sin necesidad de abrir puertos en el router ni lidiar con IP dinámica.

---

## 3. Pasos inmediatos al abrir Antigravity en la otra PC
1. Abrir la carpeta `TiendaJhon` en Antigravity.
2. Ejecutar `npm install` en la terminal.
3. Pedir a Antigravity: *"Lee MIGRACION_SERVIDOR.md y continuemos con la configuración del server.js y la carpeta uploads"*.
