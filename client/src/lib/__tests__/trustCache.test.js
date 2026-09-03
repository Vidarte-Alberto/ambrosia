/** @jest-environment node */
import { fetchTrustRequest, isTrustPath } from "../trustCache";

afterEach(() => jest.restoreAllMocks());

it("matches trust routes without matching unrelated paths", () => {
  expect(isTrustPath("/trust")).toBe(true);
  expect(isTrustPath("/trust/check.html")).toBe(true);
  expect(isTrustPath("/trusted")).toBe(false);
  expect(isTrustPath("/store/settings")).toBe(false);
});

it("always requests a fresh network response", async () => {
  const response = { status: 200 };
  jest.spyOn(global, "fetch").mockResolvedValue(response);
  const request = { url: "https://unit.local/trust/metadata.json" };
  expect(await fetchTrustRequest({ request })).toBe(response);
  expect(fetch).toHaveBeenCalledWith(request, { cache: "no-store" });
});

it("returns a network error instead of a cached success when TLS or connectivity fails", async () => {
  jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("TLS failed"));
  const response = await fetchTrustRequest({ request: {} });
  expect(response.type).toBe("error");
});
