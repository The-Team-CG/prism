/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
