import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClientHomeGreeting } from './client-home-sections';

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
