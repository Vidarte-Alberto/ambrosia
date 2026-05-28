"use client";
import { Card, CardBody } from "@heroui/react";
import { ShoppingCart, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import formatDate from "@lib/formatDate";

export function OrdersCard({ order, formatCurrency, onClick }) {
  const reportsTranslations = useTranslations("reports");
  const productNames = order.items.map((item) => item.productName).join(", ");

  return (
    <Card shadow="none" className="border border-gray-200 rounded-lg" isPressable onPress={onClick}>
      <CardBody className="flex flex-row items-center gap-3 p-3">
        <div className="bg-forest/10 rounded-lg p-2 shrink-0">
          <ShoppingCart aria-hidden="true" className="w-4 h-4 text-forest" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              #{order.shortId}
            </span>
            <span className="text-xs text-gray-400">{order.date ? formatDate(order.date) : "—"}</span>
          </div>
          <p className="text-sm font-medium text-deep truncate mt-0.5">{productNames}</p>
          <div className="flex items-center gap-1 text-sm text-forest mt-0.5">
            <Users aria-hidden="true" className="w-3 h-3 shrink-0" />
            <span className="truncate">{order.userName ?? "—"}</span>
          </div>
          <span className="text-xs text-gray-500 mt-0.5 block">{order.paymentMethod}</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-500">×{order.itemCount} {reportsTranslations("sales.quantity").toLowerCase()}</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(order.total)}</p>
        </div>
      </CardBody>
    </Card>
  );
}
