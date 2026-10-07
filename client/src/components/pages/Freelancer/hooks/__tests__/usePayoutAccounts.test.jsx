import { act, renderHook, waitFor } from "@testing-library/react";

import { httpClient, parseJsonResponse } from "@/lib/http";

import { usePayoutAccounts } from "../usePayoutAccounts";

const { addToast } = jest.requireMock("@heroui/react");

jest.mock("@heroui/react", () => ({
  addToast: jest.fn(),
}));

jest.mock("@/lib/http", () => ({
  httpClient: jest.fn(),
  parseJsonResponse: jest.fn(),
}));

const aliceBankAccount = {
  id: "alice-bank-account",
  type: "bank",
  accountHolder: "Alice",
  bankName: "BBVA",
  currencyId: "currency-mxn",
  clabe: "012180001234567890",
};
const currencies = [{ id: "currency-mxn", acronym: "MXN", name: "Mexican Peso" }];

function mockCatalogResponses(responseBodiesByEndpoint) {
  httpClient.mockImplementation((requestedEndpoint) => Promise.resolve({ ok: true, endpoint: requestedEndpoint }));
  parseJsonResponse.mockImplementation((catalogResponse) => Promise.resolve(responseBodiesByEndpoint[catalogResponse.endpoint]));
}

async function renderLoadedPayoutAccounts() {
  const { result: payoutAccountsHook } = renderHook(() => usePayoutAccounts());
  await waitFor(() => expect(payoutAccountsHook.current.loading).toBe(false));
  return payoutAccountsHook;
}

describe("usePayoutAccounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the payout accounts and the currencies", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [aliceBankAccount], "/currencies": currencies });

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(payoutAccountsHook.current.payoutAccounts).toEqual([aliceBankAccount]);
    expect(payoutAccountsHook.current.currencies).toEqual(currencies);
    expect(payoutAccountsHook.current.error).toBeNull();
  });

  it("normalizes the empty list message to an empty array", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": "No payout accounts found", "/currencies": currencies });

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(payoutAccountsHook.current.payoutAccounts).toEqual([]);
  });

  it("exposes the error when loading fails", async () => {
    const networkError = new Error("Network down");
    httpClient.mockRejectedValue(networkError);

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(payoutAccountsHook.current.error).toBe(networkError);
  });

  it("creates a new payout account with POST and reloads the list", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [], "/currencies": currencies });
    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    await act(async () => {
      await payoutAccountsHook.current.savePayoutAccount({ id: null, type: "lightning", lightningAddress: "bob@getalby.com" });
    });

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "lightning", lightningAddress: "bob@getalby.com" }),
    }));
    expect(httpClient.mock.calls.filter(([requestedEndpoint]) => requestedEndpoint === "/freelance/payout-accounts")).toHaveLength(3);
  });

  it("updates an existing payout account with PUT", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [aliceBankAccount], "/currencies": currencies });
    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    await act(async () => {
      await payoutAccountsHook.current.savePayoutAccount(aliceBankAccount);
    });

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts/alice-bank-account", expect.objectContaining({ method: "PUT" }));
  });

  it("deletes a payout account with DELETE", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [aliceBankAccount], "/currencies": currencies });
    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    await act(async () => {
      await payoutAccountsHook.current.deletePayoutAccount("alice-bank-account");
    });

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts/alice-bank-account", { method: "DELETE", skipForbiddenRedirect: true });
  });

  it("notifies the generic save error and throws when the server rejects the payout account", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [], "/currencies": currencies });
    const payoutAccountsHook = await renderLoadedPayoutAccounts();
    httpClient.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(payoutAccountsHook.current.savePayoutAccount({ id: null, type: "bank" })).rejects.toThrow("Error saving payout account");
    expect(addToast).toHaveBeenCalledWith({
      title: "toasts.saveErrorTitle",
      description: "toasts.saveErrorDescription",
      color: "danger",
    });
  });

  it("asks for a Lightning address when the node has no active Lightning backend", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [], "/currencies": currencies });
    const payoutAccountsHook = await renderLoadedPayoutAccounts();
    httpClient.mockResolvedValueOnce({ ok: false, status: 409 });

    await expect(payoutAccountsHook.current.savePayoutAccount({ id: null, type: "lightning", lightningAddress: "" })).rejects.toThrow();
    expect(addToast).toHaveBeenCalledWith({
      title: "toasts.lightningBackendUnavailableTitle",
      description: "toasts.lightningBackendUnavailableDescription",
      color: "danger",
    });
  });

  it("notifies the delete error and throws when the server rejects the deletion", async () => {
    mockCatalogResponses({ "/freelance/payout-accounts": [aliceBankAccount], "/currencies": currencies });
    const payoutAccountsHook = await renderLoadedPayoutAccounts();
    httpClient.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(payoutAccountsHook.current.deletePayoutAccount("alice-bank-account")).rejects.toThrow("Error deleting payout account");
    expect(addToast).toHaveBeenCalledWith({
      title: "toasts.deleteErrorTitle",
      description: "toasts.deleteErrorDescription",
      color: "danger",
    });
  });
});
