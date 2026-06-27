"use client";

import { useMemo } from "react";

import { useDeferredPayment } from "./useDeferredPayment";

export function usePaymentChannel(buildComplete, handlerContext) {
  const { config, setConfig, handleComplete, clearConfig } =
    useDeferredPayment(buildComplete, handlerContext);

  return useMemo(
    () => ({ config, setConfig, onComplete: handleComplete, onClose: clearConfig }),
    [config, setConfig, handleComplete, clearConfig],
  );
}
