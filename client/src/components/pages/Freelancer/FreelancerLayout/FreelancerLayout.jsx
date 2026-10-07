"use client";

import { useTranslations } from "next-intl";

import { useSeedTour } from "@/hooks/tour/useSeedTour";
import { BusinessLayout } from "@components/shared/BusinessLayout";
import { useNavigation } from "@hooks/useNavigation";

const FREELANCER_HOME_ROUTE = "/freelancer/timesheet";
const FREELANCER_SETTINGS_ROUTE = "/freelancer/settings";

export function FreelancerLayout({ children }) {
  const navbarTranslations = useTranslations("freelancerNavbar");
  const { isAuth } = useNavigation();

  useSeedTour({ isAuth, homeRoute: FREELANCER_HOME_ROUTE, settingsRoute: FREELANCER_SETTINGS_ROUTE });

  return (
    <BusinessLayout navbarTranslations={navbarTranslations} withTourIds>
      {children}
    </BusinessLayout>
  );
}
