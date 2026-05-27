"use client";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTable } from "@/components/shared/DataTable";
import { parseUtcDate } from "@lib/formatDate";

import { OrdersCard } from "./OrdersCard";

const formatDateOnly = (dateString) => {
  const parsed = parseUtcDate(dateString);
  if (isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
};

const formatTimeOnly = (dateString) => {
  const parsed = parseUtcDate(dateString);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const buildProductSummary = (items, overflowLabel) => {
  if (!items.length) return "—";
  const names = items.slice(0, 2).map((item) => item.productName);
  const overflow = items.length - 2;
  if (overflow > 0) return `${names.join(", ")} +${overflow} ${overflowLabel}`;
  return names.join(", ");
};

export function OrdersList({ orders, formatCurrency }) {
  const t = useTranslations("reports");

  if (!orders?.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ShoppingCart aria-hidden="true" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">{t("orders.empty")}</p>
      </div>
    );
  }

  const columns = [
    {
      key: "id",
      label: t("orders.shortId"),
      render: (order) => (
        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          #{order.shortId}
        </span>
      ),
    },
    {
      key: "date",
      label: t("sales.date"),
      render: (order) => (
        <div className="text-xs">
          <span className="text-gray-700">{formatDateOnly(order.date)}</span>
          <span className="text-gray-400 ml-1">{formatTimeOnly(order.date)}</span>
        </div>
      ),
    },
    {
      key: "user",
      label: t("sales.user"),
      render: (order) => <span className="text-sm text-gray-700">{order.userName ?? "—"}</span>,
    },
    {
      key: "products",
      label: t("orders.products"),
      render: (order) => (
        <span className="text-sm text-deep">{buildProductSummary(order.items, t("orders.more"))}</span>
      ),
    },
    {
      key: "items",
      label: t("sales.quantity"),
      render: (order) => <span className="font-bold">×{order.itemCount}</span>,
    },
    {
      key: "total",
      label: t("orders.total"),
      render: (order) => (
        <span className="whitespace-nowrap font-bold text-green-700">{formatCurrency(order.total)}</span>
      ),
    },
    {
      key: "payment",
      label: t("sales.paymentMethod"),
      render: (order) => (
        <span className="text-sm text-gray-700">{order.paymentMethod || t("payment.unknown")}</span>
      ),
    },
  ];

  return (
    <section aria-label={t("orders.tableAriaLabel")} className="w-full">
      <div className="md:hidden space-y-3">
        {orders.map((order) => (
          <OrdersCard key={order.orderId} order={order} formatCurrency={formatCurrency} />
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <DataTable
          columns={columns}
          items={orders}
          getKey={(order) => order.orderId}
        />
      </div>
    </section>
  );
}
