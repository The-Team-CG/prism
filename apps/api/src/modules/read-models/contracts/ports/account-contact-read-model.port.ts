import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismApprovedClientAccount } from '@prism/types';

export const ACCOUNT_CONTACT_READ_MODEL = Symbol.for('prism.readModels.accountContact');

/** Read-only contact projection for approved accounts and event-scoped notification recipients. */
export interface AccountContactReadModel {
  findApprovedEmailByRole(role: string): Promise<string | null>;
  findApprovedEmailByName(name: string): Promise<string | null>;
  searchApprovedClientAccounts(query: string, requester: ResolvedEventOpsActor, limit: number): Promise<PrismApprovedClientAccount[]>;
  getApprovedClientAccounts(userIds: string[], requester: ResolvedEventOpsActor): Promise<PrismApprovedClientAccount[]>;
  isApprovedClientAccount(userId: string): Promise<boolean>;
  /** Approved PMCM admins who are not permanently locked or inside a timed lockout. */
  findApprovedPmcmAdminEmails(): Promise<string[]>;
  /** Emails of coordinators whose assignment to the event still occupies them (not cancelled, replaced or declined). */
  findActiveCoordinatorEmailsForEvent(eventId: string): Promise<string[]>;
  /** The event name and the inquiry email of its client; null when the event does not exist. */
  findEventNotificationContact(eventId: string): Promise<{ eventName: string; clientEmail: string | null } | null>;
}
