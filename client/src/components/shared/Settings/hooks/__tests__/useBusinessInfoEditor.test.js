import { act, renderHook } from "@testing-library/react";

import * as useUploadHook from "@components/hooks/useUpload";
import * as configurationsProvider from "@providers/configurations/configurationsProvider";

import { useBusinessInfoEditor } from "../useBusinessInfoEditor";

jest.mock("@heroui/react", () => ({
  addToast: jest.fn(),
}));

const { addToast } = jest.requireMock("@heroui/react");

const mockUpdateConfig = jest.fn();
const mockUpload = jest.fn();
const aliceConfig = { businessName: "Alice Studio", businessLogoUrl: "/assets/alice-logo.png" };
const submitEvent = { preventDefault: jest.fn() };

function renderBusinessInfoEditor() {
  return renderHook(() => useBusinessInfoEditor({ successTitle: "Saved", errorTitle: "Failed" }));
}

describe("useBusinessInfoEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConfig.mockResolvedValue({});
    jest.spyOn(configurationsProvider, "useConfigurations").mockReturnValue({ config: aliceConfig, updateConfig: mockUpdateConfig });
    jest.spyOn(useUploadHook, "useUpload").mockReturnValue({ upload: mockUpload });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the editor with a draft of the current configuration", () => {
    const { result: businessInfoEditor } = renderBusinessInfoEditor();

    act(() => businessInfoEditor.current.openEditor());

    expect(businessInfoEditor.current.isEditorOpen).toBe(true);
    expect(businessInfoEditor.current.draftBusinessInfo).toEqual(aliceConfig);
  });

  it("uploads a new logo and saves its url", async () => {
    mockUpload.mockResolvedValue([{ url: "/assets/bob-logo.png" }]);
    const bobLogo = new File(["logo"], "bob-logo.png", { type: "image/png" });
    const { result: businessInfoEditor } = renderBusinessInfoEditor();

    act(() => businessInfoEditor.current.openEditor());
    act(() => businessInfoEditor.current.handleDraftChange({ businessLogo: bobLogo }));
    await act(() => businessInfoEditor.current.handleSubmit(submitEvent));

    expect(mockUpload).toHaveBeenCalledWith([bobLogo]);
    expect(mockUpdateConfig).toHaveBeenCalledWith(expect.objectContaining({ businessLogoUrl: "/assets/bob-logo.png" }));
    expect(businessInfoEditor.current.isEditorOpen).toBe(false);
    expect(addToast).toHaveBeenCalledWith({ title: "Saved", color: "success" });
  });

  it("saves a null logo url when the logo was removed", async () => {
    const { result: businessInfoEditor } = renderBusinessInfoEditor();

    act(() => businessInfoEditor.current.openEditor());
    act(() => businessInfoEditor.current.handleDraftChange({ businessLogo: null, businessLogoRemoved: true }));
    await act(() => businessInfoEditor.current.handleSubmit(submitEvent));

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateConfig).toHaveBeenCalledWith(expect.objectContaining({ businessLogoUrl: null }));
  });

  it("keeps the editor open and reports the error when saving fails", async () => {
    mockUpdateConfig.mockRejectedValue(new Error("Server down"));
    const { result: businessInfoEditor } = renderBusinessInfoEditor();

    act(() => businessInfoEditor.current.openEditor());
    await act(() => businessInfoEditor.current.handleSubmit(submitEvent));

    expect(businessInfoEditor.current.isEditorOpen).toBe(true);
    expect(addToast).toHaveBeenCalledWith({ title: "Failed", description: "Server down", color: "danger" });
  });
});
