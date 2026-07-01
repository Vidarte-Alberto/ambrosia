"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useProductVariants } from "@/components/pages/Store/hooks/useProductVariants";
import { deriveVariantDisplayName, findMatchingVariant } from "@/components/pages/Store/utils/variantUtils";

export function useVariantSelector({ product, isOpen, onClose, onAddToCart }) {
  const { fetchProductDetail } = useProductVariants();
  const [productDetail, setProductDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValues, setSelectedValues] = useState({});

  useEffect(() => {
    if (!isOpen || !product) return;
    let isCancelled = false;

    const loadProductDetail = async () => {
      if (isCancelled) return;
      setProductDetail(null);
      setIsLoading(true);
      setSelectedValues({});

      try {
        const detail = await fetchProductDetail(product.id);
        if (isCancelled) return;
        setProductDetail(detail);
        setIsLoading(false);
      } catch {
        if (isCancelled) return;
        setProductDetail(null);
        setSelectedValues({});
        setIsLoading(false);
      }
    };

    loadProductDetail();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, product, fetchProductDetail]);
  const options = useMemo(() => productDetail?.options ?? [], [productDetail]);
  const variants = useMemo(() => productDetail?.variants ?? [], [productDetail]);

  const selectedValueIds = options.map((option) => selectedValues[option.id]).filter(Boolean);
  const allSelected = options.length > 0 && selectedValueIds.length === options.length;
  const matchedVariant = allSelected ? findMatchingVariant(variants, selectedValueIds) : null;
  const isOutOfStock = matchedVariant ? matchedVariant.quantity <= 0 : false;
  const isDisabled = isLoading || !allSelected || !matchedVariant || isOutOfStock;

  const isValueAvailable = (optionType, valueId) => {
    const hypotheticalSelection = { ...selectedValues, [optionType.id]: valueId };
    const hypotheticalIds = options.map((option) => hypotheticalSelection[option.id]).filter(Boolean);
    return variants.some((variant) => {
      if (variant.isActive === false) return false;
      const variantValueIds = variant.optionValueIds ?? [];
      return hypotheticalIds.every((id) => variantValueIds.includes(id)) && variant.quantity > 0;
    });
  };

  const toggleOptionValue = useCallback((optionTypeId, valueId) => {
    setSelectedValues((previousSelectedValues) => ({
      ...previousSelectedValues,
      [optionTypeId]: previousSelectedValues[optionTypeId] === valueId ? undefined : valueId,
    }));
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!matchedVariant) return;
    const variantName = deriveVariantDisplayName(matchedVariant.optionValueIds, options);
    onAddToCart(product, { ...matchedVariant, displayName: variantName });
    onClose();
  }, [matchedVariant, options, onAddToCart, product, onClose]);

  return {
    options,
    isLoading,
    selectedValues,
    allSelected,
    isDisabled,
    matchedVariant,
    isOutOfStock,
    isValueAvailable,
    toggleOptionValue,
    handleAddToCart,
  };
}
