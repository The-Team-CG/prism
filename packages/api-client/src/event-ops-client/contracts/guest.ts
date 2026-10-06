import type {
  CreateGuestCheckInInput,
  CoordinatorWalkInCheckInInput,
  CreateGuestFeedbackInput,
  ModerateGuestFeedbackInput,
  WithdrawGuestFeedbackConsentInput,
  PrismGuestCheckIn,
  PrismGuestCheckInReceipt,
  PrismGuestPrivacyClassification,
  PrismCoordinatorRegistrationEntry,
  PrismGuestRosterEntry,
  PrismGuestEventPass,
  PrismGuestFeedback,
  ImportGuestRosterInput,
  GuestRosterSearchInput,
  UpdateWalkInPolicyInput,
  UpdateGuestVerificationInput,
  UpdateGuestPrivacyClassificationInput,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsGuestContract {
  guest: {
    eventPass(accessCode: string): Promise<PrismGuestEventPass>;
    checkIn(
      accessCode: string,
      input: CreateGuestCheckInInput,
    ): Promise<PrismGuestCheckInReceipt>;
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
    registrationRoster(
      eventId: string,
      filters?: GuestRosterSearchInput,
    ): Promise<PrismCoordinatorRegistrationEntry[]>;
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
    verifyRegistrationRoster(
      eventId: string,
      rosterEntryId: string,
      input: UpdateGuestVerificationInput,
    ): Promise<PrismCoordinatorRegistrationEntry>;
    registerWalkIn(
      eventId: string,
      input: CoordinatorWalkInCheckInInput,
    ): Promise<PrismCoordinatorRegistrationEntry>;
    guestPrivacyClassification(eventId: string): Promise<PrismGuestPrivacyClassification>;
    updateGuestPrivacyClassification(
      eventId: string,
      input: UpdateGuestPrivacyClassificationInput,
    ): Promise<PrismGuestPrivacyClassification>;
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
