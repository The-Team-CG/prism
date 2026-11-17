/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccountScreen, failedSinceLastVisit } from "@prism/ui/account-page";
import { devicesValue } from "@prism/ui/account-sessions";
import { signInCodeProblem } from "@prism/ui/sign-in-code-step";

afterEach(cleanup);

const identity = { name: "Ana Reyes", email: "ana@ayala.test", organization: "Ayala Corp", roleLabel: "Client" };
const security = { signedInAt: "2026-11-18T01:14:00.000Z", twoFactorEnabled: false, twoFactorRequired: false };
const base = { identity, security, loading: false, error: null, notifications: <p>Email and Viber switches</p>, privacy: null, contact: null, links: [] };
const signIn = (id: string, succeeded: boolean, at: string) => ({ id, succeeded, at, device: succeeded ? "Chrome on Windows" : "Unknown device" });

const dialog = () => within(screen.getByRole("dialog"));
const group = (name: string) => within(screen.getByRole("region", { name }));

describe("AccountScreen at first glance", () => {
  it("shows each setting as a row with its value now, and no form, list or switch until a row is opened", () => {
    render(
      <AccountScreen {...base}
        actions={{ saveName: vi.fn(), changePassword: vi.fn() }}
        signIns={[signIn("s1", true, "2026-11-18T01:14:00.000Z")]}
        privacy={{ openCount: 2, nextDueAt: "2026-11-21T02:00:00.000Z", notice: { version: null, acknowledgedAt: null }, href: "/dashboard/privacy" }}
        contact={{ name: "Marco Santos", detail: "Coordinates Tech Summit", href: "/dashboard/messages" }}
      />,
    );
    expect(screen.getByText("ana@ayala.test · Ayala Corp · Client")).toBeTruthy();
    expect(group("Sign-in and security").getByRole("button", { name: /^Recent sign-ins: Chrome on Windows/ })).toBeTruthy();
    expect(group("Sign-in and security").getByText("Off")).toBeTruthy();
    expect(group("Help and privacy").getByRole("link", { name: "Privacy: 2 open requests · next due Nov 21, 2026" }).getAttribute("href")).toBe("/dashboard/privacy");
    expect(group("Help and privacy").getByRole("link", { name: "Message" }).getAttribute("href")).toBe("/dashboard/messages");
    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(screen.queryByText("Email and Viber switches")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says two-step sign-in is required for PMCM staff, and lists the role's own places as rows", () => {
    render(<AccountScreen {...base} security={{ ...security, twoFactorEnabled: true, twoFactorRequired: true }}
      links={[{ title: "Workspace settings", description: "Compliance rules and templates", href: "/dashboard/settings" }]} />);
    expect(screen.getByText("On, required for PMCM staff")).toBeTruthy();
    expect(group("Help and privacy").getByRole("link", { name: /^Workspace settings:/ }).getAttribute("href")).toBe("/dashboard/settings");
  });

  it("warns about failed sign-ins since the last visit, and Review opens the list with a way to change the password", () => {
    render(<AccountScreen {...base} actions={{ changePassword: vi.fn() }} signIns={[
      signIn("now", true, "2026-11-18T02:17:00.000Z"),
      signIn("bad", false, "2026-11-18T02:10:00.000Z"),
      signIn("prev", true, "2026-11-17T09:00:00.000Z"),
      signIn("old-bad", false, "2026-11-10T09:00:00.000Z"),
    ]} />);
    expect(screen.getByRole("alert").textContent).toContain("1 failed sign-in since your last visit");
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Review" }));
    expect(dialog().getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(dialog().getByRole("button", { name: "Change password" }));
    expect(dialog().getByLabelText("Current password")).toBeTruthy();
  });
});

describe("failedSinceLastVisit", () => {
  it("counts failures after the sign-in before this one, including any after this one", () => {
    expect(failedSinceLastVisit([
      signIn("bad-now", false, "3"), signIn("now", true, "2"), signIn("bad", false, "1"), signIn("prev", true, "0"), signIn("old", false, "-1"),
    ]).map((entry) => entry.id)).toEqual(["bad-now", "bad"]);
    expect(failedSinceLastVisit([signIn("now", true, "2"), signIn("prev", true, "1")])).toEqual([]);
  });
});

describe("AccountScreen panels", () => {
  it("edits the name in a panel, keeping the API's reason when refused, then closes and confirms", async () => {
    const saveName = vi.fn().mockResolvedValueOnce("Name is too long").mockResolvedValueOnce(null);
    render(<AccountScreen {...base} actions={{ saveName }} />);
    fireEvent.click(screen.getByRole("button", { name: "Name: Ana Reyes" }));
    expect((dialog().getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(dialog().getByLabelText("Your name"), { target: { value: "Ana R. Reyes" } });
    fireEvent.click(dialog().getByRole("button", { name: "Save" }));
    expect((await dialog().findByRole("alert")).textContent).toBe("Name is too long");
    fireEvent.click(dialog().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(saveName).toHaveBeenLastCalledWith({ name: "Ana R. Reyes" });
    expect(screen.getByRole("status").textContent).toMatch(/^Name saved/);
  });

  it("changes the password in a panel only once both new entries match, naming what it does", async () => {
    const changePassword = vi.fn(async () => "That password is not right.");
    render(<AccountScreen {...base} actions={{ changePassword }} />);
    fireEvent.click(screen.getByRole("button", { name: /^Password:/ }));
    expect(dialog().getByText(/This signs you out everywhere/)).toBeTruthy();
    const submit = () => dialog().getByRole("button", { name: "Change and sign out" }) as HTMLButtonElement;
    fireEvent.change(dialog().getByLabelText("Current password"), { target: { value: "old-password-123" } });
    fireEvent.change(dialog().getByLabelText("New password"), { target: { value: "brand-new-password-1" } });
    fireEvent.change(dialog().getByLabelText("New password again"), { target: { value: "brand-new-password-2" } });
    expect(submit().disabled).toBe(true);
    fireEvent.change(dialog().getByLabelText("New password again"), { target: { value: "brand-new-password-1" } });
    fireEvent.click(submit());
    expect((await dialog().findByRole("alert")).textContent).toBe("That password is not right.");
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "old-password-123", newPassword: "brand-new-password-1" });
  });

  it("lists where they are signed in and signs out one other device, or every other one, but never this one", async () => {
    const session = (id: string, device: string, current = false) => ({ id, device, current, signedInAt: "2026-11-17T01:00:00.000Z", lastActiveAt: "2026-11-18T01:00:00.000Z" });
    const signOutSession = vi.fn().mockResolvedValueOnce("That device is already signed out.").mockResolvedValueOnce(null);
    const signOutOtherSessions = vi.fn(async () => null);
    render(<AccountScreen {...base} actions={{ signOutSession, signOutOtherSessions }}
      sessions={[session("here", "Chrome on Windows", true), session("phone", "Safari on iOS"), session("tablet", "Firefox on Android")]} />);
    fireEvent.click(group("Sign-in and security").getByRole("button", { name: "Devices: This device and 2 others" }));
    expect(dialog().queryByRole("button", { name: "Sign out Chrome on Windows" })).toBeNull();
    fireEvent.click(dialog().getByRole("button", { name: "Sign out Safari on iOS" }));
    expect((await dialog().findByRole("alert")).textContent).toBe("That device is already signed out.");
    expect(signOutSession).toHaveBeenCalledWith("phone");
    fireEvent.click(dialog().getByRole("button", { name: "Sign out everywhere else" }));
    await waitFor(() => expect(signOutOtherSessions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(dialog().queryByRole("alert")).toBeNull());
  });

  it("says how many devices without claiming this one when this sign-in predates device tracking", () => {
    const session = (id: string, current: boolean) => ({ id, device: "Chrome on Windows", current, signedInAt: "2026-11-17T01:00:00.000Z", lastActiveAt: "2026-11-18T01:00:00.000Z" });
    expect(devicesValue([session("a", true)])).toBe("This device only");
    expect(devicesValue([session("a", true), session("b", false)])).toBe("This device and 1 other");
    expect(devicesValue([session("a", false), session("b", false)])).toBe("2 devices");
  });

  it("turns two-step sign-in on only after the password and a working code from the app just added", async () => {
    const start = vi.fn()
      .mockResolvedValueOnce({ error: "That password is not right." })
      .mockResolvedValueOnce({ setup: { secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/PRISM:ana@ayala.test?secret=JBSWY3DPEHPK3PXP" } });
    const enable = vi.fn().mockResolvedValueOnce("That code is not right. Enter the newest code your app shows.").mockResolvedValueOnce(null);
    render(<AccountScreen {...base} actions={{ twoStep: { start, enable, disable: vi.fn() } }} />);
    fireEvent.click(group("Sign-in and security").getByRole("button", { name: "Two-step sign-in: Off" }));
    const continueButton = () => dialog().getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton().disabled).toBe(true);
    fireEvent.change(dialog().getByLabelText("Your password"), { target: { value: "wrong-password" } });
    fireEvent.click(continueButton());
    expect((await dialog().findByRole("alert")).textContent).toBe("That password is not right.");
    fireEvent.change(dialog().getByLabelText("Your password"), { target: { value: "right-password" } });
    fireEvent.click(continueButton());
    expect(await dialog().findByRole("img", { name: "QR code for your authenticator app" })).toBeTruthy();
    expect(dialog().getByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
    expect(start).toHaveBeenLastCalledWith("right-password");
    const turnOn = () => dialog().getByRole("button", { name: "Turn on" }) as HTMLButtonElement;
    fireEvent.change(dialog().getByLabelText("Authenticator code", { selector: "input" }), { target: { value: "12345" } });
    expect(turnOn().disabled).toBe(true);
    fireEvent.change(dialog().getByLabelText("Authenticator code", { selector: "input" }), { target: { value: "123456" } });
    fireEvent.click(turnOn());
    expect((await dialog().findByRole("alert")).textContent).toMatch(/code is not right/);
    fireEvent.click(turnOn());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(enable).toHaveBeenLastCalledWith("123456");
    expect(screen.getByRole("status").textContent).toMatch(/^Two-step sign-in is on/);
  });

  it("turns two-step sign-in off with the password, but PMCM staff only read why it stays on", async () => {
    const disable = vi.fn(async () => null);
    const twoStep = { start: vi.fn(), enable: vi.fn(), disable };
    const { unmount } = render(<AccountScreen {...base} security={{ ...security, twoFactorEnabled: true }} actions={{ twoStep }} />);
    fireEvent.click(screen.getByRole("button", { name: "Two-step sign-in: On" }));
    fireEvent.change(dialog().getByLabelText("Your password"), { target: { value: "right-password" } });
    fireEvent.click(dialog().getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(disable).toHaveBeenCalledWith("right-password"));
    expect((await screen.findByRole("status")).textContent).toMatch(/^Two-step sign-in is off/);
    unmount();

    render(<AccountScreen {...base} security={{ ...security, twoFactorEnabled: true, twoFactorRequired: true }} actions={{ twoStep }} />);
    fireEvent.click(screen.getByRole("button", { name: "Two-step sign-in: On, required for PMCM staff" }));
    expect(dialog().getByText(/PMCM staff always sign in with a code/)).toBeTruthy();
    expect(dialog().queryByRole("button", { name: "Turn off" })).toBeNull();
  });

  it("tells someone at the sign-in code step whether to retry the code or start over", () => {
    expect(signInCodeProblem("Invalid two-factor code")).toEqual({ text: "That code is not right. Enter the newest code from your app.", restart: false });
    expect(signInCodeProblem("Invalid, expired, or already-used two-factor token")).toMatchObject({ restart: true });
    expect(signInCodeProblem("This account is currently locked")).toEqual({ text: "This account is currently locked", restart: false });
  });

  it("opens the notification channels from their row", () => {
    render(<AccountScreen {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /^Channels:/ }));
    expect(dialog().getByText("Email and Viber switches")).toBeTruthy();
  });
});
