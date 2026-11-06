import { describe, expect, it } from 'vitest';
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

  it('names each pending closeout record so two items can be told apart without opening them', () => {
    const items = collectClientActionItems({
      visibleEvents: [{ id: 'evt_gala', eventName: 'Founders gala', status: 'completed' }] as unknown as Input['visibleEvents'],
      briefings: [{ eventId: 'evt_gala' }] as unknown as Input['briefings'],
      documents: [],
      floorPlanDrafts: [],
      billingStatements: [],
      paymentMilestones: [],
      paymentRecords: [],
      postEventDocuments: [
        { id: 'doc_report', eventId: 'evt_gala', title: 'Post-event report', status: 'pending' },
        { id: 'doc_feedback', eventId: 'evt_gala', title: 'Venue feedback form', status: 'in_progress' },
        { id: 'doc_done', eventId: 'evt_gala', title: 'Final invoice', status: 'complete' },
      ] as unknown as Input['postEventDocuments'],
    });

    const closeout = items.filter((item) => item.kind === 'closure');
    expect(closeout.map((item) => item.label).sort()).toEqual(['Closeout: Post-event report', 'Closeout: Venue feedback form']);
    expect(closeout.find((item) => item.id === 'closure:doc_feedback')?.description).toContain('in progress');
  });
});

describe('PMCM command inbox', () => {
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
