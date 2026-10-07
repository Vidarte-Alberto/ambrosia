"use client";

import { useState } from "react";

import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { usePayoutAccounts } from "../../hooks/usePayoutAccounts";

import { DeletePayoutAccountModal } from "./DeletePayoutAccountModal";
import { PayoutAccountModal } from "./PayoutAccountModal";
import { PayoutAccountsCard } from "./PayoutAccountsCard";

export function PayoutAccounts() {
  const payoutAccountsTranslations = useTranslations("freelancerSettings.payoutAccounts");
  const { payoutAccounts, currencies, loading, error, savePayoutAccount, deletePayoutAccount } = usePayoutAccounts();
  const [isPayoutAccountModalOpen, setIsPayoutAccountModalOpen] = useState(false);
  const [editedPayoutAccount, setEditedPayoutAccount] = useState(null);
  const [payoutAccountPendingDeletion, setPayoutAccountPendingDeletion] = useState(null);

  const openPayoutAccountModal = (payoutAccount = null) => {
    setEditedPayoutAccount(payoutAccount);
    setIsPayoutAccountModalOpen(true);
  };

  const closePayoutAccountModal = () => {
    setIsPayoutAccountModalOpen(false);
    setEditedPayoutAccount(null);
  };

  const handleSavePayoutAccount = async (payoutAccountForm) => {
    try {
      await savePayoutAccount(payoutAccountForm);
      closePayoutAccountModal();
      addToast({ title: payoutAccountsTranslations("toasts.saveSuccess"), color: "success" });
    } catch {
      return;
    }
  };

  const handleConfirmDeletePayoutAccount = async () => {
    try {
      await deletePayoutAccount(payoutAccountPendingDeletion.id);
      addToast({ title: payoutAccountsTranslations("toasts.deleteSuccess"), color: "success" });
    } catch {
      return;
    } finally {
      setPayoutAccountPendingDeletion(null);
    }
  };

  return (
    <>
      <PayoutAccountsCard
        payoutAccounts={payoutAccounts}
        loading={loading}
        hasLoadError={Boolean(error)}
        onAdd={() => openPayoutAccountModal()}
        onEdit={openPayoutAccountModal}
        onDelete={setPayoutAccountPendingDeletion}
      />
      <PayoutAccountModal
        payoutAccount={editedPayoutAccount}
        currencies={currencies}
        isOpen={isPayoutAccountModalOpen}
        onClose={closePayoutAccountModal}
        onSave={handleSavePayoutAccount}
      />
      <DeletePayoutAccountModal
        isOpen={Boolean(payoutAccountPendingDeletion)}
        onClose={() => setPayoutAccountPendingDeletion(null)}
        onConfirm={handleConfirmDeletePayoutAccount}
      />
    </>
  );
}
