import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD5iVtSrxvJpZEsjS1YvaRg3B6D2WHjXzY",
  authDomain: "tiendajhonaraujo.firebaseapp.com",
  projectId: "tiendajhonaraujo",
  storageBucket: "tiendajhonaraujo.firebasestorage.app",
  messagingSenderId: "48382191900",
  appId: "1:48382191900:web:08c651b3c3137e153572d9"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios para que el Login y los Productos funcionen
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 

export default app;