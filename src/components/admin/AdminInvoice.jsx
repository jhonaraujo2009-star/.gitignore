import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp, updateDoc, doc
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useApp } from "../../context/AppContext";
import toast from "react-hot-toast";

const DAYS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatTime(d) { return d.toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit",hour12:true}); }

export default function AdminInvoice() {
  const { bsPrice } = useApp();
  const [products, setProducts] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("invoice");
  const [sales, setSales] = useState([]);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
    const start = `${y}-${String(m+1).padStart(2,"0")}-01`;
    const endY = m+1 >= 12 ? y+1 : y;
    const endM = m+1 >= 12 ? 1 : m+2;
    const endStr = `${endY}-${String(endM).padStart(2,"0")}-01`;
    const unsub = onSnapshot(
      query(collection(db, "invoices"), where("date",">=",start), where("date","<",endStr), orderBy("date","desc")),
      snap => setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [calendarMonth]);

  const filtered = search.trim() ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).slice(0,6) : [];

  const addItem = (product) => {
    setInvoiceItems(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id ? {...i, qty: i.qty+1} : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, image: product.images?.[0]||"", qty: 1 }];
    });
    setSearch("");
    toast.success(`+ ${product.name}`);
  };

  const updateQty = (id, qty) => { if (qty < 1) return removeItem(id); setInvoiceItems(p => p.map(i => i.productId===id ? {...i, qty} : i)); };
  const removeItem = (id) => setInvoiceItems(p => p.filter(i => i.productId !== id));
  const invoiceTotal = invoiceItems.reduce((s,i) => s + i.price*i.qty, 0);
  const totalItems = invoiceItems.reduce((s,i) => s + i.qty, 0);

  const confirmInvoice = async () => {
    if (!invoiceItems.length) return toast.error("Agrega productos");
    setSaving(true);
    try {
      const now = new Date();
      await addDoc(collection(db, "invoices"), {
        items: invoiceItems, total: invoiceTotal,
        customerName: customerName.trim() || "Cliente General",
        paymentMethod, date: toDateStr(now), dayOfWeek: DAYS_ES[now.getDay()],
        time: formatTime(now), createdAt: serverTimestamp(),
      });
      for (const item of invoiceItems) {
        const prod = products.find(p => p.id === item.productId);
        if (prod && !prod.variants?.length) {
          await updateDoc(doc(db, "products", item.productId), { totalStock: Math.max(0, (prod.totalStock||0) - item.qty) });
        }
      }
      toast.success("✅ Factura registrada");
      setInvoiceItems([]); setCustomerName(""); setPaymentMethod("Efectivo");
    } catch(e) { console.error(e); toast.error("Error"); } finally { setSaving(false); }
  };

  // Print invoice
  const printInvoice = (sale) => {
    const w = window.open("","_blank","width=400,height=600");
    const itemsHtml = sale.items?.map(i =>
      `<tr><td style="padding:4px 0;font-size:12px">${i.name}</td><td style="text-align:center;font-size:12px">${i.qty}</td><td style="text-align:right;font-size:12px">$${i.price.toFixed(2)}</td><td style="text-align:right;font-size:12px;font-weight:700">$${(i.price*i.qty).toFixed(2)}</td></tr>`
    ).join("") || "";
    w.document.write(`<!DOCTYPE html><html><head><title>Factura</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;max-width:380px;margin:0 auto}h1{font-size:18px;text-align:center;margin-bottom:2px}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;color:#888;padding:6px 0;border-bottom:1px solid #ddd}td{border-bottom:1px solid #f0f0f0}.total-row td{border-top:2px solid #333;border-bottom:none;padding-top:8px;font-weight:900;font-size:14px}@media print{body{padding:10px}}</style></head><body>
    <h1>✨ LUCKATHYS SHOP</h1>
    <p style="text-align:center;font-size:10px;color:#888;margin-bottom:16px">FACTURA DE VENTA</p>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span><b>Cliente:</b> ${sale.customerName}</span><span><b>Pago:</b> ${sale.paymentMethod}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:12px;color:#666"><span>${sale.dayOfWeek} · ${sale.date}</span><span>${sale.time}</span></div>
    <table><thead><tr><th>Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">P.Unit</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsHtml}<tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right;font-size:16px">$${sale.total?.toFixed(2)}</td></tr><tr><td colspan="3" style="font-size:11px;color:#888;padding-top:2px">Bs.</td><td style="text-align:right;font-size:11px;color:#888">${bsPrice(sale.total||0)}</td></tr></tbody></table>
    <p style="text-align:center;font-size:10px;color:#aaa;margin-top:20px">¡Gracias por su compra!</p>
    <script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  };

  // Calendar
  const getDaysInMonth = (d) => new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  const getFirstDay = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const salesForDate = (ds) => sales.filter(s => s.date === ds);
  const selectedSales = salesForDate(selectedDate);
  const selectedTotal = selectedSales.reduce((s,sale) => s + (sale.total||0), 0);

  const calendarCells = () => {
    const days = getDaysInMonth(calendarMonth), first = getFirstDay(calendarMonth), cells = [];
    for (let i=0; i<first; i++) cells.push(<div key={`e${i}`} />);
    for (let d=1; d<=days; d++) {
      const ds = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const has = salesForDate(ds).length > 0;
      const sel = ds === selectedDate;
      const today = ds === toDateStr(new Date());
      cells.push(
        <button key={d} onClick={() => setSelectedDate(ds)}
          className={`h-8 w-full rounded-lg text-xs font-bold transition-all relative
            ${sel ? "bg-purple-600 text-white" : today ? "bg-purple-50 text-purple-600" : "hover:bg-gray-50 text-gray-600"}`}>
          {d}
          {has && <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${sel?"bg-white":"bg-green-500"}`}/>}
        </button>
      );
    }
    return cells;
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-black text-gray-900">🧾 {view==="invoice"?"Facturar":"Historial"}</h2>
        <div className="flex bg-gray-100 rounded-xl p-0.5">
          {[["invoice","🧾 POS"],["history","📅 Ventas"]].map(([k,l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${view===k?"bg-white text-gray-900 shadow-sm":"text-gray-400"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {view === "invoice" ? (
        /* ===== POS LAYOUT: 2 columnas en desktop ===== */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* COL IZQUIERDA: Buscar + Resultados */}
          <div className="lg:col-span-3 space-y-4">
            {/* Buscador */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔎</span>
                <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar producto para agregar..."
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold outline-none focus:border-green-300 focus:bg-white focus:ring-2 focus:ring-green-50 transition-all placeholder:text-gray-300" />
                {search && <button onClick={()=>{setSearch("");searchRef.current?.focus();}} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 text-xs">✕</button>}
              </div>

              {/* Resultados */}
              {search.trim() && (
                <div className="mt-3 max-h-[50vh] overflow-y-auto divide-y divide-gray-50 border border-gray-50 rounded-xl">
                  {filtered.length === 0 ? (
                    <p className="py-6 text-center text-xs text-gray-400 font-semibold">Sin resultados para "{search}"</p>
                  ) : filtered.map(p => {
                    const stock = p.variants?.length ? p.variants.reduce((s,v)=>s+(v.stock||0),0) : (p.totalStock??0);
                    const added = invoiceItems.find(i => i.productId===p.id);
                    return (
                      <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50/60 transition-colors text-left group">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-gray-300 text-xs">📦</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{p.name}</p>
                          <span className="text-[10px] font-black text-green-600">${p.price}</span>
                          <span className="text-[10px] text-gray-300 ml-1">· {stock} stock</span>
                        </div>
                        {added
                          ? <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">✓ x{added.qty}</span>
                          : <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg group-hover:bg-green-500 group-hover:text-white transition-all">+</span>
                        }
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Items de la factura (lista compacta) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Productos en factura ({totalItems})</p>
                {invoiceItems.length > 0 && (
                  <button onClick={()=>{setInvoiceItems([]);}} className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors">Limpiar</button>
                )}
              </div>
              {invoiceItems.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-gray-400 font-semibold">Busca y agrega productos arriba ☝️</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {invoiceItems.map(item => (
                    <div key={item.productId} className="flex items-center gap-2.5 px-4 py-2.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-gray-300 text-[10px]">📦</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400">${item.price} c/u</p>
                      </div>
                      <div className="flex items-center bg-gray-50 rounded-lg border border-gray-100">
                        <button onClick={()=>updateQty(item.productId,item.qty-1)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 font-bold text-sm">−</button>
                        <span className="w-6 text-center text-xs font-black">{item.qty}</span>
                        <button onClick={()=>updateQty(item.productId,item.qty+1)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-green-500 font-bold text-sm">+</button>
                      </div>
                      <span className="text-xs font-black text-gray-800 w-14 text-right">${(item.price*item.qty).toFixed(2)}</span>
                      <button onClick={()=>removeItem(item.productId)} className="text-gray-300 hover:text-red-500 text-xs ml-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COL DERECHA: Resumen + Confirmar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:sticky lg:top-20">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Resumen</p>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cliente</label>
                  <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Opcional"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-purple-300 transition-all placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Pago</label>
                  <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-purple-300 transition-all">
                    <option>Efectivo</option><option>Pago Móvil</option><option>Transferencia</option><option>Zelle</option><option>Punto de Venta</option><option>Otro</option>
                  </select>
                </div>
              </div>

              {/* Desglose */}
              <div className="px-4 py-3 border-t border-gray-50 space-y-1.5">
                {invoiceItems.map(i => (
                  <div key={i.productId} className="flex justify-between text-[11px]">
                    <span className="text-gray-500 truncate flex-1 mr-2">{i.name} x{i.qty}</span>
                    <span className="font-bold text-gray-700">${(i.price*i.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="px-4 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-green-100">
                <div className="flex justify-between items-end mb-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Total</p>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-950 leading-none">${invoiceTotal.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">Bs. {bsPrice(invoiceTotal)}</p>
                  </div>
                </div>
                <button onClick={confirmInvoice} disabled={saving || !invoiceItems.length}
                  className="w-full py-3 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-md disabled:opacity-40 transition-all active:scale-[0.98]"
                  style={{background:"linear-gradient(135deg,#10b981,#059669)"}}>
                  {saving ? "Procesando..." : "✅ Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===== HISTORIAL: Calendar compacto + lista ===== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Calendario compacto */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:sticky lg:top-20">
              <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 text-xs font-bold">◀</button>
                <span className="text-xs font-black text-gray-700 uppercase tracking-wider">{MONTHS_FULL[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</span>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 text-xs font-bold">▶</button>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {["D","L","M","M","J","V","S"].map((d,i) => (
                    <div key={i} className="text-center text-[9px] font-black text-gray-400 py-0.5">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarCells()}
                </div>
              </div>
              {/* Mini resumen del mes */}
              <div className="px-4 py-3 border-t border-gray-50 bg-purple-50/50">
                <div className="flex justify-between text-[10px]">
                  <span className="font-bold text-gray-500">{sales.length} ventas este mes</span>
                  <span className="font-black text-purple-600">${sales.reduce((s,sale) => s+(sale.total||0),0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ventas del día seleccionado */}
          <div className="lg:col-span-2 space-y-4">
            {/* Day header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-gray-900">
                  {(() => { const d = new Date(selectedDate+"T12:00:00"); return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`; })()}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{selectedSales.length} venta{selectedSales.length!==1?"s":""} registrada{selectedSales.length!==1?"s":""}</p>
              </div>
              {selectedSales.length > 0 && (
                <div className="text-right bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                  <p className="text-lg font-black text-green-600 leading-none">${selectedTotal.toFixed(2)}</p>
                  <p className="text-[9px] font-bold text-green-500 mt-0.5">Bs. {bsPrice(selectedTotal)}</p>
                </div>
              )}
            </div>

            {selectedSales.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center">
                <span className="text-4xl block mb-3 opacity-20">📭</span>
                <p className="text-sm font-bold text-gray-400">Sin ventas este día</p>
                <p className="text-[10px] text-gray-300 mt-1">Selecciona otra fecha en el calendario</p>
              </div>
            ) : (
              <>
                {selectedSales.map((sale, idx) => (
                  <div key={sale.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Card header */}
                    <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-black text-white px-2 py-1 rounded-lg" style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)"}}>#{idx+1}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-700">{sale.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-semibold">🕐 {sale.time}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400 font-semibold">{sale.dayOfWeek}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400 font-semibold">💳 {sale.paymentMethod}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-green-600">${sale.total?.toFixed(2)}</span>
                        <button onClick={() => printInvoice(sale)} title="Imprimir factura"
                          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm">
                          🖨️
                        </button>
                      </div>
                    </div>
                    {/* Products table */}
                    <div className="px-5 py-2">
                      <table className="w-full">
                        <thead>
                          <tr className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                            <th className="text-left py-1.5">Producto</th>
                            <th className="text-center py-1.5 w-12">Cant</th>
                            <th className="text-right py-1.5 w-16">P.Unit</th>
                            <th className="text-right py-1.5 w-16">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items?.map((item, i) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="py-1.5 text-xs font-semibold text-gray-700">{item.name}</td>
                              <td className="py-1.5 text-xs text-center text-gray-500">{item.qty}</td>
                              <td className="py-1.5 text-xs text-right text-gray-400">${item.price.toFixed(2)}</td>
                              <td className="py-1.5 text-xs text-right font-bold text-gray-800">${(item.price*item.qty).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Card footer */}
                    <div className="px-5 py-2.5 bg-green-50/50 border-t border-green-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">{sale.items?.reduce((s,i)=>s+i.qty,0)} artículos</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400">Bs. {bsPrice(sale.total||0)}</span>
                        <span className="text-sm font-black text-gray-900">${sale.total?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Day summary */}
                <div className="bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl px-5 py-4 flex items-center justify-between text-white shadow-lg">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">Total del día</p>
                    <p className="text-xs font-semibold text-purple-200 mt-0.5">{selectedSales.length} factura{selectedSales.length!==1?"s":""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black leading-none">${selectedTotal.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-purple-200 mt-0.5">Bs. {bsPrice(selectedTotal)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
