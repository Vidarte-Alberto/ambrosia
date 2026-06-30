"use client";
import { useState, useEffect, useCallback } from "react";

import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useUpload } from "@/components/hooks/useUpload";
import { toArray } from "@/components/utils/array";
import { httpClient, parseJsonResponse } from "@/lib/http";

export function useProducts() {
  const productsTranslation = useTranslations("products");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { upload, isUploading } = useUpload();

  const normalizeSku = (sku) => sku?.trim() || null;

  const buildRequestPayload = (product, imageUrl, { includeId = false } = {}) => {
    const priceNumber = Number(product.productPrice ?? 0);
    const priceCents = Number.isFinite(priceNumber)
      ? Math.round(priceNumber * 100)
      : 0;
    const quantityNumber = Number(product.productStock ?? 0);
    const minStockNumber = Number(product.productMinStock ?? 0);
    const maxStockNumber = Number(product.productMaxStock ?? 0);

    return {
      ...(includeId ? { id: product.productId } : {}),
      SKU: normalizeSku(product.productSKU),
      name: product.productName,
      description: product.productDescription || null,
      imageUrl,
      costCents: priceCents,
      categoryIds: toArray(product.productCategories),
      quantity: Number.isFinite(quantityNumber) ? quantityNumber : 0,
      minStockThreshold: Number.isFinite(minStockNumber) ? minStockNumber : 0,
      maxStockThreshold: Number.isFinite(maxStockNumber) ? maxStockNumber : 0,
      priceCents,
      isBundle: product.isBundle ?? false,
      bundleComponents: product.isBundle
        ? (product.bundleComponents ?? []).map((bundleProduct) => ({
            componentId: bundleProduct.productId,
            quantity: bundleProduct.quantity,
          }))
        : [],
    };
  };

  const buildHttpError = (response, payload) => ({
    status: response.status,
    message: payload?.message || "Request failed",
  });

  const notifyMutationError = (mutationError) => {
    if (mutationError?.status === 409) {
      addToast({
        title: productsTranslation("toasts.duplicateSkuTitle"),
        description: productsTranslation("toasts.duplicateSkuDescription"),
        color: "danger",
      });
      return;
    }

    addToast({
      title: productsTranslation("toasts.genericErrorTitle"),
      description: productsTranslation("toasts.genericErrorDescription"),
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
      const response = await httpClient("/products");
      if (!response.ok) return;
      const productsData = await parseJsonResponse(response, []);
      setProducts(toArray(productsData));
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  const addProduct = async (product) => {
    try {
      let uploadedUrl = product.productImageUrl || null;
      if (product.productImage instanceof File) {
        const uploads = await upload([product.productImage]);
        uploadedUrl = uploads?.[0]?.url || uploads?.[0]?.path || null;
      }

      const response = await httpClient("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(product, uploadedUrl)),
        notShowError: false,
      });

      const payload = await ensureSuccess(response);
      await fetchProducts();
      return payload;
    } catch (addError) {
      notifyMutationError(addError);
      throw addError;
    }
  };

  const updateProduct = async (product) => {
    try {
      let uploadedUrl = product.productImageUrl || null;
      if (product.productImage instanceof File) {
        const uploads = await upload([product.productImage]);
        uploadedUrl = uploads?.[0]?.url || uploads?.[0]?.path || null;
      } else if (product.productImageRemoved) {
        uploadedUrl = null;
      }

      const response = await httpClient(`/products/${product.productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(product, uploadedUrl, { includeId: true })),
        notShowError: false,
      });

      const payload = await ensureSuccess(response);
      await fetchProducts();
      return payload;
    } catch (updateError) {
      notifyMutationError(updateError);
      throw updateError;
    }
  };

  const deleteProduct = async (product) => {
    const response = await httpClient(`/products/${product.id}`, {
      method: "DELETE",
      notShowError: false,
    });

    if (response.status === 409) {
      addToast({
        title: productsTranslation("toasts.bundleComponentErrorTitle"),
        description: productsTranslation("toasts.bundleComponentErrorDescription"),
        color: "danger",
      });
      return;
    }

    await fetchProducts();
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
