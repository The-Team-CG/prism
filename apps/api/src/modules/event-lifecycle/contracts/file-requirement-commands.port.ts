import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { BindFileRequirementUploadInput, CreateFileRequirementInput, PrismFileRequirementItem, PrismFileRequirementTemplate, UpdateFileRequirementInput, UpsertFileRequirementTemplateInput } from '@prism/types';

export type FileRequirementReminderReason = 'overdue' | 'rejected';

export type FileRequirementReminder = {
  eventId: string;
  key: string;
  reason: FileRequirementReminderReason;
  recipient: string;
  idempotencyKey: string;
};

/** PMCM-owned writes for the event file requirements matrix. */
export interface FileRequirementCommands {
  createRequirement(eventId: string, input: CreateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem>;
  updateRequirement(eventId: string, key: string, input: UpdateFileRequirementInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem>;
  /** Queue reminders for one event after an explicit PMCM action. */
  sendReminders(eventId: string, actor: ResolvedEventOpsActor, now?: Date): Promise<{ reminders: FileRequirementReminder[] }>;
  listRequirementTemplates(actor: ResolvedEventOpsActor): Promise<PrismFileRequirementTemplate[]>;
  upsertRequirementTemplate(input: UpsertFileRequirementTemplateInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementTemplate>;
  applyRequirementTemplate(eventId: string, actor: ResolvedEventOpsActor): Promise<{ eventId: string; eventType: string; templateId: string; createdKeys: string[]; skippedExistingCount: number }>;
  bindRequirementUpload(eventId: string, key: string, input: BindFileRequirementUploadInput, actor: ResolvedEventOpsActor): Promise<PrismFileRequirementItem>;
  /** Queue-only reminders for required items that are overdue or whose latest file was rejected. */
  runReminderSweep(now?: Date): Promise<{ reminders: FileRequirementReminder[] }>;
}
