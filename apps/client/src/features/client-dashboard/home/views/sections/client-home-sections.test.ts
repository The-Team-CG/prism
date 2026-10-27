import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PrismClientActionCenter } from '@prism/types';
import { selectClientAccountActions, selectClientDashboardActions } from '../../../workspace/model/client-dashboard-selectors';
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

  it('shows actions from each event with their event names and destinations', () => {
    const center: PrismClientActionCenter = {
      ...loaded,
      items: [
        { ...loaded.items[0], eventId: 'evt_one', eventName: 'First event', href: '/dashboard/events/evt_one/briefing' },
        { ...loaded.items[0], id: 'briefing:evt_two', eventId: 'evt_two', eventName: 'Second event', href: '/dashboard/events/evt_two/briefing' },
      ],
    };
    const actions = selectClientAccountActions(center);
    const markup = renderToStaticMarkup(createElement(ClientHomeActionCenter, {
      actionCenter: center, clientActions: actions, runClientAction: vi.fn(),
    }));
    expect(markup).toContain('First event');
    expect(markup).toContain('Second event');
    expect(actions.map((action) => action.href)).toEqual([
      '/dashboard/events/evt_one/briefing', '/dashboard/events/evt_two/briefing',
    ]);
  });

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
    expect(markup).toContain('Event updates');
    expect(markup).not.toContain('Waiting on PMCM');
    expect(markup).not.toContain('No pending actions');
  });
});
