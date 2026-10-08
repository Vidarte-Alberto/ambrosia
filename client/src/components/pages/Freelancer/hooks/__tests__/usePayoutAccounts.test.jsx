import { act, renderHook, waitFor } from "@testing-library/react";

import { httpClient, parseJsonResponse } from "@/lib/http";

import { usePayoutAccounts } from "../usePayoutAccounts";

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
const bobLightningRequest = { type: "lightning", lightningAddress: "bob@getalby.com" };

function mockPayoutAccountsResponse(payoutAccountsBody) {
  httpClient.mockResolvedValue({ ok: true, status: 200 });
  parseJsonResponse.mockResolvedValue(payoutAccountsBody);
}

async function renderLoadedPayoutAccounts() {
  const { result: payoutAccountsHook } = renderHook(() => usePayoutAccounts({ skipForbiddenRedirect: true }));
  await waitFor(() => expect(payoutAccountsHook.current.loading).toBe(false));
  return payoutAccountsHook;
}

function payoutAccountsListRequests() {
  return httpClient.mock.calls.filter(([requestedEndpoint, requestOptions]) => (
    requestedEndpoint === "/freelance/payout-accounts" && !requestOptions.method
  ));
}

describe("usePayoutAccounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the payout accounts", async () => {
    mockPayoutAccountsResponse([aliceBankAccount]);

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts", { skipForbiddenRedirect: true });
    expect(payoutAccountsHook.current.payoutAccounts).toEqual([aliceBankAccount]);
    expect(payoutAccountsHook.current.error).toBeNull();
  });

  it("normalizes the empty list message to an empty array", async () => {
    mockPayoutAccountsResponse("No payout accounts found");

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(payoutAccountsHook.current.payoutAccounts).toEqual([]);
  });

  it("flags a forbidden response without loading payout accounts", async () => {
    httpClient.mockResolvedValue({ ok: false, status: 403 });

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(payoutAccountsHook.current.forbidden).toBe(true);
    expect(payoutAccountsHook.current.payoutAccounts).toEqual([]);
  });

  it("exposes the error when loading fails", async () => {
    const networkError = new Error("Network down");
    httpClient.mockRejectedValue(networkError);

    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    expect(payoutAccountsHook.current.error).toBe(networkError);
  });

  it("creates a payout account with POST and reloads the list", async () => {
    mockPayoutAccountsResponse([]);
    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    await act(async () => {
      await payoutAccountsHook.current.createPayoutAccount(bobLightningRequest);
    });

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(bobLightningRequest),
    }));
    expect(payoutAccountsListRequests()).toHaveLength(2);
  });

  it("updates a payout account with PUT", async () => {
    mockPayoutAccountsResponse([aliceBankAccount]);
    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    await act(async () => {
      await payoutAccountsHook.current.updatePayoutAccount("alice-bank-account", { ...aliceBankAccount, bankName: "Banorte" });
    });

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts/alice-bank-account", expect.objectContaining({ method: "PUT" }));
  });

  it("deletes a payout account with DELETE", async () => {
    mockPayoutAccountsResponse([aliceBankAccount]);
    const payoutAccountsHook = await renderLoadedPayoutAccounts();

    await act(async () => {
      await payoutAccountsHook.current.deletePayoutAccount("alice-bank-account");
    });

    expect(httpClient).toHaveBeenCalledWith("/freelance/payout-accounts/alice-bank-account", { method: "DELETE", skipForbiddenRedirect: true });
  });

  it("throws the parsed error when the server rejects a mutation", async () => {
    mockPayoutAccountsResponse([]);
    const payoutAccountsHook = await renderLoadedPayoutAccounts();
    httpClient.mockResolvedValueOnce({ ok: false, status: 409 });

    await expect(payoutAccountsHook.current.createPayoutAccount({ type: "lightning", lightningAddress: null }))
      .rejects.toMatchObject({ message: "Error creating payout account", status: 409 });
  });
});
