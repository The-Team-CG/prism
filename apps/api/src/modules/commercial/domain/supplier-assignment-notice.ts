export interface SupplierAssignmentNoticeInput {
  eventName: string;
  eventDate: Date;
  category: string;
  amount: number;
  inclusions: unknown;
  paymentTerms: string;
  ingress: { ingressAt: Date; egressAt: Date; location: string } | null;
}

const MANILA = 'Asia/Manila';

function manilaDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function deliverables(inclusions: unknown): string[] {
  if (!Array.isArray(inclusions)) return [];
  return inclusions
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * The formal notice a supplier receives when PMCM selects their quote: the event, the deliverables they quoted, the
 * ingress window (or that PMCM has not set one yet) and the agreed payment terms. It repeats only what the supplier
 * already submitted or PMCM scheduled for them, never other bids or client details.
 */
export function buildSupplierAssignmentNotice(input: SupplierAssignmentNoticeInput): string {
  const items = deliverables(input.inclusions);
  const lines = [
    `Your supplier quote was selected for ${input.eventName} on ${input.eventDate.toISOString().slice(0, 10)} (${input.category}).`,
    items.length > 0 ? `Deliverables: ${items.join('; ')}.` : 'Deliverables: as stated in your submitted quote.',
    input.ingress
      ? `Ingress: ${manilaDateTime(input.ingress.ingressAt)} to egress ${manilaDateTime(input.ingress.egressAt)} (Philippine time)${input.ingress.location ? `, ${input.ingress.location}` : ''}.`
      : 'Ingress: PMCM will send your ingress schedule separately.',
    `Agreed amount: PHP ${input.amount.toLocaleString('en-PH')}. Payment terms: ${input.paymentTerms.trim() || 'to be confirmed by PMCM'}.`,
    'Please confirm the assignment in your supplier portal.',
  ];
  return lines.join(' ');
}
