import { describe, expect, it } from 'vitest';
import type { PrismStatementOfAccount } from '@prism/types';
import { renderBillingStatementPdf, renderPaymentReceiptPdf, renderStatementOfAccountPdf } from './billing-documents';

/** A well-formed PDF: header, an xref table whose offsets point at each object, and a trailer pointing at the xref. */
function expectWellFormed(pdf: Buffer) {
  const text = pdf.toString('latin1');
  expect(text.startsWith('%PDF-1.4\n')).toBe(true);
  const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  expect(text.slice(startxref, startxref + 4)).toBe('xref');
  const offsets = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
  offsets.forEach((offset, index) => expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
  return text;
}

const statement = (overrides: Partial<PrismStatementOfAccount> = {}): PrismStatementOfAccount => ({
  eventId: 'evt', eventName: 'UAT Live Ops Event', generatedAt: '', available: true, statementNumber: 'BS-2026-0003', billed: 420000, received: 270000, refunded: 0,
  creditHeld: 0, balance: 150000, disputedOnStatement: 0, paymentMethods: [{ label: 'BPI', details: 'PMCM Events Inc. · Account 0123' }], submissions: [],
  milestones: [
    { id: 'm1', label: 'Downpayment', dueDate: '2026-09-26', amount: 210000, paid: 210000, remaining: 0, status: 'paid', checking: 0, disputed: 0, settledOn: '2026-09-25' },
    { id: 'm2', label: 'Second payment', dueDate: '2026-10-19', amount: 126000, paid: 60000, remaining: 66000, status: 'partially_paid', checking: 60000, disputed: 0, settledOn: null },
  ],
  lines: [
    { id: 'r1', date: '2026-09-25', kind: 'payment', description: 'Payment received', method: 'Bank Transfer', reference: 'BPI-1', amount: 210000, reversed: false },
    { id: 'r2', date: '2026-10-01', kind: 'payment', description: 'Payment received, later reversed by PMCM', method: 'Cheque', reference: 'CHQ-9', amount: 5000, reversed: true },
  ],
  ...overrides,
});

describe('billing documents', () => {
  it('prints a billing statement with what is billed, the schedule and how to pay, in pesos written out', () => {
    const text = expectWellFormed(renderBillingStatementPdf({
      number: 'BS-2026-0004', issuedOn: '2026-11-01T00:00:00.000Z', clientName: 'Ana Reyes', clientContact: 'ana@ayala.test', eventName: 'Operations (Booking)', eventDate: '2026-11-23',
      lineItems: [{ label: 'Registration and badging', amount: 485000 }], schedule: [{ label: 'Downpayment', percentage: 50, amount: 432500, dueDate: '2026-11-18' }],
      methods: [{ label: 'GCash', details: '0917 555 0100' }], total: 865000,
    }));

    for (const piece of ['BILLING STATEMENT', 'BS-2026-0004', 'Registration and badging', 'PHP 485,000', 'PHP 865,000', 'Nov 18, 2026', 'How to pay', 'Write BS-2026-0004 as the payment reference']) expect(text).toContain(piece);
    // Parentheses are escaped inside PDF strings, and the peso sign never reaches a font that cannot draw it.
    expect(text).toContain(String.raw`Operations \(Booking\)`);
    expect(text).not.toContain('₱');
  });

  it('marks each payment on the statement of account, leaves undone payments out of the totals, and asks how to pay while money is owed', () => {
    const text = expectWellFormed(renderStatementOfAccountPdf({ statement: statement(), clientName: 'Ana Reyes', eventDate: '2026-10-26', today: '2026-11-14' }));

    for (const piece of ['STATEMENT OF ACCOUNT', 'PAID SEP 25, 2026', 'OVERDUE', 'Balance due', 'PHP 150,000', String.raw`\(not counted\)`, 'How to pay']) expect(text).toContain(piece);
    expect(text).not.toContain('PAID IN FULL');
    expect(text).toContain(String.raw`\267`); // the middle dot, as its WinAnsi code
  });

  it('stamps a statement paid in full and drops the payment instructions', () => {
    const settled = statement({ balance: 0, milestones: [
      { id: 'm1', label: 'Downpayment', dueDate: '2026-09-26', amount: 210000, paid: 210000, remaining: 0, status: 'paid', checking: 0, disputed: 0, settledOn: '2026-10-13' },
      { id: 'm2', label: 'Balance', dueDate: '2026-10-26', amount: 210000, paid: 210000, remaining: 0, status: 'paid', checking: 50000, disputed: 0, settledOn: '2026-10-20' },
    ] });
    const text = expectWellFormed(renderStatementOfAccountPdf({ statement: settled, clientName: 'Ana Reyes', eventDate: null, today: '2026-11-14' }));

    expect(text).toContain('PAID IN FULL');
    // Money settled but not yet checked by PMCM says so.
    expect(text).toContain('BEING CHECKED');
    expect(text).not.toContain('How to pay');
  });

  it('carries a long payment history onto more pages, repeating the table header', () => {
    const lines = Array.from({ length: 60 }, (_, index) => ({ id: `r${index}`, date: '2026-10-01', kind: 'payment' as const, description: 'Payment received', method: 'GCash', reference: `GC-${index}`, amount: 1000, reversed: false }));
    const text = expectWellFormed(renderStatementOfAccountPdf({ statement: statement({ lines }), clientName: 'Ana Reyes', eventDate: null, today: '2026-11-14' }));

    expect(Number(text.match(/\/Count (\d+)/)?.[1])).toBeGreaterThan(1);
    expect(text.match(/\(ENTRY\) Tj/g)?.length).toBeGreaterThan(1);
  });

  it('prints a receipt for one payment with its amount, what it was for and how it arrived', () => {
    const text = expectWellFormed(renderPaymentReceiptPdf({
      receiptNumber: 'R-1A2B3C4D', clientName: 'Ana Reyes', eventName: 'UAT Live Ops Event', statementNumber: 'BS-2026-0003', paymentLabel: 'Downpayment',
      amount: 210000, paidOn: '2026-09-25', method: 'Bank Transfer', reference: 'BPI-0925-7710', recordedOn: '2026-09-25T08:00:00.000Z',
    }));

    for (const piece of ['PAYMENT RECEIPT', 'R-1A2B3C4D', 'PHP 210,000', 'Downpayment', 'BPI-0925-7710', 'RECEIVED']) expect(text).toContain(piece);
  });
});
