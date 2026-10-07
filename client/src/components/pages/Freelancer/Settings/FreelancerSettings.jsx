"use client";

import { useTranslations } from "next-intl";

import { usePermission } from "@/hooks/usePermission";
import { SettingsLayout } from "@components/shared/Settings";
import { Currency } from "@components/shared/Settings/Currency";
import { Display } from "@components/shared/Settings/Display";
import { ExportData } from "@components/shared/Settings/ExportData";
import { useSettingsAvailability } from "@components/shared/Settings/hooks/useSettingsAvailability";
import { ImportData } from "@components/shared/Settings/ImportData";
import { InstallPWA } from "@components/shared/Settings/InstallPWA";
import { Language } from "@components/shared/Settings/Language";
import { LightningCard } from "@components/shared/Settings/Lightning/LightningCard";
import { NotificationPreferencesCard } from "@components/shared/Settings/Notifications";
import { NwcConnectionCard } from "@components/shared/Settings/NwcConnection/NwcConnectionCard";
import { PhoenixdRemoteCard } from "@components/shared/Settings/PhoenixdRemote/PhoenixdRemoteCard";
import { SecretsEncryptionCard } from "@components/shared/Settings/SecretsEncryption/SecretsEncryptionCard";
import { SecureConnection } from "@components/shared/Settings/SecureConnection/SecureConnection";
import { Seed } from "@components/shared/Settings/Seed";
import { SystemCard } from "@components/shared/Settings/System/SystemCard";
import { Tutorials } from "@components/shared/Settings/Tutorials";
import { useNavigation } from "@hooks/useNavigation";
import { isElectron } from "@lib/isElectron";

import { FreelancerInfo } from "./FreelancerInfo";
import { PayoutAccounts } from "./PayoutAccounts";

const FREELANCER_HOME_ROUTE = "/freelancer/timesheet";

export function FreelancerSettings() {
  const settingsTranslations = useTranslations("settings");
  const freelancerSettingsTranslations = useTranslations("freelancerSettings");
  const { isAdmin } = useNavigation();
  const canReadPayoutAccounts = usePermission({ allOf: ["payout_accounts_read"] });
  const { secureConnectionAvailable, installPWAAvailable, devicesTabAvailable } = useSettingsAvailability();

  const freelancerSettingsTabs = [
    {
      key: "business",
      label: settingsTranslations("categories.business"),
      content: (
        <>
          <FreelancerInfo />
          <Currency withPriceStep={false} />
        </>
      ),
    },
    {
      key: "preferences",
      label: settingsTranslations("categories.preferences"),
      content: (
        <>
          <Language />
          <Display />
        </>
      ),
    },
    isAdmin && {
      key: "wallet",
      label: settingsTranslations("categories.wallet"),
      content: (
        <>
          <Seed />
          {isElectron && <LightningCard />}
          <NwcConnectionCard />
          <PhoenixdRemoteCard />
          <SecretsEncryptionCard />
        </>
      ),
    },
    canReadPayoutAccounts && {
      key: "payoutAccounts",
      label: freelancerSettingsTranslations("categories.payoutAccounts"),
      content: <PayoutAccounts />,
    },
    isAdmin && {
      key: "backup",
      label: settingsTranslations("categories.backup"),
      content: (
        <>
          <ExportData />
          <ImportData />
        </>
      ),
    },
    devicesTabAvailable && {
      key: "devices",
      label: settingsTranslations("categories.devices"),
      content: (
        <>
          {secureConnectionAvailable && <SecureConnection />}
          {installPWAAvailable && <InstallPWA />}
        </>
      ),
    },
    isAdmin && {
      key: "system",
      label: settingsTranslations("categories.system"),
      content: (
        <>
          <SystemCard />
          <NotificationPreferencesCard />
        </>
      ),
    },
    isAdmin && {
      key: "help",
      label: settingsTranslations("categories.help"),
      content: <Tutorials homeRoute={FREELANCER_HOME_ROUTE} tours={["seed"]} />,
    },
  ].filter(Boolean);

  return <SettingsLayout subtitle={freelancerSettingsTranslations("subtitle")} settingsTabs={freelancerSettingsTabs} />;
}
