import type {
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  ModerateGuestFeedbackInput,
  WithdrawGuestFeedbackConsentInput,
  PrismGuestCheckIn,
  PrismGuestRosterEntry,
  PrismGuestEventPass,
  PrismGuestFeedback,
  ImportGuestRosterInput,
  GuestRosterSearchInput,
  UpdateWalkInPolicyInput,
  UpdateGuestVerificationInput,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives.js";

export interface EventOpsGuestContract {
  guest: {
    eventPass(accessCode: string): Promise<PrismGuestEventPass>;
    checkIn(
      accessCode: string,
      input: CreateGuestCheckInInput,
    ): Promise<PrismGuestCheckIn>;
    feedback(
      accessCode: string,
      input: CreateGuestFeedbackInput,
    ): Promise<PrismGuestFeedback>;
    withdrawFeedbackConsent(
      accessCode: string,
      feedbackId: string,
      input: WithdrawGuestFeedbackConsentInput,
    ): Promise<PrismGuestFeedback>;
    pendingFeedback(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestFeedback[]>;
    moderateFeedback(
      eventId: string,
      feedbackId: string,
      input: ModerateGuestFeedbackInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestFeedback>;
    roster(
      eventId: string,
      query?: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestRosterEntry[]>;
    searchRoster(
      eventId: string,
      filters?: GuestRosterSearchInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestRosterEntry[]>;
    importRoster(
      eventId: string,
      input: ImportGuestRosterInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestRosterEntry[]>;
    checkInRoster(
      eventId: string,
      rosterEntryId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestCheckIn>;
    verifyRoster(
      eventId: string,
      rosterEntryId: string,
      input: UpdateGuestVerificationInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismGuestRosterEntry>;
    walkInPolicy(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<{
      eventId: string;
      policy: "closed" | "open" | "threshold";
      threshold: number;
    }>;
    updateWalkInPolicy(
      eventId: string,
      input: UpdateWalkInPolicyInput,
      actor?: EventOpsActorQuery,
    ): Promise<{
      eventId: string;
      policy: "closed" | "open" | "threshold";
      threshold: number;
    }>;
  };
}
