import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConformeBillingService } from './conforme-billing.service';

function fixture(options: { proposals?: Record<string, { versionNumber: number; title: string; totalAmount: number; alternativeTotalAmount: number | null } | null>; billedEventIds?: string[] } = {}) {
  const proposals = options.proposals ?? { evt_1: { versionNumber: 2, title: 'Gala full service', totalAmount: 500_000, alternativeTotalAmount: null } };
  const prisma = {
    opsEvent: { findMany: vi.fn(async () => Object.keys(proposals).map((id) => ({ id }))) },
    opsBillingSource: { findMany: vi.fn(async () => (options.billedEventIds ?? []).map((eventId) => ({ eventId }))) },
    opsProposalVersion: { findFirst: vi.fn(async ({ where }: { where: { eventId: string } }) => proposals[where.eventId] ?? null) },
  };
  const billing = {
    createBillingSource: vi.fn(async (eventId: string) => ({ id: `src_${eventId}` })),
    approveBillingSource: vi.fn(async () => ({})),
    generateBillingStatement: vi.fn(async (eventId: string) => ({ id: `bill_${eventId}` })),
  };
  const audits: unknown[] = [];
  const service = new ConformeBillingService(prisma as never, billing as never, { write: vi.fn(async (entry: unknown) => audits.push(entry)) } as never);
  return { service, prisma, billing, audits };
}

describe('ConformeBillingService (UAT 5.3)', () => {
  it('issues the billing statement from the approved proposal on 50% down / balance terms after the conforme', async () => {
    const { service, billing } = fixture();

    await expect(service.issuePending()).resolves.toEqual([{ eventId: 'evt_1', status: 'issued', statementId: 'bill_evt_1' }]);

    expect(billing.createBillingSource).toHaveBeenCalledWith('evt_1', expect.objectContaining({
      sourceLabel: 'Approved proposal v2',
      lineItems: [{ label: 'Gala full service', amount: 500_000 }],
      paymentSchedule: [{ label: 'Downpayment (50%)', percentage: 50 }, { label: 'Balance', percentage: 50 }],
      paymentTermsPolicy: 'standard',
    }), expect.objectContaining({ role: 'system' }));
    expect(billing.approveBillingSource).toHaveBeenCalledWith('evt_1', 'src_evt_1', expect.anything(), expect.anything());
    expect(billing.generateBillingStatement).toHaveBeenCalledWith('evt_1', 'src_evt_1', expect.anything(), expect.objectContaining({ actorRole: 'system' }), 'conforme-billing-statement:evt_1');

    // Tried once per event: the next sweep leaves it alone.
    await expect(service.issuePending()).resolves.toEqual([]);
    expect(billing.createBillingSource).toHaveBeenCalledOnce();
  });

  it('leaves billing to PMCM for an event already billed, a two-package proposal, or missing payment details', async () => {
    const billed = fixture({ billedEventIds: ['evt_1'] });
    await expect(billed.service.issuePending()).resolves.toEqual([]);
    expect(billed.billing.createBillingSource).not.toHaveBeenCalled();

    const twoPackages = fixture({ proposals: { evt_2: { versionNumber: 1, title: 'Options', totalAmount: 300_000, alternativeTotalAmount: 250_000 } } });
    await expect(twoPackages.service.issuePending()).resolves.toEqual([{ eventId: 'evt_2', status: 'skipped', reason: 'two_packages' }]);
    expect(twoPackages.billing.createBillingSource).not.toHaveBeenCalled();
    expect(twoPackages.audits).toHaveLength(1);

    const noDetails = fixture();
    noDetails.billing.generateBillingStatement.mockRejectedValueOnce(new ConflictException('Add PMCM payment details in Finance > Payment details before issuing a statement.'));
    await expect(noDetails.service.issuePending()).resolves.toEqual([{ eventId: 'evt_1', status: 'failed', reason: expect.stringContaining('payment details') }]);
    expect(noDetails.audits).toHaveLength(1);
  });
});
