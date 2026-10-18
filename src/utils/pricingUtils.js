/**
 * Utilidades centralizadas para precios, ofertas y descuentos
 */

export function getProductPricing(product) {
  if (!product) {
    return {
      finalPrice: 0,
      oldPrice: 0,
      hasDiscount: false,
      discountPercentage: 0,
      isFlash: false
    };
  }

  const rawPrice = Number(product.price) || 0;
  const rawOldPrice = Number(product.oldPrice) || 0;
  const discountPerc = Number(product.discount) || Number(product.offerDiscount) || 0;

  // Verificar si la oferta flash tiene tiempo límite y sigue activa
  let isFlash = false;
  let endTime = product.parsedOfferEndsAt || 0;
  if (!endTime) {
    if (product.offerEndsAt) {
      endTime = product.offerEndsAt?.toMillis ? product.offerEndsAt.toMillis() : new Date(product.offerEndsAt).getTime();
      if (endTime < 100000) endTime = (product.createdAtMs || Date.now()) + (endTime * 60 * 60 * 1000);
    } else if (product.horas || product.duracion || product.hours) {
      endTime = (product.createdAtMs || Date.now()) + (Number(product.horas || product.duracion || product.hours) * 60 * 60 * 1000);
    }
  }

  if (endTime && endTime > Date.now()) {
    isFlash = true;
  }

  let finalPrice = rawPrice;
  let crossedPrice = rawOldPrice > rawPrice ? rawOldPrice : 0;

  if (discountPerc > 0 && (!endTime || isFlash)) {
    finalPrice = rawPrice - (rawPrice * (discountPerc / 100));
    crossedPrice = rawOldPrice > rawPrice ? rawOldPrice : rawPrice;
  } else if (rawOldPrice > rawPrice) {
    crossedPrice = rawOldPrice;
  }

  finalPrice = Number(finalPrice.toFixed(2));
  crossedPrice = Number(crossedPrice.toFixed(2));
  const hasDiscount = crossedPrice > finalPrice;

  let calculatedPerc = 0;
  if (hasDiscount && crossedPrice > 0) {
    calculatedPerc = Math.round(((crossedPrice - finalPrice) / crossedPrice) * 100);
  }

  return {
    finalPrice,
    oldPrice: crossedPrice,
    hasDiscount,
    discountPercentage: calculatedPerc,
    isFlash
  };
}
