"use client";
import { Card, CardBody, Pagination } from "@heroui/react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { useSalesData } from "../hooks/useSalesData";

import { SalesFilters } from "./SalesFilters";
import { SalesList } from "./SalesList";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50];

export function SalesDetailCard({ sales, formatCurrency, filters, onFiltersChange, disabled }) {
  const reportsTranslations = useTranslations("reports");
  const { paginatedSales, totalPages, page, setPage, rowsPerPage, handleRowsPerPageChange, exportToCsv } =
    useSalesData(sales, formatCurrency);

  return (
    <Card shadow="none" className="shadow-lg bg-white rounded-lg p-4 lg:p-8">
      <CardBody className="space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-lg">
            {reportsTranslations("sales.transactions")}
            <span className="ml-2 text-sm font-normal text-default-400">
              ({sales.length} {reportsTranslations("sales.records")})
            </span>
          </h2>
          <button
            onClick={exportToCsv}
            disabled={!sales.length}
            className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download aria-hidden="true" className="w-3.5 h-3.5" />
            {reportsTranslations("sales.export")}
          </button>
        </div>

        <SalesFilters filters={filters} onFiltersChange={onFiltersChange} disabled={disabled} />

        <SalesList sales={paginatedSales} formatCurrency={formatCurrency} />

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
                {reportsTranslations("sales.pageOf", { page, total: totalPages })}
              </span>
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                color="primary"
                showControls
                showShadow
                size="sm"
                aria-label={reportsTranslations("sales.paginationAria")}
              />
            </div>
          )}
        </div>

      </CardBody>
    </Card>
  );
}
