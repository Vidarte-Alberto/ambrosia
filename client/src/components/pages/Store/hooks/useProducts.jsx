"use client";
import { useState, useEffect, useCallback } from "react";

import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useUpload } from "@/components/hooks/useUpload";
import { toArray } from "@/components/utils/array";
import { httpClient, parseJsonResponse } from "@/lib/http";
import { useFetchList } from "@/lib/http/useFetchList";

import { toFiniteNumber } from "../Products/utils/number";
import { resolveImageUrl } from "../Products/utils/resolveImageUrl";

import { useProductVariants } from "./useProductVariants";

export function useProducts() {
  const t = useTranslations("products");
  const { fetchList } = useFetchList();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { upload, isUploading } = useUpload();
  const { addVariant, updateVariant } = useProductVariants();

  const normalizeSku = (sku) => sku?.trim() || null;

  const buildRequestPayload = (product, imageUrl, { includeId = false } = {}) => ({
    ...(includeId ? { id: product.productId } : {}),
    SKU: normalizeSku(product.productSKU),
    name: product.productName,
    description: product.productDescription || null,
    imageUrl,
    categoryIds: toArray(product.productCategories),
    hasVariants: product.hasVariants ?? false,
    minStockThreshold: toFiniteNumber(product.productMinStock),
    maxStockThreshold: toFiniteNumber(product.productMaxStock),
  });

  const buildDefaultVariantPayload = (product) => ({
    SKU: normalizeSku(product.productSKU),
    priceCents: Math.round(toFiniteNumber(product.productPrice) * 100),
    quantity: toFiniteNumber(product.productStock),
    isActive: true,
  });

  const buildHttpError = (response, payload) => ({
    status: response.status,
    message: payload?.message || "Request failed",
  });

  const notifyMutationError = (error) => {
    if (error?.status === 409) {
      addToast({
        title: t("toasts.duplicateSkuTitle"),
        description: t("toasts.duplicateSkuDescription"),
        color: "danger",
      });
      return;
    }

    addToast({
      title: t("toasts.genericErrorTitle"),
      description: t("toasts.genericErrorDescription"),
      color: "danger",
    });
  };

  const ensureSuccess = async (response) => {
    const payload = await parseJsonResponse(response, null);
    if (!response.ok) throw buildHttpError(response, payload);
    return payload;
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const productsData = await fetchList("/products");
      if (productsData === null) return;
      setProducts(toArray(productsData));
    } catch (error) {
      console.error("Error fetching products:", error);
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  const addProduct = async (product) => {
    try {
      const uploadedUrl = await resolveImageUrl(product.productImage, product.productImageUrl || null, upload);

      const response = await httpClient("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(product, uploadedUrl)),
        notShowError: false,
      });

      const payload = await ensureSuccess(response);
      const newProductId = payload?.id;

      if (newProductId && !product.hasVariants) {
        const newVariantId = await addVariant(newProductId, buildDefaultVariantPayload(product));
        if (newVariantId === null) {
          await httpClient(`/products/${newProductId}`, { method: "DELETE" });
          throw buildHttpError({ status: 422 }, null);
        }
      }

      await fetchProducts();
      return payload;
    } catch (error) {
      notifyMutationError(error);
      throw error;
    }
  };

  const updateProduct = async (product) => {
    try {
      let uploadedUrl;
      if (product.productImageRemoved) {
        uploadedUrl = null;
      } else {
        uploadedUrl = await resolveImageUrl(product.productImage, product.productImageUrl || null, upload);
      }

      const response = await httpClient(`/products/${product.productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(product, uploadedUrl, { includeId: true })),
        notShowError: false,
      });

      const payload = await ensureSuccess(response);

      if (!product.hasVariants && product.productVariantId) {
        await updateVariant(product.productId, product.productVariantId, buildDefaultVariantPayload(product));
      }

      await fetchProducts();
      return payload;
    } catch (error) {
      notifyMutationError(error);
      throw error;
    }
  };

  const deleteProduct = async (product) => {
    try {
      const response = await httpClient(`/products/${product.id}`, {
        method: "DELETE",
        notShowError: false,
      });
      await ensureSuccess(response);
      await fetchProducts();
      return true;
    } catch (error) {
      notifyMutationError(error);
      return false;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    addProduct,
    isUploading,
    updateProduct,
    deleteProduct,
    loading,
    error,
    refetch: fetchProducts,
  };
}
