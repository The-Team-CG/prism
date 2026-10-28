import { describe, expect, it } from 'vitest';
import { collectClientActionItems } from './event-read-models.inbox';

type Input = Parameters<typeof collectClientActionItems>[0];

describe('client action center', () => {
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
