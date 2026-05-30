"use client";
import { useMemo } from "react";

import { formatDateParts } from "@lib/formatDate";

export function useOrdersChartData(orders) {
  const ordersPerDay = useMemo(() => {
    const byDay = {};
    for (const order of orders) {
      const day = formatDateParts(order.date).localDay;
      if (!byDay[day]) byDay[day] = { date: day, orders: 0, revenue: 0 };
      byDay[day].orders += 1;
      byDay[day].revenue += order.total;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  const paymentMethodByOrders = useMemo(() => {
    const byMethod = {};
    for (const order of orders) {
      const method = order.paymentMethod;
      if (!byMethod[method]) byMethod[method] = { method, count: 0, revenue: 0 };
      byMethod[method].count += 1;
      byMethod[method].revenue += order.total;
    }
    return Object.values(byMethod).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const topUsersByOrders = useMemo(() => {
    const byUser = {};
    for (const order of orders) {
      const name = order.userName || "Unknown";
      if (!byUser[name]) byUser[name] = { name, orderCount: 0, revenue: 0 };
      byUser[name].orderCount += 1;
      byUser[name].revenue += order.total;
    }
    return Object.values(byUser)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 8);
  }, [orders]);

  return { ordersPerDay, paymentMethodByOrders, topUsersByOrders };
}
