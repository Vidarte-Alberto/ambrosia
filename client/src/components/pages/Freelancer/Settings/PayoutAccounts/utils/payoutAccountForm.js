export const EMPTY_PAYOUT_ACCOUNT_FORM = {
  id: null,
  type: "bank",
  accountHolder: "",
  bankName: "",
  accountNumber: "",
  currencyId: "",
  swift: "",
  iban: "",
  clabe: "",
  lightningAddress: "",
};

export function toPayoutAccountForm(payoutAccount) {
  if (!payoutAccount) return EMPTY_PAYOUT_ACCOUNT_FORM;
  return {
    id: payoutAccount.id ?? null,
    type: payoutAccount.type ?? EMPTY_PAYOUT_ACCOUNT_FORM.type,
    accountHolder: payoutAccount.accountHolder ?? "",
    bankName: payoutAccount.bankName ?? "",
    accountNumber: payoutAccount.accountNumber ?? "",
    currencyId: payoutAccount.currencyId ?? "",
    swift: payoutAccount.swift ?? "",
    iban: payoutAccount.iban ?? "",
    clabe: payoutAccount.clabe ?? "",
    lightningAddress: payoutAccount.lightningAddress ?? "",
  };
}

function hasText(fieldValue) {
  return Boolean(fieldValue?.trim());
}

export function isPayoutAccountFormComplete(payoutAccountForm) {
  if (payoutAccountForm.type === "lightning") return true;
  const hasBankIdentifier = [payoutAccountForm.accountNumber, payoutAccountForm.iban, payoutAccountForm.clabe].some(hasText);
  return hasText(payoutAccountForm.accountHolder)
    && hasText(payoutAccountForm.bankName)
    && hasText(payoutAccountForm.currencyId)
    && hasBankIdentifier;
}
