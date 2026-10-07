function toNullableTrimmedValue(fieldValue) {
  const trimmedValue = fieldValue?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function buildPayoutAccountPayload(payoutAccountForm) {
  if (payoutAccountForm.type === "lightning") {
    return {
      type: "lightning",
      lightningAddress: toNullableTrimmedValue(payoutAccountForm.lightningAddress),
    };
  }

  return {
    type: "bank",
    accountHolder: toNullableTrimmedValue(payoutAccountForm.accountHolder),
    bankName: toNullableTrimmedValue(payoutAccountForm.bankName),
    accountNumber: toNullableTrimmedValue(payoutAccountForm.accountNumber),
    currencyId: toNullableTrimmedValue(payoutAccountForm.currencyId),
    swift: toNullableTrimmedValue(payoutAccountForm.swift),
    iban: toNullableTrimmedValue(payoutAccountForm.iban),
    clabe: toNullableTrimmedValue(payoutAccountForm.clabe),
    lightningAddress: null,
  };
}
