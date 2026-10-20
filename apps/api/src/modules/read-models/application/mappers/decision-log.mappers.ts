import type { PrismDecisionLogActor, PrismDecisionLogEntry, PrismDecisionLogKind } from '@prism/types';
import { PRISM_DECISION_LOG_KINDS } from '@prism/types';
import type { EventReadModelQueries } from '../queries/event-read-models.queries';

export type DecisionLogSources = NonNullable<Awaited<ReturnType<EventReadModelQueries['decisionLogSourcesForEvent']>>>;
type AuditAttributionRow = DecisionLogSources['auditAttributions'][number];

/**
 * Attribution index over audit rows keyed by `affectedType:affectedId`. Audit rows only fill the
 * actor name/role a source row does not store; reasons always come from the source row itself.
 */
export function indexAuditAttributions(rows: AuditAttributionRow[]) {
  const byRecord = new Map<string, AuditAttributionRow[]>();
  for (const row of rows) {
    if (!row.affectedType || !row.affectedId) continue;
    const key = `${row.affectedType}:${row.affectedId}`;
    const list = byRecord.get(key) ?? [];
    list.push(row);
    byRecord.set(key, list);
  }
  /** Prefers the newest audit row by the named actor, else the newest row for the record. */
  return (type: string, id: string, actorName?: string | null): PrismDecisionLogActor => {
    const candidates = byRecord.get(`${type}:${id}`) ?? [];
    const match = (actorName ? candidates.find((row) => sameName(row.actor, actorName)) : undefined) ?? candidates[0];
    return { name: textOrNull(actorName) ?? textOrNull(match?.actor), role: textOrNull(match?.actorRole) };
  };
}

type Attribute = ReturnType<typeof indexAuditAttributions>;

function entry(
  kind: PrismDecisionLogKind,
  sourceType: string,
  sourceId: string,
  fields: { decision: string; subject: string; reason?: string | null; actor: PrismDecisionLogActor; decidedAt: Date },
): PrismDecisionLogEntry {
  return {
    id: `${sourceType}:${sourceId}`,
    kind,
    decision: fields.decision,
    subject: fields.subject,
    reason: textOrNull(fields.reason),
    actor: fields.actor,
    decidedAt: fields.decidedAt.toISOString(),
    sourceRef: { type: sourceType, id: sourceId },
  };
}

