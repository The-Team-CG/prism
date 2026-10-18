export interface ClientConformeReviewState {
  selectedExecutionId: string | null;
  consentAccepted: boolean;
}

export type ClientConformeReviewAction =
  | { type: "select-execution"; executionId: string | null }
  | { type: "set-consent"; accepted: boolean };

export const initialClientConformeReviewState: ClientConformeReviewState = {
  selectedExecutionId: null,
  consentAccepted: false,
};

export function reduceClientConformeReviewState(
  state: ClientConformeReviewState,
  action: ClientConformeReviewAction,
): ClientConformeReviewState {
  if (action.type === "set-consent") return { ...state, consentAccepted: action.accepted };
  return action.executionId === state.selectedExecutionId
    ? state
    : { selectedExecutionId: action.executionId, consentAccepted: false };
}
