import { describe, expect, it } from 'vitest';
import { savePaymentDetailsSchema, type PaymentMethod } from '@prism/types';
import { describePaymentDetailsChange, parseStoredMethods, qrImageProblem, referencedQrImageIds } from './payment-details.policy';

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const bpi: PaymentMethod = { kind: 'bank', id: ID(1), label: 'BPI', accountName: 'PMCM Events Management', accountNumber: '1234-5678-90', instructions: '', qrImageId: null, enabled: true };
const gcash: PaymentMethod = { kind: 'ewallet', id: ID(2), label: 'GCash', accountName: 'PMCM Finance', accountNumber: '0917 123 4567', instructions: 'Send as Express Send', qrImageId: 'pqr_a', enabled: true };
const cheque: PaymentMethod = { kind: 'cheque', id: ID(3), label: 'Cheque', accountName: 'PMCM Events Management', instructions: '', enabled: true };

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

describe('payment details rules', () => {
  it('accepts a payment QR only when its bytes are a PNG or JPEG of the type declared, within 1 MB', () => {
    expect(qrImageProblem(png, 'image/png')).toBeNull();
    expect(qrImageProblem(jpeg, 'image/jpeg; charset=binary')).toBeNull();
    expect(qrImageProblem(jpeg, 'image/png')).toBe('The QR image type does not match its content');
    expect(qrImageProblem(Uint8Array.from([0x47, 0x49, 0x46, 0x38]), 'image/png')).toBe('The QR image must be a PNG or JPEG');
    expect(qrImageProblem(new Uint8Array(0), 'image/png')).toBe('The QR image is empty');
    expect(qrImageProblem(new Uint8Array(1024 * 1024 + 1).fill(0xff), 'image/jpeg')).toBe('The QR image must be 1 MB or smaller');
  });

  it('describes a save in words that never include an account number, and says nothing when nothing changed', () => {
    expect(describePaymentDetailsChange([bpi, gcash], [bpi, gcash])).toEqual([]);

    const changes = describePaymentDetailsChange(
      [bpi, gcash],
      [{ ...bpi, accountNumber: '9999-0000-11', enabled: false }, { ...gcash, qrImageId: null }, cheque],
    );
    expect(changes).toEqual([
      'Added Cheque',
      'Turned off BPI',
      'Changed the account number of BPI',
      'Removed the QR of GCash',
    ]);
    expect(changes.join(' ')).not.toMatch(/\d{4}/);
    expect(describePaymentDetailsChange([bpi, gcash], [gcash, bpi])).toEqual(['Reordered the payment methods']);
    expect(describePaymentDetailsChange([bpi, gcash], [bpi])).toEqual(['Removed GCash']);
  });

  it('lists the QR images a save points at and drops stored methods that no longer parse', () => {
    expect(referencedQrImageIds([bpi, gcash, { ...bpi, id: ID(4), qrImageId: 'pqr_a' }, cheque])).toEqual(['pqr_a']);
    expect(parseStoredMethods([gcash, { kind: 'bank', id: 'not-a-uuid' }, 'junk'])).toEqual([gcash]);
    expect(parseStoredMethods(null)).toEqual([]);
  });

  it('refuses a save with repeated ids, nothing turned on, or too many methods, and takes an empty list', () => {
    const issue = (methods: PaymentMethod[]) => savePaymentDetailsSchema.safeParse({ expectedRevision: 0, methods });
    expect(issue([bpi, gcash, cheque]).success).toBe(true);
    expect(issue([]).success).toBe(true);
    expect(issue([bpi, { ...gcash, id: bpi.id }]).error?.issues[0]?.message).toBe('Each payment method needs its own id');
    expect(issue([{ ...bpi, enabled: false }]).error?.issues[0]?.message).toBe('Keep at least one payment method turned on');
    expect(issue(Array.from({ length: 9 }, (_, index) => ({ ...bpi, id: `00000000-0000-4000-8000-0000000001${index}` }))).success).toBe(false);
    expect(savePaymentDetailsSchema.safeParse({ expectedRevision: 0, methods: [{ ...cheque, accountNumber: '123' }] }).success).toBe(false);
  });
});
