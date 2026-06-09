import { addToast } from "@heroui/react";

import {
  markCheckoutCompleted,
  registerBtcCheckoutSync,
  savePendingCheckout,
} from "@/lib/btcCheckoutStore";

import { processCheckout } from "./paymentFlows";

function getPaymentMethodType(paymentMethodData) {
  const name = (paymentMethodData?.name || "").toLowerCase();
  if (name.includes("btc")) return "btc";
  if (name.includes("cash") || name.includes("efectivo")) return "cash";
  if (name.includes("credit") || name.includes("debit") || name.includes("card")) return "card";
  return "generic";
}

function buildInvoiceDescription(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "";

  const lines = items
    .map((item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      if (!name) return null;
      const quantity = Number(item?.quantity) || 1;
      return `${quantity}x ${name}`;
    })
    .filter(Boolean);

  return lines.join(", ");
}

export function buildHandlePay({
  t,
  currency,
  formatAmount,
  paymentMethodMap,
  getPaymentCurrencyById,
  setBtcPaymentConfig,
  setCashPaymentConfig,
  setCardPaymentConfig,
  onResetCart,
  onPay,
  notifyError,
  dispatch,
  user,
  ensureCartReady,
  normalizeAmounts,
  printCustomerReceipt,
  refreshShiftTickets,
}) {
  return async function handlePay({
    items: cartItems = [],
    subtotal = 0,
    discount = 0,
    discountAmount = 0,
    total = 0,
    selectedPaymentMethod,
  }) {
    try {
      ensureCartReady({
        t,
        items: cartItems,
        selectedPaymentMethod,
        userId: user?.userId,
        currencyId: currency?.id,
      });
    } catch (err) {
      notifyError(err.message);
      return;
    }

    dispatch({ type: "start" });

    try {
      const currencyId = currency.id;
      const paymentAmounts = normalizeAmounts({ subtotal, discount, discountAmount, total, formatAmount });
      const paymentMethodData = paymentMethodMap[selectedPaymentMethod] || null;
      const methodType = getPaymentMethodType(paymentMethodData);

      if (methodType === "btc") {
        const currencyData = await getPaymentCurrencyById(currencyId);
        const currencyAcronym = (
          currencyData?.acronym ||
          currency?.acronym ||
          "MXN"
        ).toLowerCase();
        const invoiceDescription = buildInvoiceDescription(cartItems);

        setBtcPaymentConfig({
          paymentId: `btc-${Date.now()}`,
          amountFiat: paymentAmounts.amountFiat,
          currencyAcronym,
          displayTotal: paymentAmounts.displayTotal,
          subtotal: paymentAmounts.subtotal,
          discount: paymentAmounts.discount,
          discountAmount: paymentAmounts.discountAmount,
          total: paymentAmounts.total,
          cartItems,
          invoiceDescription,
          selectedPaymentMethod,
          currencyId,
          userId: user.userId,
        });
        return;
      }

      if (methodType === "cash") {
        setCashPaymentConfig({
          amountDue: paymentAmounts.amountFiat,
          displayTotal: paymentAmounts.displayTotal,
          cartItems,
          paymentAmounts,
          selectedPaymentMethod,
          currencyId,
        });
        return;
      }

      if (methodType === "card") {
        setCardPaymentConfig({
          amountDue: paymentAmounts.amountFiat,
          displayTotal: paymentAmounts.displayTotal,
          cartItems,
          paymentAmounts,
          selectedPaymentMethod,
          currencyId,
          methodLabel: paymentMethodData?.name || "",
        });
        return;
      }

      const storeCheckoutResult = await processCheckout({
        cartItems,
        paymentAmounts,
        selectedPaymentMethod,
        currencyId,
        user,
        t,
      });

      await refreshShiftTickets?.();
      await printCustomerReceipt?.({
        items: cartItems,
        totalCents: paymentAmounts.total,
        ticketId: storeCheckoutResult.ticketId,
      });

      addToast({ color: "success", description: t("success.paid") });
      onResetCart?.();
      onPay?.({ items: cartItems, ...paymentAmounts, paymentMethod: selectedPaymentMethod, ...storeCheckoutResult });
    } catch (err) {
      console.error("Error processing payment:", err);
      notifyError(err?.message || t("errors.process"));
    } finally {
      dispatch({ type: "stop" });
    }
  };
}

export function buildHandleBtcInvoiceReady({ setBtcPaymentConfig }) {
  return (data) => {
    setBtcPaymentConfig((prev) => {
      if (!prev) return prev;

      if (data?.invoice?.paymentHash) {
        const checkoutPayload = {
          paymentHash: data.invoice.paymentHash,
          userId: prev.userId,
          items: (prev.cartItems || []).map((item) => ({
            productId: String(item?.id ?? ""),
            quantity: Number(item?.quantity) || 0,
            priceAtOrder: Number(item?.price) || 0,
          })),
          paymentMethodId: prev.selectedPaymentMethod,
          currencyId: prev.currencyId,
          amount: prev.amountFiat,
          transactionId: data.invoice.serialized || "",
          satoshiAmount: data.satoshis ?? null,
          exchangeRateAtPayment: data.exchangeRate ?? null,
          exchangeRateCurrency: prev.currencyAcronym ?? null,
          fiatAmountAtPayment: prev.amountFiat ?? null,
        };
        savePendingCheckout({ paymentHash: data.invoice.paymentHash, checkoutPayload }).catch(() => {});
        registerBtcCheckoutSync().catch(() => {});
      }

      return { ...prev, invoiceData: data };
    });
  };
}

