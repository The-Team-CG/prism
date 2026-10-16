import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismGuestQrPassIssueResult, PrismGuestQrPassStatus } from '@prism/types';

export interface GuestQrPassCommands {
  list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus[]>;
  get(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus>;
  issue(eventId: string, rosterEntryId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassIssueResult>;
  retry(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus>;
  reissue(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassIssueResult>;
  revoke(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus>;
}
