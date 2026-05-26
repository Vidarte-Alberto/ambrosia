"use client";
import { useTranslations } from "next-intl";

import { useSummaryData } from "../hooks/useSummaryData";

import { SummaryStat } from "./SummaryStat";

const TONE = {
  bg: "bg-white",
  border: "border-default-100",
  text: "text-forest",
  value: "text-deep",
};

export function SummaryCard({ reportData, formatCurrency }) {
  const reportsTranslations = useTranslations("reports");
  const { totalRevenue, totalItems, transactionCount, averageTicket } = useSummaryData(reportData);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryStat label={reportsTranslations("summary.revenue")} value={formatCurrency(totalRevenue)} tone={TONE} />
      <SummaryStat label={reportsTranslations("summary.items")} value={totalItems} tone={TONE} />
      <SummaryStat label={reportsTranslations("summary.transactions")} value={transactionCount} tone={TONE} />
      <SummaryStat label={reportsTranslations("summary.averageTicket")} value={formatCurrency(averageTicket)} tone={TONE} />
    </div>
  );
}