export function buildHandleBtcComplete({
  btcPaymentConfig,
  dispatch,
  onPay,
  onResetCart,
  notifyError,
  t,
  user,
  setBtcPaymentConfig,
  printCustomerReceipt,
  refreshShiftTickets,
}) {
  return async (data) => {
    if (!btcPaymentConfig) return;
    dispatch({ type: "start" });
    try {
      const storeCheckoutResult = await processCheckout({
        cartItems: btcPaymentConfig.cartItems,
        paymentAmounts: {
          amountFiat: btcPaymentConfig.amountFiat,
          subtotal: btcPaymentConfig.subtotal,
          discount: btcPaymentConfig.discount,
          discountAmount: btcPaymentConfig.discountAmount,
          total: btcPaymentConfig.total,
        },
        selectedPaymentMethod: btcPaymentConfig.selectedPaymentMethod,
        currencyId: btcPaymentConfig.currencyId,
        user,
        transactionId: data?.invoice?.serialized || "",
        satoshiAmount: data?.satoshis ?? null,
        exchangeRateAtPayment: btcPaymentConfig.invoiceData?.exchangeRate ?? null,
        paymentHash: data?.invoice?.paymentHash ?? null,
        exchangeRateCurrency: btcPaymentConfig.currencyAcronym ?? null,
        fiatAmountAtPayment: btcPaymentConfig.amountFiat ?? null,
        t,
      });

      await markCheckoutCompleted(data?.invoice?.paymentHash, storeCheckoutResult).catch(() => {});

      await refreshShiftTickets?.();
      await printCustomerReceipt?.({
        items: btcPaymentConfig.cartItems,
        totalCents: btcPaymentConfig.total,
        ticketId: storeCheckoutResult.ticketId,
        invoice: data?.invoice?.serialized || "",
      });

      onPay?.({
        items: btcPaymentConfig.cartItems,
        subtotal: btcPaymentConfig.subtotal,
        discount: btcPaymentConfig.discount,
        discountAmount: btcPaymentConfig.discountAmount,
        total: btcPaymentConfig.total,
        amount: btcPaymentConfig.amountFiat,
        paymentMethod: btcPaymentConfig.selectedPaymentMethod,
        ...storeCheckoutResult,
        ...data,
      });
      onResetCart?.();
      addToast({ color: "success", description: t("success.btcPaid") });
    } catch (err) {
      console.error("Error completing BTC payment:", err);
      notifyError(err?.message || t("errors.btcComplete"));
    } finally {
      setBtcPaymentConfig((prev) => {
        if (!prev) return prev;
        return { ...prev, paymentCompleted: true };
      });
      dispatch({ type: "stop" });
    }
  };
}

export function buildHandleCashComplete({
  cashPaymentConfig,
  dispatch,
  onPay,
  onResetCart,
  notifyError,
  t,
  setCashPaymentConfig,
  printCustomerReceipt,
  user,
  refreshShiftTickets,
}) {
  return async ({ cashReceived, change }) => {
    if (!cashPaymentConfig) return;
    dispatch({ type: "start" });
    try {
      const storeCheckoutResult = await processCheckout({
        cartItems: cashPaymentConfig.cartItems || [],
        paymentAmounts: cashPaymentConfig.paymentAmounts,
        selectedPaymentMethod: cashPaymentConfig.selectedPaymentMethod,
        currencyId: cashPaymentConfig.currencyId,
        user,
        t,
      });

      await refreshShiftTickets?.();
      await printCustomerReceipt?.({
        items: cashPaymentConfig.cartItems,
        totalCents: cashPaymentConfig.paymentAmounts.total,
        ticketId: storeCheckoutResult.ticketId,
      });

      onPay?.({
        items: cashPaymentConfig.cartItems,
        ...cashPaymentConfig.paymentAmounts,
        paymentMethod: cashPaymentConfig.selectedPaymentMethod,
        ...storeCheckoutResult,
        cashReceived,
        change,
      });
      onResetCart?.();
      addToast({ color: "success", description: t("success.cashPaid") });
    } catch (err) {
      console.error("Error completing cash payment:", err);
      notifyError(err?.message || t("errors.cashComplete"));
    } finally {
      setCashPaymentConfig(null);
      dispatch({ type: "stop" });
    }
  };
}

export function buildHandleCardComplete({
  cardPaymentConfig,
  dispatch,
  onPay,
  onResetCart,
  notifyError,
  t,
  setCardPaymentConfig,
  printCustomerReceipt,
  user,
  refreshShiftTickets,
}) {
  return async () => {
    if (!cardPaymentConfig) return;
    dispatch({ type: "start" });
    try {
      const storeCheckoutResult = await processCheckout({
        cartItems: cardPaymentConfig.cartItems || [],
        paymentAmounts: cardPaymentConfig.paymentAmounts,
        selectedPaymentMethod: cardPaymentConfig.selectedPaymentMethod,
        currencyId: cardPaymentConfig.currencyId,
        user,
        t,
      });

      await refreshShiftTickets?.();
      await printCustomerReceipt?.({
        items: cardPaymentConfig.cartItems,
        totalCents: cardPaymentConfig.paymentAmounts.total,
        ticketId: storeCheckoutResult.ticketId,
      });

      onPay?.({
        items: cardPaymentConfig.cartItems,
        ...cardPaymentConfig.paymentAmounts,
        paymentMethod: cardPaymentConfig.selectedPaymentMethod,
        ...storeCheckoutResult,
        methodLabel: cardPaymentConfig.methodLabel,
      });
      onResetCart?.();
      addToast({ color: "success", description: t("success.cardPaid") });
    } catch (err) {
      console.error("Error completing card payment:", err);
      notifyError(err?.message || t("errors.cardComplete"));
    } finally {
      setCardPaymentConfig(null);
      dispatch({ type: "stop" });
    }
  };
}
