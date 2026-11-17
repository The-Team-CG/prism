/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmailConfirmationResult, emailConfirmationTitle, useEmailConfirmation } from "@prism/ui/confirm-email";
import type { PrismEmailChangeConfirmed } from "@prism/types";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function ConfirmPage({ confirm, forget }: { confirm: (token: string) => Promise<PrismEmailChangeConfirmed>; forget: () => void }) {
  const state = useEmailConfirmation(confirm, forget);
  return (
    <>
      <h1>{emailConfirmationTitle(state)}</h1>
      <EmailConfirmationResult state={state} signInHref="/sign-in" />
    </>
  );
}

describe("the confirm-email page", () => {
  it("sends the link's token once, even when React runs effects twice, then clears the old session and offers sign-in", async () => {
    window.history.replaceState(null, "", "/confirm-email?token=one-time-token");
    const confirm = vi.fn(async () => ({ email: "ana@reyes.test" }));
    const forget = vi.fn();
    render(<StrictMode><ConfirmPage confirm={confirm} forget={forget} /></StrictMode>);
    expect(await screen.findByRole("heading", { name: "Email changed" })).toBeTruthy();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith("one-time-token");
    expect(forget).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toMatch(/now ana@reyes\.test/);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("explains a used or broken link, keeps the stored session, and never calls the API without a token", async () => {
    window.history.replaceState(null, "", "/confirm-email?token=used-token");
    const forget = vi.fn();
    render(<ConfirmPage confirm={vi.fn(async () => { throw new Error("This link has expired or was already used."); })} forget={forget} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/expired or was already used/);
    expect(forget).not.toHaveBeenCalled();
    cleanup();

    window.history.replaceState(null, "", "/confirm-email");
    const confirm = vi.fn();
    render(<ConfirmPage confirm={confirm} forget={forget} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/link is incomplete/);
    expect(confirm).not.toHaveBeenCalled();
  });
});
