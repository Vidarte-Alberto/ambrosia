"use client";
import { useState, useEffect, useCallback } from "react";

import { toArray } from "@/components/utils/array";
import { httpClient, parseJsonResponse } from "@/lib/http";

function buildOrdersQueryString(filters = {}) {
  const queryParams = new URLSearchParams();

  const filterEntries = [
    ["startDate", filters.startDate],
    ["endDate", filters.endDate],
    ["status", filters.status],
    ["userId", filters.userId],
    ["paymentMethod", filters.paymentMethod],
    ["minTotal", filters.minTotal],
    ["maxTotal", filters.maxTotal],
    ["sortBy", filters.sortBy],
    ["sortOrder", filters.sortOrder],
  ];

  filterEntries.forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      queryParams.set(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `/orders/with-payments?${queryString}` : "/orders/with-payments";
}

export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrdersRequest = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = buildOrdersQueryString(filters);
      const ordersResponse = await httpClient(endpoint);
      if (ordersResponse?.ok === false) {
        const errorResponse = await parseJsonResponse(ordersResponse, null);
        throw new Error(errorResponse?.message || "Failed to fetch orders");
      }
      const ordersData = await parseJsonResponse(ordersResponse, []);
      setOrders(toArray(ordersData));
      return toArray(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setError(error);
      setOrders([]);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      await fetchOrdersRequest();
    } catch {
      return [];
    }
  }, [fetchOrdersRequest]);

  const fetchOrdersFiltered = useCallback(
    async (filters = {}) => await fetchOrdersRequest(filters),
    [fetchOrdersRequest],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    fetchOrders,
    fetchOrdersFiltered,
  };
}
