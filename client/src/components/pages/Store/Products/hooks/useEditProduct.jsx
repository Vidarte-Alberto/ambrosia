"use client";
import { useCallback, useState } from "react";

export function useEditProduct({ fetchProductDetail }) {
  const [productVariants, setProductVariants] = useState([]);

  const loadProductVariants = useCallback(async (productId) => {
    if (!productId) return;
    const productDetail = await fetchProductDetail(productId);
    if (!productDetail) return;
    setProductVariants(productDetail.variants ?? []);
  }, [fetchProductDetail]);

  return { productVariants, loadProductVariants };
}
