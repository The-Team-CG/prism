import { describe, expect, it } from 'vitest';
import { buildSupplierAssignmentNotice } from './supplier-assignment-notice';

const base = {
  eventName: 'Summit',
  eventDate: new Date('2026-10-01T00:00:00.000Z'),
  category: 'Technicals',
  amount: 180000,
  inclusions: ['LED wall', ' Sound system ', '', 42],
  paymentTerms: '50/50',
  ingress: null,
};

describe('buildSupplierAssignmentNotice', () => {
  it('states the quoted deliverables, payment terms and that ingress is still to come', () => {
    const notice = buildSupplierAssignmentNotice(base);
    expect(notice).toContain('selected for Summit on 2026-10-01 (Technicals)');
    expect(notice).toContain('Deliverables: LED wall; Sound system.');
    expect(notice).toContain('Ingress: PMCM will send your ingress schedule separately.');
    expect(notice).toContain('Agreed amount: PHP 180,000. Payment terms: 50/50.');
  });

  it('shows the ingress and egress window in Philippine time with the location', () => {
    const notice = buildSupplierAssignmentNotice({
      ...base,
      ingress: { ingressAt: new Date('2026-09-30T22:00:00.000Z'), egressAt: new Date('2026-10-01T14:00:00.000Z'), location: 'Dock B' },
    });
    expect(notice).toMatch(/Ingress: Oct 1, 2026, 6:00 am to egress Oct 1, 2026, 10:00 pm \(Philippine time\), Dock B\./i);
  });

  it('falls back sensibly when the quote has no deliverables or payment terms', () => {
    const notice = buildSupplierAssignmentNotice({ ...base, inclusions: null, paymentTerms: '  ' });
    expect(notice).toContain('Deliverables: as stated in your submitted quote.');
    expect(notice).toContain('Payment terms: to be confirmed by PMCM.');
  });
});
