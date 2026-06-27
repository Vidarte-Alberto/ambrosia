import { useState } from "react";

import { Divider } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";

import { DiscountInput } from "./DiscountInput";

export function CartTotals({ subtotal, discountAmount, discount, discountType, onApplyDiscount }) {
  const translateCart = useTranslations("cart");
  const { formatAmount } = useCurrency();
  const [previewDiscountValue, setPreviewDiscountValue] = useState(null);
  const [previewDiscountType, setPreviewDiscountType] = useState("percentage");

  function handlePreview(value, type) {
    setPreviewDiscountValue(value);
    if (type !== undefined) setPreviewDiscountType(type);
  }

  function resolveDisplayDiscountAmount() {
    if (previewDiscountValue === null) return discountAmount;
    if (previewDiscountType === "fixed") return (Number(previewDiscountValue) || 0) * 100;
    return (subtotal * (Number(previewDiscountValue) || 0)) / 100;
  }

  const displayDiscountAmount = resolveDisplayDiscountAmount();

  const displayTotal = subtotal - displayDiscountAmount;

  return (
    <div className="space-y-2 text-sm text-gray-800">
      {displayDiscountAmount > 0 && (
        <div className="flex justify-between">
          <span>{translateCart("summary.subtotal")}</span>
          <span>{formatAmount(subtotal)}</span>
        </div>
      )}
      <DiscountInput
        discount={discount}
        discountType={discountType}
        onApply={onApplyDiscount}
        onPreview={handlePreview}
      />
      <Divider className="bg-green-600" />
      <div className="flex justify-between items-center font-semibold text-green-900">
        <span>{translateCart("summary.total")}:</span>
        <span className="text-lg">{formatAmount(displayTotal)}</span>
      </div>
    </div>
  );
}
