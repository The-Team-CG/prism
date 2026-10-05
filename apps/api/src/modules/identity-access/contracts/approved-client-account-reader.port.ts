import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismApprovedClientAccount } from '@prism/types';

export const APPROVED_CLIENT_ACCOUNT_READER = Symbol.for('prism.identityAccess.approvedClientAccountReader');

export interface ApprovedClientAccountReader {
  searchApprovedClientAccounts(query: string, requester: ResolvedEventOpsActor, limit: number): Promise<PrismApprovedClientAccount[]>;
  getApprovedClientAccounts(userIds: string[], requester: ResolvedEventOpsActor): Promise<PrismApprovedClientAccount[]>;
  isApprovedClientAccount(userId: string): Promise<boolean>;
}
