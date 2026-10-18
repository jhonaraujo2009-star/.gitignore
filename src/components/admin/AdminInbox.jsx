import { useState, useEffect, useRef } from "react";
import {
  collection, onSnapshot, query, orderBy, updateDoc, doc, runTransaction, deleteDoc
} from "firebase/firestore";
import { db } from "../../config/firebase";
import toast from "react-hot-toast";
import { getWhatsAppUrl } from "../../utils/phoneUtils";
import {
  notifyNewOrder,
  unlockAudio,
  playOrderNotificationSound,
  triggerOrderVibration,
  requestNotificationPermission,
  shouldNotifyOrder,
  markOrdersAsKnown,
  requestOneSignalPushPermission,
  sendOneSignalTestNotification,
  isOneSignalSubscribed
} from "../../utils/orderNotifications";

export default function AdminInbox() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const isInitialOrdersLoad = useRef(true);

  // Escuchar órdenes en tiempo real de Firebase
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubO = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(docs);
      setLoading(false);

      // Si es la carga inicial al abrir la pantalla, marcar todos como conocidos
      if (isInitialOrdersLoad.current) {
        markOrdersAsKnown(snap.docs.map((d) => d.id));
        isInitialOrdersLoad.current = false;
        return;
      }

      // Si entra una orden nueva en vivo, solo notificar si nunca antes fue notificada
      snap.docChanges().forEach((change) => {
        if (change.type === "added" && shouldNotifyOrder(change.doc.id)) {
          const newOrder = { id: change.doc.id, ...change.doc.data() };
          notifyNewOrder(newOrder);
          toast.success(`🛍️ ¡Nuevo pedido de ${newOrder.customerName || "Cliente"} ($${newOrder.totalAmount || ""})!`, {
            duration: 8000,
            icon: "🔔"
          });
        }
      });
    });

    return () => unsubO();
  }, []);

  // Verificar estado de suscripción a OneSignal al cargar
  useEffect(() => {
    isOneSignalSubscribed().then((subscribed) => {
      setIsPushSubscribed(subscribed);
    });
  }, []);

  // Función para probar sonido, vibración y pedir permisos Push
  const handleTestNotifications = async () => {
    unlockAudio();
    playOrderNotificationSound();
    triggerOrderVibration();

    const perm = await requestNotificationPermission();
    setNotifPermission(perm);

    // Intentar también registrar OneSignal si es posible
    requestOneSignalPushPermission().then((granted) => {
      if (granted) setIsPushSubscribed(true);
    });

    if (perm === "granted") {
      toast.success("🔔 ¡Sonido, vibración y notificaciones activadas!");
    } else {
      toast("🔔 Sonido y vibración probados con éxito", { icon: "🔊" });
    }
  };

  // Activar Notificaciones Nativas en el teléfono (OneSignal)
  const handleEnableNativePush = async () => {
    unlockAudio();
    playOrderNotificationSound();
    triggerOrderVibration();

    try {
      const granted = await requestOneSignalPushPermission();
      if (granted) {
        setIsPushSubscribed(true);
        setNotifPermission("granted");
        toast.success("🎉 ¡Notificaciones nativas activadas con éxito! Tu teléfono recibirá alertas de compra.");
      } else {
        toast("Permiso no concedido o cancelado. Puedes permitirlo desde los ajustes del navegador.", { icon: "ℹ️" });
      }
    } catch (err) {
      toast.error("Error al activar notificaciones");
    }
  };

  // Enviar alerta de prueba directa al teléfono
  const handleSendTestPush = async () => {
    try {
      setTestingPush(true);
      toast.loading("Enviando alerta de prueba a tu teléfono...", { id: "test-push" });
      await sendOneSignalTestNotification();
      toast.success("📲 ¡Alerta enviada! Revisa la barra de notificaciones de tu teléfono.", { id: "test-push", duration: 5000 });
    } catch (err) {
      toast.error("No se pudo enviar la alerta de prueba.", { id: "test-push" });
    } finally {
      setTestingPush(false);
    }
  };

  // Modificar cantidad de un producto en un pedido
  const editItemQty = async (orderId, itemIndex, currentQty) => {
    const newQty = prompt("Nueva cantidad para este producto:", currentQty);
    if (newQty === null) return;
    const parsedQty = parseInt(newQty);
    if (isNaN(parsedQty) || parsedQty < 0) return;
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
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

  // Confirmar el pago del pedido y descontar el inventario en transacción segura
  const confirmOrder = async (order) => {
    if (order.items.length === 0) return toast.error("El pedido está vacío");
    if (!confirm(`¿Confirmar pago y descontar stock de ${order.customerName || "este cliente"}?`)) return;

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
                const labelABuscar = typeof item.variant === "object" 
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
      toast.success(`¡Venta confirmada e inventario actualizado con éxito! ✅`);
    } catch (e) {
      console.error(e);
      toast.error("Error al procesar el pago");
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* CABECERA PRINCIPAL */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black text-gray-950 tracking-tight">📥 Centro de Pedidos</h2>
            {orders.length > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-pink-500 text-white shadow-sm shadow-pink-500/30 animate-pulse">
                {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-bold mt-1">
            Monitoreo en tiempo real • Notificaciones sonoras y vibración activas
          </p>
        </div>

        {/* BOTÓN TEST NOTIFICACIONES */}
        <button
          onClick={handleTestNotifications}
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-lg shadow-pink-500/25 active:scale-95 transition-all self-start sm:self-auto"
          title="Prueba el timbre y vibración de tu teléfono y concede permiso para notificaciones Push"
        >
          <span className="text-lg animate-bounce">🔔</span>
          <div className="text-left">
            <span className="block leading-none font-black">Probar Alerta & Vibrar</span>
            <span className="text-[10px] opacity-90 font-medium">
              {notifPermission === "granted" ? "Push Activo ✅" : "Activar Notificaciones"}
            </span>
          </div>
        </button>
      </div>

      {/* BANNER NOTIFICACIONES NATIVAS EN EL TELÉFONO */}
      <div className="bg-gradient-to-r from-gray-950 via-purple-950 to-gray-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
            🔔
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black tracking-tight">Notificaciones Nativas en tu Celular</h4>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${isPushSubscribed ? "bg-emerald-500 text-white" : "bg-pink-500 text-white"}`}>
                {isPushSubscribed ? "Vinculado ✅" : "Nativo 100%"}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-1 max-w-lg leading-relaxed">
              Recibe avisos con sonido y vibración en la barra de tu teléfono cuando un cliente compre, incluso con la app cerrada o la pantalla apagada. Sin instalar ninguna otra app.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto flex-shrink-0">
          {!isPushSubscribed ? (
            <button
              onClick={handleEnableNativePush}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-pink-500/30"
            >
              <span>🔔 Activar en mi Celular</span>
            </button>
          ) : (
            <button
              onClick={handleSendTestPush}
              disabled={testingPush}
              className="px-5 py-3 rounded-2xl bg-white text-gray-950 hover:bg-gray-100 active:scale-95 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <span>{testingPush ? "⏳ Enviando..." : "📲 Probar Alerta en mi Teléfono"}</span>
            </button>
          )}

          {isPushSubscribed && (
            <button
              onClick={handleEnableNativePush}
              title="Volver a sincronizar permisos"
              className="px-3 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* LISTA DE PEDIDOS */}
      <div className="space-y-5">
        {loading ? (
          <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100 shadow-sm animate-pulse">
            <div className="w-12 h-12 bg-pink-100 rounded-full mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm font-bold">Cargando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-14 text-center border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
            <div className="w-20 h-20 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
              🛍️
            </div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight">No hay pedidos pendientes</h3>
            <p className="text-gray-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Cada vez que un cliente realice una compra en tu tienda, sonará la campana y vibrará tu teléfono automáticamente.
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const totalItemsCount = order.items?.reduce((acc, i) => acc + (i.qty || 1), 0) || 0;

            return (
              <div
                key={order.id}
                className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.07)] transition-all duration-300 overflow-hidden group"
              >
                {/* ENCABEZADO DE LA TARJETA */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-gray-50/90 via-pink-50/20 to-gray-50/90 border-b border-gray-100/80 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex items-start gap-3.5">
                    {/* AVATAR CON INICIAL */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gray-900 to-black text-white flex items-center justify-center font-black text-lg shadow-md shadow-black/10 flex-shrink-0">
                      {(order.customerName || "C").charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-gray-900 text-sm tracking-tight uppercase">
                          {order.customerName || "Cliente"}
                        </h3>
                        <span className="bg-pink-100 text-pink-700 text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider">
                          #{order.id.slice(-5).toUpperCase()}
                        </span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Por Procesar
                        </span>
                      </div>

                      {/* TELÉFONO Y BOTÓN DIRECTO DE WHATSAPP */}
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {order.customerPhone ? (
                          <>
                            <span className="text-xs font-bold text-gray-700 bg-white border border-gray-200/80 px-3 py-1 rounded-xl shadow-2xs">
                              📞 {order.customerPhone}
                            </span>
                            <a
                              href={getWhatsAppUrl(
                                order.customerPhone,
                                `¡Hola ${order.customerName || ""}! Te contactamos de Luckathys Shop sobre tu pedido #${order.id.slice(-5).toUpperCase()} por un total de $${order.totalAmount || ""}. ¡Muchas gracias por tu compra! ✨`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black shadow-sm shadow-emerald-500/20 active:scale-95 transition-all"
                              title="Chatear con el cliente en WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.127-.521-1.834-.759-3.003-2.628-3.095-2.75-.088-.124-.736-.98-.736-1.874 0-.893.468-1.333.636-1.514.168-.181.368-.227.49-.227.123 0 .245.001.353.007.113.006.264-.043.412.313.155.372.531 1.298.577 1.393.046.094.077.205.015.328-.063.123-.094.2-.187.31-.093.111-.196.248-.28.333-.094.094-.192.196-.083.383.11.187.487.805 1.045 1.302.718.639 1.323.837 1.51.93.187.093.296.079.405-.047.11-.125.468-.544.593-.732.125-.187.249-.156.417-.094.168.063 1.066.503 1.249.596.183.093.305.14.351.218.046.079.046.453-.098.858z" />
                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.66 1.438 5.174L2 22l4.981-1.307A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.688 0-3.26-.51-4.577-1.385l-.328-.219-3.037.797.81-2.961-.24-.382A8.134 8.134 0 013.833 12c0-4.503 3.664-8.167 8.167-8.167 4.503 0 8.167 3.664 8.167 8.167 0 4.503-3.664 8.167-8.167 8.167z" />
                              </svg>
                              <span>WhatsApp</span>
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Sin teléfono registrado</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* MONTO Y HORA */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2.5 sm:pt-0 border-gray-100">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest sm:block">TOTAL ORDEN</span>
                    <p className="text-2xl sm:text-3xl font-black text-pink-600 tracking-tight leading-none">
                      ${Number(order.totalAmount || 0).toFixed(2)}
                    </p>
                    {order.createdAt && (
                      <span className="text-[10px] text-gray-400 font-bold mt-1">
                        🕒 {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* LISTA DE ARTÍCULOS */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      PRODUCTOS COMPRADOS ({totalItemsCount})
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      Toca ✏️ para ajustar cantidades
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100 bg-gray-50/50 rounded-2xl p-2 border border-gray-100">
                    {order.items?.map((item, idx) => {
                      const itemOldPrice = Number(item.oldPrice) || 0;
                      const itemPrice = Number(item.price) || 0;
                      const hasDiscount = itemOldPrice > itemPrice;

                      return (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-gray-800 uppercase line-clamp-1">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {item.variant && (
                                <span className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-lg shadow-2xs">
                                  {typeof item.variant === "object" ? item.variant.label : item.variant}
                                </span>
                              )}
                              <span className="text-[10px] font-black text-pink-600 bg-pink-50 px-2 py-0.5 rounded-lg">
                                x{item.qty} {item.qty === 1 ? "unidad" : "unidades"}
                              </span>
                              {hasDiscount && (
                                <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                                  🔥 Oferta
                                </span>
                              )}
                            </div>
                          </div>

                          {/* PRECIO Y BOTÓN EDITAR */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs font-black text-gray-900 leading-none">
                                ${(itemPrice * item.qty).toFixed(2)}
                              </p>
                              {hasDiscount && (
                                <span className="text-[10px] text-gray-400 font-bold line-through decoration-red-500/80">
                                  ${(itemOldPrice * item.qty).toFixed(2)}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => editItemQty(order.id, idx, item.qty)}
                              className="p-1.5 rounded-xl bg-white border border-gray-200 hover:border-pink-300 hover:bg-pink-50 text-xs font-bold text-gray-500 hover:text-pink-600 transition-all shadow-2xs active:scale-95"
                              title="Editar cantidad"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BARRA DE ACCIONES INFERIOR */}
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1 flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => confirmOrder(order)}
                    className="flex-1 py-3.5 rounded-2xl bg-gray-950 hover:bg-black text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-black/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span>✅ Confirmar Pago & Descontar Stock</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("¿Eliminar este pedido permanentemente?")) return;
                      try {
                        await deleteDoc(doc(db, "orders", order.id));
                        toast.success("Pedido eliminado correctamente");
                      } catch {
                        toast.error("Error al eliminar pedido");
                      }
                    }}
                    className="py-3.5 px-5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98]"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}