/** Maps every decision source of one event into decision-log entries (unordered). */
export function mapDecisionLogEntries(sources: DecisionLogSources): PrismDecisionLogEntry[] {
  const attribute = indexAuditAttributions(sources.auditAttributions);
  return [
    ...sources.eventDecisions.map((row) =>
      entry(row.decision === 'cancelled' ? 'cancellation' : 'postponement', 'event_decision', row.id, {
        decision: row.decision,
        subject: row.decision === 'cancelled' ? 'Event cancelled' : row.decision === 'postponed' ? 'Event postponed' : 'Event date to be confirmed',
        reason: row.reason,
        actor: { name: textOrNull(row.actorName), role: textOrNull(row.actorRole) },
        decidedAt: row.decidedAt,
      }),
    ),
    ...sources.freezeExceptions.map((row) =>
      entry('freeze_exception', 'freeze_exception', row.id, {
        decision: row.status,
        subject: row.requestedChange,
        reason: textOrNull(row.decisionNote) ?? row.reason,
        actor: attribute('freeze_exception', row.id, row.decidedBy),
        decidedAt: row.decidedAt!,
      }),
    ),
    ...sources.addenda.map((row) =>
      entry('addendum', 'addendum', row.id, {
        decision: row.status,
        subject: `Addendum v${row.versionNumber}: ${row.title} (${row._count.impacts} impact${row._count.impacts === 1 ? '' : 's'}, delta ${row.financialDelta})`,
        reason: row.summary,
        actor: attribute('addendum', row.id),
        decidedAt: row.issuedAt,
      }),
    ),
    ...archiveOverrideEntries(sources, attribute),
    ...sources.complianceOverrides.map((row) =>
      entry('compliance_override', 'compliance_check', row.id, {
        decision: row.status,
        subject: row.title,
        reason: row.overrideReason,
        actor: attribute('compliance_check', row.id, row.overrideBy),
        decidedAt: row.overrideAt!,
      }),
    ),
    ...sources.riskChanges.map((row) =>
      entry('risk_change', 'compliance_risk_history', row.id, {
        decision: `${row.action === 'create' ? 'raised' : 'updated'}: ${row.status}, ${row.severity}`,
        subject: row.risk.title,
        reason: row.reason,
        actor: attribute('compliance_risk', row.riskId, row.actor),
        decidedAt: row.createdAt,
      }),
    ),
    ...sources.ocularWaivers.map((row) =>
      entry('ocular_waiver', 'ocular_visit_request', row.id, {
        decision: row.status,
        subject: 'Ocular visit waived',
        reason: row.waiverReason,
        actor: attribute('ocular_visit_request', row.id, row.waivedBy),
        decidedAt: row.waivedAt!,
      }),
    ),
    ...sources.billingCorrections.map((row) =>
      entry('billing_correction', 'billing_correction', row.id, {
        decision: row.status,
        subject: row.correctedTotalAmount === null ? `Correction to statement ${row.statementId}` : `Correction to statement ${row.statementId}: total ${row.correctedTotalAmount}`,
        reason: textOrNull(row.resolutionNotes) ?? row.reason,
        actor: attribute('billing_correction', row.id, row.resolvedBy),
        decidedAt: row.resolvedAt!,
      }),
    ),
    ...sources.billingWaivers.map((row) =>
      entry('billing_waiver', 'additional_billing', row.id, {
        decision: row.status,
        subject: `${row.description} (${row.amount})`,
        reason: row.waiverReason,
        actor: attribute('additional_billing', row.id, row.waivedBy),
        decidedAt: row.waivedAt!,
      }),
    ),
    ...sources.paymentTermsOverrides.map((row) =>
      entry('payment_terms_override', 'billing_source', row.id, {
        decision: row.paymentTermsApprovedBy ? 'approved' : 'pending_approval',
        subject: row.sourceLabel,
        reason: row.paymentTermsOverrideReason,
        actor: attribute('billing_source', row.id, row.paymentTermsApprovedBy),
        decidedAt: row.approvedAt ?? row.createdAt,
      }),
    ),
    ...sources.reassignments.map((row) =>
      entry('reassignment', 'event_task_reassignment', row.id, {
        decision: row.status,
        subject: `${row.task.title}: ${textOrNull(row.fromOwnerName) ?? row.fromOwnerRole} to ${textOrNull(row.toOwnerName) ?? row.toOwnerRole}`,
        reason: textOrNull(row.decisionReason) ?? row.reason,
        actor: attribute('event_task_reassignment', row.id, row.decidedBy),
        decidedAt: row.decidedAt!,
      }),
    ),
    ...sources.inquiryMerges.map((row) =>
      entry('inquiry_merge', 'inquiry_merge', row.id, {
        decision: 'merged',
        subject: `Inquiry ${row.mergedInquiryId} merged into ${row.primaryInquiryId} (${row.matchBasis})`,
        reason: row.reason,
        actor: { name: textOrNull(row.actorName), role: textOrNull(row.actorRole) },
        decidedAt: row.createdAt,
      }),
    ),
  ];
}

function archiveOverrideEntries(sources: DecisionLogSources, attribute: Attribute): PrismDecisionLogEntry[] {
  const { event } = sources;
  if (!textOrNull(event.archiveOverrideReason)) return [];
  return [
    entry('archive_override', 'event', event.id, {
      decision: 'archived_with_override',
      subject: 'Event archived with open close gates',
      reason: event.archiveOverrideReason,
      actor: attribute('event', event.id, event.archiveOverrideBy),
      decidedAt: event.archivedAt ?? event.updatedAt,
    }),
  ];
}

/** Newest first; ties break on the stable entry id so pages never overlap. */
export function compareDecisionLogEntries(left: PrismDecisionLogEntry, right: PrismDecisionLogEntry) {
  const byTime = right.decidedAt.localeCompare(left.decidedAt);
  return byTime !== 0 ? byTime : right.id.localeCompare(left.id);
}

export function countDecisionLogKinds(entries: PrismDecisionLogEntry[]): Record<PrismDecisionLogKind, number> {
  const counts = Object.fromEntries(PRISM_DECISION_LOG_KINDS.map((kind) => [kind, 0])) as Record<PrismDecisionLogKind, number>;
  for (const item of entries) counts[item.kind] += 1;
  return counts;
}

function textOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sameName(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}
