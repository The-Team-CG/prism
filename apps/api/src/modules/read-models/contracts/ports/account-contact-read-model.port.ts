import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismApprovedClientAccount } from '@prism/types';

export const ACCOUNT_CONTACT_READ_MODEL = Symbol.for('prism.readModels.accountContact');

/** Read-only contact projection for approved accounts. */
export interface AccountContactReadModel {
  findApprovedEmailByRole(role: string): Promise<string | null>;
  findApprovedEmailByName(name: string): Promise<string | null>;
  searchApprovedClientAccounts(query: string, requester: ResolvedEventOpsActor, limit: number): Promise<PrismApprovedClientAccount[]>;
  getApprovedClientAccounts(userIds: string[], requester: ResolvedEventOpsActor): Promise<PrismApprovedClientAccount[]>;
  isApprovedClientAccount(userId: string): Promise<boolean>;
}
