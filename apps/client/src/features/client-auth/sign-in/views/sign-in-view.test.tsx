/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const useCases = vi.hoisted(() => ({
  requestClientEmailCode: vi.fn(async () => ({ kind: "sent" as const })),
  signInClientWithEmailCode: vi.fn(async () => ({ kind: "signed_in" as const, session: { name: "Ana" }, redirectTo: "/dashboard" })),
  signInClient: vi.fn(async () => ({ kind: "signed_in" as const, session: { name: "Ana" }, redirectTo: "/dashboard" })),
  verifyClientSignInCode: vi.fn(),
  resumeClientCookieSession: vi.fn(async () => null),
  finishFrontDoorSignIn: vi.fn(),
}));
vi.mock("../use-cases/sign-in", () => useCases);

import { SignInView } from "./sign-in-view";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function typeCode(digits: string) {
  const boxes = screen.getAllByRole("textbox").filter((box) => box.getAttribute("inputmode") === "numeric");
  if (boxes.length === 1) fireEvent.change(boxes[0]!, { target: { value: digits } });
  else digits.split("").forEach((digit, index) => fireEvent.change(boxes[index]!, { target: { value: digit } }));
}

describe("client sign-in (sign-in redesign)", () => {
  it("opens on the emailed code: no password, then the six-digit code signs the client in", async () => {
    render(<SignInView />);
    expect(screen.queryByLabelText("Password")).toBeNull();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ana@client.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in code" }));

    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(useCases.requestClientEmailCode).toHaveBeenCalledWith("ana@client.test");
    expect(screen.getByText(/Send a new code in 0:4\d/)).toBeTruthy();

    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(useCases.signInClientWithEmailCode).toHaveBeenCalledWith({ email: "ana@client.test", code: "123456", nextPath: null }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("continues with a session the API's cookie already holds (signed in on the shared page)", async () => {
    useCases.resumeClientCookieSession.mockResolvedValueOnce({ kind: "signed_in", session: { name: "Ana" }, redirectTo: "/dashboard" } as never);
    render(<SignInView />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("the shared \"Sign in to P.R.I.S.M.\" page sends a supplier on to the supplier portal", async () => {
    vi.stubEnv("NEXT_PUBLIC_GUEST_PORTAL_URL", "http://guest.test");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, search: "" });
    useCases.signInClientWithEmailCode.mockResolvedValueOnce({ kind: "signed_in", session: { name: "Sam" }, redirectTo: "http://supplier.test/sign-in" });
    render(<SignInView frontDoor />);
    expect(screen.getByRole("heading", { name: "Sign in to P.R.I.S.M." })).toBeTruthy();
    expect(useCases.resumeClientCookieSession).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@supplier.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in code" }));
    await screen.findByText("Check your email");
    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("http://supplier.test/sign-in"));
    expect(useCases.signInClientWithEmailCode).toHaveBeenCalledWith(expect.objectContaining({ finish: useCases.finishFrontDoorSignIn }));
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("still signs in with a password for clients who prefer it", async () => {
    render(<SignInView />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with password" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ana@client.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(useCases.signInClient).toHaveBeenCalled());
    expect(useCases.requestClientEmailCode).not.toHaveBeenCalled();
  });
});
