import type {
  OpsDocument,
  OpsEvent,
  OpsFloorPlanDraft,
  OpsPaymentMilestone,
  OpsPaymentRecord,
  OpsPostEventDocument,
} from '@prisma/client';
import type { PrismClientActionItem, PrismClientChangeRequest, PrismCommandInboxItem, PrismCommandInboxSeverity } from '@prism/types';
import { toClientChangeRequest, type ClientChangeRequestSource } from '@prism/contexts/event-lifecycle';
import type {
  PmcmInboxCoordinatorAssignment,
  PmcmInboxEvent,
  PmcmInboxEventDayTask,
  PmcmInboxFloorPlanDraft,
  PmcmInboxInquiry,
  PmcmInboxPaymentMilestone,
  PmcmInboxPostEventDocument,
  PmcmInboxQuoteRequest,
  PmcmInboxUrgentIssue,
} from '../queries/pmcm-command-inbox.types';

type EventRef = PmcmInboxEvent;
type ClientEventRef = EventRef & Partial<Pick<OpsEvent, 'actualEndedAt' | 'archived'>>;
type BriefingRef = { eventId: string };
type BillingStatementRef = { id: string; eventId: string; status: string; number: string };
type CloseoutResponseRef = { eventId: string };
export type ClientChangeRequestRef = ClientChangeRequestSource & { eventId: string };

const DOCUMENT_ACTION_STATUSES = ['needs_update', 'pending', 'rejected'];
const FLOORPLAN_DRAFT_ACTION_STATUSES = ['submitted', 'in_review'];
const CLOSED_QUOTE_REQUEST_STATUSES = ['selected', 'closed', 'cancelled'];
const SETTLED_COORDINATOR_STATUSES = ['confirmed', 'checked_in', 'completed'];
const CLOSED_LIVE_OPS_STATUSES = ['done', 'resolved', 'cancelled', 'closed'];
/** A decided change request stays in the client action center long enough for the client to review the outcome. */
export const CLIENT_CHANGE_DECISION_REVIEW_DAYS = 14;

export function toIso(value?: Date | string | null) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

