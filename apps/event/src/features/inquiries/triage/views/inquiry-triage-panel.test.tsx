/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InquiryTriagePanel } from './inquiry-triage-panel';

const repo = vi.hoisted(() => ({ latest: vi.fn(), run: vi.fn() }));
vi.mock('../data/inquiry-triage-repository', () => ({ inquiryTriageRepository: repo }));

afterEach(cleanup);

const REVIEW = {
  reviewId: 'r1',
  inquiryId: 'inq_1',
  result: {
    fit: 'high',
    summary: 'A clear corporate request.',
    signals: ['Referred by a past client'],
    risks: ['Guest count is not stated'],
    suggestedAction: 'request_more_info',
    suggestedQuestions: ['How many guests?'],
  },
  requestedAt: '2026-11-06T01:00:00.000Z',
  requestedBy: 'PMCM',
  requestId: 'req_1',
  modelVersion: 'claude-sonnet-5-5',
};

beforeEach(() => {
  repo.latest.mockResolvedValue(null);
  repo.run.mockResolvedValue(REVIEW);
});

describe('InquiryTriagePanel', () => {
  it('asks for advice only on request and shows fit, action, risks and questions', async () => {
    render(<InquiryTriagePanel inquiryId="inq_1" />);
    await screen.findByText(/second opinion/i);
    expect(repo.run).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Get advice' }));

    await screen.findByText('Strong fit · Ask the client for more detail');
    expect(repo.run).toHaveBeenCalledWith('inq_1');
    expect(screen.getByText('A clear corporate request.')).toBeTruthy();
    expect(screen.getByText('Guest count is not stated')).toBeTruthy();
    expect(screen.getByText('How many guests?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh advice' })).toBeTruthy();
  });

  it('shows saved advice immediately without a provider call', async () => {
    repo.latest.mockResolvedValue(REVIEW);
    render(<InquiryTriagePanel inquiryId="inq_1" />);
    await screen.findByText('Strong fit · Ask the client for more detail');
    expect(repo.run).not.toHaveBeenCalled();
  });

  it('keeps the previous advice visible and explains a failed refresh', async () => {
    repo.latest.mockResolvedValue(REVIEW);
    repo.run.mockRejectedValue(new Error('AI drafting is not available: no AI provider is configured.'));
    render(<InquiryTriagePanel inquiryId="inq_1" />);
    await screen.findByText('A clear corporate request.');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh advice' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no AI provider is configured'));
    expect(screen.getByText('A clear corporate request.')).toBeTruthy();
  });
});
