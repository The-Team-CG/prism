import type { Prisma } from '@prisma/client';
import type { PaymentMethod } from '@prism/types';
import { parseStoredMethods } from '../../domain/payment-details.policy';

/** The row's id: PMCM has one set of payment details. */
const ROW_ID = 'pmcm';

export interface LivePaymentDetails {
  /** 0 until PMCM saves anything. */
  revision: number;
  /** Only the methods turned on, in the order PMCM set. */
  methods: PaymentMethod[];
}

/** What clients are told to pay to right now. Reads inside a transaction when given one, so an issued statement copies a consistent set. */
export async function readLivePaymentDetails(db: Pick<Prisma.TransactionClient, 'opsPmcmPaymentDetails'>): Promise<LivePaymentDetails> {
  const row = await db.opsPmcmPaymentDetails.findUnique({ where: { id: ROW_ID }, select: { methods: true, revision: true } });
  return { revision: row?.revision ?? 0, methods: parseStoredMethods(row?.methods).filter((method) => method.enabled) };
}
