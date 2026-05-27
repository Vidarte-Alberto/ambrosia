"use client";
import { Card, CardBody, Pagination } from "@heroui/react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { useOrdersDetailData } from "../hooks/useOrdersDetailData";

import { OrdersFilters } from "./OrdersFilters";
import { OrdersList } from "./OrdersList";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50];

export function OrdersDetailCard({ orders, formatCurrency, filters, onFiltersChange, disabled }) {
  const reportsTranslations = useTranslations("reports");
  const { paginatedOrders, totalPages, page, setPage, rowsPerPage, handleRowsPerPageChange, exportToCsv } =
    useOrdersDetailData(orders, formatCurrency);

  return (
    <Card shadow="none" className="shadow-lg bg-white rounded-lg p-4 lg:p-8">
      <CardBody className="space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-lg">
            {reportsTranslations("orders.title")}
            <span className="ml-2 text-sm font-normal text-default-400">
              ({orders.length} {reportsTranslations("sales.records")})
            </span>
          </h2>
          <button
            onClick={exportToCsv}
            disabled={!orders.length}
            className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download aria-hidden="true" className="w-3.5 h-3.5" />
            {reportsTranslations("sales.export")}
          </button>
        </div>

        <OrdersFilters filters={filters} onFiltersChange={onFiltersChange} disabled={disabled} orders={orders} />

        <OrdersList orders={paginatedOrders} formatCurrency={formatCurrency} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-default-100">
          <div className="flex items-center gap-2 text-sm text-default-500">
            <span>{reportsTranslations("sales.show")}</span>
            <select
              aria-label={reportsTranslations("sales.rowsPerPage")}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
              value={rowsPerPage}
              onChange={(event) => handleRowsPerPageChange(parseInt(event.target.value, 10))}
            >
              {ROWS_PER_PAGE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span>{reportsTranslations("sales.perPage")}</span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-default-500">
                {reportsTranslations("sales.pageLabel")} {page} {reportsTranslations("sales.ofLabel")} {totalPages}
              </span>
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                color="primary"
                showControls
                showShadow
                size="sm"
                aria-label={reportsTranslations("orders.paginationAria")}
              />
            </div>
          )}
        </div>

      </CardBody>
    </Card>
  );
}
