"use client";

import { useTranslations } from "next-intl";

import { useBusinessInfoEditor } from "@components/shared/Settings/hooks/useBusinessInfoEditor";

import { EditFreelancerInfoModal } from "./EditFreelancerInfoModal";
import { FreelancerInfoCard } from "./FreelancerInfoCard";

export function FreelancerInfo() {
  const freelancerSettingsTranslations = useTranslations("freelancerSettings");
  const {
    config,
    draftBusinessInfo,
    isEditorOpen,
    setIsEditorOpen,
    openEditor,
    handleDraftChange,
    handleSubmit,
  } = useBusinessInfoEditor({
    successTitle: freelancerSettingsTranslations("infoModal.updateSuccess"),
    errorTitle: freelancerSettingsTranslations("infoModal.errorTitle"),
  });

  if (!config) return null;

  return (
    <>
      <FreelancerInfoCard businessInfo={config} onEdit={openEditor} />
      <EditFreelancerInfoModal
        draftBusinessInfo={draftBusinessInfo}
        onDraftChange={handleDraftChange}
        onSubmit={handleSubmit}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
    </>
  );
}
