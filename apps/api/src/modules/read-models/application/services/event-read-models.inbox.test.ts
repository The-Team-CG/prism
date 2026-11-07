import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectClientActionItems, collectPmcmCommandInboxItems } from './event-read-models.inbox';

type Input = Parameters<typeof collectClientActionItems>[0];

describe('client action center', () => {
  it('surfaces only addenda awaiting the client and links to the version to acknowledge', () => {
    const items = collectClientActionItems({
      visibleEvents: [{ id: 'evt_gala', eventName: 'Founders gala', status: 'planning' }] as unknown as Input['visibleEvents'],
      briefings: [{ eventId: 'evt_gala' }] as unknown as Input['briefings'],
      documents: [],
      floorPlanDrafts: [],
      billingStatements: [],
      paymentMilestones: [],
      paymentRecords: [],
      postEventDocuments: [],
      addenda: [
        { id: 'add_7', eventId: 'evt_gala', versionNumber: 7, title: 'Updated lighting plan', issuedAt: new Date('2026-11-05T00:00:00Z'), conformeExecution: { status: 'awaiting_client' } },
        { id: 'add_6', eventId: 'evt_gala', versionNumber: 6, title: 'Prior plan', issuedAt: new Date('2026-11-04T00:00:00Z'), conformeExecution: { status: 'awaiting_pmcm' } },
      ],
      now: new Date('2026-11-06T00:00:00Z'),
    });

    expect(items.filter((item) => item.kind === 'addendum')).toEqual([expect.objectContaining({
      id: 'addendum:add_7',
      priority: 'attention',
      label: 'Acknowledge addendum: Updated lighting plan',
      description: 'Version 7 is waiting for your acknowledgment.',
      status: 'awaiting_client',
      href: '/dashboard/events/evt_gala/overview#client-addendum-add_7',
    })]);
  });

  // The closeout rule depends on the event having ended; pin "now" after the fixture's end time.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the client to acknowledge each delivered deliverable by name once the event has ended', () => {
    const items = collectClientActionItems({
      visibleEvents: [{ id: 'evt_gala', eventName: 'Founders gala', status: 'completed', actualEndedAt: new Date('2026-10-20T14:00:00Z'), archived: false }] as unknown as Input['visibleEvents'],
      briefings: [{ eventId: 'evt_gala' }] as unknown as Input['briefings'],
      documents: [],
      floorPlanDrafts: [],
      billingStatements: [],
      paymentMilestones: [],
      paymentRecords: [],
      postEventDocuments: [
        { id: 'doc_report', eventId: 'evt_gala', title: 'Post-event report', status: 'submitted' },
        { id: 'doc_photos', eventId: 'evt_gala', title: 'Photo gallery', status: 'submitted' },
        { id: 'doc_draft', eventId: 'evt_gala', title: 'Venue feedback form', status: 'in_progress' },
        { id: 'doc_seen', eventId: 'evt_gala', title: 'Final invoice', status: 'submitted', clientAcknowledgedAt: new Date('2026-10-21T00:00:00Z') },
      ] as unknown as Input['postEventDocuments'],
    });

    // Only delivered, unacknowledged records need the client; each is named so two can be told apart.
    const closeout = items.filter((item) => item.kind === 'closure');
    expect(closeout.map((item) => item.label).sort()).toEqual(['Acknowledge deliverable: Photo gallery', 'Acknowledge deliverable: Post-event report']);
  });
});

describe('PMCM command inbox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows blocked task context and links directly to the affected event-day task', () => {
    const items = collectPmcmCommandInboxItems({
      inquiries: [],
      events: [{
        id: 'evt_gala', eventName: 'Founders gala', eventDate: new Date('2026-11-10T09:00:00.000Z'),
        floorPlanStatus: 'not_started', status: 'planning', clientName: 'Alex Client',
      }],
      paymentMilestones: [],
      quoteRequests: [],
      coordinatorAssignments: [],
      floorPlanDrafts: [],
      postEventDocuments: [],
      eventDayTasks: [{
        id: 'task_42', eventId: 'evt_gala', title: 'Confirm venue power', status: 'blocked',
        assignedRole: 'Technical Coordinator', ownerName: 'Morgan Lee', notes: 'Waiting for the venue power map.',
        dueAt: new Date('2026-11-08T09:00:00.000Z'), slaDueAt: null, slaStatus: 'on_track',
      }],
    });

    expect(items).toContainEqual(expect.objectContaining({
      id: 'live-ops:task:task_42',
      label: 'Event-day task blocked',
      description: 'Confirm venue power for Founders gala is blocked. Owner: Technical Coordinator (Morgan Lee). Blocker: Waiting for the venue power map.',
      dueAt: '2026-11-08T09:00:00.000Z',
      href: '/dashboard/events/evt_gala/live-ops#event-day-task-task_42',
    }));
  });
});
