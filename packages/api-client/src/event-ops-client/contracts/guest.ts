import type {
  GuestQrCheckInInput,
  PrismGuestQrPass,
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
  PrismGuestEventWatermark,
  PrismGuestFeedbackMediaUpload,
  PrismGuestFeedbackReceipt,
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
    watermark(accessCode: string): Promise<PrismGuestEventWatermark>;
    checkIn(
      accessCode: string,
      input: CreateGuestCheckInInput,
    ): Promise<PrismGuestCheckInReceipt>;
    /** Sends a guest's feedback; the API answers with a minimal receipt, not the stored record. */
    feedback(
      accessCode: string,
      input: CreateGuestFeedbackInput,
    ): Promise<PrismGuestFeedbackReceipt>;
    withdrawFeedbackConsent(
      accessCode: string,
      feedbackId: string,
      input: WithdrawGuestFeedbackConsentInput,
    ): Promise<PrismGuestFeedbackReceipt>;
    /** Sends the file bytes as they are; the API checks the file type and size before storing them. */
    uploadFeedbackMedia(accessCode: string, file: File): Promise<PrismGuestFeedbackMediaUpload>;
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
    flagWalkInForVerification(
      eventId: string,
      rosterEntryId: string,
    ): Promise<PrismCoordinatorRegistrationEntry>;
    guestPrivacyClassification(eventId: string): Promise<PrismGuestPrivacyClassification>;
    qrPasses(eventId: string): Promise<PrismGuestQrPass[]>;
    issueQrPasses(eventId: string): Promise<PrismGuestQrPass[]>;
    qrCheckIn(eventId: string, input: GuestQrCheckInInput): Promise<PrismGuestCheckIn>;
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
