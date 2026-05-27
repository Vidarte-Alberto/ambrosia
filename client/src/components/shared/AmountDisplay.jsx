"use client";

import { useState } from "react";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";

export function AmountDisplay({ satoshis, exchangeRateAtSale, currentRate }) {
  const [showSats, setShowSats] = useState(false);
  const [showCurrentFiat, setShowCurrentFiat] = useState(false);
  const { formatAmount } = useCurrency();
  const t = useTranslations("amountDisplay");

  if (!satoshis) return null;

  if (showSats) {
    return (
      <button
        type="button"
        onClick={() => setShowSats(false)}
        className="text-sm tabular-nums"
      >
        {satoshis.toLocaleString()} {t("satsLabel")}
      </button>
    );
  }

  const fiatAtSaleCents = exchangeRateAtSale != null
    ? (satoshis / 100_000_000) * exchangeRateAtSale * 100
    : null;
  const fiatCurrentCents = currentRate != null
    ? (satoshis / 100_000_000) * currentRate * 100
    : null;

  const displayCents = showCurrentFiat ? fiatCurrentCents : fiatAtSaleCents;
  const canToggleRate = fiatAtSaleCents != null && fiatCurrentCents != null;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setShowSats(true)}
        className="text-sm tabular-nums"
      >
        {displayCents != null ? formatAmount(displayCents) : "—"}
      </button>
      {canToggleRate && (
        <button
          type="button"
          onClick={() => setShowCurrentFiat((prev) => !prev)}
          aria-label={showCurrentFiat ? t("showHistoricalRate") : t("showCurrentRate")}
          className="flex items-center"
        >
          <Clock
            size={12}
            className={showCurrentFiat ? "text-primary" : "text-foreground-400"}
          />
        </button>
      )}
    </span>
  );
}
