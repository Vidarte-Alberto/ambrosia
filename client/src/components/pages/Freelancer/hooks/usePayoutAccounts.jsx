"use client";
import { useState, useEffect, useCallback } from "react";

import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { buildParsedHttpError } from "@/components/pages/Store/utils/buildHttpError";
import { isConflict, resolveMutationErrorToast, translateToast } from "@/components/pages/Store/utils/mutationErrorToast";
import { toArray } from "@/components/utils/array";
import { httpClient, parseJsonResponse } from "@/lib/http";

import { buildPayoutAccountPayload } from "../Settings/PayoutAccounts/utils/buildPayoutAccountPayload";

const PAYOUT_ACCOUNTS_ENDPOINT = "/freelance/payout-accounts";

export function usePayoutAccounts() {
  const payoutAccountsTranslations = useTranslations("freelancerSettings.payoutAccounts");
  const [payoutAccounts, setPayoutAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayoutAccounts = useCallback(async () => {
    const payoutAccountsResponse = await httpClient(PAYOUT_ACCOUNTS_ENDPOINT, { skipForbiddenRedirect: true });
    const fetchedPayoutAccounts = payoutAccountsResponse.ok ? await parseJsonResponse(payoutAccountsResponse, []) : [];
    setPayoutAccounts(toArray(fetchedPayoutAccounts));
  }, []);

  const fetchCurrencies = useCallback(async () => {
    const currenciesResponse = await httpClient("/currencies", { skipForbiddenRedirect: true });
    const fetchedCurrencies = currenciesResponse.ok ? await parseJsonResponse(currenciesResponse, []) : [];
    setCurrencies(toArray(fetchedCurrencies));
  }, []);

  const fetchPayoutAccountsWithCurrencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchPayoutAccounts(), fetchCurrencies()]);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [fetchPayoutAccounts, fetchCurrencies]);

  const savePayoutAccountMutationErrorRules = [
    {
      when: isConflict,
      toast: translateToast(payoutAccountsTranslations, "toasts.lightningBackendUnavailableTitle", "toasts.lightningBackendUnavailableDescription", "danger"),
    },
  ];

  const notifySaveError = (requestError) => {
    addToast(resolveMutationErrorToast(
      requestError,
      savePayoutAccountMutationErrorRules,
      translateToast(payoutAccountsTranslations, "toasts.saveErrorTitle", "toasts.saveErrorDescription", "danger"),
    ));
  };

  const notifyDeleteError = () => {
    addToast(translateToast(payoutAccountsTranslations, "toasts.deleteErrorTitle", "toasts.deleteErrorDescription", "danger"));
  };

  const savePayoutAccount = async (payoutAccountForm) => {
    const isExistingPayoutAccount = Boolean(payoutAccountForm.id);
    try {
      const savePayoutAccountResponse = await httpClient(
        isExistingPayoutAccount ? `${PAYOUT_ACCOUNTS_ENDPOINT}/${payoutAccountForm.id}` : PAYOUT_ACCOUNTS_ENDPOINT,
        {
          method: isExistingPayoutAccount ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayoutAccountPayload(payoutAccountForm)),
          skipForbiddenRedirect: true,
        },
      );
      if (!savePayoutAccountResponse.ok) {
        throw await buildParsedHttpError(savePayoutAccountResponse, "Error saving payout account");
      }
      await fetchPayoutAccounts();
    } catch (requestError) {
      notifySaveError(requestError);
      throw requestError;
    }
  };

  const deletePayoutAccount = async (payoutAccountId) => {
    try {
      const deletePayoutAccountResponse = await httpClient(`${PAYOUT_ACCOUNTS_ENDPOINT}/${payoutAccountId}`, {
        method: "DELETE",
        skipForbiddenRedirect: true,
      });
      if (!deletePayoutAccountResponse.ok) {
        throw await buildParsedHttpError(deletePayoutAccountResponse, "Error deleting payout account");
      }
      await fetchPayoutAccounts();
    } catch (requestError) {
      notifyDeleteError();
      throw requestError;
    }
  };

  useEffect(() => {
    fetchPayoutAccountsWithCurrencies();
  }, [fetchPayoutAccountsWithCurrencies]);

  return {
    payoutAccounts,
    currencies,
    loading,
    error,
    savePayoutAccount,
    deletePayoutAccount,
    refetch: fetchPayoutAccountsWithCurrencies,
  };
}
