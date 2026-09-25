"use client";

import { useState } from "react";

import { usePathname } from "next/navigation";

import { useLocale, useTranslations } from "next-intl";

import { ShiftWidget } from "@/components/turn/ShiftWidget";
import { useSeedTour } from "@/hooks/tour/useSeedTour";
import { useWalletTour } from "@/hooks/tour/useWalletTour";
import { useSecretsLockSignal } from "@/hooks/useSecretsLockSignal";
import { ADMIN_NOTIFICATIONS_ROUTE } from "@/lib/adminNotifications";
import { BusinessLayout } from "@components/shared/BusinessLayout";
import { SecretsUnlockModal } from "@components/shared/SecretsUnlockModal";
import { useNavigation } from "@hooks/useNavigation";

import { useAdminNotificationSignals } from "./hooks/useAdminNotificationSignals";

const WALLET_ROUTE = "/store/wallet";

export function StoreLayout({ children }) {
  const pathname = usePathname();
  const locale = useLocale();
  const navbarTranslations = useTranslations("navbar");
  const notificationsTranslations = useTranslations("notifications");
  const { isAuth, isAdmin } = useNavigation();
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const { notificationUnreadCount } = useAdminNotificationSignals({
    enabled: isAuth && isAdmin,
    locale,
    pathname,
    notificationsTranslations,
  });
  const { secretsLocked } = useSecretsLockSignal({ enabled: isAuth });

  useSeedTour(isAuth);
  useWalletTour(isAuth);

  return (
    <>
      <BusinessLayout
        navbarTranslations={navbarTranslations}
        badgeCountsByPath={{ [ADMIN_NOTIFICATIONS_ROUTE]: notificationUnreadCount }}
        lockedPaths={secretsLocked ? [WALLET_ROUTE] : []}
        onLockedClick={() => setUnlockModalOpen(true)}
        withTourIds
      >
        {children}
      </BusinessLayout>

      <ShiftWidget />

      {unlockModalOpen && <SecretsUnlockModal onClose={() => setUnlockModalOpen(false)} />}
    </>
  );
}
