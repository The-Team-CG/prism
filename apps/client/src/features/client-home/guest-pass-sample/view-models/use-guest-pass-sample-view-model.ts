"use client";

import { useReducer } from "react";
import { GUEST_PASS_SAMPLE_STEPS, guestPassSampleReducer, initialGuestPassSample } from "../model/guest-pass-sample";

export function useGuestPassSampleViewModel() {
  const [state, dispatch] = useReducer(guestPassSampleReducer, initialGuestPassSample);
  const currentIndex = GUEST_PASS_SAMPLE_STEPS.findIndex(({ step }) => step === state.step);
  return {
    state,
    steps: GUEST_PASS_SAMPLE_STEPS.map((item, index) => ({ ...item, done: index < currentIndex, current: index === currentIndex })),
    typeCode: (code: string) => dispatch({ type: "type_code", code }),
    openPass: () => dispatch({ type: "open_pass" }),
    checkIn: () => dispatch({ type: "check_in" }),
    rate: (rating: number) => dispatch({ type: "rate", rating }),
    sendFeedback: () => dispatch({ type: "send_feedback" }),
    restart: () => dispatch({ type: "restart" }),
  };
}
