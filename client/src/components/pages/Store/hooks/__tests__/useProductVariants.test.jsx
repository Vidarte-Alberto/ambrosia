import { renderHook, act } from "@testing-library/react";

import { httpClient, parseJsonResponse } from "@/lib/http";

import { useProductVariants } from "../useProductVariants";

jest.mock("@/lib/http", () => ({
  httpClient: jest.fn(),
  parseJsonResponse: jest.fn(),
}));

const mockAddToast = jest.fn();
jest.mock("@heroui/react", () => ({
  addToast: (...args) => mockAddToast(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function setup() {
  const { result } = renderHook(() => useProductVariants());
  return result.current;
}

describe("useProductVariants", () => {
  describe("fetchProductDetail", () => {
    it("returns parsed data on success", async () => {
      const detail = { id: "p1", variants: [], options: [] };
      httpClient.mockResolvedValue({ ok: true });
      parseJsonResponse.mockResolvedValue(detail);

      const { fetchProductDetail } = setup();
      const result = await act(async () => fetchProductDetail("p1"));

      expect(httpClient).toHaveBeenCalledWith("/products/p1");
      expect(result).toEqual(detail);
    });

    it("returns null and shows generic toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 500 });
      parseJsonResponse.mockResolvedValue(null);

      const { fetchProductDetail } = setup();
      const result = await act(async () => fetchProductDetail("p1"));

      expect(result).toBeNull();
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });
  });

  describe("addVariant", () => {
    it("returns the new variant id on success", async () => {
      httpClient.mockResolvedValue({ ok: true });
      parseJsonResponse.mockResolvedValue({ id: "v-new" });

      const { addVariant } = setup();
      const result = await act(async () => addVariant("p1", { priceCents: 1000, quantity: 5 }));

      expect(httpClient).toHaveBeenCalledWith("/products/p1/variants", expect.objectContaining({ method: "POST" }));
      expect(result).toBe("v-new");
    });

    it("returns null and shows generic toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 500 });
      parseJsonResponse.mockResolvedValue(null);

      const { addVariant } = setup();
      const result = await act(async () => addVariant("p1", { priceCents: 1000 }));

      expect(result).toBeNull();
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });

    it("shows duplicate SKU toast on 409", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 409 });
      parseJsonResponse.mockResolvedValue(null);

      const { addVariant } = setup();
      await act(async () => addVariant("p1", { SKU: "DUP", priceCents: 500 }));

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "toasts.duplicateVariantSkuTitle",
          color: "danger",
        }),
      );
    });
  });

  describe("updateVariant", () => {
    it("returns true on success", async () => {
      httpClient.mockResolvedValue({ ok: true });

      const { updateVariant } = setup();
      const result = await act(async () => updateVariant("p1", "v1", { priceCents: 800 }));

      expect(httpClient).toHaveBeenCalledWith("/products/p1/variants/v1", expect.objectContaining({ method: "PUT" }));
      expect(result).toBe(true);
    });

    it("returns false and shows toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 500 });

      const { updateVariant } = setup();
      const result = await act(async () => updateVariant("p1", "v1", { priceCents: -1 }));

      expect(result).toBe(false);
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });
  });

  describe("deleteVariant", () => {
    it("returns true on success", async () => {
      httpClient.mockResolvedValue({ ok: true });

      const { deleteVariant } = setup();
      const result = await act(async () => deleteVariant("p1", "v1"));

      expect(httpClient).toHaveBeenCalledWith("/products/p1/variants/v1", expect.objectContaining({ method: "DELETE" }));
      expect(result).toBe(true);
    });

    it("returns false and shows toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 500 });

      const { deleteVariant } = setup();
      const result = await act(async () => deleteVariant("p1", "v1"));

      expect(result).toBe(false);
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });
  });

  describe("addOptionType", () => {
    it("returns the new option type id on success", async () => {
      httpClient.mockResolvedValue({ ok: true });
      parseJsonResponse.mockResolvedValue({ id: "ot-new" });

      const { addOptionType } = setup();
      const result = await act(async () => addOptionType("p1", { name: "Color", values: [] }));

      expect(httpClient).toHaveBeenCalledWith("/products/p1/options", expect.objectContaining({ method: "POST" }));
      expect(result).toBe("ot-new");
    });

    it("returns null and shows toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 500 });
      parseJsonResponse.mockResolvedValue(null);

      const { addOptionType } = setup();
      const result = await act(async () => addOptionType("p1", { name: "Color" }));

      expect(result).toBeNull();
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });
  });

  describe("updateOptionType", () => {
    it("returns true on success", async () => {
      httpClient.mockResolvedValue({ ok: true });

      const { updateOptionType } = setup();
      const result = await act(async () => updateOptionType("p1", "ot1", { name: "Size", values: [] }));

      expect(httpClient).toHaveBeenCalledWith("/products/p1/options/ot1", expect.objectContaining({ method: "PUT" }));
      expect(result).toBe(true);
    });

    it("returns false and shows toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 404 });

      const { updateOptionType } = setup();
      const result = await act(async () => updateOptionType("p1", "ot1", { name: "Size" }));

      expect(result).toBe(false);
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });
  });

  describe("deleteOptionType", () => {
    it("returns true on success", async () => {
      httpClient.mockResolvedValue({ ok: true });

      const { deleteOptionType } = setup();
      const result = await act(async () => deleteOptionType("p1", "ot1"));

      expect(httpClient).toHaveBeenCalledWith("/products/p1/options/ot1", expect.objectContaining({ method: "DELETE" }));
      expect(result).toBe(true);
    });

    it("returns false and shows toast on failure", async () => {
      httpClient.mockResolvedValue({ ok: false, status: 500 });

      const { deleteOptionType } = setup();
      const result = await act(async () => deleteOptionType("p1", "ot1"));

      expect(result).toBe(false);
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ color: "danger" }));
    });
  });
});
