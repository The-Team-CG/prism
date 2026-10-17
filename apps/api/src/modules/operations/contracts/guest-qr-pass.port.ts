import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismGuestQrPassIssueResult, PrismGuestQrPassRosterStatus, PrismGuestQrPassStatus } from '@prism/types';

export interface GuestQrPassCommands {
  listForRoster(eventId: string, rosterEntryIds: readonly string[], actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassRosterStatus>;
  get(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus>;
  issue(eventId: string, rosterEntryId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassIssueResult>;
  retry(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus>;
  reissue(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassIssueResult>;
  revoke(eventId: string, passId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPassStatus>;
}
