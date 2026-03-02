import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useCart } from "../../context/CartContext";
import { useApp } from "../../context/AppContext";
import toast from "react-hot-toast";

export default function CartDrawer() {
  const { items, removeItem, updateQuantity, isOpen, setIsOpen, coupon, setCoupon, subtotal, discount, total, clearCart, createOrder } = useCart();
  const { settings, bsPrice } = useApp();
  const [couponCode, setCouponCode] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  const freeShippingProgress = Math.min(100, (total / settings.freeShippingGoal) * 100);
  const remaining = Math.max(0, settings.freeShippingGoal - total);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "coupons"),
          where("code", "==", couponCode.toUpperCase()),
          where("active", "==", true)
        )
      );
      if (snap.empty) {
        toast.error("Cupón inválido o expirado");
      } else {
        const c = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setCoupon(c);
        toast.success(`Cupón aplicado: ${c.type === "percent" ? `${c.value}% off` : `$${c.value} off`}`);
      }
    } finally {
      setCheckingCoupon(false);
    }
  };

  const loadPaymentMethods = async () => {
    const snap = await getDocs(collection(db, "payments"));
    setPaymentMethods(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    await loadPaymentMethods();
    setShowCheckout(true);
  };

  const sendWhatsApp = async () => {
    if (!selectedPayment) {
      toast.error("Selecciona un método de pago");
      return;
    }
    if (!customer.name || !customer.phone) {
      toast.error("Ingresa tu nombre y teléfono");
      return;
    }
    
    // LÓGICA VIP: Usa el teléfono del método de pago si existe, sino usa el general de la tienda
    const targetPhone = selectedPayment.phone || settings.whatsappNumber;

    if (!targetPhone) {
        toast.error("Error: Método de pago sin número asignado");
        return;
    }

    try {
      const orderItems = items.map(i => ({
        id: i.product.id,
        name: i.product.name,
        price: i.price,
        qty: i.quantity,
        variant: i.variant?.label || null 
      }));

      await createOrder({ ...customer, items: orderItems });

      const itemLines = items
        .map((i) => `• ${i.product.name}${i.variant ? ` (${i.variant.label})` : ""} x${i.quantity} = $${(i.price * i.quantity).toFixed(2)}`)
        .join("\n");

      const pm = selectedPayment;
      const paymentLine = `🏦 ${pm.bankName} — ${pm.holderName} — ${pm.idNumber}`;

      const message = `🛍️ *Nuevo Pedido de ${customer.name}*\n📞 ${customer.phone}\n\n${itemLines}\n\n${coupon ? `🏷️ Cupón: ${coupon.code} (-$${discount.toFixed(2)})\n` : ""}💵 *Total: $${total.toFixed(2)} | Bs. ${bsPrice(total)}*\n\n${paymentLine}`;

      // Enviar al número del método de pago
      const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
      clearCart();
      setIsOpen(false);
      setShowCheckout(false);
      toast.success("¡Pedido enviado por WhatsApp! 🎉");
    } catch (error) {
      toast.error("Error al registrar pedido");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsOpen(false)} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">
            🛍️ Mi Carrito {items.length > 0 && `(${items.length})`}
          </h2>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-3">🛒</div>
              <p>Tu carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.key} className="flex gap-3 bg-gray-50 rounded-2xl p-3">
                {(item.product.image || item.product.images?.[0]) && (
                  <img src={item.product.image || item.product.images[0]} alt={item.product.name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.product.name}</p>
                  {item.variant && <p className="text-xs text-gray-400">{item.variant.label}</p>}
                  <p className="text-sm font-bold mt-1" style={{ color: "var(--primary)" }}>${(item.price * item.quantity).toFixed(2)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => updateQuantity(item.key, item.quantity - 1)} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold">−</button>
                    <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.key, item.quantity + 1)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "var(--primary)" }}>+</button>
                  </div>
                </div>
                <button onClick={() => removeItem(item.key)} className="text-gray-300 hover:text-red-400 transition-colors text-lg">×</button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-3">
            {remaining > 0 ? (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">
                  ¡Agrega <strong>${remaining.toFixed(2)}</strong> más para envío gratis 🚚
                </p>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${freeShippingProgress}%`, background: "var(--primary)" }} />
                </div>
              </div>
            ) : (
              <div className="bg-green-50 text-green-700 text-xs font-semibold rounded-xl px-3 py-2 text-center">🎉 ¡Tienes envío gratis!</div>
            )}

            {!coupon ? (
              <div className="flex gap-2">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Código de cupón" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-300" />
                <button onClick={applyCoupon} disabled={checkingCoupon} className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)" }}>{checkingCoupon ? "..." : "Aplicar"}</button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2">
                <span className="text-sm font-semibold text-green-700">🏷️ {coupon.code} aplicado</span>
                <button onClick={() => setCoupon(null)} className="text-gray-400 hover:text-red-400 text-sm">✕</button>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Descuento</span><span>-${discount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <div className="text-right">
                  <div style={{ color: "var(--primary)" }}>${total.toFixed(2)}</div>
                  <div className="text-xs font-normal text-gray-400">Bs. {bsPrice(total)}</div>
                </div>
              </div>
            </div>

            {!showCheckout ? (
              <button onClick={handleCheckout} className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg" style={{ background: "var(--primary)" }}>Finalizar compra 🛒</button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Datos de entrega:</p>
                <div className="flex gap-2">
                  <input placeholder="Tu Nombre" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  <input placeholder="Teléfono" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>

                <p className="text-sm font-semibold text-gray-700 mt-2">Selecciona método de pago:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {paymentMethods.map((pm) => (
                    <button key={pm.id} onClick={() => setSelectedPayment(pm)} className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition-all ${selectedPayment?.id === pm.id ? "border-pink-400 bg-pink-50" : "border-gray-200 bg-white"}`}>
                      {pm.logo && <img src={pm.logo} alt={pm.bankName} className="w-8 h-8 object-contain rounded-lg" />}
                      <div><p className="text-sm font-semibold text-gray-800">{pm.bankName}</p><p className="text-xs text-gray-400">{pm.holderName} · {pm.idNumber}</p></div>
                    </button>
                  ))}
                </div>
                <button onClick={sendWhatsApp} className="w-full py-4 rounded-2xl text-white font-bold text-base bg-green-500 hover:bg-green-600 transition-colors shadow-lg mt-2">📲 Confirmar por WhatsApp</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}