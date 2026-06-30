"use client";

import { useCallback, useEffect, useRef } from "react";

import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  addCartItem,
  removeCartItem,
  setCartItemQuantity,
} from "../utils/cartItemOperations";

export function useCartOperations({ cart, setCart, products }) {
  const cartTranslations = useTranslations("cart");
  const outOfStockTimeoutRef = useRef(null);

  const notifyOutOfStock = useCallback(() => {
    if (outOfStockTimeoutRef.current) {
      clearTimeout(outOfStockTimeoutRef.current);
    }
    outOfStockTimeoutRef.current = setTimeout(() => {
      addToast({
        color: "danger",
        description: cartTranslations("errors.outOfStock"),
      });
    }, 250);
  }, [cartTranslations]);

  useEffect(() => () => {
    if (outOfStockTimeoutRef.current) {
      clearTimeout(outOfStockTimeoutRef.current);
    }
  }, []);

  const getAvailableQuantity = useCallback(
    (productId, variant) => {
      if (variant) return Number(variant.quantity) || 0;
      const matchedProduct = products.find((product) => product.id === productId);
      return Number(matchedProduct?.quantity) || 0;
    },
    [products],
  );

  const addProduct = useCallback(
    (product, variant = null) => {
      const availableQuantity = getAvailableQuantity(product.id, variant);
      if (availableQuantity <= 0) {
        notifyOutOfStock();
        return;
      }

      const variantName = variant?.displayName ?? null;

      const nextCart = addCartItem(cart, product, variant, availableQuantity, variantName);
      if (nextCart === cart) {
        notifyOutOfStock();
        return;
      }
      setCart(nextCart);
    },
    [cart, getAvailableQuantity, notifyOutOfStock, setCart],
  );

  const updateQuantity = useCallback(
    (itemId, quantity) => {
      if (!Number.isFinite(quantity)) {
        return;
      }

      const cartItem = cart.find((item) => item.id === itemId);
      const availableQuantity = cartItem?.maxQuantity
        ?? getAvailableQuantity(cartItem?.productId ?? itemId);

      if (quantity > availableQuantity) {
        notifyOutOfStock();
        if (availableQuantity <= 0) {
          setCart(removeCartItem(cart, itemId));
        } else {
          setCart(setCartItemQuantity(cart, itemId, availableQuantity, availableQuantity));
        }
        return;
      }

      if (quantity <= 0) {
        setCart(removeCartItem(cart, itemId));
        return;
      }

      setCart(setCartItemQuantity(cart, itemId, quantity, availableQuantity));
    },
    [cart, getAvailableQuantity, notifyOutOfStock, setCart],
  );

  const removeProduct = useCallback(
    (itemId) => {
      setCart(removeCartItem(cart, itemId));
    },
    [cart, setCart],
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, [setCart]);

  return { addProduct, updateQuantity, removeProduct, clearCart };
}
