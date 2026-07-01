export function deriveVariantDisplayName(optionValueIds, options) {
  if (!options?.length || !optionValueIds?.length) return null;
  const valueById = {};
  options.forEach((optionType) => optionType.values.forEach((optionValue) => {
    valueById[optionValue.id] = optionValue.value;
  }));
  const labels = optionValueIds.map((optionValueId) => valueById[optionValueId]).filter(Boolean);
  return labels.length ? labels.join(" / ") : null;
}

export function variantHasOptionValues(variant, optionValueIds) {
  const variantOptionValueIds = variant.optionValueIds ?? [];
  return optionValueIds.every((optionValueId) => variantOptionValueIds.includes(optionValueId));
}

export function variantIsActive(variant) {
  return variant.isActive !== false;
}

export function variantIsAvailableForSale(variant) {
  return variantIsActive(variant) && variant.quantity > 0;
}

export function findMatchingVariant(variants, selectedOptionValueIds) {
  if (!variants?.length || !selectedOptionValueIds?.length) return null;
  return variants.find((variant) => {
    const variantOptionValueIds = variant.optionValueIds ?? [];
    return (
      variantIsActive(variant) &&
      variantOptionValueIds.length === selectedOptionValueIds.length &&
      variantHasOptionValues(variant, selectedOptionValueIds)
    );
  }) ?? null;
}
