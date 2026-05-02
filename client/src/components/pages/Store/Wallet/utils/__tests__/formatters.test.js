import { formatFiat, formatSats } from "../formatters";

describe("formatSats", () => {
  it("formats numbers with thousand separators", () => {
    expect(formatSats(1000)).toBe("1,000");
  });

  it("formats large numbers correctly", () => {
    expect(formatSats(1000000)).toBe("1,000,000");
  });

  it("formats small numbers without separators", () => {
    expect(formatSats(100)).toBe("100");
  });

  it("formats zero correctly", () => {
    expect(formatSats(0)).toBe("0");
  });

  it("handles decimal numbers", () => {
    const result = formatSats(1000.5);
    expect(result).toBe("1,000.5");
  });

  it("handles negative numbers", () => {
    const result = formatSats(-1000);
    expect(result).toBe("-1,000");
  });

  it("handles very large numbers", () => {
    expect(formatSats(1000000000)).toBe("1,000,000,000");
  });
});

describe("formatFiat", () => {
  it("formats fiat values using currency and locale", () => {
    expect(formatFiat({
      value: 12.5,
      currencyAcronym: "USD",
      locale: "en-US",
    })).toBe("$12.50");
  });

  it("falls back when Intl currency formatting fails", () => {
    expect(formatFiat({
      value: 12.5,
      currencyAcronym: "INVALID",
      locale: "en-US",
    })).toBe("INVALID 12.50");
  });
});
