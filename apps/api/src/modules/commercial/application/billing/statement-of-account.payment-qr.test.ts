import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentMethod, PrismStatementOfAccount, PrismVerifiedEventActor } from '@prism/types';
import { StatementOfAccountService } from './statement-of-account.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const actor = { id: 'client-1', role: 'client' } as unknown as PrismVerifiedEventActor;

const gcash: PaymentMethod = { kind: 'ewallet', id: '00000000-0000-4000-8000-000000000002', label: 'GCash', accountName: 'PMCM Finance', accountNumber: '0917 123 4567', instructions: '', qrImageId: 'pqr_shown', enabled: true };
const bpi: PaymentMethod = { kind: 'bank', id: '00000000-0000-4000-8000-000000000001', label: 'BPI', accountName: 'PMCM Events', accountNumber: '1234', instructions: '', qrImageId: null, enabled: true };

const statementWith = (overrides: Partial<PrismStatementOfAccount>) => ({ available: true, payTo: [bpi, gcash], ...overrides }) as PrismStatementOfAccount;

function setup(statement: PrismStatementOfAccount | Error) {
  const findUnique = vi.fn(async () => ({ bytes: new Uint8Array(PNG), contentType: 'image/png' }));
  const service = new StatementOfAccountService({ opsPmcmPaymentQrImage: { findUnique } } as never, {} as never);
  const statementFor = vi.spyOn(service, 'statementFor');
  if (statement instanceof Error) statementFor.mockRejectedValue(statement);
  else statementFor.mockResolvedValue(statement);
  return { service, findUnique, statementFor };
}

describe('the payment QR a client scans', () => {
  it("serves an image the client's own statement shows, going through the same checks as the statement", async () => {
    const { service, findUnique, statementFor } = setup(statementWith({}));

    const image = await service.paymentQr('evt_1', 'pqr_shown', actor);

    expect(statementFor).toHaveBeenCalledWith('evt_1', actor);
    expect(image.contentType).toBe('image/png');
    expect(image.bytes.equals(PNG)).toBe(true);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pqr_shown' } }));
  });

  it('serves nothing for an image no turned-on method shows any more, or before the statement is sent, without reading the image', async () => {
    const stale = setup(statementWith({}));
    await expect(stale.service.paymentQr('evt_1', 'pqr_old', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(stale.findUnique).not.toHaveBeenCalled();

    // A statement the client cannot see yet has no methods to show, so even a real image id is not found.
    const unsent = setup(statementWith({ available: false, payTo: [] }));
    await expect(unsent.service.paymentQr('evt_1', 'pqr_shown', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(unsent.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a client who may not see this event's statement, without reading the image", async () => {
    const { service, findUnique } = setup(new ForbiddenException('Client cannot access this event'));

    await expect(service.paymentQr('evt_other', 'pqr_shown', actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
