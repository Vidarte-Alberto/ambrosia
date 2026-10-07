"use client";

import { Button, Card, CardBody, CardHeader, Chip, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import { RequirePermission } from "@/hooks/usePermission";
import { DeleteButton } from "@components/shared/DeleteButton";
import { EditButton } from "@components/shared/EditButton";

function describeBankAccount(payoutAccount) {
  const bankIdentifier = payoutAccount.clabe || payoutAccount.iban || payoutAccount.accountNumber;
  return [payoutAccount.bankName, bankIdentifier].filter(Boolean).join(" · ");
}

function PayoutAccountRow({ payoutAccount, onEdit, onDelete }) {
  const payoutAccountsTranslations = useTranslations("freelancerSettings.payoutAccounts");
  const isBankAccount = payoutAccount.type === "bank";
  const payoutAccountTitle = isBankAccount
    ? payoutAccount.accountHolder
    : payoutAccount.lightningAddress || payoutAccountsTranslations("nodeLightningAddress");

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-semibold text-green-900 truncate">{payoutAccountTitle}</span>
          <Chip size="sm" variant="flat" className="bg-green-100 text-green-800">
            {payoutAccountsTranslations(`types.${payoutAccount.type}`)}
          </Chip>
        </div>
        {isBankAccount && (
          <p className="text-xs sm:text-sm text-gray-500 truncate">{describeBankAccount(payoutAccount)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RequirePermission allOf={["payout_accounts_update"]}>
          <EditButton onPress={() => onEdit(payoutAccount)} />
        </RequirePermission>
        <RequirePermission allOf={["payout_accounts_delete"]}>
          <DeleteButton onPress={() => onDelete(payoutAccount)} />
        </RequirePermission>
      </div>
    </li>
  );
}

export function PayoutAccountsCard({ payoutAccounts, loading, hasLoadError, onAdd, onEdit, onDelete }) {
  const payoutAccountsTranslations = useTranslations("freelancerSettings.payoutAccounts");

  const renderPayoutAccounts = () => {
    if (loading) return <Spinner size="sm" color="success" />;
    if (hasLoadError) return <p className="text-sm text-red-600">{payoutAccountsTranslations("loadError")}</p>;
    if (payoutAccounts.length === 0) {
      return <p className="text-sm text-gray-400 italic">{payoutAccountsTranslations("empty")}</p>;
    }
    return (
      <ul className="divide-y divide-gray-100">
        {payoutAccounts.map((payoutAccount) => (
          <PayoutAccountRow
            key={payoutAccount.id}
            payoutAccount={payoutAccount}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    );
  };

  return (
    <Card shadow="none" className="rounded-lg p-6 shadow-lg">
      <CardHeader className="flex items-start justify-between gap-3 pb-0">
        <div>
          <h2 className="text-lg sm:text-xl xl:text-2xl font-semibold text-green-900">
            {payoutAccountsTranslations("title")}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {payoutAccountsTranslations("subtitle")}
          </p>
        </div>
        <RequirePermission allOf={["payout_accounts_create"]}>
          <Button
            color="primary"
            className="h-8 min-w-16 px-3 rounded-small sm:h-10 sm:min-w-20 sm:px-4 sm:rounded-medium bg-green-800"
            onPress={onAdd}
          >
            {payoutAccountsTranslations("addButton")}
          </Button>
        </RequirePermission>
      </CardHeader>
      <CardBody>
        {renderPayoutAccounts()}
      </CardBody>
    </Card>
  );
}
