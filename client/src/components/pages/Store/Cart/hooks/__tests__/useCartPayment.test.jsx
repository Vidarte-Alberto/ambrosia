import { act } from "react";

import { addToast } from "@heroui/react";
import { waitFor, renderHook } from "@testing-library/react";

import {
  deleteCheckout,
  getCompletedCheckouts,
  getPendingCheckouts,
  markCheckoutCompleted,
} from "@/lib/btcCheckoutStore";
import { httpClient, parseJsonResponse } from "@/lib/http";

import { useCartPayment } from "../useCartPayment";

let mockPaymentMethods;

jest.mock("@heroui/react", () => ({
  addToast: jest.fn(),
}));

jest.mock("@/lib/btcCheckoutStore", () => ({
  getCompletedCheckouts: jest.fn(),
  getPendingCheckouts: jest.fn(),
  markCheckoutCompleted: jest.fn(),
  deleteCheckout: jest.fn(),
}));

jest.mock("@/lib/http", () => ({
  httpClient: jest.fn(),
  parseJsonResponse: jest.fn(),
}));

jest.mock("@/hooks/auth/useAuth", () => ({
  useAuth: () => ({ user: { userId: "u1", name: "Tester" } }),
}));

jest.mock("@/components/hooks/useCurrency", () => ({
  useCurrency: () => ({
    currency: { id: "cur-1", acronym: "MXN" },
    formatAmount: (value) => `fmt-${value}`,
  }),
}));

jest.mock("../usePaymentMethod", () => ({
  usePaymentMethods: () => ({
    paymentMethods: mockPaymentMethods,
  }),
}));

jest.mock("../../../hooks/usePayments", () => ({
  usePayments: () => ({
    getPaymentCurrencyById: jest.fn(() => Promise.resolve({ acronym: "USD" })),
  }),
}));

jest.mock("../../../hooks/usePrinter", () => ({
  usePrinters: () => ({
    printTicket: jest.fn(() => Promise.resolve()),
    printerConfigs: [{ id: "cfg-1", printerType: "CUSTOMER", enabled: true }],
    loadingConfigs: false,
  }),
}));

