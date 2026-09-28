// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismInquiry } from '@prism/types';
import { ConformeDraftReviewView } from './conforme-draft-review-view';

const viewModel = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../view-models/use-conforme-draft-review-view-model', () => ({
  useConformeDraftReviewViewModel: () => viewModel.current,
}));

afterEach(() => vi.clearAllMocks());

const inquiry = {
  id: 'inq_1',
  clientName: 'Ana Reyes',
  email: 'ana@example.test',
  eventName: 'Summit',
  status: 'accepted',
  conformeSentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  conformeSignedAt: null,
  lastConformeReminderAt: null,
} as PrismInquiry;

function model(status: string, overrides: Record<string, unknown> = {}) {
  viewModel.current = {
    status,
    draft: null,
    subject: '',
    body: '',
    errorMessage: null,
    setSubject: vi.fn(),
    setBody: vi.fn(),
    generate: vi.fn(),
    cancelGeneration: vi.fn(),
    startManualWriting: vi.fn(),
    cancelManualWriting: vi.fn(),
    saveManual: vi.fn(),
    approve: vi.fn(),
    cancelDraft: vi.fn(),
    ...overrides,
  };
}

describe('ConformeDraftReviewView', () => {
  it('offers retry and manual writing when AI generation is unavailable', () => {
    model('unavailable', { errorMessage: 'AI draft is unavailable.' });
    render(<ConformeDraftReviewView inquiries={[inquiry]} />);

    expect(screen.getByRole('alert').textContent).toContain('AI draft is unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry AI draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write manually' }));
    expect((viewModel.current.generate as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((viewModel.current.startManualWriting as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('shows generation progress from metadata without implying draft text is arriving token by token', () => {
    model('starting');
    const { rerender } = render(<ConformeDraftReviewView inquiries={[inquiry]} />);

    expect(screen.getByRole('status').textContent).toContain('Starting draft');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    model('generating');
    rerender(<ConformeDraftReviewView inquiries={[inquiry]} />);

    expect(screen.getByRole('status').textContent).toContain('Generating draft');
    expect(screen.getByRole('status').textContent).not.toMatch(/character|token/i);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((viewModel.current.cancelGeneration as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('offers manual writing and editable fields when no saved draft exists', () => {
    model('idle');
    const { rerender } = render(<ConformeDraftReviewView inquiries={[inquiry]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write manually' }));
    expect((viewModel.current.startManualWriting as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);

    model('editing');
    rerender(<ConformeDraftReviewView inquiries={[inquiry]} />);
    expect(screen.getByLabelText('Subject')).toBeTruthy();
    expect(screen.getByLabelText('Message')).toBeTruthy();
  });

  it('keeps approval and cancellation explicit while a validated draft is pending', () => {
    model('pending', {
      draft: {
        draftId: 'aia_1',
        inquiryId: 'inq_1',
        draft: { subject: 'Subject', body: 'Body' },
        status: 'pending_human_approval',
        source: 'ai',
        requestedAt: '2026-09-24T12:00:00.000Z',
        reviewedBy: null,
        reviewedAt: null,
        lastConformeReminderAt: null,
        reminderWindowBaseAt: inquiry.conformeSentAt!,
        requestId: 'req_1',
        modelVersion: 'mock',
      },
      subject: 'Subject',
      body: 'Body',
    });
    render(<ConformeDraftReviewView inquiries={[inquiry]} />);

    expect(screen.getByText(/canceling permanently rejects this draft for its reminder window/i)).toBeTruthy();
    expect(screen.getByDisplayValue('Subject')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Edited subject' } });
    expect((viewModel.current.setSubject as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('Edited subject');
    expect(screen.getByRole('button', { name: 'Cancel draft' }).getAttribute('aria-describedby'))
      .toBe('conforme-draft-cancel-warning');
    fireEvent.click(screen.getByRole('button', { name: 'Approve and queue for delivery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel draft' }));
    expect((viewModel.current.approve as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((viewModel.current.cancelDraft as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('allows a new reminder window after a prior draft was approved', () => {
    const priorWindow = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    model('approved', {
      draft: {
        draftId: 'aia_1', inquiryId: 'inq_1', draft: { subject: 'Subject', body: 'Body' },
        status: 'approved', source: 'ai', requestedAt: priorWindow, reviewedBy: 'PMCM', reviewedAt: priorWindow,
        lastConformeReminderAt: priorWindow, reminderWindowBaseAt: priorWindow, requestId: 'req_1', modelVersion: 'mock',
      },
    });
    render(<ConformeDraftReviewView inquiries={[{
      ...inquiry,
      conformeSentAt: priorWindow,
      lastConformeReminderAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    } as PrismInquiry]} />);

    expect(screen.getByRole('button', { name: 'Generate AI draft' })).toBeTruthy();
    expect(screen.getByText('Previous reminder draft was approved')).toBeTruthy();
  });
});
