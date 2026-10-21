import { describe, expect, it } from 'vitest';
import { EventContextAgent } from './event-context.agent';

describe('EventContextAgent', () => {
  it('projects an owner read model into the PARE context', async () => {
    const agent = new EventContextAgent();
    const context = await agent.buildPareEventContext('request-1', {
      request: {
        id: 'request-1',
        eventId: 'event-1',
        assignmentStatus: 'withdrawn',
        supplierId: 'supplier-1',
        supplierName: 'Supplier One',
        category: 'catering',
        supplierTier: 'tier_1',
      },
      event: {
        id: 'event-1',
        eventDate: new Date('2030-01-01T00:00:00.000Z'),
        eventName: 'Synthetic Event',
        clientName: 'Synthetic Client',
      },
      selectedQuotes: [
        { amount: 250, requestId: 'request-1' },
        { amount: 100, requestId: 'request-other' },
      ],
      latestBriefingRequirements: ['Halal meal'],
    });

    expect(context).toMatchObject({
      triggerId: 'request-1',
      eventId: 'event-1',
      spentBudget: 350,
      withdrawnSupplier: { id: 'supplier-1', tier: 'tier_1', quotedAmount: 250 },
    });
    expect(context.clientPreferences).toEqual(['Halal meal']);
  });

  it('fails closed when a source request belongs to a different event', async () => {
    const agent = new EventContextAgent();
    await expect(agent.buildPareEventContext('request-1', {
      request: { id: 'request-1', eventId: 'event-a', assignmentStatus: 'withdrawn', supplierId: null, supplierName: 'Supplier', category: 'catering', supplierTier: null },
      event: { id: 'event-b', eventDate: new Date('2030-01-01T00:00:00.000Z'), eventName: 'Event', clientName: 'Client' },
      selectedQuotes: [],
      latestBriefingRequirements: null,
    })).rejects.toThrow('no matching event source');
  });
});
