"use client";

import { useCallback, useEffect, useState } from "react";

import { toArray } from "@/components/utils/array";
import { httpClient, parseJsonResponse } from "@/lib/http";

import { buildParsedHttpError } from "../../Store/utils/buildHttpError";

const PAYOUT_ACCOUNTS_ENDPOINT = "/freelance/payout-accounts";

export function usePayoutAccounts({ skipForbiddenRedirect = false } = {}) {
  const [payoutAccounts, setPayoutAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchPayoutAccounts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const payoutAccountsResponse = await httpClient(PAYOUT_ACCOUNTS_ENDPOINT, { skipForbiddenRedirect });
      setForbidden(payoutAccountsResponse.status === 403);
      if (!payoutAccountsResponse.ok) return;

      const payoutAccountsData = await parseJsonResponse(payoutAccountsResponse, []);
      setPayoutAccounts(toArray(payoutAccountsData));
    } catch (loadPayoutAccountsError) {
      setLoadError(loadPayoutAccountsError);
    } finally {
      setLoading(false);
    }
  }, [skipForbiddenRedirect]);

  const createPayoutAccount = useCallback(
    async (payoutAccountRequest) => {
      const createPayoutAccountResponse = await httpClient(PAYOUT_ACCOUNTS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payoutAccountRequest),
        skipForbiddenRedirect: true,
      });

      if (createPayoutAccountResponse.ok === false) {
        throw await buildParsedHttpError(createPayoutAccountResponse, "Error creating payout account");
      }

      const createdPayoutAccountData = await parseJsonResponse(createPayoutAccountResponse, {});
      await fetchPayoutAccounts();
      return createdPayoutAccountData;
    },
    [fetchPayoutAccounts],
  );

  const updatePayoutAccount = useCallback(
    async (payoutAccountId, payoutAccountRequest) => {
      const updatePayoutAccountResponse = await httpClient(`${PAYOUT_ACCOUNTS_ENDPOINT}/${payoutAccountId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payoutAccountRequest),
        skipForbiddenRedirect: true,
      });

      if (updatePayoutAccountResponse.ok === false) {
        throw await buildParsedHttpError(updatePayoutAccountResponse, "Error updating payout account");
      }

      const updatedPayoutAccountData = await parseJsonResponse(updatePayoutAccountResponse, {});
      await fetchPayoutAccounts();
      return updatedPayoutAccountData;
    },
    [fetchPayoutAccounts],
  );

  const deletePayoutAccount = useCallback(
    async (payoutAccountId) => {
      const deletePayoutAccountResponse = await httpClient(`${PAYOUT_ACCOUNTS_ENDPOINT}/${payoutAccountId}`, {
        method: "DELETE",
        skipForbiddenRedirect: true,
      });

      if (deletePayoutAccountResponse.ok === false) {
        throw await buildParsedHttpError(deletePayoutAccountResponse, "Error deleting payout account");
      }

      await fetchPayoutAccounts();
      return deletePayoutAccountResponse;
    },
    [fetchPayoutAccounts],
  );

  useEffect(() => {
    fetchPayoutAccounts();
  }, [fetchPayoutAccounts]);

  return {
    payoutAccounts,
    loading,
    error: loadError,
    forbidden,
    refetch: fetchPayoutAccounts,
    createPayoutAccount,
    updatePayoutAccount,
    deletePayoutAccount,
  };
}
