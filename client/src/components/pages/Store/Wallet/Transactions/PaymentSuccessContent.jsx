"use client";

import {
  Button,
  Divider,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";
import { CopyButton } from "@/components/shared/CopyButton";

import { formatSats } from "../utils/formatters";

import { formatFiat } from "./formatFiat";
import { useSatsToFiatEstimate } from "./useSatsToFiatEstimate";

export function PaymentSuccessContent({
  isOpen,
  onClose,
  result,
}) {
  const t = useTranslations("wallet");
  const { currency } = useCurrency();
  const {
    estimatedFiat,
    estimatedFiatHasError,
    estimatedFiatIsLoading,
  } = useSatsToFiatEstimate({
    isActive: isOpen,
    isPaid: false,
    satsAmount: result?.recipientAmountSat,
    currencyAcronym: currency.acronym,
  });

  return (
    <>
      <ModalBody className="gap-0">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <CheckCircle className="h-16 w-16 text-forest" />
          <p className="text-xl font-semibold text-deep">
            {t("payments.send.paySuccessTitle")}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">{t("payments.send.amountSent")}</span>
            <span className="font-medium">{formatSats(result?.recipientAmountSat)} sats</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("payments.send.estimatedLabel")}</span>
            <span className="font-medium">
              {estimatedFiatIsLoading && t("payments.send.confirmModal.fiatLoading")}
              {estimatedFiatHasError && t("payments.send.confirmModal.fiatError")}
              {!estimatedFiatIsLoading && !estimatedFiatHasError && estimatedFiat != null && formatFiat({
                value: estimatedFiat,
                currencyAcronym: currency.acronym,
                locale: currency.locale,
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("payments.send.routingFee")}</span>
            <span className="font-medium">{formatSats(result?.routingFeeSat)} sats</span>
          </div>
        </div>

        <Divider className="mt-4" />

        <div className="space-y-2 pt-4">
          <span className="text-sm text-gray-500">{t("payments.send.paymentHash")}</span>
          <div className="relative rounded-xl border border-default-200 bg-default-50 p-3 pr-28">
            <CopyButton
              value={result?.paymentHash ?? ""}
              label={t("payments.send.copyButton")}
              size="sm"
              className="absolute right-3 top-3 min-w-0 rounded-lg border-default-300 bg-white px-3 shadow-sm"
            />
            <div className="text-xs font-mono leading-5 break-all text-foreground/80">
              {result?.paymentHash}
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="bordered"
          type="button"
          className="px-6 py-2 border border-border text-foreground hover:bg-muted transition-colors"
          onPress={onClose}
        >
          {t("payments.send.closeButton")}
        </Button>
      </ModalFooter>
    </>
  );
}
