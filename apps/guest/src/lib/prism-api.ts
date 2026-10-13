import { createEventOpsClient } from "@prism/api-client";
import type {
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
} from "@prism/types";

const eventOpsClient = createEventOpsClient();

/** Thin guest HTTP surface — contracts from `@prism/types`, client from `@prism/api-client`. */
export const prismApi = {
  eventPass: (accessCode: string) => eventOpsClient.guest.eventPass(accessCode),

  checkIn: (accessCode: string, input: CreateGuestCheckInInput) =>
    eventOpsClient.guest.checkIn(accessCode, input),

  feedback: (accessCode: string, input: CreateGuestFeedbackInput) =>
    eventOpsClient.guest.feedback(accessCode, input),
};
