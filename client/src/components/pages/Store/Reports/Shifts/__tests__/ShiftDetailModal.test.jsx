import { act, render, screen, waitFor } from "@testing-library/react";

import { getShiftBreakdown } from "@/services/shiftsService";

import { ShiftDetailModal } from "../ShiftDetailModal";

jest.mock("@/services/shiftsService", () => ({
  getShiftBreakdown: jest.fn(),
}));

jest.mock("@heroui/react", () => ({
  Modal: ({ children, isOpen }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
  ModalContent: ({ children }) => <div>{children}</div>,
  ModalHeader: ({ children }) => <div data-testid="modal-header">{children}</div>,
  ModalBody: ({ children }) => <div data-testid="modal-body">{children}</div>,
  Spinner: () => <div data-testid="spinner" />,
}));

const SHIFT = {
  id: "shift-1",
  userName: "alice",
  shiftDate: "2024-01-15",
  startTime: "08:00:00",
  endTime: "16:00:00",
};

const BREAKDOWN = {
  shiftId: "shift-1",
  initialAmount: 100,
  finalAmount: 150,
  difference: 20,
  totalSales: 120,
  totalTips: 5,
  cashSales: 80,
  cashRefunds: 10,
  expectedTotal: 170,
  totalTickets: 2,
  byPaymentMethod: [
    { name: "Efectivo", total: 80 },
    { name: "Card", total: 40 },
  ],
};

const formatCurrency = (amount) => `$${amount}`;

describe("ShiftDetailModal", () => {
  beforeEach(() => {
    getShiftBreakdown.mockReset();
  });

  it("does not render when shift is null", () => {
    render(<ShiftDetailModal shift={null} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders the modal and fetches the breakdown when a shift is provided", async () => {
    getShiftBreakdown.mockResolvedValue(BREAKDOWN);
    await act(async () => {
      render(<ShiftDetailModal shift={SHIFT} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    });
    expect(getShiftBreakdown).toHaveBeenCalledWith("shift-1");
    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("shows the shift user name in the header", async () => {
    getShiftBreakdown.mockResolvedValue(BREAKDOWN);
    await act(async () => {
      render(<ShiftDetailModal shift={SHIFT} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    });
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("shows the breakdown amounts once loaded", async () => {
    getShiftBreakdown.mockResolvedValue(BREAKDOWN);
    await act(async () => {
      render(<ShiftDetailModal shift={SHIFT} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    });
    await waitFor(() => expect(screen.getByText("$120")).toBeInTheDocument());
    expect(screen.getAllByText("$80").length).toBeGreaterThan(0);
    expect(screen.getByText("-$10")).toBeInTheDocument();
    expect(screen.getByText("$170")).toBeInTheDocument();
  });

  it("does not show a cash refunds row when there are none", async () => {
    getShiftBreakdown.mockResolvedValue({ ...BREAKDOWN, cashRefunds: 0 });
    await act(async () => {
      render(<ShiftDetailModal shift={SHIFT} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    });
    await waitFor(() => expect(screen.getByText("$120")).toBeInTheDocument());
    expect(screen.queryByText("cashRefunds")).not.toBeInTheDocument();
  });

  it("shows the payment method breakdown once loaded", async () => {
    getShiftBreakdown.mockResolvedValue(BREAKDOWN);
    await act(async () => {
      render(<ShiftDetailModal shift={SHIFT} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    });
    await waitFor(() => expect(screen.getByText("Efectivo")).toBeInTheDocument());
    expect(screen.getByText("Card")).toBeInTheDocument();
  });

  it("shows an error message when the breakdown fails to load", async () => {
    getShiftBreakdown.mockRejectedValue(new Error("network error"));
    await act(async () => {
      render(<ShiftDetailModal shift={SHIFT} formatCurrency={formatCurrency} onClose={jest.fn()} />);
    });
    await waitFor(() => expect(screen.getByText("loadError")).toBeInTheDocument());
  });
});
