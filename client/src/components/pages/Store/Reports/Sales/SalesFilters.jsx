"use client";
import { Input, Select, SelectItem } from "@heroui/react";
import { useTranslations } from "next-intl";

export function SalesFilters({ filters, onFiltersChange, disabled, sales = [] }) {
  const reportsTranslations = useTranslations("reports");

  const paymentMethods = ["all", ...new Set(sales.map((s) => s.paymentMethod).filter(Boolean))];

  const handlePaymentMethodChange = (selectionKeys) => {
    const selectedMethod = Array.from(selectionKeys)[0] ?? "all";
    onFiltersChange({ paymentMethod: selectedMethod === "all" ? "" : selectedMethod });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Input
        isClearable
        className="flex-1"
        label={reportsTranslations("filters.productName")}
        aria-label={reportsTranslations("filters.productName")}
        placeholder={reportsTranslations("filters.productNamePlaceholder")}
        value={filters.productName}
        onChange={(event) => onFiltersChange({ productName: event.target.value })}
        onClear={() => onFiltersChange({ productName: "" })}
        isDisabled={disabled}
      />
      <Select
        aria-label={reportsTranslations("filters.paymentMethod")}
        label={reportsTranslations("filters.paymentMethod")}
        className="sm:w-48 shrink-0"
        selectedKeys={new Set([filters.paymentMethod || "all"])}
        onSelectionChange={handlePaymentMethodChange}
        isDisabled={disabled}
      >
        {paymentMethods.map((method) => (
          <SelectItem key={method} value={method}>
            {method === "all" ? reportsTranslations("filters.paymentMethods.all") : method}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}
