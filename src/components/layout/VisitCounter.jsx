import { useState, useRef, useEffect } from "react";
import { useVisits } from "../../hooks/useVisits";

export default function VisitCounter() {
  const { total, dailyCounts } = useVisits();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const menuRef = useRef(null);

  // Cerrar al hacer click afuera
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Lógica del Calendario (Mes Actual)
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Dom) - 6 (Sab)
  
  // Nombres de los meses y días
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayNames = ["D", "L", "M", "M", "J", "V", "S"];

  // Generar array de días para el grid (incluyendo espacios vacíos)
  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Formato para buscar en Firebase: YYYY-MM-DD
  const getFormatDate = (day) => {
    if (!day) return null;
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Visitas del día hovereado
  const hoveredDateStr = getFormatDate(hoveredDay);
  const hoveredVisits = hoveredDateStr ? (dailyCounts[hoveredDateStr] || 0) : null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Botón Principal (Contador) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-2 rounded-full hover:bg-pink-50 transition-colors active:scale-90 border border-transparent hover:border-pink-100 group"
      >
        <div className="relative flex items-center justify-center">
          <svg className="w-[20px] h-[20px] text-gray-700 group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <span className="text-xs font-black text-gray-800 tracking-wider">
          {total > 0 ? (total > 999 ? '999+' : total) : '-'}
        </span>
      </button>

      {/* Menú Desplegable (Calendario Premium) */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-72 bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(236,72,153,0.15)] border border-white/60 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          
          {/* Header del Calendario: Muestra Info del día seleccionado o Totales */}
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-100 mb-1">
                {hoveredDay ? `${hoveredDay} de ${monthNames[month]}` : "Visitas Históricas"}
              </p>
              <h3 className="text-3xl font-black text-white drop-shadow-md">
                {hoveredDay ? hoveredVisits : total}
              </h3>
              <p className="text-xs text-pink-50 font-medium mt-1 opacity-90">
                {hoveredDay ? "Vistas este día" : "Vistas en total"}
              </p>
            </div>
          </div>

          {/* Cuerpo del Calendario */}
          <div className="p-4 bg-white/50">
            <div className="text-center mb-3">
              <span className="text-sm font-black text-gray-800 uppercase tracking-widest">{monthNames[month]} {year}</span>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((d, i) => (
                <div key={i} className="text-center text-[9px] font-black text-gray-400 uppercase">
                  {d}
                </div>
              ))}
            </div>

            {/* Cuadrícula de fechas */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const dateStr = getFormatDate(day);
                const visits = dateStr ? (dailyCounts[dateStr] || 0) : 0;
                
                // Determinar la intensidad del color basado en las visitas (Heatmap ligero)
                let bgColor = "bg-transparent";
                let textColor = "text-gray-600";
                
                if (day) {
                  if (visits > 50) { bgColor = "bg-pink-500"; textColor = "text-white font-bold shadow-md"; }
                  else if (visits > 20) { bgColor = "bg-pink-300"; textColor = "text-gray-900 font-bold"; }
                  else if (visits > 0) { bgColor = "bg-pink-100"; textColor = "text-gray-800"; }
                  else { bgColor = "hover:bg-gray-50"; }
                }

                const isToday = day === today.getDate();

                return (
                  <div 
                    key={index}
                    onMouseEnter={() => day && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`aspect-square flex items-center justify-center rounded-xl text-xs transition-all duration-300 cursor-default
                      ${day ? 'cursor-pointer' : ''} 
                      ${bgColor} ${textColor}
                      ${isToday && visits === 0 ? 'border border-pink-500 text-pink-600 font-bold' : ''}
                      ${day ? 'hover:scale-110 hover:shadow-lg hover:z-10 relative' : ''}
                    `}
                  >
                    {day || ""}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
