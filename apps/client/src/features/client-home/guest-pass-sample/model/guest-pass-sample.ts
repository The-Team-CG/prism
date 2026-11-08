/**
 * FR-42: the guest pass promotional sample. A scripted walkthrough of what a guest sees, for prospects on the
 * public site. It is fixed sample content: it never calls the API and never reads or writes live event data.
 */

export const SAMPLE_ACCESS_CODE = "SAMPLE-2026";

export const SAMPLE_EVENT = {
  eventName: "Sample Company Anniversary Night",
  clientName: "Sample Client Inc.",
  dateLabel: "Saturday, 12 December 2026",
  venue: "Sample Grand Ballroom",
  startTime: "6:00 PM",
  guestName: "Alex Sample",
  table: "Table 8",
} as const;

export type GuestPassSampleStep = "code" | "pass" | "checked_in" | "feedback_sent";

export type GuestPassSampleState = {
  step: GuestPassSampleStep;
  code: string;
  error: string | null;
  rating: number;
};

export type GuestPassSampleAction =
  | { type: "type_code"; code: string }
  | { type: "open_pass" }
  | { type: "check_in" }
  | { type: "rate"; rating: number }
  | { type: "send_feedback" }
  | { type: "restart" };

export const initialGuestPassSample: GuestPassSampleState = { step: "code", code: "", error: null, rating: 0 };

function openPass(state: GuestPassSampleState): GuestPassSampleState {
  if (state.step !== "code") return state;
  return state.code.trim().toUpperCase() === SAMPLE_ACCESS_CODE
    ? { ...state, step: "pass", error: null }
    : { ...state, error: `This sample opens with the code ${SAMPLE_ACCESS_CODE}.` };
}

function rate(state: GuestPassSampleState, rating: number): GuestPassSampleState {
  return state.step === "checked_in" ? { ...state, rating: Math.min(5, Math.max(1, Math.round(rating))) } : state;
}

export function guestPassSampleReducer(state: GuestPassSampleState, action: GuestPassSampleAction): GuestPassSampleState {
  switch (action.type) {
    case "type_code": return { ...state, code: action.code, error: null };
    case "open_pass": return openPass(state);
    case "check_in": return state.step === "pass" ? { ...state, step: "checked_in" } : state;
    case "rate": return rate(state, action.rating);
    case "send_feedback": return state.step === "checked_in" && state.rating > 0 ? { ...state, step: "feedback_sent" } : state;
    case "restart": return initialGuestPassSample;
  }
}

export const GUEST_PASS_SAMPLE_STEPS: Array<{ step: GuestPassSampleStep; label: string }> = [
  { step: "code", label: "Enter the event code" },
  { step: "pass", label: "Open the guest pass" },
  { step: "checked_in", label: "Check in at the door" },
  { step: "feedback_sent", label: "Leave feedback" },
];
