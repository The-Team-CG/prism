import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectClientActionItems, collectPmcmCommandInboxItems } from './event-read-models.inbox';

type Input = Parameters<typeof collectClientActionItems>[0];

describe('client action center', () => {
  it('puts each addendum with whoever signs next, states the money before signing, and drops settled ones after two weeks', () => {
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
        { id: 'add_7', eventId: 'evt_gala', versionNumber: 7, title: 'Updated lighting plan', financialDelta: 48000, issuedAt: new Date('2026-11-05T00:00:00Z'), conformeExecution: { status: 'awaiting_client', completedAt: null } },
        { id: 'add_6', eventId: 'evt_gala', versionNumber: 6, title: 'Prior plan', financialDelta: 0, issuedAt: new Date('2026-11-04T00:00:00Z'), conformeExecution: { status: 'awaiting_pmcm', completedAt: null } },
        { id: 'add_5', eventId: 'evt_gala', versionNumber: 5, title: 'Fewer chairs', financialDelta: -5000, issuedAt: new Date('2026-11-01T00:00:00Z'), conformeExecution: { status: 'completed', completedAt: new Date('2026-11-03T00:00:00Z') } },
        { id: 'add_1', eventId: 'evt_gala', versionNumber: 1, title: 'Old change', financialDelta: 0, issuedAt: new Date('2026-09-01T00:00:00Z'), conformeExecution: { status: 'completed', completedAt: new Date('2026-09-02T00:00:00Z') } },
      ],
      now: new Date('2026-11-06T00:00:00Z'),
    });

    const addenda = items.filter((item) => item.kind === 'addendum');
    expect(addenda.map((item) => [item.id, item.stage])).toEqual(expect.arrayContaining([
      ['addendum:add_7', 'needs_client'],
      ['addendum:add_6', 'with_pmcm'],
      ['addendum:add_5', 'done'],
    ]));
    expect(addenda).toHaveLength(3);
    expect(addenda.find((item) => item.id === 'addendum:add_7')).toMatchObject({
      description: 'Takes effect once PMCM countersigns after you.',
      href: '/dashboard/events/evt_gala/overview#client-addendum-add_7',
      decision: { kind: 'addendum', addendumId: 'add_7', versionNumber: 7, financialDelta: 48000 },
    });
    expect(addenda.find((item) => item.id === 'addendum:add_5')?.decidedAt).toBe('2026-11-03T00:00:00.000Z');
  });

  it('keeps a scope change with PMCM while it is reviewed and shows PMCM\'s client answer once decided', () => {
    const items = collectClientActionItems({
      visibleEvents: [{ id: 'evt_gala', eventName: 'Founders gala', status: 'planning' }] as unknown as Input['visibleEvents'],
      briefings: [{ eventId: 'evt_gala' }] as unknown as Input['briefings'],
      documents: [], floorPlanDrafts: [], billingStatements: [], paymentMilestones: [], paymentRecords: [], postEventDocuments: [],
      scopeChanges: [
        { id: 'sc_1', eventId: 'evt_gala', title: 'Add a second registration desk', status: 'under_review', clientResponse: null, decidedAt: null },
        { id: 'sc_2', eventId: 'evt_gala', title: 'Move dinner outdoors', status: 'rejected', clientResponse: 'The garden is booked that night.', decidedAt: new Date('2026-11-05T00:00:00Z') },
      ],
      now: new Date('2026-11-06T00:00:00Z'),
    });
    expect(items.filter((item) => item.kind === 'change_request').map((item) => [item.stage, item.label, item.description])).toEqual(expect.arrayContaining([
      ['with_pmcm', 'Add a second registration desk', 'PMCM is reviewing your change request.'],
      ['to_review', 'Change not approved: Move dinner outdoors', 'PMCM: The garden is booked that night.'],
    ]));
  });

  it('lets only the primary contact decide on an issued proposal, then tracks the request or approval', () => {
    const event = { id: 'evt_gala', eventName: 'Founders gala', status: 'planning', clientName: 'Ana Reyes', inquiry: { email: 'ana@example.com' }, proposalRevisionCount: 1 };
    const sources = {
      briefings: [{ eventId: 'evt_gala' }] as unknown as Input['briefings'],
      documents: [{ id: 'doc_prop', eventId: 'evt_gala', type: 'proposal', status: 'issued', uploadedAt: new Date('2026-11-04T00:00:00Z') }] as unknown as Input['documents'],
      proposalVersions: [
        { eventId: 'evt_gala', versionNumber: 1, revisionNote: '', issuedAt: new Date('2026-10-01T00:00:00Z') },
        { eventId: 'evt_gala', versionNumber: 2, revisionNote: 'Moved dinner to 7 PM', issuedAt: new Date('2026-11-04T00:00:00Z') },
      ],
      floorPlanDrafts: [], billingStatements: [], paymentMilestones: [], paymentRecords: [], postEventDocuments: [],
    };
    const proposalItem = (overrides: Record<string, unknown>, actorEmail: string) => collectClientActionItems({
      ...sources,
      visibleEvents: [{ ...event, ...overrides }] as unknown as Input['visibleEvents'],
      actorEmail,
    }).find((item) => item.kind === 'approval');

    expect(proposalItem({}, 'ANA@example.com')).toMatchObject({
      stage: 'needs_client',
      label: 'Review proposal version 2',
      decision: { kind: 'proposal', versionNumber: 2, changeNote: 'Moved dinner to 7 PM', revisionsLeft: 2, decider: { name: 'Ana Reyes', isYou: true } },
    });
    expect(proposalItem({}, 'ben@example.com')).toMatchObject({ stage: 'to_review', decision: { decider: { isYou: false } } });
    expect(proposalItem({ proposalClientStatus: 'revision_requested' }, 'ana@example.com')).toMatchObject({ stage: 'with_pmcm', label: 'Proposal changes requested' });
    expect(proposalItem({ proposalClientStatus: 'approved', proposalReviewedAt: new Date('2026-11-05T00:00:00Z') }, 'ana@example.com')).toMatchObject({
      stage: 'done', label: 'Proposal approved', decidedAt: '2026-11-05T00:00:00.000Z',
    });
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
        assignedRole: 'Technical Coordinator', ownerName: 'Morgan Lee',
        blockedReason: 'Waiting for the venue power map.',
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

  it('turns a client revision request into PMCM work and sends waiting decisions to the event follow-ups', () => {
    const items = collectPmcmCommandInboxItems({
      inquiries: [],
      events: [{ id: 'evt_gala', eventName: 'Founders gala', eventDate: new Date('2026-12-10T09:00:00.000Z'), floorPlanStatus: 'approved', status: 'planning', clientName: 'Alex Client' }],
      paymentMilestones: [], quoteRequests: [], coordinatorAssignments: [], floorPlanDrafts: [], postEventDocuments: [],
      clientDecisions: {
        revisionRequests: [{ eventId: 'evt_gala', requestedAt: new Date('2026-11-05T00:00:00Z'), note: 'Fewer tables near the stage', areas: ['venue', 'budget'] }],
        proposalsAwaitingClient: [{ eventId: 'evt_gala', versionNumber: 2, issuedAt: new Date('2026-11-01T00:00:00Z') }],
        unsignedAddenda: [{ eventId: 'evt_gala', addendumId: 'add_3', versionNumber: 3, title: 'Extra guests', sentAt: new Date('2026-11-02T00:00:00Z') }],
      },
      now: new Date('2026-11-06T00:00:00Z'),
    });

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'proposal-revision:evt_gala', severity: 'attention', label: 'Client asked for proposal changes',
        description: 'Areas: Venue, Budget. “Fewer tables near the stage”', href: '/dashboard/events/evt_gala/briefing?part=proposal',
      }),
      expect.objectContaining({
        id: 'proposal-waiting:evt_gala', description: 'Version 2 sent 5 days ago with no answer. Send a follow-up.',
        href: '/dashboard/events/evt_gala/briefing?part=follow-ups',
      }),
      expect.objectContaining({ id: 'addendum-waiting:add_3', href: '/dashboard/events/evt_gala/briefing?part=follow-ups' }),
    ]));
  });
});
