"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Card, CardBody, CardHeader, addToast } from "@heroui/react";
import { AlertCircle, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";

import { StoreLayout } from "../StoreLayout";

import { DateRangeCard } from "./components/DateRangeCard";
import { ReportsHeader } from "./components/ReportsHeader";
import { ReportSkeleton } from "./components/ReportSkeleton";
import { SalesTable } from "./components/SalesTable";
import { SummaryStat } from "./components/SummaryStat";
import { useReports } from "./hooks/useReports";

const DEFAULT_FILTERS = {
  activePeriod: "month",
  startDate: "",
  endDate: "",
  productName: "",
  paymentMethod: "",
};

export default function Reports() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const filtersRef = useRef(DEFAULT_FILTERS);
  const debounceRef = useRef(null);

  useEffect(() => { filtersRef.current = filters; });

  const { formatAmount, loading: currencyLoading } = useCurrency();
  const { reportData, loading, error, fetchReport } = useReports();
  const t = useTranslations("reports");

  const formatCurrency = useCallback((cents) => formatAmount(cents), [formatAmount]);

  const showError = useCallback(
    (message) => {
      addToast({ title: t("statuses.errorTitle"), description: message, variant: "solid", color: "danger" });
    },
    [t],
  );

  const validateCustomRange = useCallback(
    (startDate, endDate) => {
      if (startDate && endDate && startDate > endDate) {
        showError(t("errors.invalidRange"));
        return false;
      }
      if ((startDate && !endDate) || (!startDate && endDate)) {
        showError(t("errors.bothDates"));
        return false;
      }
      return true;
    },
    [showError, t],
  );

  const generateReport = useCallback(async () => {
    const currentFilters = filtersRef.current;
    if (!currentFilters.activePeriod && !validateCustomRange(currentFilters.startDate, currentFilters.endDate)) return;
    try {
      await fetchReport({
        period: currentFilters.activePeriod || undefined,
        startDate: currentFilters.activePeriod ? undefined : currentFilters.startDate || undefined,
        endDate: currentFilters.activePeriod ? undefined : currentFilters.endDate || undefined,
        productName: currentFilters.productName || undefined,
        paymentMethod: currentFilters.paymentMethod || undefined,
      });
    } catch {
      showError(t("statuses.errorGenerate"));
    }
  }, [fetchReport, validateCustomRange, showError, t]);

  useEffect(() => {
    fetchReport({ period: DEFAULT_FILTERS.activePeriod });
  }, [fetchReport]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleFiltersChange = useCallback(
    (patch) => {
      const prev = filtersRef.current;
      const next = { ...prev, ...patch };
      setFilters(next);

      if ("activePeriod" in patch && patch.activePeriod) {
        fetchReport({
          period: next.activePeriod,
          productName: next.productName || undefined,
          paymentMethod: next.paymentMethod || undefined,
        });
      } else if ("startDate" in patch || "endDate" in patch) {
        if (next.startDate && next.endDate) {
          if (next.startDate <= next.endDate) {
            fetchReport({
              startDate: next.startDate,
              endDate: next.endDate,
              productName: next.productName || undefined,
              paymentMethod: next.paymentMethod || undefined,
            });
          } else {
            showError(t("errors.invalidRange"));
          }
        }
      } else if ("paymentMethod" in patch) {
        fetchReport({
          period: next.activePeriod || undefined,
          startDate: next.activePeriod ? undefined : next.startDate || undefined,
          endDate: next.activePeriod ? undefined : next.endDate || undefined,
          productName: next.productName || undefined,
          paymentMethod: next.paymentMethod || undefined,
        });
      } else {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const currentFilters = filtersRef.current;
          fetchReport({
            period: currentFilters.activePeriod || undefined,
            startDate: currentFilters.activePeriod ? undefined : currentFilters.startDate || undefined,
            endDate: currentFilters.activePeriod ? undefined : currentFilters.endDate || undefined,
            productName: currentFilters.productName || undefined,
            paymentMethod: currentFilters.paymentMethod || undefined,
          });
        }, 500);
      }
    },
    [fetchReport, showError, t],
  );

  const totalRevenue = useMemo(() => reportData?.totalRevenueCents ?? 0, [reportData]);
  const totalItems = useMemo(() => reportData?.totalItemsSold ?? 0, [reportData]);

  if (currencyLoading && !reportData) {
    return (
      <StoreLayout>
        <ReportSkeleton />
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        <ReportsHeader
          onBack={() => window.history.back()}
          onRefresh={generateReport}
          loading={loading}
        />

        {error && (
          <Card className="bg-red-50 border-red-200">
            <CardBody>
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-600 font-semibold">{t("statuses.errorGenerate")}</p>
              </div>
            </CardBody>
          </Card>
        )}

        <DateRangeCard
          filters={filters}
          onFiltersChange={handleFiltersChange}
          disabled={currencyLoading}
        />

        {reportData && (
          <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader>
                <h3 className="text-lg font-bold text-deep flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  {t("summary.title")}
                </h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SummaryStat
                    icon={<DollarSign className="w-6 h-6 text-green-600" />}
                    label={t("summary.revenue")}
                    value={formatCurrency(totalRevenue)}
                    tone={{
                      bg: "bg-green-50",
                      border: "border-green-200",
                      iconBg: "bg-green-100",
                      text: "text-green-700",
                      value: "text-green-900",
                    }}
                  />
                  <SummaryStat
                    icon={<ShoppingCart className="w-6 h-6 text-purple-600" />}
                    label={t("summary.items")}
                    value={totalItems}
                    tone={{
                      bg: "bg-purple-50",
                      border: "border-purple-200",
                      iconBg: "bg-purple-100",
                      text: "text-purple-700",
                      value: "text-purple-900",
                    }}
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-lg border-0 bg-white">
              <CardHeader>
                <h3 className="text-lg font-bold text-deep flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {t("sales.title")}
                </h3>
              </CardHeader>
              <CardBody>
                <SalesTable sales={reportData.sales} formatCurrency={formatCurrency} />
              </CardBody>
            </Card>
          </div>
        )}

      </div>
    </StoreLayout>
  );
}
