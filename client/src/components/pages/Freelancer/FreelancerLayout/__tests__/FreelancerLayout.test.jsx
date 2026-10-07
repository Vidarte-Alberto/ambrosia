import { render, screen, within } from "@testing-library/react";

import { useSeedTour } from "@/hooks/tour/useSeedTour";
import * as useNavigationHook from "@hooks/useNavigation";
import * as configurationsProvider from "@providers/configurations/configurationsProvider";

import { FreelancerLayout } from "../FreelancerLayout";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/freelancer/timesheet"),
}));

jest.mock("@/hooks/tour/useSeedTour", () => ({
  useSeedTour: jest.fn(),
}));

const freelancerNavigation = [
  { path: "/freelancer/timesheet", label: "timesheet", icon: "calendar-clock", showInNavbar: true, showInBottomNav: true, bottomNavOrder: 1 },
  { path: "/freelancer/clients", label: "clients", icon: "contact", showInNavbar: true },
];

describe("FreelancerLayout", () => {
  beforeEach(() => {
    jest.spyOn(useNavigationHook, "useNavigation").mockReturnValue({
      availableNavigation: freelancerNavigation,
      isAuth: true,
      logout: jest.fn(),
    });
    jest.spyOn(configurationsProvider, "useConfigurations").mockReturnValue({
      config: { businessName: "Freelance Studio" },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the freelancer navigation and the page content inside the shared business layout", () => {
    const { container } = render(
      <FreelancerLayout>
        <div>Timesheet Content</div>
      </FreelancerLayout>,
    );
    const sidebar = within(screen.getByTestId("desktop-sidebar"));

    expect(sidebar.getByText("timesheet")).toBeInTheDocument();
    expect(sidebar.getByText("clients")).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveTextContent("Timesheet Content");
  });

  it("starts the seed tour from the timesheet and points it to the freelancer settings", () => {
    render(
      <FreelancerLayout>
        <div>Timesheet Content</div>
      </FreelancerLayout>,
    );

    expect(useSeedTour).toHaveBeenCalledWith({
      isAuth: true,
      homeRoute: "/freelancer/timesheet",
      settingsRoute: "/freelancer/settings",
    });
  });
});
