/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://ambrosia-test.local/store/settings"}
 */
import { render, screen, waitFor } from "@testing-library/react";

import { SecureConnection } from "../SecureConnection";

jest.mock("react-qr-code", () => ({
  __esModule: true,
  default: ({ value, "aria-label": label }) => <div data-testid="trust-qr" data-value={value} aria-label={label} />,
}));

const metadata = {
  schemaVersion: 1,
  hostname: "ambrosia-test.local",
  displayName: "Ambrosia test",
  subject: "CN=Ambrosia test Root CA",
  sha256: Array(32).fill("AB").join(":"),
  notBefore: "2026-01-01T00:00:00+00:00",
  notAfter: "2030-01-01T00:00:00+00:00",
  trustUrl: "http://untrusted.example/trust/",
};

beforeEach(() => {
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => metadata });
});

afterEach(() => jest.restoreAllMocks());

it("uses same-origin HTTPS metadata and derives the enrollment QR from this unit", async () => {
  render(<SecureConnection />);
  expect(await screen.findByText("httpsSession")).toBeInTheDocument();
  expect(screen.getByText(metadata.sha256)).toBeInTheDocument();
  expect(screen.getByTestId("trust-qr")).toHaveAttribute("data-value", "http://ambrosia-test.local/trust/");
  expect(fetch).toHaveBeenCalledWith("/trust/metadata.json", expect.objectContaining({ cache: "no-store", credentials: "omit" }));
  expect(screen.getByRole("link", { name: "instructions" })).toHaveAttribute("href", "/trust/");
});

it("does not show a card when this deployment does not provide trust metadata", async () => {
  fetch.mockResolvedValue({ ok: false, status: 404 });
  const { container } = render(<SecureConnection />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it.each([
  { ...metadata, hostname: "another-unit.local" },
  { ...metadata, sha256: "invalid" },
  { ...metadata, notAfter: "invalid" },
  { ...metadata, schemaVersion: 99 },
  { ...metadata, displayName: " " },
  { ...metadata, notBefore: ["2026-01-01"] },
  { ...metadata, notBefore: metadata.notAfter, notAfter: metadata.notBefore },
])("does not advertise invalid or foreign-unit metadata", async (invalid) => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => invalid });
  render(<SecureConnection />);
  expect(await screen.findByRole("status")).toHaveTextContent("unavailable");
  expect(screen.queryByTestId("trust-qr")).not.toBeInTheDocument();
});

it("shows an unavailable state on network failure", async () => {
  fetch.mockRejectedValue(new Error("offline"));
  render(<SecureConnection />);
  expect(await screen.findByRole("status")).toHaveTextContent("unavailable");
});

it("cancels the pending request on unmount", () => {
  fetch.mockImplementation(() => new Promise(() => {}));
  const { unmount } = render(<SecureConnection />);
  const options = fetch.mock.calls[0][1];
  unmount();
  expect(options.signal.aborted).toBe(true);
});
