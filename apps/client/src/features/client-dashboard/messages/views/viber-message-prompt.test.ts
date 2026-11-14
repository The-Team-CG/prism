/** @vitest-environment jsdom */
import { createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismNotificationPreferences } from '@prism/types';
import { ViberMessagePrompt } from '@prism/ui/chat';

afterEach(cleanup);
const preferences: PrismNotificationPreferences = { email: 'ana@example.test', emailDelivery: 'captured', viberConfigured: true, viberLinked: false, viberEnabled: false, viberLinkedAt: null };

describe('Viber prompt in Messages', () => {
  it('offers the existing linking flow only when configured and needs attention', async () => {
    const mine = vi.fn().mockResolvedValue(preferences);
    const view = render(createElement(ViberMessagePrompt, { actions: { mine }, href: '/dashboard/notifications#viber-settings' }));
    const link = await screen.findByRole('link', { name: 'Get replies on Viber' });
    expect(link.getAttribute('href')).toBe('/dashboard/notifications#viber-settings');
    expect(screen.getByText('Get message notices on Viber. Reply here in PRISM.')).toBeTruthy();
    view.rerender(createElement(ViberMessagePrompt, { actions: { mine: async () => ({ ...preferences, viberLinked: true }) }, href: '/settings' }));
    await screen.findByRole('link', { name: 'Turn on Viber updates' });
    view.rerender(createElement(ViberMessagePrompt, { actions: { mine: async () => ({ ...preferences, viberLinked: true, viberEnabled: true }) }, href: '/settings' }));
    await waitFor(() => expect(screen.queryByRole('link')).toBeNull());
  });

  it('shows no linking affordance while unavailable or preferences fail to load', async () => {
    const mine = vi.fn().mockResolvedValue({ ...preferences, viberConfigured: false });
    const view = render(createElement(ViberMessagePrompt, { actions: { mine }, href: '/settings' }));
    await waitFor(() => expect(mine).toHaveBeenCalledOnce());
    expect(screen.queryByRole('link')).toBeNull();
    view.rerender(createElement(ViberMessagePrompt, { actions: { mine: async () => { throw new Error('offline'); } }, href: '/settings' }));
    await waitFor(() => expect(screen.queryByRole('link')).toBeNull());
  });
});
