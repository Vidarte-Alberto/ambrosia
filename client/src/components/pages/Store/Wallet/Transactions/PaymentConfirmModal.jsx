"use client";

import { useCallback } from "react";

import {
  Button,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { CheckCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";
import { CopyButton } from "@/components/shared/CopyButton";

import { formatSats } from "../utils/formatters";
import { usePaymentAmountInput } from "./usePaymentAmountInput";

export function PaymentConfirmModal({
  decodedInvoice,
  isOpen,
  onClose,
  onConfirm,
  paymentResult,
  isLoading,
}) {
  const t = useTranslations("wallet");
  const { currency } = useCurrency();
  const isPaid = paymentResult != null;
  const amountSat = decodedInvoice?.amountSat;
  const description = decodedInvoice?.description;
  const isZeroAmount = amountSat == null;
  const {
    amountInputMode,
    customAmountError,
    customAmountValue,
    effectiveAmount,
    fiatDisplay,
    fiatHasError,
    fiatIsLoading,
    fiatToSatHasError,
    fiatToSatIsLoading,
    handleAmountChange,
    handleAmountModeChange,
    getConfirmAmount,
    isConfirmDisabled,
  } = usePaymentAmountInput({
    isOpen,
    isPaid,
    amountSat,
    currencyAcronym: currency.acronym,
    t,
  });

  const handleConfirm = useCallback(() => {
    const confirmAmount = getConfirmAmount();
    if (confirmAmount === undefined) return;
    onConfirm(confirmAmount);
  }, [getConfirmAmount, onConfirm]);

  const formatFiat = useCallback(
    (value) => {
      try {
        return new Intl.NumberFormat(currency.locale || "en-US", {
          style: "currency",
          currency: currency.acronym || "USD",
        }).format(value);
      } catch {
        return `${currency.acronym || "USD"} ${value.toFixed(2)}`;
      }
    },
    [currency],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      scrollBehavior="inside"
      shouldBlockScroll={false}
      backdrop="blur"
      classNames={{
        backdrop: "backdrop-blur-xs bg-white/10",
        wrapper: "items-start h-auto",
        base: "my-auto overflow-hidden",
      }}
    >
      <ModalContent>
        <ModalHeader className="pb-2">
          {isPaid ? t("payments.send.paymentDone") : t("payments.send.confirmModal.title")}
        </ModalHeader>
        <ModalBody className="gap-0">
          {isPaid ? (
            <>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircle className="h-16 w-16 text-forest" />
                <p className="text-xl font-semibold text-deep">
                  {t("payments.send.paySuccessTitle")}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("payments.send.amountSent")}</span>
                  <span className="font-medium">{formatSats(paymentResult?.recipientAmountSat)} sats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("payments.send.routingFee")}</span>
                  <span className="font-medium">{formatSats(paymentResult?.routingFeeSat)} sats</span>
                </div>
              </div>

              <Divider />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t("payments.send.paymentHash")}</span>
                  <CopyButton
                    value={paymentResult?.paymentHash ?? ""}
                    label={t("payments.send.copyButton")}
                    size="sm"
                  />
                </div>
                <div className="bg-gray-100 rounded p-2 text-xs font-mono truncate sm:whitespace-normal sm:break-all">
                  {paymentResult?.paymentHash}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Send className="h-16 w-16 text-forest" />
                <p className="text-xl font-semibold text-deep">
                  {t("payments.send.confirmModal.summaryTitle")}
                </p>
              </div>

              <div className="space-y-3">
                {isZeroAmount ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        {t("payments.send.confirmModal.zeroAmountTitle")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant={amountInputMode === "sat" ? "solid" : "bordered"}
                          color={amountInputMode === "sat" ? "primary" : "default"}
                          onPress={() => handleAmountModeChange("sat")}
                        >
                          {t("payments.send.confirmModal.satsOption")}
                        </Button>
                        <Button
                          variant={amountInputMode === "fiat" ? "solid" : "bordered"}
                          color={amountInputMode === "fiat" ? "primary" : "default"}
                          onPress={() => handleAmountModeChange("fiat")}
                        >
                          {t("payments.send.confirmModal.fiatOption", { currency: currency.acronym })}
                        </Button>
                      </div>
                    </div>

                    <Input
                      type="number"
                      label={amountInputMode === "fiat"
                        ? t("payments.send.confirmModal.zeroAmountFiatLabel", { currency: currency.acronym })
                        : t("payments.send.confirmModal.zeroAmountLabel")}
                      placeholder={amountInputMode === "fiat"
                        ? t("payments.send.confirmModal.zeroAmountFiatPlaceholder")
                        : t("payments.send.confirmModal.zeroAmountPlaceholder")}
                      value={customAmountValue}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      isInvalid={Boolean(customAmountError) || fiatToSatHasError}
                      errorMessage={customAmountError || (fiatToSatHasError
                        ? t("payments.send.confirmModal.fiatToSatsError")
                        : "")}
                      min="0"
                      step={amountInputMode === "fiat" ? "0.01" : "1"}
                    />

                    {amountInputMode === "fiat" && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {t("payments.send.confirmModal.amountLabel")}
                        </span>
                        <span className="font-medium">
                          {fiatToSatIsLoading && t("payments.send.confirmModal.fiatLoading")}
                          {fiatToSatHasError && t("payments.send.confirmModal.fiatToSatsError")}
                          {!fiatToSatIsLoading && !fiatToSatHasError && effectiveAmount != null && `${formatSats(effectiveAmount)} sats`}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      {t("payments.send.confirmModal.amountLabel")}
                    </span>
                    <span className="font-medium">
                      {formatSats(amountSat)} sats
                    </span>
                  </div>
                )}

                {effectiveAmount != null && effectiveAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      {t("payments.send.confirmModal.fiatLabel")}
                    </span>
                    <span className="font-medium">
                      {fiatIsLoading && t("payments.send.confirmModal.fiatLoading")}
                      {fiatHasError && t("payments.send.confirmModal.fiatError")}
                      {!fiatIsLoading && !fiatHasError && fiatDisplay != null && formatFiat(fiatDisplay)}
                    </span>
                  </div>
                )}
              </div>

              {description && (
                <>
                  <Divider />
                  <div className="space-y-2 pt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        {t("payments.send.confirmModal.descriptionLabel")}
                      </span>
                      <span className="font-medium text-right max-w-[60%]">
                        {description}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          {isPaid ? (
            <Button
              variant="bordered"
              type="button"
              className="px-6 py-2 border border-border text-foreground hover:bg-muted transition-colors"
              onPress={onClose}
            >
              {t("payments.send.closeButton")}
            </Button>
          ) : (
            <>
              <Button
                variant="bordered"
                type="button"
                className="px-6 py-2 border border-border text-foreground hover:bg-muted transition-colors"
                onPress={onClose}
                isDisabled={isLoading}
              >
                {t("payments.send.confirmModal.cancelButton")}
              </Button>
              <Button
                color="primary"
                onPress={handleConfirm}
                isLoading={isLoading}
                isDisabled={isConfirmDisabled}
              >
                {t("payments.send.confirmModal.confirmButton")}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
