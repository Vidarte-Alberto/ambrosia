"use client";
import { Input, Select, SelectItem } from "@heroui/react";
import { useTranslations } from "next-intl";

export function OrdersFilters({ filters, onFiltersChange, disabled, orders = [] }) {
  const reportsTranslations = useTranslations("reports");

  const paymentMethods = ["all", ...new Set(orders.map((o) => o.paymentMethod).filter(Boolean))];

  const handlePaymentMethodChange = (selectionKeys) => {
    const selected = Array.from(selectionKeys)[0] ?? "all";
    onFiltersChange({ paymentMethod: selected === "all" ? "" : selected });
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
        onChange={(e) => onFiltersChange({ productName: e.target.value })}
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
