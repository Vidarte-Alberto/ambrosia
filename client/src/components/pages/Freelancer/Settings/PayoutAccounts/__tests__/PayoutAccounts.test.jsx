import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { usePayoutAccounts } from "../../../hooks/usePayoutAccounts";
import { PayoutAccounts } from "../PayoutAccounts";

jest.mock("@/hooks/usePermission");

jest.mock("../../../hooks/usePayoutAccounts", () => ({
  usePayoutAccounts: jest.fn(),
}));

jest.mock("@heroui/react", () => ({
  ...jest.requireActual("@heroui/react"),
  addToast: jest.fn(),
}));

jest.mock("../PayoutAccountModal", () => ({
  PayoutAccountModal: ({ isOpen, payoutAccount, onSave, onClose }) => (isOpen ? (
    <div>
      <span>{payoutAccount ? `editing ${payoutAccount.id}` : "creating"}</span>
      <button type="button" onClick={() => onSave({ id: payoutAccount?.id ?? null, type: "lightning" })}>save payout account</button>
      <button type="button" onClick={onClose}>close payout account</button>
    </div>
  ) : null),
}));

const { addToast } = jest.requireMock("@heroui/react");

const aliceBankAccount = { id: "alice-bank-account", type: "bank", accountHolder: "Alice", bankName: "BBVA", clabe: "012180001234567890" };
const mockSavePayoutAccount = jest.fn();
const mockDeletePayoutAccount = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  usePayoutAccounts.mockReturnValue({
    payoutAccounts: [aliceBankAccount],
    currencies: [],
    loading: false,
    error: null,
    savePayoutAccount: mockSavePayoutAccount,
    deletePayoutAccount: mockDeletePayoutAccount,
  });
});

describe("PayoutAccounts", () => {
  it("opens the modal empty to create a payout account and confirms the save", async () => {
    const user = userEvent.setup();
    mockSavePayoutAccount.mockResolvedValue(undefined);
    render(<PayoutAccounts />);

    await user.click(screen.getByText("addButton"));
    expect(screen.getByText("creating")).toBeInTheDocument();
    await user.click(screen.getByText("save payout account"));

    await waitFor(() => expect(screen.queryByText("creating")).not.toBeInTheDocument());
    expect(mockSavePayoutAccount).toHaveBeenCalledWith({ id: null, type: "lightning" });
    expect(addToast).toHaveBeenCalledWith({ title: "toasts.saveSuccess", color: "success" });
  });

  it("opens the modal with the selected payout account to edit it", async () => {
    render(<PayoutAccounts />);

    await userEvent.click(screen.getByLabelText("edit"));

    expect(screen.getByText("editing alice-bank-account")).toBeInTheDocument();
  });

  it("keeps the modal open without a success toast when saving fails", async () => {
    const user = userEvent.setup();
    mockSavePayoutAccount.mockRejectedValue(new Error("Invalid payout account data"));
    render(<PayoutAccounts />);

    await user.click(screen.getByText("addButton"));
    await user.click(screen.getByText("save payout account"));

    await waitFor(() => expect(mockSavePayoutAccount).toHaveBeenCalled());
    expect(screen.getByText("creating")).toBeInTheDocument();
    expect(addToast).not.toHaveBeenCalled();
  });

  it("deletes the payout account after confirming", async () => {
    const user = userEvent.setup();
    mockDeletePayoutAccount.mockResolvedValue(undefined);
    render(<PayoutAccounts />);

    await user.click(screen.getByLabelText("delete"));
    await user.click(await screen.findByText("deleteModal.deleteButton"));

    await waitFor(() => expect(mockDeletePayoutAccount).toHaveBeenCalledWith("alice-bank-account"));
    expect(addToast).toHaveBeenCalledWith({ title: "toasts.deleteSuccess", color: "success" });
  });

  it("closes the delete confirmation without a success toast when deleting fails", async () => {
    const user = userEvent.setup();
    mockDeletePayoutAccount.mockRejectedValue(new Error("Payout account not found"));
    render(<PayoutAccounts />);

    await user.click(screen.getByLabelText("delete"));
    await user.click(await screen.findByText("deleteModal.deleteButton"));

    await waitFor(() => expect(screen.queryByText("deleteModal.deleteButton")).not.toBeInTheDocument());
    expect(addToast).not.toHaveBeenCalled();
  });

  it("shows the load error from the hook", () => {
    usePayoutAccounts.mockReturnValue({
      payoutAccounts: [],
      currencies: [],
      loading: false,
      error: new Error("Network down"),
      savePayoutAccount: mockSavePayoutAccount,
      deletePayoutAccount: mockDeletePayoutAccount,
    });
    render(<PayoutAccounts />);

    expect(screen.getByText("loadError")).toBeInTheDocument();
  });
});
