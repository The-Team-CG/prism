import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PrismClientActionCenter } from '@prism/types';
import { selectClientAccountActions, selectClientDashboardActions } from '../../../workspace/model/client-dashboard-selectors';
import { ClientHomeActionCenter } from './client-home-sections';

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
      actionCenter: center, clientActions: actions, runClientAction: vi.fn(), todayKey: '2026-10-19',
    }));
    expect(markup).toContain('First event');
    expect(markup).toContain('Second event');
    expect(actions.map((action) => action.href)).toEqual([
      '/dashboard/events/evt_one/briefing', '/dashboard/events/evt_two/briefing',
    ]);
  });

  it('groups the client actions by event and keeps current blockers apart from later requirements', () => {
    const base = loaded.items[0];
    const center: PrismClientActionCenter = {
      ...loaded,
      items: [
        { ...base, id: 'closure:evt_one', kind: 'closure', priority: 'info', label: 'Upload signed venue permit', eventId: 'evt_one', eventName: 'First event' },
        { ...base, id: 'billing:evt_one', kind: 'billing', priority: 'critical', label: 'Pay the deposit', eventId: 'evt_one', eventName: 'First event' },
        { ...base, id: 'briefing:evt_two', eventId: 'evt_two', eventName: 'Second event' },
      ],
    };
    const markup = renderToStaticMarkup(createElement(ClientHomeActionCenter, {
      actionCenter: center, clientActions: selectClientAccountActions(center), runClientAction: vi.fn(), todayKey: '2026-10-19',
    }));
    const headings = [...markup.matchAll(/<h2[^>]*>(Needs your action[^<]*)</g)].map((match) => match[1]);
    expect(headings).toEqual(['Needs your action · First event', 'Needs your action · Second event']);
    expect(markup.indexOf('Pay the deposit')).toBeLessThan(markup.indexOf('Upload signed venue permit'));
  });

  it('renders the empty state when the loaded action center has nothing for the selected event', () => {
    const markup = renderToStaticMarkup(createElement(ClientHomeActionCenter, {
      actionCenter: loaded,
      clientActions: selectClientDashboardActions(loaded, 'evt_selected'),
      runClientAction: vi.fn(), todayKey: '2026-10-19',
    }));

    expect(markup).toContain('all caught up');
    expect(markup).not.toContain('Needs your action');
  });

  it('lists next required actions without the empty state or empty groups', () => {
    const markup = renderToStaticMarkup(createElement(ClientHomeActionCenter, {
      actionCenter: loaded,
      clientActions: selectClientDashboardActions(loaded, 'evt_other'),
      runClientAction: vi.fn(), todayKey: '2026-10-19',
    }));

    expect(markup).toContain('Complete event briefing');
    expect(markup).toContain('Needs your action');
    expect(markup).not.toContain('Waiting for PMCM');
    expect(markup).not.toContain('New to review');
    expect(markup).not.toContain('all caught up');
  });
});
