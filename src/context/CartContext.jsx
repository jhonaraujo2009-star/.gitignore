import { createContext, useContext, useState, useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [coupon, setCoupon] = useState(null);

  const addItem = useCallback((product, variant, quantity) => {
    setItems((prev) => {
      const key = `${product.id}-${variant?.id || "default"}`;
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          key,
          product,
          variant,
          quantity,
          price: product.price,
        },
      ];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.key !== key));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const createOrder = async (customerData) => {
    try {
      const orderData = {
        customerName: customerData.name,
        customerPhone: customerData.phone,
        items: items.map(i => ({
          id: i.product.id,
          name: i.product.name,
          qty: i.quantity,
          price: i.price,
          // ÚNICO CAMBIO: Ahora sí guardamos la talla/color elegido
          variant: i.variant?.label || null 
        })),
        totalAmount: total,
        status: "pending",
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, "orders"), orderData);
      return docRef.id;
    } catch (error) {
      console.error("Error creando orden:", error);
      throw error;
    }
  };

  const subtotal = items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  const discount = coupon
    ? coupon.type === "percent"
      ? subtotal * (coupon.value / 100)
      : coupon.value
    : 0;

  const total = Math.max(0, subtotal - discount);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isOpen,
        setIsOpen,
        coupon,
        setCoupon,
        subtotal,
        discount,
        total,
        itemCount,
        createOrder
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);