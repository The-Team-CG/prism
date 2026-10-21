import type { OpsDocument, OpsInquiry } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { CreateInquiryInput, UpdateInquiryStatusInput } from '../application/onboarding/inquiries.service';

export interface InquiryCommands {
  createInquiry(input: CreateInquiryInput): Promise<OpsInquiry>;
  logInquiryOnBehalf(input: CreateInquiryInput, actor: ResolvedEventOpsActor): Promise<OpsInquiry>;
  updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput, actor: ResolvedEventOpsActor): Promise<OpsInquiry>;
  sendConformeReminder(inquiryId: string, actor: ResolvedEventOpsActor): Promise<OpsInquiry>;
  runConformeReminderSweep(): Promise<void>;
  markPortalInvitationOpenedByEmail(email: string): Promise<void>;
  uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number; storageObjectId?: string },
    actor: ResolvedEventOpsActor,
  ): Promise<OpsDocument>;
}
