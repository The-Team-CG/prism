import type { OpsDocument, OpsInquiry } from '@prisma/client';
import type { PrismEventOpsActorContext } from '@prism/types';
import type { CreateInquiryInput, UpdateInquiryStatusInput } from '../services/inquiries.service';

export interface InquiryCommands {
  createInquiry(input: CreateInquiryInput): Promise<OpsInquiry>;
  logInquiryOnBehalf(input: CreateInquiryInput, actorInput?: PrismEventOpsActorContext): Promise<OpsInquiry>;
  updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput): Promise<OpsInquiry>;
  sendConformeReminder(inquiryId: string): Promise<OpsInquiry>;
  runConformeReminderSweep(): Promise<void>;
  markPortalInvitationOpenedByEmail(email: string): Promise<void>;
  uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number },
  ): Promise<OpsDocument>;
}