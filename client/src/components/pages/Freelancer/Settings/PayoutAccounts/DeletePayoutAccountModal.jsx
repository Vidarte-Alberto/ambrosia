"use client";

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useTranslations } from "next-intl";

export function DeletePayoutAccountModal({ isOpen, onClose, onConfirm }) {
  const payoutAccountsTranslations = useTranslations("freelancerSettings.payoutAccounts");
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => !nextIsOpen && onClose()}
      backdrop="blur"
      classNames={{
        backdrop: "backdrop-blur-xs bg-white/10",
      }}
      placement="center"
    >
      <ModalContent>
        <ModalHeader>{payoutAccountsTranslations("deleteModal.title")}</ModalHeader>
        <ModalBody>
          <p>{payoutAccountsTranslations("deleteModal.description")}</p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="bordered"
            type="button"
            className="px-6 py-2 border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onPress={onClose}
          >
            {payoutAccountsTranslations("deleteModal.cancelButton")}
          </Button>
          <Button color="danger" onPress={onConfirm}>
            {payoutAccountsTranslations("deleteModal.deleteButton")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