describe("useCartPayment", () => {
  beforeEach(() => {
    mockPaymentMethods = [
      { id: "btc", name: "BTC" },
      { id: "cash", name: "Cash" },
    ];

    addToast.mockClear();
    getCompletedCheckouts.mockReset().mockResolvedValue([]);
    getPendingCheckouts.mockReset().mockResolvedValue([]);
    deleteCheckout.mockReset().mockResolvedValue(undefined);
    markCheckoutCompleted.mockReset().mockResolvedValue(undefined);
    httpClient.mockReset();
    parseJsonResponse.mockReset();
  });

  it("handles BTC payment config and clearing", async () => {
    const { result } = renderHook(() => useCartPayment());

    await act(async () => {
      await result.current.handlePay({
        items: [{ id: 1, subtotal: 100 }],
        subtotal: 100,
        discount: 0,
        discountAmount: 0,
        total: 100,
        selectedPaymentMethod: "btc",
      });
    });

    await waitFor(() => {
      expect(result.current.btcPaymentConfig).toEqual(
        expect.objectContaining({
          amountFiat: 1,
          currencyAcronym: "usd",
          displayTotal: "fmt-100",
          selectedPaymentMethod: "btc",
        }),
      );
    });

    act(() => {
      result.current.clearBtcPaymentConfig();
    });

    expect(result.current.btcPaymentConfig).toBeNull();
  });

  it("handles cash payment config and clearing", async () => {
    const { result } = renderHook(() => useCartPayment());

    await act(async () => {
      await result.current.handlePay({
        items: [{ id: 1, subtotal: 100 }],
        subtotal: 100,
        discount: 0,
        discountAmount: 0,
        total: 100,
        selectedPaymentMethod: "cash",
      });
    });

    await waitFor(() => {
      expect(result.current.cashPaymentConfig).toEqual(
        expect.objectContaining({
          amountDue: 1,
          displayTotal: "fmt-100",
        }),
      );
    });

    act(() => {
      result.current.clearCashPaymentConfig();
    });

    expect(result.current.cashPaymentConfig).toBeNull();
  });

  it("handles card payment config and clearing", async () => {
    mockPaymentMethods = [
      { id: "credit", name: "Credit Card" },
    ];
    const { result } = renderHook(() => useCartPayment());

    await act(async () => {
      await result.current.handlePay({
        items: [{ id: 1, subtotal: 100 }],
        subtotal: 100,
        discount: 0,
        discountAmount: 0,
        total: 100,
        selectedPaymentMethod: "credit",
      });
    });

    await waitFor(() => {
      expect(result.current.cardPaymentConfig).toEqual(
        expect.objectContaining({
          amountDue: 1,
          displayTotal: "fmt-100",
          methodLabel: "Credit Card",
        }),
      );
    });

    act(() => {
      result.current.clearCardPaymentConfig();
    });

    expect(result.current.cardPaymentConfig).toBeNull();
  });

  it("handles missing payment methods without crashing", () => {
    mockPaymentMethods = undefined;
    const { result } = renderHook(() => useCartPayment());

    expect(typeof result.current.handlePay).toBe("function");
  });

  describe("BTC checkout recovery", () => {
    it("shows a recovery toast and deletes completed entries found on mount", async () => {
      // NOTE: codifies issue B (known, out of scope) — buildHandleBtcComplete never
      // calls deleteCheckout after a normal BTC sale, so a "completed" entry also
      // lingers after a successful (non-recovery) payment and triggers this same
      // toast on the next mount.
      getCompletedCheckouts.mockResolvedValue([{ paymentHash: "hash-1" }]);

      renderHook(() => useCartPayment());

      await waitFor(() => {
        expect(deleteCheckout).toHaveBeenCalledWith("hash-1");
      });
      expect(addToast).toHaveBeenCalledWith({
        color: "success",
        description: "success.btcRecovered",
      });
    });

    it("recovers a pending checkout that was paid and marks it completed", async () => {
      const checkoutPayload = { userId: "u1", items: [], amount: 10 };
      getPendingCheckouts.mockResolvedValue([
        { paymentHash: "hash-2", checkoutPayload },
      ]);
      httpClient.mockResolvedValue({ ok: true });
      parseJsonResponse.mockResolvedValue({ status: "completed", orderId: "order-2" });

      renderHook(() => useCartPayment());

      await waitFor(() => {
        expect(deleteCheckout).toHaveBeenCalledWith("hash-2");
      });

      expect(httpClient).toHaveBeenCalledWith("store/orders/checkout-if-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });
      expect(markCheckoutCompleted).toHaveBeenCalledWith("hash-2", {
        status: "completed",
        orderId: "order-2",
      });
      expect(addToast).toHaveBeenCalledWith({
        color: "success",
        description: "success.btcRecovered",
      });
    });

    it("leaves a pending checkout untouched when it has not been paid yet", async () => {
      getPendingCheckouts.mockResolvedValue([
        { paymentHash: "hash-3", checkoutPayload: {} },
      ]);
      httpClient.mockResolvedValue({ ok: true });
      parseJsonResponse.mockResolvedValue({ status: "pending" });

      renderHook(() => useCartPayment());

      await waitFor(() => {
        expect(httpClient).toHaveBeenCalled();
      });

      expect(markCheckoutCompleted).not.toHaveBeenCalled();
      expect(deleteCheckout).not.toHaveBeenCalled();
      expect(addToast).not.toHaveBeenCalled();
    });

    it("silently skips recovery when the checkout store is unavailable", async () => {
      getCompletedCheckouts.mockRejectedValue(new Error("IndexedDB unavailable"));

      const { result } = renderHook(() => useCartPayment());

      await waitFor(() => {
        expect(getCompletedCheckouts).toHaveBeenCalled();
      });

      expect(getPendingCheckouts).not.toHaveBeenCalled();
      expect(addToast).not.toHaveBeenCalled();
      expect(typeof result.current.handlePay).toBe("function");
    });
  });
});
