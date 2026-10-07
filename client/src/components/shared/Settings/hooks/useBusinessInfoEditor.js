"use client";

import { useState } from "react";

import { addToast } from "@heroui/react";

import { useUpload } from "@components/hooks/useUpload";
import { useConfigurations } from "@providers/configurations/configurationsProvider";

export function useBusinessInfoEditor({ successTitle, errorTitle }) {
  const { config, updateConfig } = useConfigurations();
  const { upload } = useUpload();
  const [draftBusinessInfo, setDraftBusinessInfo] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const openEditor = () => {
    setDraftBusinessInfo(config);
    setIsEditorOpen(true);
  };

  const handleDraftChange = (changedFields) => {
    setDraftBusinessInfo((previousDraft) => ({ ...previousDraft, ...changedFields }));
  };

  const resolveLogoUrl = async () => {
    if (draftBusinessInfo.businessLogo instanceof File) {
      const [uploadedLogo] = await upload([draftBusinessInfo.businessLogo]);
      return uploadedLogo?.url ?? uploadedLogo?.path;
    }
    if (draftBusinessInfo.businessLogoRemoved) return null;
    return draftBusinessInfo.businessLogoUrl;
  };

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    try {
      const savedBusinessInfo = {
        ...draftBusinessInfo,
        businessLogoUrl: await resolveLogoUrl(),
        businessLogo: undefined,
        businessLogoRemoved: undefined,
      };

      await updateConfig(savedBusinessInfo);
      setDraftBusinessInfo(savedBusinessInfo);
      setIsEditorOpen(false);
      addToast({
        title: successTitle,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: errorTitle,
        description: error.message,
        color: "danger",
      });
    }
  };

  return {
    config,
    draftBusinessInfo,
    setDraftBusinessInfo,
    isEditorOpen,
    setIsEditorOpen,
    openEditor,
    handleDraftChange,
    handleSubmit,
  };
}
