import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PrismClientActionCenter } from '@prism/types';
import { selectClientDashboardActions } from '../../../workspace/model/client-dashboard-selectors';
import { ClientHomeActionCenter, ClientHomeGreeting } from './client-home-sections';

describe('ClientHomeGreeting', () => {
  it('keeps the conforme review entry visible when the client already has events', () => {
    const markup = renderToStaticMarkup(createElement(ClientHomeGreeting, {
      sessionName: 'Client',
      eventCount: 2,
      daysToEvent: null,
      onRequest: vi.fn(),
      onEvents: vi.fn(),
      onReviewConforme: vi.fn(),
    }));

    expect(markup).toContain('My events');
    expect(markup).toContain('Review conforme');
  });
});

describe('ClientHomeActionCenter', () => {
  const loaded: PrismClientActionCenter = {
    generatedAt: '2026-10-19T00:00:00.000Z',
    counts: { critical: 0, warning: 0, attention: 1, info: 0 },
    items: [{ id: 'briefing:evt_other', kind: 'briefing', priority: 'attention', label: 'Complete event briefing', description: '', status: 'missing', eventId: 'evt_other', eventName: 'Other' }],
  };

  it('renders the empty state when the loaded action center has nothing for the selected event', () => {
    const markup = renderToStaticMarkup(createElement(ClientHomeActionCenter, {
      actionCenter: loaded,
      clientActions: selectClientDashboardActions(loaded, 'evt_selected'),
      runClientAction: vi.fn(),
    }));

    expect(markup).toContain('Action center');
    expect(markup).toContain('No pending actions');
    expect(markup).not.toContain('Needs your action');
  });

  it('lists next required actions without the empty state or empty groups', () => {
    const markup = renderToStaticMarkup(createElement(ClientHomeActionCenter, {
      actionCenter: loaded,
      clientActions: selectClientDashboardActions(loaded, 'evt_other'),
      runClientAction: vi.fn(),
    }));

    expect(markup).toContain('Complete event briefing');
    expect(markup).toContain('Needs your action');
    expect(markup).not.toContain('Waiting on PMCM');
    expect(markup).not.toContain('No pending actions');
  });
});
