import { z } from 'zod';
import type { AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';

export type NotificationRecipientLookups = Pick<
  AccountContactReadModel,
  'findApprovedPmcmAdminEmails' | 'findActiveCoordinatorEmailsForEvent' | 'findEventNotificationContact'
>;

export type ResolvedNotificationRecipients =
  | { status: 'resolved'; addresses: string[] }
  | { status: 'failed'; reason: string };

const PMCM_ADMIN_LABELS = new Set(['PMCM Admin', 'pmcm-inquiry-desk']);

function uniqueAddresses(addresses: string[]) {
  const seen = new Map<string, string>();
  for (const address of addresses.map((value) => value.trim()).filter(Boolean)) {
    if (!seen.has(address.toLowerCase())) seen.set(address.toLowerCase(), address);
  }
  return [...seen.values()];
}

function addressesOrFailure(addresses: string[], emptyReason: string): ResolvedNotificationRecipients {
  const unique = uniqueAddresses(addresses);
  return unique.length > 0 ? { status: 'resolved', addresses: unique } : { status: 'failed', reason: emptyReason };
}

/**
 * Turns an outbox recipient into delivery addresses at send time. The recipient is either an
 * email address or one of the known role labels; anything else fails with a stored reason.
 */
export async function resolveNotificationRecipients(
  recipient: string,
  eventId: string | null,
  lookups: NotificationRecipientLookups,
): Promise<ResolvedNotificationRecipients> {
  const label = recipient.trim();
  if (z.email().safeParse(label).success) return { status: 'resolved', addresses: [label] };

  if (PMCM_ADMIN_LABELS.has(label)) {
    return addressesOrFailure(await lookups.findApprovedPmcmAdminEmails(), 'No approved, unlocked PMCM Admin account has an email address');
  }
  if (label === 'Coordinator') {
    if (!eventId) return { status: 'failed', reason: "Recipient 'Coordinator' needs an event to resolve" };
    return addressesOrFailure(
      await lookups.findActiveCoordinatorEmailsForEvent(eventId),
      'No active coordinator with an email address is assigned to this event',
    );
  }
  if (label === 'Client') {
    if (!eventId) return { status: 'failed', reason: "Recipient 'Client' needs an event to resolve" };
    const contact = await lookups.findEventNotificationContact(eventId);
    return addressesOrFailure(contact?.clientEmail ? [contact.clientEmail] : [], 'No client email address is on file for this event');
  }
  return { status: 'failed', reason: `Recipient '${label}' is not an email address or a known role` };
}
