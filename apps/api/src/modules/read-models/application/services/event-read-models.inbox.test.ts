import { describe, expect, it } from 'vitest';
import { collectClientActionItems } from './event-read-models.inbox';

type Input = Parameters<typeof collectClientActionItems>[0];

describe('client action center', () => {
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
