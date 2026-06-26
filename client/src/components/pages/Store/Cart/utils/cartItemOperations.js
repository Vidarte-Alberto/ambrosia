export function addCartItem(cart, product, variant, availableQuantity, variantName) {
  const itemId = variant?.id ?? product.id;
  const existingCartItem = cart.find((item) => item.id === itemId);

  if (!existingCartItem) {
    return [
      ...cart,
      {
        id: itemId,
        productId: product.id,
        variantId: variant?.id ?? null,
        variantName: variantName ?? null,
        imageUrl: variant?.imageUrl ?? product.imageUrl,
        name: product.name,
        price: variant?.priceCents ?? product.priceCents,
        quantity: 1,
        subtotal: variant?.priceCents ?? product.priceCents,
        maxQuantity: availableQuantity,
      },
    ];
  }

  const nextQuantity = existingCartItem.quantity + 1;
  if (nextQuantity > availableQuantity) {
    return cart;
  }

  return cart.map((item) => (item.id === itemId
    ? {
        ...item,
        imageUrl: item.imageUrl ?? (variant?.imageUrl ?? product.imageUrl),
        quantity: nextQuantity,
        subtotal: nextQuantity * item.price,
      }
    : item),
  );
}

export function setCartItemQuantity(cart, itemId, quantity, availableQuantity) {
  const cappedQuantity = Math.min(quantity, availableQuantity);
  return cart.map((item) => (item.id === itemId
    ? {
        ...item,
        quantity: cappedQuantity,
        subtotal: cappedQuantity * item.price,
      }
    : item),
  );
}

export function removeCartItem(cart, itemId) {
  return cart.filter((item) => item.id !== itemId);
}
