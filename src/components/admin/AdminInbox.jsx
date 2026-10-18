import { useState, useEffect, useRef } from "react";
import {
  collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs, runTransaction, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import toast from "react-hot-toast";
import { getWhatsAppUrl } from "../../utils/phoneUtils";
import {
  notifyNewOrder,
  unlockAudio,
  playOrderNotificationSound,
  triggerOrderVibration,
  requestNotificationPermission
} from "../../utils/orderNotifications";

function ReplyBox({ value, onChange, onSubmit, saving }) {
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escribe tu respuesta..."
        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-300"
      />
      <button onClick={onSubmit} disabled={saving}
        className="px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)" }}>
        {saving ? "..." : "Responder"}
      </button>
    </div>
  );
}

export default function AdminInbox() {
  const [tab, setTab] = useState("pedidos");
  const [questions, setQuestions] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [saving, setSaving] = useState({});
  const [orders, setOrders] = useState([]);
  const [notifPermission, setNotifPermission] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });

  const isInitialOrdersLoad = useRef(true);

  // Cargar preguntas, órdenes en tiempo real y productos
  useEffect(() => {
    const unsubQ = onSnapshot(query(collection(db, "questions"), orderBy("createdAt", "desc")), (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubO = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(docs);

      // Si es la primera carga inicial, no disparamos la alerta de sonido
      if (isInitialOrdersLoad.current) {
        isInitialOrdersLoad.current = false;
        return;
      }

      // Si entra una orden nueva después de cargar la pantalla
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const newOrder = { id: change.doc.id, ...change.doc.data() };
          notifyNewOrder(newOrder);
          toast.success(`🛍️ ¡Nuevo pedido de ${newOrder.customerName || "Cliente"} ($${newOrder.totalAmount || ""})!`, {
            duration: 8000,
            icon: "🔔"
          });
        }
      });
    });

    getDocs(collection(db, "products")).then((snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });

    return () => { 
      unsubQ(); 
      unsubO(); 
    };
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    const unsub = onSnapshot(
      query(collection(db, "products", selectedProduct, "comments"), orderBy("createdAt", "desc")),
      (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [selectedProduct]);

  // Función para probar sonido, vibración y pedir permisos Push
  const handleTestNotifications = async () => {
    unlockAudio();
    playOrderNotificationSound();
    triggerOrderVibration();

    const perm = await requestNotificationPermission();
    setNotifPermission(perm);

    if (perm === "granted") {
      toast.success("🔔 ¡Sonido, vibración y notificaciones Push activadas!");
    } else {
      toast("🔔 Sonido y vibración probados con éxito", { icon: "🔊" });
    }
  };

  const editItemQty = async (orderId, itemIndex, currentQty) => {
    const newQty = prompt("Nueva cantidad para este producto:", currentQty);
    if (newQty === null) return;
    const parsedQty = parseInt(newQty);
    if (isNaN(parsedQty) || parsedQty < 0) return;
    
    const order = orders.find(o => o.id === orderId);
    const updatedItems = [...order.items];
    
    if (parsedQty === 0) { 
      updatedItems.splice(itemIndex, 1); 
    } else { 
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], qty: parsedQty };
    }
    
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    try {
      await updateDoc(doc(db, "orders", orderId), { items: updatedItems, totalAmount: newTotal });
      toast.success("Pedido actualizado ✅");
    } catch (e) { 
      toast.error("Error al editar"); 
    }
  };

  const confirmOrder = async (order) => {
    if (order.items.length === 0) return toast.error("El pedido está vacío");
    if (!confirm(`¿Confirmar pago de ${order.customerName}?`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const groupedItems = order.items.reduce((acc, item) => {
          if (!acc[item.id]) acc[item.id] = [];
          acc[item.id].push(item);
          return acc;
        }, {});

        const leerProductos = [];
        for (const productId of Object.keys(groupedItems)) {
          const pRef = doc(db, "products", productId);
          const pDoc = await transaction.get(pRef);
          leerProductos.push({ doc: pDoc, ref: pRef, items: groupedItems[productId] });
        }

        for (const producto of leerProductos) {
          if (producto.doc.exists()) {
            const currentData = producto.doc.data();
            let updateData = {};
            let currentVariants = currentData.variants ? [...currentData.variants] : [];
            let totalStock = currentData.totalStock || 0;
            let salesCount = currentData.salesCount || 0;

            for (const item of producto.items) {
              if (currentVariants.length > 0 && item.variant) {
                const labelABuscar = typeof item.variant === 'object' 
                  ? item.variant.label 
                  : item.variant;

                currentVariants = currentVariants.map(v => {
                  if (v.label === labelABuscar) {
                    return { ...v, stock: Math.max(0, (v.stock || 0) - item.qty) };
                  }
                  return v;
                });
              } else {
                totalStock = Math.max(0, totalStock - item.qty);
              }
              salesCount += item.qty;
            }

            if (currentData.variants && currentData.variants.length > 0) {
              updateData = { 
                variants: currentVariants,
                totalStock: currentVariants.reduce((acc, v) => acc + (v.stock || 0), 0) 
              };
            } else {
              updateData = { totalStock };
            }

            updateData.salesCount = salesCount;
            transaction.update(producto.ref, updateData);
          }
        }
        
        transaction.delete(doc(db, "orders", order.id));
      });
      toast.success(`Venta procesada con éxito ✅`);
    } catch (e) {
      console.error(e);
      toast.error("Error al procesar el pago");
    }
  };

  const replyQuestion = async (id) => {
    const text = replyText[id];
    if (!text?.trim()) return;
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      await updateDoc(doc(db, "questions", id), { adminReply: text, adminRepliedAt: serverTimestamp(), isPublic: true });
      setReplyText(prev => ({ ...prev, [id]: "" }));
      toast.success("Respuesta enviada ✅");
    } catch (e) {
      toast.error('Error al responder');
    } finally { setSaving(prev => ({ ...prev, [id]: false })); }
  };

  const replyComment = async (commentId) => {
    const text = replyText[commentId];
    if (!text?.trim() || !selectedProduct) return;
    setSaving(prev => ({ ...prev, [commentId]: true }));
    try {
      await updateDoc(doc(db, "products", selectedProduct, "comments", commentId), { adminReply: text, adminRepliedAt: serverTimestamp() });
      setReplyText(prev => ({ ...prev, [commentId]: "" }));
      toast.success("Respuesta enviada ✅");
    } catch (e) {
      toast.error('Error al responder');
    } finally { setSaving(prev => ({ ...prev, [commentId]: false })); }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER CON BOTÓN DE ALERTA Y ESTADO PUSH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">💬 Centro de Mensajería</h2>
          <p className="text-xs text-gray-500 font-medium">Pedidos en vivo, preguntas de clientes y comentarios</p>
        </div>

        {/* BOTÓN TEST NOTIFICACIONES */}
        <button
          onClick={handleTestNotifications}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition-all self-start sm:self-auto"
          title="Prueba el timbre y vibración de tu teléfono y activa Push"
        >
          <span className="text-base animate-bounce">🔔</span>
          <div className="text-left">
            <span className="block leading-none">Probar Alerta & Vibrar</span>
            <span className="text-[9px] opacity-80 font-normal">
              {notifPermission === "granted" ? "Push: Activo ✅" : "Toca para activar"}
            </span>
          </div>
        </button>
      </div>
      
      {/* PESTAÑAS */}
      <div className="flex gap-2">
        {["pedidos", "questions", "comments"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${tab === t ? "text-white shadow-md shadow-pink-500/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            style={tab === t ? { background: "var(--primary)" } : {}}>
            <span>{t === "pedidos" ? "📥 Pedidos" : t === "questions" ? "❓ Preguntas" : "💬 Comentarios"}</span>
            {t === "pedidos" && orders.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${tab === t ? "bg-white text-pink-600" : "bg-pink-500 text-white"}`}>
                {orders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* PESTAÑA PEDIDOS */}
      {tab === "pedidos" && (
        <div className="grid gap-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <span className="text-5xl mb-3 block">📭</span>
              <p className="text-gray-500 font-bold text-base">No hay pedidos pendientes</p>
              <p className="text-gray-400 text-xs mt-1">Cuando un cliente compre en la tienda, sonará y vibrará tu teléfono automáticamente.</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                {/* CABECERA DEL PEDIDO */}
                <div className="bg-gray-50/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-gray-900 uppercase text-xs tracking-wider">
                        {order.customerName || "Cliente"}
                      </h3>
                      <span className="bg-pink-100 text-pink-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                    </div>

                    {/* TELÉFONO Y BOTÓN DE WHATSAPP DIRECTO */}
                    {order.customerPhone ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-bold text-gray-700">📞 {order.customerPhone}</span>
                        <a
                          href={getWhatsAppUrl(
                            order.customerPhone,
                            `¡Hola ${order.customerName || ""}! Te contactamos de Luckathys Shop sobre tu pedido de $${order.totalAmount || ""}. ¡Muchas gracias por tu compra! ✨`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black shadow-sm transition-all"
                          title="Contactar al cliente directamente por WhatsApp"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.127-.521-1.834-.759-3.003-2.628-3.095-2.75-.088-.124-.736-.98-.736-1.874 0-.893.468-1.333.636-1.514.168-.181.368-.227.49-.227.123 0 .245.001.353.007.113.006.264-.043.412.313.155.372.531 1.298.577 1.393.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.111-.196.248-.28.333-.094.094-.192.196-.083.383.11.187.487.805 1.045 1.302.718.639 1.323.837 1.51.93.187.093.296.079.405-.047.11-.125.468-.544.593-.732.125-.187.249-.156.417-.094.168.063 1.066.503 1.249.596.183.093.305.14.351.218.046.079.046.453-.098.858z" />
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.66 1.438 5.174L2 22l4.981-1.307A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.688 0-3.26-.51-4.577-1.385l-.328-.219-3.037.797.81-2.961-.24-.382A8.134 8.134 0 013.833 12c0-4.503 3.664-8.167 8.167-8.167 4.503 0 8.167 3.664 8.167 8.167 0 4.503-3.664 8.167-8.167 8.167z" />
                          </svg>
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1 italic">Sin teléfono registrado</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-black text-pink-600 leading-none">${order.totalAmount}</p>
                    {order.createdAt && (
                      <p className="text-[10px] text-gray-400 font-bold mt-1">
                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* LISTA DE PRODUCTOS DEL PEDIDO */}
                <div className="p-4 space-y-2">
                  {order.items.map((item, idx) => {
                    const hasDiscount = (Number(item.oldPrice) > Number(item.price));
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 last:border-none">
                        <span className="text-gray-700 font-medium">
                          {item.name} {item.variant ? `(${typeof item.variant === 'object' ? item.variant.label : item.variant})` : ""} (x{item.qty})
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-black text-gray-900">${(item.price * item.qty).toFixed(2)}</span>
                            {hasDiscount && (
                              <span className="text-[10px] text-gray-400 line-through ml-1.5 font-bold">
                                ${(item.oldPrice * item.qty).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <button onClick={() => editItemQty(order.id, idx, item.qty)} className="text-[10px] bg-gray-100 px-2 py-1 rounded-lg font-bold text-gray-500 hover:bg-pink-100">✏️ Editar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="px-4 pb-4 flex gap-2">
                  <button onClick={() => confirmOrder(order)} className="flex-1 bg-black text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all">
                    Confirmar Pago
                  </button>
                  <button onClick={async () => { if (!confirm('¿Eliminar este pedido permanentemente?')) return; try { await deleteDoc(doc(db, "orders", order.id)); toast.success('Pedido eliminado'); } catch { toast.error('Error al eliminar pedido'); } }} className="px-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black hover:bg-red-100 transition-all">
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PESTAÑA PREGUNTAS */}
      {tab === "questions" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {questions.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No hay preguntas de clientes aún.</p>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-800">{q.text}</p>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${q.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {q.isPublic ? "Pública" : "Privada"}
                    </span>
                  </div>

                  {/* TELÉFONO Y WHATSAPP EN PREGUNTAS */}
                  {q.phone && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-600 font-bold">📞 {q.phone}</span>
                      <a
                        href={getWhatsAppUrl(q.phone, `¡Hola! Te contactamos de Luckathys sobre tu pregunta: "${q.text}"`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black shadow-sm transition-all"
                      >
                        <span>💬 WhatsApp</span>
                      </a>
                    </div>
                  )}

                  {q.adminReply ? (
                    <div className="bg-pink-50 rounded-2xl px-4 py-2.5 text-xs border border-pink-100">
                      <span className="font-black" style={{ color: "var(--primary)" }}>Tu respuesta: </span>
                      <span className="text-gray-700 font-medium">{q.adminReply}</span>
                    </div>
                  ) : (
                    <ReplyBox value={replyText[q.id] || ""} onChange={(v) => setReplyText({ ...replyText, [q.id]: v })} onSubmit={() => replyQuestion(q.id)} saving={saving[q.id]} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA COMENTARIOS */}
      {tab === "comments" && (
        <div className="space-y-4">
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-pink-300">
            <option value="">Selecciona un producto para ver comentarios...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProduct && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {comments.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No hay comentarios en este producto.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-4">
                      <p className="text-sm font-black text-gray-800 mb-0.5">{c.authorName}</p>
                      <p className="text-sm text-gray-600 mb-2">{c.text}</p>
                      {c.adminReply ? (
                        <div className="bg-pink-50 rounded-2xl px-4 py-2.5 text-xs border border-pink-100">
                          <span className="font-black" style={{ color: "var(--primary)" }}>Tu respuesta: </span>
                          <span className="text-gray-700 font-medium">{c.adminReply}</span>
                        </div>
                      ) : (
                        <ReplyBox value={replyText[c.id] || ""} onChange={(v) => setReplyText({ ...replyText, [c.id]: v })} onSubmit={() => replyComment(c.id)} saving={saving[c.id]} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}