export function isPast(value?: Date | string | null) {
  if (!value) return false;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

export function dateRank(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function priorityRank(priority: PrismCommandInboxSeverity) {
  const ranks: Record<PrismCommandInboxSeverity, number> = {
    critical: 0,
    warning: 1,
    attention: 2,
    info: 3,
  };
  return ranks[priority];
}

export function emptyInboxPayload() {
  return {
    generatedAt: new Date().toISOString(),
    counts: { critical: 0, warning: 0, attention: 0, info: 0 },
    items: [] as PrismClientActionItem[],
  };
}

export function countByPriority(items: Array<{ priority: PrismCommandInboxSeverity }>) {
  return {
    critical: items.filter((item) => item.priority === 'critical').length,
    warning: items.filter((item) => item.priority === 'warning').length,
    attention: items.filter((item) => item.priority === 'attention').length,
    info: items.filter((item) => item.priority === 'info').length,
  };
}

export function countBySeverity(items: Array<{ severity: PrismCommandInboxSeverity }>) {
  return {
    critical: items.filter((item) => item.severity === 'critical').length,
    warning: items.filter((item) => item.severity === 'warning').length,
    attention: items.filter((item) => item.severity === 'attention').length,
    info: items.filter((item) => item.severity === 'info').length,
  };
}

function eventById<T extends { id: string }>(events: T[], eventId: string) {
  return events.find((item) => item.id === eventId);
}

export function collectClientActionItems(input: {
  visibleEvents: ClientEventRef[];
  briefings: BriefingRef[];
  documents: OpsDocument[];
  floorPlanDrafts: OpsFloorPlanDraft[];
  billingStatements: BillingStatementRef[];
  paymentMilestones: OpsPaymentMilestone[];
  paymentRecords: OpsPaymentRecord[];
  postEventDocuments: OpsPostEventDocument[];
  closeoutResponses?: CloseoutResponseRef[];
  changeRequests?: ClientChangeRequestRef[];
  now?: Date;
}): PrismClientActionItem[] {
  const now = input.now ?? new Date();
  const items = [
    ...collectClientEventActionItems(input.visibleEvents, new Set(input.briefings.map((briefing) => briefing.eventId))),
    ...collectClientBillingActionItems(input.paymentMilestones, input.visibleEvents, input.paymentRecords),
    ...collectClientDocumentActionItems(input.documents, input.visibleEvents),
    ...collectClientFloorplanDraftActionItems(input.floorPlanDrafts, input.visibleEvents),
    ...collectClientBillingStatementActionItems(input.billingStatements, input.visibleEvents),
    ...collectClientClosureActionItems(input.postEventDocuments, input.visibleEvents),
    ...collectClientFeedbackActionItems(input.visibleEvents, new Set((input.closeoutResponses ?? []).map((row) => row.eventId))),
    ...collectClientChangeRequestItems(input.changeRequests ?? [], input.visibleEvents, now),
  ];
  items.sort((left, right) => {
    const priority = priorityRank(left.priority) - priorityRank(right.priority);
    if (priority !== 0) return priority;
    const due = (left.dueAt ?? '').localeCompare(right.dueAt ?? '');
    if (due !== 0) return due;
    return left.id.localeCompare(right.id);
  });
  return items;
}

function collectClientEventActionItems(events: EventRef[], briefingEventIds: Set<string>) {
  const items: PrismClientActionItem[] = [];
  for (const event of events) {
    items.push(...clientEventActionItems(event, briefingEventIds));
  }
  return items;
}

function clientEventActionItems(event: EventRef, briefingEventIds: Set<string>): PrismClientActionItem[] {
  const items: PrismClientActionItem[] = [];
  if (!briefingEventIds.has(event.id)) {
    items.push({
      id: `briefing:${event.id}`,
      kind: 'briefing',
      priority: 'attention',
      label: 'Complete event briefing',
      description: `Share venue, guest count, budget, and service requirements for ${event.eventName}.`,
      status: 'missing',
      eventId: event.id,
      eventName: event.eventName,
      dueAt: toIso(event.eventDate),
      href: `/dashboard/events/${event.id}/briefing`,
    });
  }

  if (event.floorPlanStatus === 'in_review') {
    items.push({
      id: `floorplan:review:${event.id}`,
      kind: 'floorplan',
      priority: 'attention',
      label: 'Review official floorplan',
      description: `PMCM submitted the official layout for ${event.eventName}.`,
      status: event.floorPlanStatus,
      eventId: event.id,
      eventName: event.eventName,
      href: `/dashboard/events/${event.id}/floor-plan`,
    });
  } else if (event.floorPlanStatus === 'not_started') {
    items.push({
      id: `floorplan:preferences:${event.id}`,
      kind: 'floorplan',
      priority: 'info',
      label: 'Submit layout preferences',
      description: `Share layout requirements before PMCM prepares the official floorplan for ${event.eventName}.`,
      status: event.floorPlanStatus,
      eventId: event.id,
      eventName: event.eventName,
      href: `/dashboard/events/${event.id}/floor-plan`,
    });
  }

  return items;
}

function collectClientBillingActionItems(
  payments: OpsPaymentMilestone[],
  events: EventRef[],
  paymentRecords: OpsPaymentRecord[],
) {
  const items: PrismClientActionItem[] = [];
  for (const payment of payments) {
    const item = clientBillingActionItem(payment, events, paymentRecords);
    if (item) items.push(item);
  }
  return items;
}

function clientBillingActionItem(
  payment: OpsPaymentMilestone,
  events: EventRef[],
  paymentRecords: OpsPaymentRecord[],
): PrismClientActionItem | null {
  if (payment.status === 'paid') return null;
  const event = eventById(events, payment.eventId);
  if (!event) return null;
  const history = paymentRecords.filter((record) => record.milestoneId === payment.id);
  const paidAmount = history.reduce((sum, record) => sum + Number(record.amountReceived ?? 0), 0);
  const remaining = Number(payment.amount ?? 0) - paidAmount;
  const overdue = isPast(payment.dueDate);
  return {
    id: `billing:${payment.id}`,
    kind: 'billing',
    priority: overdue ? 'critical' : 'warning',
    label: overdue ? 'Payment overdue' : 'Payment pending',
    description: `${payment.label} has ${Math.max(remaining, 0).toLocaleString('en-PH')} PHP remaining.`,
    status: payment.status,
    eventId: event.id,
    eventName: event.eventName,
    dueAt: toIso(payment.dueDate),
    href: `/dashboard/events/${event.id}/billing`,
  };
}

function collectClientDocumentActionItems(documents: OpsDocument[], events: EventRef[]) {
  const items: PrismClientActionItem[] = [];
  for (const document of documents) {
    const item = clientDocumentActionItem(document, events);
    if (item) items.push(item);
  }
  return items;
}

function clientDocumentActionItem(document: OpsDocument, events: EventRef[]): PrismClientActionItem | null {
  if (!DOCUMENT_ACTION_STATUSES.includes(document.status)) return null;
  const event = eventById(events, document.eventId);
  if (!event) return null;
  return {
    id: `document:${document.id}`,
    kind: 'document',
    priority: document.status === 'rejected' ? 'warning' : 'attention',
    label: 'Document needs attention',
    description: `${document.fileName} is ${document.status.replaceAll('_', ' ')}.`,
    status: document.status,
    eventId: event.id,
    eventName: event.eventName,
    href: `/dashboard/events/${event.id}/documents`,
  };
}

function collectClientFloorplanDraftActionItems(drafts: OpsFloorPlanDraft[], events: EventRef[]) {
  const items: PrismClientActionItem[] = [];
  for (const draft of drafts) {
    const item = clientFloorplanDraftActionItem(draft, events);
    if (item) items.push(item);
  }
  return items;
}

function clientFloorplanDraftActionItem(draft: OpsFloorPlanDraft, events: EventRef[]): PrismClientActionItem | null {
  if (!FLOORPLAN_DRAFT_ACTION_STATUSES.includes(draft.status)) return null;
  const event = eventById(events, draft.eventId);
  if (!event) return null;
  return {
    id: `floorplan:draft:${draft.id}`,
    kind: 'floorplan',
    priority: 'attention',
    label: 'Floorplan draft waiting for response',
    description: `${draft.name} is ${draft.status.replaceAll('_', ' ')}.`,
    status: draft.status,
    eventId: event.id,
    eventName: event.eventName,
    href: `/dashboard/events/${event.id}/floor-plan`,
  };
}

function collectClientBillingStatementActionItems(statements: BillingStatementRef[], events: EventRef[]) {
  const items: PrismClientActionItem[] = [];
  for (const statement of statements) {
    const item = clientBillingStatementActionItem(statement, events);
    if (item) items.push(item);
  }
  return items;
}

function clientBillingStatementActionItem(
  statement: BillingStatementRef,
  events: EventRef[],
): PrismClientActionItem | null {
  if (statement.status !== 'issued') return null;
  const event = eventById(events, statement.eventId);
  if (!event) return null;
  return {
    id: `approval:billing:${statement.id}`,
    kind: 'approval',
    priority: 'info',
    label: 'Billing statement available',
    description: `${statement.number} is ready for ${event.eventName}.`,
    status: statement.status,
    eventId: event.id,
    eventName: event.eventName,
    href: `/dashboard/events/${event.id}/billing`,
  };
}

function collectClientClosureActionItems(documents: OpsPostEventDocument[], events: EventRef[]) {
  const items: PrismClientActionItem[] = [];
  for (const document of documents) {
    const item = clientClosureActionItem(document, events);
    if (item) items.push(item);
  }
  return items;
}

function clientClosureActionItem(document: OpsPostEventDocument, events: EventRef[]): PrismClientActionItem | null {
  if (document.status === 'complete') return null;
  const event = eventById(events, document.eventId);
  if (!event) return null;
  return {
    id: `closure:${document.id}`,
    kind: 'closure',
    priority: event.status === 'completed' ? 'warning' : 'info',
    label: 'Closeout item pending',
    description: `${document.title} is ${document.status.replaceAll('_', ' ')}.`,
    status: document.status,
    eventId: event.id,
    eventName: event.eventName,
    href: `/dashboard/events/${event.id}/activity`,
  };
}

// The feedback window matches the closeout command: open once the event has ended, closed when it is archived.
function collectClientFeedbackActionItems(events: ClientEventRef[], respondedEventIds: Set<string>) {
  const items: PrismClientActionItem[] = [];
  for (const event of events) {
    if (!event.actualEndedAt || event.archived || respondedEventIds.has(event.id)) continue;
    items.push({
      id: `feedback:${event.id}`,
      kind: 'feedback',
      priority: 'attention',
      label: 'Share event feedback',
      description: `Tell PMCM how ${event.eventName} went.`,
      status: 'awaiting_feedback',
      eventId: event.id,
      eventName: event.eventName,
      href: `/dashboard/events/${event.id}/summary`,
    });
  }
  return items;
}

function collectClientChangeRequestItems(requests: ClientChangeRequestRef[], events: ClientEventRef[], now: Date) {
  const items: PrismClientActionItem[] = [];
  const reviewSince = now.getTime() - CLIENT_CHANGE_DECISION_REVIEW_DAYS * 24 * 60 * 60 * 1000;
  for (const request of requests) {
    const event = eventById(events, request.eventId);
    if (!event) continue;
    if (request.decidedAt && request.decidedAt.getTime() < reviewSince) continue;
    // Only the client-safe projection is read so internal reasons and decision notes can never reach the item.
    const projection: PrismClientChangeRequest = toClientChangeRequest(request);
    const copy: Record<PrismClientChangeRequest['status'], Pick<PrismClientActionItem, 'priority' | 'label' | 'description'>> = {
      under_review: { priority: 'info', label: 'Change request under review', description: `PMCM is reviewing: ${projection.requestedChange}` },
      approved: { priority: 'info', label: 'Change request approved', description: `PMCM approved: ${projection.requestedChange}` },
      not_approved: { priority: 'attention', label: 'Change request not approved', description: `Review PMCM's decision on: ${projection.requestedChange}` },
    };
    items.push({
      id: `change-request:${projection.id}`,
      kind: 'change_request',
      ...copy[projection.status],
      status: projection.status,
      eventId: event.id,
      eventName: event.eventName,
      href: `/dashboard/events/${event.id}/changes`,
    });
  }
  return items;
}

export function collectPmcmCommandInboxItems(input: {
  inquiries: PmcmInboxInquiry[];
  events: EventRef[];
  paymentMilestones: PmcmInboxPaymentMilestone[];
  quoteRequests: PmcmInboxQuoteRequest[];
  coordinatorAssignments: PmcmInboxCoordinatorAssignment[];
  floorPlanDrafts: PmcmInboxFloorPlanDraft[];
  postEventDocuments: PmcmInboxPostEventDocument[];
  eventDayTasks?: PmcmInboxEventDayTask[];
  urgentIssues?: PmcmInboxUrgentIssue[];
}): PrismCommandInboxItem[] {
  const eventsById = new Map(input.events.map((event) => [event.id, event]));
  const items = [
    ...collectLiveOpsTaskInboxItems(input.eventDayTasks ?? [], eventsById),
    ...collectLiveOpsIssueInboxItems(input.urgentIssues ?? [], eventsById),
    ...collectInquiryInboxItems(input.inquiries),
    ...collectEventFloorplanInboxItems(input.events),
    ...collectBillingInboxItems(input.paymentMilestones, eventsById),
    ...collectSupplierInboxItems(input.quoteRequests, eventsById),
    ...collectCoordinatorInboxItems(input.coordinatorAssignments, eventsById),
    ...collectFloorplanDraftInboxItems(input.floorPlanDrafts, eventsById),
    ...collectClosureInboxItems(input.postEventDocuments, eventsById),
  ];
  items.sort((left, right) => {
    const severity = priorityRank(left.severity) - priorityRank(right.severity);
    if (severity !== 0) return severity;
    const date = dateRank(left.dueAt ?? left.createdAt) - dateRank(right.dueAt ?? right.createdAt);
    return date !== 0 ? date : left.id.localeCompare(right.id);
  });
  return items;
}

function collectInquiryInboxItems(inquiries: PmcmInboxInquiry[]) {
  const items: PrismCommandInboxItem[] = [];
  for (const inquiry of inquiries) {
    items.push(...inquiryInboxItems(inquiry));
  }
  return items;
}

function inquiryInboxItems(inquiry: PmcmInboxInquiry): PrismCommandInboxItem[] {
  const items: PrismCommandInboxItem[] = [];
  if (inquiry.status === 'new') {
    items.push({
      id: `inquiry:${inquiry.id}`,
      kind: 'inquiry',
      severity: 'attention',
      label: 'Review new inquiry',
      description: `${inquiry.clientName} submitted ${inquiry.eventName}.`,
      status: inquiry.status,
      clientName: inquiry.clientName,
      createdAt: toIso(inquiry.createdAt),
      href: '/dashboard/inquiries',
    });
  }

  if (inquiry.status === 'accepted' && !inquiry.conformeSignedAt) {
    items.push({
      id: `conforme:${inquiry.id}`,
      kind: 'conforme',
      severity: 'warning',
      label: 'Signed conforme pending',
      description: `${inquiry.clientName} is accepted but has no signed conforme yet.`,
      status: 'awaiting_conforme',
      clientName: inquiry.clientName,
      dueAt: toIso(inquiry.portalInvitationExpiresAt),
      createdAt: toIso(inquiry.acceptedAt ?? inquiry.createdAt),
      href: '/dashboard/inquiries',
    });
  }

  return items;
}

function collectEventFloorplanInboxItems(events: EventRef[]) {
  const items: PrismCommandInboxItem[] = [];
  for (const event of events) {
    const item = eventFloorplanInboxItem(event);
    if (item) items.push(item);
  }
  return items;
}

function eventFloorplanInboxItem(event: EventRef): PrismCommandInboxItem | null {
  if (event.floorPlanStatus === 'approved') return null;
  return {
    id: `floorplan:event:${event.id}`,
    kind: 'floorplan',
    severity: event.floorPlanStatus === 'in_review' ? 'attention' : 'info',
    label: 'Official floorplan needs attention',
    description: `${event.eventName} floorplan is ${event.floorPlanStatus.replaceAll('_', ' ')}.`,
    status: event.floorPlanStatus,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    dueAt: toIso(event.eventDate),
    href: `/dashboard/events/${event.id}/floorplans`,
  };
}

function collectBillingInboxItems(payments: PmcmInboxPaymentMilestone[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const payment of payments) {
    const item = billingInboxItem(payment, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function billingInboxItem(
  payment: PmcmInboxPaymentMilestone,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(payment.eventId);
  if (!event || payment.status === 'paid') return null;
  const overdue = isPast(payment.dueDate);
  return {
    id: `billing:${payment.id}`,
    kind: 'billing',
    severity: overdue ? 'critical' : 'warning',
    label: overdue ? 'Payment milestone overdue' : 'Payment milestone pending',
    description: `${payment.label} for ${event.eventName} is ${payment.status.replaceAll('_', ' ')}.`,
    status: payment.status,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    dueAt: toIso(payment.dueDate),
    href: `/dashboard/events/${event.id}/billing`,
  };
}

function collectSupplierInboxItems(requests: PmcmInboxQuoteRequest[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const request of requests) {
    const item = supplierInboxItem(request, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function supplierInboxItem(
  request: PmcmInboxQuoteRequest,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(request.eventId);
  if (!event || CLOSED_QUOTE_REQUEST_STATUSES.includes(request.status)) return null;
  return {
    id: `supplier:${request.id}`,
    kind: 'supplier',
    severity: isPast(request.dueDate) ? 'critical' : 'attention',
    label: 'Supplier quote request open',
    description: `${request.supplierName} quote request for ${event.eventName} is ${request.status.replaceAll('_', ' ')}.`,
    status: request.status,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    dueAt: toIso(request.dueDate),
    href: `/dashboard/events/${event.id}/suppliers`,
  };
}

function collectCoordinatorInboxItems(assignments: PmcmInboxCoordinatorAssignment[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const assignment of assignments) {
    const item = coordinatorInboxItem(assignment, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function coordinatorInboxItem(
  assignment: PmcmInboxCoordinatorAssignment,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(assignment.eventId);
  if (!event || SETTLED_COORDINATOR_STATUSES.includes(assignment.status)) return null;
  return {
    id: `coordinator:${assignment.id}`,
    kind: 'coordinator',
    severity: assignment.status === 'replacement_requested' ? 'critical' : 'warning',
    label: 'Coordinator assignment needs confirmation',
    description: `${assignment.coordinatorName} is ${assignment.status.replaceAll('_', ' ')} for ${event.eventName}.`,
    status: assignment.status,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    createdAt: toIso(assignment.createdAt),
    href: `/dashboard/events/${event.id}/coordinators`,
  };
}

function collectFloorplanDraftInboxItems(drafts: PmcmInboxFloorPlanDraft[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const draft of drafts) {
    const item = floorplanDraftInboxItem(draft, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function floorplanDraftInboxItem(
  draft: PmcmInboxFloorPlanDraft,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(draft.eventId);
  if (!event || !FLOORPLAN_DRAFT_ACTION_STATUSES.includes(draft.status)) return null;
  return {
    id: `floorplan:draft:${draft.id}`,
    kind: 'floorplan',
    severity: 'attention',
    label: 'Floorplan draft waiting for PMCM review',
    description: `${draft.name} is ${draft.status.replaceAll('_', ' ')}.`,
    status: draft.status,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    createdAt: toIso(draft.updatedAt),
    href: `/dashboard/events/${event.id}/floorplans`,
  };
}

function collectClosureInboxItems(documents: PmcmInboxPostEventDocument[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const document of documents) {
    const item = closureInboxItem(document, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function closureInboxItem(
  document: PmcmInboxPostEventDocument,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(document.eventId);
  if (!event || document.status === 'complete') return null;
  return {
    id: `closure:${document.id}`,
    kind: 'closure',
    severity: event.status === 'completed' ? 'warning' : 'info',
    label: 'Closeout document pending',
    description: `${document.title} for ${event.eventName} is ${document.status.replaceAll('_', ' ')}.`,
    status: document.status,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    href: `/dashboard/events/${event.id}/closure`,
  };
}

function collectLiveOpsTaskInboxItems(tasks: PmcmInboxEventDayTask[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const task of tasks) {
    const item = liveOpsTaskInboxItem(task, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function liveOpsTaskInboxItem(
  task: PmcmInboxEventDayTask,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(task.eventId);
  if (!event || CLOSED_LIVE_OPS_STATUSES.includes(task.status)) return null;
  const dueAt = task.slaDueAt ?? task.dueAt;
  const overdue = task.slaStatus === 'overdue' || isPast(dueAt);
  const blocked = task.status === 'blocked';
  if (!overdue && !blocked) return null;
  const owner = task.ownerName ? `${task.assignedRole} (${task.ownerName})` : task.assignedRole;
  return {
    id: `live-ops:task:${task.id}`,
    kind: 'live_ops',
    severity: overdue ? 'critical' : 'warning',
    label: overdue ? 'Event-day task overdue' : 'Event-day task blocked',
    description: `${task.title} for ${event.eventName} is ${overdue ? 'overdue' : 'blocked'}. Owner: ${owner}.`,
    status: overdue ? 'overdue' : 'blocked',
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    dueAt: toIso(dueAt),
    href: `/dashboard/events/${event.id}/live-ops`,
  };
}

function collectLiveOpsIssueInboxItems(issues: PmcmInboxUrgentIssue[], eventsById: Map<string, EventRef>) {
  const items: PrismCommandInboxItem[] = [];
  for (const issue of issues) {
    const item = liveOpsIssueInboxItem(issue, eventsById);
    if (item) items.push(item);
  }
  return items;
}

function liveOpsIssueInboxItem(
  issue: PmcmInboxUrgentIssue,
  eventsById: Map<string, EventRef>,
): PrismCommandInboxItem | null {
  const event = eventsById.get(issue.eventId);
  if (!event || CLOSED_LIVE_OPS_STATUSES.includes(issue.status)) return null;
  const overdue = issue.slaStatus === 'overdue' || isPast(issue.slaDueAt);
  let severity: PrismCommandInboxSeverity = 'attention';
  if (issue.severity === 'critical' || overdue) severity = 'critical';
  else if (issue.severity === 'high') severity = 'warning';
  return {
    id: `live-ops:issue:${issue.id}`,
    kind: 'live_ops',
    severity,
    label: overdue ? 'Urgent issue past SLA' : 'Urgent issue open',
    description: `${issue.title} (${issue.severity}) for ${event.eventName} is ${issue.status.replaceAll('_', ' ')}.`,
    status: issue.status,
    eventId: event.id,
    eventName: event.eventName,
    clientName: event.clientName,
    dueAt: toIso(issue.slaDueAt),
    createdAt: toIso(issue.createdAt),
    href: `/dashboard/events/${event.id}/live-ops`,
  };
}
