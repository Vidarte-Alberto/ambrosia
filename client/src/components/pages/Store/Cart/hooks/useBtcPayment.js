"use client";

import { useMemo } from "react";

import {
  buildHandleBtcComplete,
  buildHandleBtcInvoiceReady,
} from "./paymentHandlers";
import { useBtcCheckoutRecovery } from "./useBtcCheckoutRecovery";
import { useDeferredPayment } from "./useDeferredPayment";

export function useBtcPayment(handlerContext) {
  const { config, setConfig, handleComplete, clearConfig } =
    useDeferredPayment(buildHandleBtcComplete, handlerContext);

  useBtcCheckoutRecovery(handlerContext.onResetCart);

  const onInvoiceReady = useMemo(
    () => buildHandleBtcInvoiceReady({ setBtcPaymentConfig: setConfig }),
    [setConfig],
  );

  return useMemo(
    () => ({
      config,
      setConfig,
      onInvoiceReady,
      onComplete: handleComplete,
      onClose: clearConfig,
    }),
    [config, setConfig, onInvoiceReady, handleComplete, clearConfig],
  );
}
