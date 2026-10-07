"use client";

import { useEffect, useState } from "react";

import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@heroui/react";
import { useTranslations } from "next-intl";

import { CurrencyInput } from "@components/shared/CurrencyInput";

import { isPayoutAccountFormComplete, toPayoutAccountForm } from "./utils/payoutAccountForm";

const PAYOUT_ACCOUNT_TYPES = ["bank", "lightning"];
const BANK_IDENTIFIER_FIELD_NAMES = ["clabe", "iban", "swift"];

export function PayoutAccountModal({ payoutAccount, currencies, isOpen, onClose, onSave }) {
  const payoutAccountsTranslations = useTranslations("freelancerSettings.payoutAccounts");
  const [payoutAccountForm, setPayoutAccountForm] = useState(() => toPayoutAccountForm(payoutAccount));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setPayoutAccountForm(toPayoutAccountForm(payoutAccount));
  }, [isOpen, payoutAccount]);

  const isEditing = Boolean(payoutAccount?.id);
  const isBankAccount = payoutAccountForm.type === "bank";
  const currencyOptions = currencies.map((currency) => ({ code: currency.acronym, name: currency.name ?? currency.acronym }));
  const selectedCurrencyAcronym = currencies.find((currency) => currency.id === payoutAccountForm.currencyId)?.acronym ?? null;

  const changePayoutAccountField = (fieldName, fieldValue) => {
    setPayoutAccountForm((previousForm) => ({ ...previousForm, [fieldName]: fieldValue }));
  };

  const changeSelectedCurrency = (currencyAcronym) => {
    const selectedCurrency = currencies.find((currency) => currency.acronym === currencyAcronym);
    changePayoutAccountField("currencyId", selectedCurrency?.id ?? "");
  };

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!isPayoutAccountFormComplete(payoutAccountForm)) return;
    setIsSaving(true);
    try {
      await onSave(payoutAccountForm);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => !nextIsOpen && onClose()}
      placement="center"
      backdrop="blur"
      shouldBlockScroll={false}
      classNames={{
        backdrop: "backdrop-blur-xs bg-white/10",
        wrapper: "items-start h-auto",
        base: "my-auto overflow-hidden",
        body: "overflow-y-auto max-h-[65vh]",
      }}
    >
      <ModalContent>
        <ModalHeader>
          {payoutAccountsTranslations(isEditing ? "modal.editTitle" : "modal.createTitle")}
        </ModalHeader>
        <ModalBody>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Select
              label={payoutAccountsTranslations("fields.type")}
              isRequired
              selectedKeys={[payoutAccountForm.type]}
              disallowEmptySelection
              onChange={(changeEvent) => changePayoutAccountField("type", changeEvent.target.value)}
            >
              {PAYOUT_ACCOUNT_TYPES.map((payoutAccountType) => (
                <SelectItem key={payoutAccountType}>
                  {payoutAccountsTranslations(`types.${payoutAccountType}`)}
                </SelectItem>
              ))}
            </Select>

            {isBankAccount ? (
              <>
                <Input
                  label={payoutAccountsTranslations("fields.accountHolder")}
                  type="text"
                  placeholder={payoutAccountsTranslations("placeholders.accountHolder")}
                  isRequired
                  value={payoutAccountForm.accountHolder}
                  onChange={(changeEvent) => changePayoutAccountField("accountHolder", changeEvent.target.value)}
                />
                <Input
                  label={payoutAccountsTranslations("fields.bankName")}
                  type="text"
                  placeholder={payoutAccountsTranslations("placeholders.bankName")}
                  isRequired
                  value={payoutAccountForm.bankName}
                  onChange={(changeEvent) => changePayoutAccountField("bankName", changeEvent.target.value)}
                />
                <CurrencyInput
                  currencies={currencyOptions}
                  label={payoutAccountsTranslations("fields.currency")}
                  placeholder={payoutAccountsTranslations("placeholders.currency")}
                  isRequired
                  selectedKey={selectedCurrencyAcronym}
                  onSelectionChange={changeSelectedCurrency}
                />
                <Input
                  label={payoutAccountsTranslations("fields.accountNumber")}
                  type="text"
                  placeholder={payoutAccountsTranslations("placeholders.accountNumber")}
                  description={payoutAccountsTranslations("bankIdentifierHelp")}
                  value={payoutAccountForm.accountNumber}
                  onChange={(changeEvent) => changePayoutAccountField("accountNumber", changeEvent.target.value)}
                />
                {BANK_IDENTIFIER_FIELD_NAMES.map((bankIdentifierFieldName) => (
                  <Input
                    key={bankIdentifierFieldName}
                    label={payoutAccountsTranslations(`fields.${bankIdentifierFieldName}`)}
                    type="text"
                    placeholder={payoutAccountsTranslations(`placeholders.${bankIdentifierFieldName}`)}
                    value={payoutAccountForm[bankIdentifierFieldName]}
                    onChange={(changeEvent) => changePayoutAccountField(bankIdentifierFieldName, changeEvent.target.value)}
                  />
                ))}
              </>
            ) : (
              <Input
                label={payoutAccountsTranslations("fields.lightningAddress")}
                type="text"
                placeholder={payoutAccountsTranslations("placeholders.lightningAddress")}
                description={payoutAccountsTranslations("lightningAddressHelp")}
                value={payoutAccountForm.lightningAddress}
                onChange={(changeEvent) => changePayoutAccountField("lightningAddress", changeEvent.target.value)}
              />
            )}

            <ModalFooter className="flex justify-between p-0 my-4">
              <Button
                variant="bordered"
                type="button"
                className="px-6 py-2 border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onPress={onClose}
              >
                {payoutAccountsTranslations("modal.cancelButton")}
              </Button>
              <Button
                color="primary"
                className="bg-green-800"
                type="submit"
                isLoading={isSaving}
                isDisabled={!isPayoutAccountFormComplete(payoutAccountForm) || isSaving}
              >
                {payoutAccountsTranslations("modal.saveButton")}
              </Button>
            </ModalFooter>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
