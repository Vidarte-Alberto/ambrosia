import { renderHook } from "@testing-library/react";

import { usePaymentMethodLabel } from "../usePaymentMethodLabel";

jest.mock("next-intl", () => ({
  useTranslations: (namespace) => (key) => `${namespace}.${key}`,
}));

describe("usePaymentMethodLabel", () => {
  it("translates built-in payment method names", () => {
    const { result } = renderHook(() => usePaymentMethodLabel());

    expect(result.current.getPaymentMethodLabel("Bank Transfer")).toBe("paymentMethods.bankTransfer");
    expect(result.current.getPaymentMethodLabel("BTC")).toBe("paymentMethods.btc");
  });

  it("returns custom payment method names unchanged", () => {
    const { result } = renderHook(() => usePaymentMethodLabel());

    expect(result.current.getPaymentMethodLabel("Vale de despensa")).toBe("Vale de despensa");
  });

  it("returns empty values unchanged so callers can apply their own fallback", () => {
    const { result } = renderHook(() => usePaymentMethodLabel());

    expect(result.current.getPaymentMethodLabel(null)).toBeNull();
    expect(result.current.getPaymentMethodLabel("")).toBe("");
  });
});
