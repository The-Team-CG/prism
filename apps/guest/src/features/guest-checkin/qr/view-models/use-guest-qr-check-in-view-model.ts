"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { guestDashboardRepository } from "../../dashboard/data/guest-dashboard-repository";
import { createGuestQrCheckInFlow } from "../use-cases/guest-qr-check-in-flow";
import type { GuestQrCheckInState } from "../model/guest-qr-check-in-types";

const initialState: GuestQrCheckInState = {
  status: "loading",
  event: null,
  secure: false,
  hasPass: false,
  message: null,
};

export function useGuestQrCheckInViewModel() {
  const flowRef = useRef<ReturnType<typeof createGuestQrCheckInFlow> | null>(null);
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState(initialState);
  const [consentAccepted, setConsentAccepted] = useState(false);

  if (!flowRef.current) {
    flowRef.current = createGuestQrCheckInFlow(guestDashboardRepository, setState);
  }
  const flow = flowRef.current;

  useEffect(() => {
    if (disposeTimer.current !== null) {
      clearTimeout(disposeTimer.current);
      disposeTimer.current = null;
    }
    void flow.initialize(window.location, window.history);
    return () => {
      disposeTimer.current = setTimeout(() => {
        flow.dispose();
        disposeTimer.current = null;
      }, 0);
    };
  }, [flow]);

  const submit = useCallback(() => flow.submit(consentAccepted), [consentAccepted, flow]);
  const canSubmit = state.secure
    && state.hasPass
    && state.event !== null
    && consentAccepted
    && (state.status === "ready" || state.status === "retryable");

  return {
    state,
    consentAccepted,
    setConsentAccepted,
    canSubmit,
    submit,
  };
}
