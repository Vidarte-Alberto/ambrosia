"use client";

import { useCallback, useEffect, useState } from "react";

import BitcoinPriceService from "@/services/bitcoinPriceService";

const bitcoinService = new BitcoinPriceService();
const DEFAULT_AMOUNT_MODE = "sat";

function resolveEffectiveAmount({
  isZeroAmount,
  amountInputMode,
  parsedSatAmount,
  amountSat,
  fiatToSatResult,
  customAmountFiat,
}) {
  if (!isZeroAmount) return amountSat;
  if (amountInputMode !== "fiat") return parsedSatAmount;
  if (fiatToSatResult?.forAmount !== customAmountFiat) return null;
  return fiatToSatResult.value;
}

export function usePaymentAmountInput({
  isOpen,
  isPaid,
  amountSat,
  currencyAcronym,
  t,
}) {
  const [customAmountSat, setCustomAmountSat] = useState("");
  const [customAmountFiat, setCustomAmountFiat] = useState("");
  const [customAmountError, setCustomAmountError] = useState("");
  const [fiatResult, setFiatResult] = useState(null);
  const [amountInputMode, setAmountInputMode] = useState(DEFAULT_AMOUNT_MODE);
  const [fiatToSatResult, setFiatToSatResult] = useState(null);

  const isZeroAmount = amountSat == null;
  const parsedSatAmount = parseInt(customAmountSat, 10);
  const parsedFiatAmount = parseFloat(customAmountFiat);
  const effectiveAmount = resolveEffectiveAmount({
    isZeroAmount,
    amountInputMode,
    parsedSatAmount,
    amountSat,
    fiatToSatResult,
    customAmountFiat,
  });
  const isValidSatAmount = Number.isInteger(parsedSatAmount) && parsedSatAmount > 0;
  const isValidFiatAmount = Number.isFinite(parsedFiatAmount) && parsedFiatAmount > 0;

  useEffect(() => {
    if (!isOpen) return;
    setAmountInputMode(DEFAULT_AMOUNT_MODE);
    setCustomAmountSat("");
    setCustomAmountFiat("");
    setCustomAmountError("");
    setFiatToSatResult(null);
    setFiatResult(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isPaid || !effectiveAmount || effectiveAmount <= 0) return;

    let cancelled = false;

    bitcoinService
      .satoshisToFiat(effectiveAmount, currencyAcronym)
      .then((fiat) => {
        if (!cancelled) {
          setFiatResult({ value: fiat, error: false, forAmount: effectiveAmount });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiatResult({ value: null, error: true, forAmount: effectiveAmount });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isPaid, effectiveAmount, currencyAcronym]);

  useEffect(() => {
    if (!isOpen || isPaid || !isZeroAmount || amountInputMode !== "fiat") return;

    if (!customAmountFiat.trim()) {
      setFiatToSatResult(null);
      return;
    }

    if (!isValidFiatAmount) {
      setFiatToSatResult({ value: null, error: true, forAmount: customAmountFiat });
      return;
    }

    let cancelled = false;

    bitcoinService
      .fiatToSatoshis(parsedFiatAmount, currencyAcronym)
      .then((sats) => {
        if (!cancelled) {
          setFiatToSatResult({ value: sats, error: false, forAmount: customAmountFiat });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiatToSatResult({ value: null, error: true, forAmount: customAmountFiat });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    isPaid,
    isZeroAmount,
    amountInputMode,
    customAmountFiat,
    parsedFiatAmount,
    isValidFiatAmount,
    currencyAcronym,
  ]);

  const fiatDisplay = fiatResult?.forAmount === effectiveAmount ? fiatResult.value : null;
  const fiatIsLoading = effectiveAmount > 0 &&
    fiatDisplay == null &&
    !(fiatResult?.error && fiatResult?.forAmount === effectiveAmount);
  const fiatHasError = fiatResult?.error && fiatResult?.forAmount === effectiveAmount;
  const fiatToSatIsLoading = amountInputMode === "fiat" &&
    customAmountFiat.trim() &&
    isValidFiatAmount &&
    (fiatToSatResult?.forAmount !== customAmountFiat || fiatToSatResult?.value == null) &&
    !(fiatToSatResult?.error && fiatToSatResult?.forAmount === customAmountFiat);
  const fiatToSatHasError = amountInputMode === "fiat" &&
    fiatToSatResult?.error &&
    fiatToSatResult?.forAmount === customAmountFiat;

  const handleAmountModeChange = useCallback((nextMode) => {
    setAmountInputMode(nextMode);
    setCustomAmountError("");
  }, []);

  const handleAmountChange = useCallback((value) => {
    if (amountInputMode === "fiat") {
      setCustomAmountFiat(value);
    } else {
      setCustomAmountSat(value);
    }
    setCustomAmountError("");
  }, [amountInputMode]);

  const getConfirmAmount = useCallback(() => {
    if (!isZeroAmount) return null;

    if (amountInputMode === "fiat") {
      if (!isValidFiatAmount || !effectiveAmount || effectiveAmount <= 0) {
        setCustomAmountError(t("payments.send.confirmModal.zeroAmountError"));
        return undefined;
      }
      return effectiveAmount;
    }

    if (!isValidSatAmount) {
      setCustomAmountError(t("payments.send.confirmModal.zeroAmountError"));
      return undefined;
    }

    return parsedSatAmount;
  }, [
    isZeroAmount,
    amountInputMode,
    isValidFiatAmount,
    effectiveAmount,
    isValidSatAmount,
    parsedSatAmount,
    t,
  ]);

  return {
    amountInputMode,
    customAmountError,
    customAmountValue: amountInputMode === "fiat" ? customAmountFiat : customAmountSat,
    effectiveAmount,
    fiatDisplay,
    fiatHasError,
    fiatIsLoading,
    fiatToSatHasError,
    fiatToSatIsLoading,
    handleAmountChange,
    handleAmountModeChange,
    getConfirmAmount,
    isConfirmDisabled: isZeroAmount && (
      amountInputMode === "fiat"
        ? !isValidFiatAmount || fiatToSatIsLoading || !effectiveAmount
        : !isValidSatAmount
    ),
  };
}
