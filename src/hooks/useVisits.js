import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../config/firebase";

export function useVisits() {
  const [stats, setStats] = useState({ total: 0, dailyCounts: {} });

  useEffect(() => {
    const trackAndFetch = async () => {
      // Obtener fecha actual en formato YYYY-MM-DD
      const today = new Date().toISOString().split("T")[0];
      const lastVisit = localStorage.getItem("lastVisitDate");
      const docRef = doc(db, "stats", "visits");

      try {
        let currentDoc = await getDoc(docRef);
        
        // Si no existe el documento de estadísticas, lo creamos
        if (!currentDoc.exists()) {
          await setDoc(docRef, { total: 0, dailyCounts: {} });
          currentDoc = await getDoc(docRef);
        }

        // Si es su primera visita hoy, incrementamos
        if (lastVisit !== today) {
          await updateDoc(docRef, {
            total: increment(1),
            [`dailyCounts.${today}`]: increment(1)
          });
          localStorage.setItem("lastVisitDate", today);
          // Recargamos los datos actualizados
          currentDoc = await getDoc(docRef);
        }

        setStats(currentDoc.data() || { total: 0, dailyCounts: {} });
      } catch (error) {
        console.error("Error con el tracking de visitas:", error);
      }
    };

    trackAndFetch();
  }, []);

  return stats;
}
