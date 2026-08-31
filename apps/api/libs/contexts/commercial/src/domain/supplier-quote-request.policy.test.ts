import { describe, expect, it } from 'vitest';
import { SupplierQuoteRequestStatus, SupplierQuoteStatus } from '@prism/modules/event-core';
import {
  isSupplierQuoteLocked,
  isSupplierQuoteRequestClosed,
  resolveExpiredQuoteRequestStatus,
} from './supplier-quote-request.policy';

describe('isSupplierQuoteRequestClosed', () => {
  it('treats Selected, Closed, and Expired as closed', () => {
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.Selected)).toBe(true);
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.Closed)).toBe(true);
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.Expired)).toBe(true);
  });

  it('treats Open, Submitted, RevisionRequested, and Revised as still active', () => {
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.Open)).toBe(false);
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.Submitted)).toBe(false);
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.RevisionRequested)).toBe(false);
    expect(isSupplierQuoteRequestClosed(SupplierQuoteRequestStatus.Revised)).toBe(false);
  });

  it('treats an unrecognized status as not closed', () => {
    expect(isSupplierQuoteRequestClosed('made-up-status')).toBe(false);
  });
});

describe('isSupplierQuoteLocked', () => {
  it('treats Selected and Locked as locked', () => {
    expect(isSupplierQuoteLocked(SupplierQuoteStatus.Selected)).toBe(true);
    expect(isSupplierQuoteLocked(SupplierQuoteStatus.Locked)).toBe(true);
  });

  it('treats Received, Revised, and NotSelected as not locked', () => {
    expect(isSupplierQuoteLocked(SupplierQuoteStatus.Received)).toBe(false);
    expect(isSupplierQuoteLocked(SupplierQuoteStatus.Revised)).toBe(false);
    expect(isSupplierQuoteLocked(SupplierQuoteStatus.NotSelected)).toBe(false);
  });
});

describe('resolveExpiredQuoteRequestStatus', () => {
  it('expires an Open request whose due date has passed', () => {
    const status = resolveExpiredQuoteRequestStatus({
      status: SupplierQuoteRequestStatus.Open,
      dueDate: new Date(Date.now() - 1000),
    });
    expect(status).toBe(SupplierQuoteRequestStatus.Expired);
  });

  it('expires a RevisionRequested request whose due date has passed', () => {
    const status = resolveExpiredQuoteRequestStatus({
      status: SupplierQuoteRequestStatus.RevisionRequested,
      dueDate: new Date(Date.now() - 1000),
    });
    expect(status).toBe(SupplierQuoteRequestStatus.Expired);
  });

  it('does not expire a request with no due date', () => {
    const status = resolveExpiredQuoteRequestStatus({
      status: SupplierQuoteRequestStatus.Open,
      dueDate: null,
    });
    expect(status).toBe(SupplierQuoteRequestStatus.Open);
  });

  it('does not expire a request whose due date is in the future', () => {
    const status = resolveExpiredQuoteRequestStatus({
      status: SupplierQuoteRequestStatus.Open,
      dueDate: new Date(Date.now() + 100_000),
    });
    expect(status).toBe(SupplierQuoteRequestStatus.Open);
  });

  it('does not expire a request already Selected, Closed, or Submitted', () => {
    expect(
      resolveExpiredQuoteRequestStatus({ status: SupplierQuoteRequestStatus.Selected, dueDate: new Date(Date.now() - 1000) }),
    ).toBe(SupplierQuoteRequestStatus.Selected);
    expect(
      resolveExpiredQuoteRequestStatus({ status: SupplierQuoteRequestStatus.Submitted, dueDate: new Date(Date.now() - 1000) }),
    ).toBe(SupplierQuoteRequestStatus.Submitted);
  });
});
