import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismGuestEventPass } from "@prism/types";
import type { GuestQrCheckInInput } from "../model/guest-qr-check-in-types";
import { createGuestQrCheckInFlow, GUEST_QR_INVALID_PASS_MESSAGE } from "./guest-qr-check-in-flow";

const event = {
  id: "evt_guest_demo",
  eventName: "Synthetic Demo",
  eventDate: "2026-10-18",
  clientName: "Demo Client",
  readiness: "Registration open",
  floorPlanStatus: "approved",
  guestAccessCode: "DEMO-ACCESS-CODE",
  watermark: "2026-10-17T00:00:00.000Z",
} as PrismGuestEventPass;

function setup(options: { protocol?: string; hash?: string } = {}) {
  const historyCalls: string[] = [];
  const location = {
    protocol: options.protocol ?? "https:",
    pathname: "/qr-check-in",
    search: "?accessCode=DEMO-ACCESS-CODE",
    hash: options.hash ?? "#opaque-token",
  };
  const history = {
    state: { entry: "current" },
    replaceState: vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
      historyCalls.push("clean");
      if (typeof url === "string") location.hash = new URL(url, "https://guest.example").hash;
    }),
  };
  const repository = {
    fetchEventByAccessCode: vi.fn(async (_accessCode: string) => {
      historyCalls.push("preview");
      return event;
    }),
    checkInQr: vi.fn(async (_accessCode: string, _input: GuestQrCheckInInput) => ({ accepted: true as const })),
  };
  const onStateChange = vi.fn();
  const flow = createGuestQrCheckInFlow(repository, onStateChange, () => "11111111-1111-4111-8111-111111111111");
  return { flow, repository, location, history, historyCalls, onStateChange };
}

describe("guest QR check-in flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cleans the fragment before loading only the guest-safe event preview", async () => {
    const { flow, repository, location, history, historyCalls } = setup();

    await flow.initialize(location, history);

    expect(history.replaceState).toHaveBeenCalledWith(history.state, "", "/qr-check-in?accessCode=DEMO-ACCESS-CODE");
    expect(historyCalls).toEqual(["clean", "preview"]);
    expect(location.hash).toBe("");
    expect(repository.fetchEventByAccessCode).toHaveBeenCalledWith("DEMO-ACCESS-CODE");
    expect(flow.getState()).toMatchObject({ status: "ready", event, secure: true, hasPass: true });
  });

  it("requires privacy consent and HTTPS before any check-in submission", async () => {
    const consentFlow = setup();
    await consentFlow.flow.initialize(consentFlow.location, consentFlow.history);
    await consentFlow.flow.submit(false);
    expect(consentFlow.repository.checkInQr).not.toHaveBeenCalled();
    expect(consentFlow.flow.getState().message).toMatch(/consent/i);

    const insecureFlow = setup({ protocol: "http:" });
    await insecureFlow.flow.initialize(insecureFlow.location, insecureFlow.history);
    await insecureFlow.flow.submit(true);
    expect(insecureFlow.repository.checkInQr).not.toHaveBeenCalled();
    expect(insecureFlow.flow.getState()).toMatchObject({ status: "insecure", secure: false, hasPass: true });
  });

  it("allows only one request for a double submit and clears the token on success", async () => {
    const { flow, repository, location, history } = setup();
    await flow.initialize(location, history);
    let resolveRequest!: (value: { accepted: true }) => void;
    repository.checkInQr.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

    const first = flow.submit(true);
    const second = flow.submit(true);
    expect(repository.checkInQr).toHaveBeenCalledTimes(1);
    expect(repository.checkInQr).toHaveBeenCalledWith("DEMO-ACCESS-CODE", expect.objectContaining({
      checkInMode: "qr_pass",
      passToken: "opaque-token",
      privacyConsentAccepted: true,
      marketingConsentAccepted: false,
    }));
    resolveRequest({ accepted: true });
    await Promise.all([first, second]);

    expect(flow.getState()).toMatchObject({ status: "success", hasPass: false });
  });

  it("keeps the token only in memory for a transient retry", async () => {
    const { flow, repository, location, history } = setup();
    await flow.initialize(location, history);
    repository.checkInQr.mockRejectedValueOnce(new TypeError("Connection reset"));
    repository.checkInQr.mockResolvedValueOnce({ accepted: true });

    await flow.submit(true);
    expect(flow.getState()).toMatchObject({ status: "retryable", hasPass: true });
    await flow.submit(true);

    expect(repository.checkInQr).toHaveBeenCalledTimes(2);
    expect(repository.checkInQr.mock.calls[1]?.[1]).toEqual(repository.checkInQr.mock.calls[0]?.[1]);
    expect(flow.getState()).toMatchObject({ status: "success", hasPass: false });
  });

  it("uses a generic invalid-pass message and clears rejected tokens", async () => {
    const { flow, repository, location, history } = setup();
    await flow.initialize(location, history);
    repository.checkInQr.mockRejectedValueOnce(Object.assign(new Error("token-specific failure"), { status: 400 }));

    await flow.submit(true);

    expect(flow.getState()).toMatchObject({ status: "invalid", message: GUEST_QR_INVALID_PASS_MESSAGE, hasPass: false });
    expect(flow.getState().message).not.toContain("opaque-token");
    expect(flow.getState().message).not.toContain("token-specific failure");
  });

  it("clears the in-memory token when the page is disposed", async () => {
    const { flow, repository, location, history } = setup();
    await flow.initialize(location, history);

    flow.dispose();
    await flow.submit(true);

    expect(flow.getState().hasPass).toBe(false);
    expect(repository.checkInQr).not.toHaveBeenCalled();
  });
});
