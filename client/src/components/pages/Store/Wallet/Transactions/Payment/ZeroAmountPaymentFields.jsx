"use client";

import { useTranslations } from "next-intl";

import { AmountUnitInputFields } from "../AmountUnitInputFields";

export function ZeroAmountPaymentFields({
  amountInputMode,
  currencyAcronym,
  customEstimateError,
  customEstimateValue,
  estimatedSats,
  fiatToSatHasError,
  fiatToSatIsLoading,
  onAmountChange,
  onAmountModeChange,
}) {
  const t = useTranslations("wallet");

  return (
    <AmountUnitInputFields
      amountInputMode={amountInputMode}
      errorMessage={customEstimateError}
      estimatedLabel={t("payments.send.confirmModal.estimatedLabel")}
      estimatedSats={estimatedSats}
      fiatLabel={t("payments.send.confirmModal.zeroAmountFiatLabel", { currency: currencyAcronym })}
      fiatOptionLabel={t("payments.send.confirmModal.fiatOption", { currency: currencyAcronym })}
      fiatPlaceholder={t("payments.send.confirmModal.zeroAmountFiatPlaceholder")}
      fiatToSatHasError={fiatToSatHasError}
      fiatToSatIsLoading={fiatToSatIsLoading}
      inputValue={customEstimateValue}
      loadingText={t("payments.send.confirmModal.fiatLoading")}
      onAmountChange={onAmountChange}
      onAmountModeChange={onAmountModeChange}
      satLabel={t("payments.send.confirmModal.zeroAmountLabel")}
      satsOptionLabel={t("payments.send.confirmModal.satsOption")}
      satPlaceholder={t("payments.send.confirmModal.zeroAmountPlaceholder")}
      title={t("payments.send.confirmModal.zeroAmountTitle")}
      conversionErrorText={t("payments.send.confirmModal.fiatToSatsError")}
    />
  );
}
