"use client";

import { useTranslations } from "next-intl";

import { useBusinessInfoEditor } from "@components/shared/Settings/hooks/useBusinessInfoEditor";

import { EditStoreInfoModal } from "./EditStoreInfoModal";
import { StoreInfoCard } from "./StoreInfoCard";

export function StoreInfo() {
  const t = useTranslations("settings");
  const {
    config,
    draftBusinessInfo,
    setDraftBusinessInfo,
    isEditorOpen,
    setIsEditorOpen,
    openEditor,
    handleDraftChange,
    handleSubmit,
  } = useBusinessInfoEditor({
    successTitle: t("modal.updateSuccess"),
    errorTitle: t("modal.errorTitle"),
  });

  if (!config) return null;

  return (
    <>
      <StoreInfoCard data={config} onEdit={openEditor} />
      <EditStoreInfoModal
        data={draftBusinessInfo}
        setData={setDraftBusinessInfo}
        onChange={handleDraftChange}
        onSubmit={handleSubmit}
        isOpen={isEditorOpen}
        setIsOpen={setIsEditorOpen}
      />
    </>
  );
}
