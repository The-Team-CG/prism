/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beginEventTwoFactorSetup, getDevelopmentEventTwoFactorQr, resumeEventCookieSession, signInToEventPortal, verifyEventTwoFactor } from "../use-cases/event-sign-in";
import { EventSignInView } from "./event-sign-in-view";

const router = vi.hoisted(() => ({ replace: (() => undefined) as (path: string) => void }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../use-cases/event-sign-in", () => ({
  beginEventTwoFactorSetup: vi.fn(),
  getDevelopmentEventTwoFactorQr: vi.fn(),
  resumeEventCookieSession: vi.fn(),
  signInToEventPortal: vi.fn(),
  verifyEventTwoFactor: vi.fn(),
}));

beforeEach(() => {
  router.replace = vi.fn();
  vi.mocked(resumeEventCookieSession).mockResolvedValue(null);
  vi.mocked(signInToEventPortal).mockResolvedValue({ kind: "two_factor", token: "challenge-fixture", setupRequired: false });
  vi.mocked(getDevelopmentEventTwoFactorQr).mockResolvedValue({ otpauthUri: "otpauth://totp/test" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

async function passwordSignIn() {
  render(<EventSignInView />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "pmcm@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-fixture" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByLabelText("Authenticator code");
}

describe("arriving from the shared sign-in page (sign-in redesign)", () => {
  it("continues with the session the API's cookie already holds, without asking to sign in again", async () => {
    vi.mocked(resumeEventCookieSession).mockResolvedValue({ redirectTo: "/dashboard" });
    render(<EventSignInView />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("authenticator QR rescan", () => {
  it("fetches the QR only when requested in development, and lets it be hidden again", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await passwordSignIn();
    expect(getDevelopmentEventTwoFactorQr).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show authenticator QR" }));
    await screen.findByRole("img", { name: "QR code for your authenticator app" });
    expect(getDevelopmentEventTwoFactorQr).toHaveBeenCalledWith("challenge-fixture");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Verify code" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Hide authenticator QR" }));
    expect(screen.queryByRole("img", { name: "QR code for your authenticator app" })).toBeNull();
  });

  it.each(["production", "test", undefined])("omits rescan controls and requests under NODE_ENV=%s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    await passwordSignIn();
    expect(screen.queryByRole("button", { name: "Show authenticator QR" })).toBeNull();
    expect(screen.queryByRole("img", { name: "QR code for your authenticator app" })).toBeNull();
    expect(getDevelopmentEventTwoFactorQr).not.toHaveBeenCalled();
  });

  it("keeps ordinary first-time QR enrollment available in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(signInToEventPortal).mockResolvedValue({ kind: "two_factor", token: "setup-fixture", setupRequired: true });
    vi.mocked(beginEventTwoFactorSetup).mockResolvedValue({ kind: "two_factor_setup", token: "setup-fixture", secret: "fixture-secret", otpauthUri: "otpauth://totp/test" });
    await passwordSignIn();
    expect(screen.getByRole("img", { name: "QR code for your authenticator app" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show authenticator QR" })).toBeNull();
    expect(getDevelopmentEventTwoFactorQr).not.toHaveBeenCalled();
  });

  it("shows a failed rescan inline while keeping code verification available", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(getDevelopmentEventTwoFactorQr).mockRejectedValue(new Error("QR unavailable"));
    await passwordSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Show authenticator QR" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("QR unavailable"));
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "012345" } });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Verify code" }).disabled).toBe(false);
  });
});

describe("authenticator recovery (sign-in redesign)", () => {
  it("trusts this browser for 30 days when asked, and accepts a backup code for a lost phone", async () => {
    vi.mocked(verifyEventTwoFactor).mockResolvedValue({ kind: "redirect", redirectTo: "/dashboard", backupCodes: null });
    await passwordSignIn();

    fireEvent.click(screen.getByRole("checkbox", { name: "Trust this device for 30 days" }));
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await waitFor(() => expect(verifyEventTwoFactor).toHaveBeenCalledWith(expect.objectContaining({ code: "012345", trustDevice: true, email: "pmcm@example.test" })));

    fireEvent.click(screen.getByRole("button", { name: "Use a backup code" }));
    const backup = screen.getByLabelText("Backup code");
    fireEvent.change(backup, { target: { value: "k7p2-9xqm" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await waitFor(() => expect(verifyEventTwoFactor).toHaveBeenLastCalledWith(expect.objectContaining({ code: "k7p2-9xqm" })));
  });

  it("shows the backup codes once after a new authenticator, before going on", async () => {
    vi.mocked(signInToEventPortal).mockResolvedValue({ kind: "two_factor", token: "setup-fixture", setupRequired: true });
    vi.mocked(beginEventTwoFactorSetup).mockResolvedValue({ kind: "two_factor_setup", token: "setup-fixture", secret: "fixture-secret", otpauthUri: "otpauth://totp/test" });
    vi.mocked(verifyEventTwoFactor).mockResolvedValue({ kind: "redirect", redirectTo: "/dashboard", backupCodes: ["k7p2-9xqm", "a2b3-c4d5"] });
    await passwordSignIn();
    // Setting the authenticator up has no trust or backup-code options yet.
    expect(screen.queryByRole("checkbox", { name: "Trust this device for 30 days" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    const list = await screen.findByRole("list", { name: "Backup codes" });
    expect(list.textContent).toContain("k7p2-9xqm");
    expect(screen.getByRole("button", { name: "I saved them, continue" })).toBeTruthy();
  });
});
