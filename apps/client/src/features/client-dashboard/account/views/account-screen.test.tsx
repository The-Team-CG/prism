/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccountScreen } from "@prism/ui/account-page";

afterEach(cleanup);

const identity = { name: "Ana Reyes", email: "ana@ayala.test", organization: "Ayala Corp", roleLabel: "Client" };

describe("AccountScreen", () => {
  it("heads with who is signed in and shows how they sign in, their PMCM contact, privacy and notifications", () => {
    render(
      <AccountScreen
        identity={identity}
        loading={false}
        error={null}
        security={{ signedInAt: "2026-11-18T01:14:00.000Z", twoFactorEnabled: false, twoFactorRequired: false }}
        notifications={<section aria-label="Notification channels">channels</section>}
        privacy={{ openCount: 2, nextDueAt: "2026-11-21T02:00:00.000Z", notice: { version: "2026-10-25", acknowledgedAt: "2026-10-27T02:00:00.000Z" }, href: "/dashboard/privacy" }}
        contact={{ name: "Marco Santos", detail: "Coordinates Tech Summit", href: "/dashboard/messages" }}
        links={[]}
        today="2026-11-18"
      />,
    );
    expect(screen.getByText("Ana Reyes")).toBeTruthy();
    expect(screen.getByText("ana@ayala.test · Ayala Corp · Client")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Sign-in and security" })).getByText("Off")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Your PMCM contact" })).getByRole("link", { name: "Message" }).getAttribute("href")).toBe("/dashboard/messages");
    const privacy = within(screen.getByRole("region", { name: "Privacy" }));
    expect(privacy.getByText("2 open requests")).toBeTruthy();
    expect(privacy.getByText(/Due Nov 21, 2026 · in 3 days/).className).toContain("text-attention");
    expect(privacy.getByText(/You accepted the privacy notice of Oct 25, 2026 on Oct 27, 2026/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Notification channels" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "More for your role" })).toBeNull();
  });

  it("says two-step sign-in is required for PMCM staff, and lists their role's own places", () => {
    render(
      <AccountScreen
        identity={{ ...identity, roleLabel: "PMCM administrator" }}
        loading={false}
        error={null}
        security={{ signedInAt: null, twoFactorEnabled: true, twoFactorRequired: true }}
        notifications={null}
        privacy={null}
        contact={null}
        links={[{ title: "Workspace settings", description: "Compliance rules and templates", href: "/dashboard/settings" }]}
        today="2026-11-18"
      />,
    );
    expect(screen.getByText("On (required for PMCM staff)")).toBeTruthy();
    expect(screen.getByText("Not recorded")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Privacy" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "More for your role" })).getByRole("link", { name: /Workspace settings/ }).getAttribute("href")).toBe("/dashboard/settings");
  });
});

describe("AccountScreen changes", () => {
  const base = {
    identity: { name: "Ana Reyes", email: "ana@ayala.test", organization: "Ayala Corp", roleLabel: "Client" },
    loading: false, error: null, notifications: null, privacy: null, contact: null, links: [], today: "2026-11-18",
    security: { signedInAt: null, twoFactorEnabled: false, twoFactorRequired: false },
  };

  it("edits the name in place and closes once saved, keeping the API's reason when it is refused", async () => {
    const saveName = vi.fn().mockResolvedValueOnce("Name is too long").mockResolvedValueOnce(null);
    render(<AccountScreen {...base} actions={{ saveName }} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit name" }));
    const field = screen.getByLabelText("Your name");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: "Ana R. Reyes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Name is too long");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByLabelText("Your name")).toBeNull());
    expect(saveName).toHaveBeenLastCalledWith({ name: "Ana R. Reyes" });
  });

  it("changes the password only once both new entries match and differ from the current one", async () => {
    const changePassword = vi.fn(async () => "That password is not right.");
    render(<AccountScreen {...base} actions={{ changePassword }} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const submit = () => screen.getByRole("button", { name: "Change password" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-password-123" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brand-new-password-1" } });
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "brand-new-password-2" } });
    expect(screen.getByText("The two new passwords do not match.")).toBeTruthy();
    expect(submit().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "brand-new-password-1" } });
    fireEvent.click(submit());
    expect((await screen.findByRole("alert")).textContent).toBe("That password is not right.");
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "old-password-123", newPassword: "brand-new-password-1" });
  });

  it("lists recent sign-ins, marking the ones that failed", () => {
    render(<AccountScreen {...base} signIns={[
      { id: "s2", at: "2026-11-18T01:00:00.000Z", succeeded: true, device: "Chrome on Windows" },
      { id: "s1", at: "2026-11-17T01:00:00.000Z", succeeded: false, device: "Unknown device" },
    ]} />);
    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("Chrome on Windows");
    expect(items[1]).toContain("Failed · ");
  });
});
