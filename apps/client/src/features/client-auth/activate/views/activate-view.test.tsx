/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));
const activate = vi.hoisted(() => ({
  previewClientInvitation: vi.fn(),
  confirmClientInvitation: vi.fn(async () => ({ kind: "signed_in" as const, session: { name: "Ana" }, redirectTo: "/privacy?next=%2Fdashboard" })),
  activateClientAccount: vi.fn(),
}));
vi.mock("../use-cases/activate", () => activate);
const signIn = vi.hoisted(() => ({ requestClientEmailCode: vi.fn(async () => ({ kind: "sent" as const })) }));
vi.mock("../../sign-in/use-cases/sign-in", () => signIn);

import { ClientActivateView } from "./activate-view";

const TOKEN = "t".repeat(43);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function openLink() {
  window.history.replaceState(null, "", `/activate?token=${TOKEN}`);
  render(<ClientActivateView />);
}

describe("client first visit from an invitation (sign-in redesign)", () => {
  it("greets the client and opens the portal on confirm, without a password", async () => {
    activate.previewClientInvitation.mockResolvedValue({ name: "Ana Reyes", email: "ana@client.test", organization: "Ayala Corp", role: "client", passwordRequired: false });
    openLink();

    expect(await screen.findByRole("heading", { name: "Welcome, Ana" })).toBeTruthy();
    expect(screen.getByText("Step 1 of 2: Confirm it's you")).toBeTruthy();
    expect(screen.getByText("ana@client.test")).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));
    await waitFor(() => expect(activate.confirmClientInvitation).toHaveBeenCalledWith(TOKEN));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/privacy?next=%2Fdashboard"));
  });

  it("offers a fresh emailed code when the link has expired, instead of asking PMCM", async () => {
    activate.previewClientInvitation.mockResolvedValue(null);
    openLink();

    expect(await screen.findByRole("heading", { name: "This link no longer works" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ana@client.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in code" }));

    await waitFor(() => expect(signIn.requestClientEmailCode).toHaveBeenCalledWith("ana@client.test"));
    expect(push).toHaveBeenCalledWith("/sign-in?code-sent=ana%40client.test");
  });
});
