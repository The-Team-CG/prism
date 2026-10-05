import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

describe.skipIf(!live)('Commercial quote-request referential integrity', () => {
  it('preserves submitted quote evidence by restricting deletion of a referenced request', async () => {
    const url = databaseUrl as string;
    process.env.SUPABASE_DB_URL = url;
    process.env.DATABASE_URL = url;
    process.env.PRISMA_DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.DB_SSL = 'false';

    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const categoryId = 'p0_quote_fk_category_' + suffix;
    const supplierId = 'p0_quote_fk_supplier_' + suffix;
    const inquiryId = 'p0_quote_fk_inquiry_' + suffix;
    const eventId = 'p0_quote_fk_event_' + suffix;
    const requestId = 'p0_quote_fk_request_' + suffix;
    const quoteId = 'p0_quote_fk_quote_' + suffix;
    const email = 'quote-fk-' + suffix + '@example.test';

    try {
      await prisma.opsSupplierCategory.create({
        data: { id: categoryId, slug: categoryId + '-slug', name: 'Quote FK Test Category' },
      });
      await prisma.opsSupplier.create({
        data: { id: supplierId, categoryId, name: 'Quote FK Test Supplier', email },
      });
      await prisma.opsInquiry.create({
        data: {
          id: inquiryId,
          clientName: 'Quote FK Test Client',
          email,
          normalizedEmail: email,
          eventName: 'Quote FK Test Event',
          eventDate: new Date('2032-06-18T09:00:00.000Z'),
          clientType: 'corporate',
        },
      });
      await prisma.opsEvent.create({
        data: {
          id: eventId,
          inquiryId,
          clientName: 'Quote FK Test Client',
          eventName: 'Quote FK Test Event',
          eventDate: new Date('2032-06-18T09:00:00.000Z'),
        },
      });
      await prisma.opsSupplierQuoteRequest.create({
        data: {
          id: requestId,
          eventId,
          supplierId,
          categoryId,
          supplierName: 'Quote FK Test Supplier',
          category: 'Quote FK Test Category',
          accessToken: requestId + '-token',
        },
      });
      await prisma.opsSupplierQuote.create({
        data: {
          id: quoteId,
          eventId,
          requestId,
          supplierId,
          categoryId,
          supplierName: 'Quote FK Test Supplier',
          category: 'Quote FK Test Category',
          amount: 12_500,
          inclusions: ['Recorded scope'],
        },
      });

      await expect(prisma.opsSupplierQuoteRequest.delete({ where: { id: requestId } }))
        .rejects.toMatchObject({ code: 'P2003' });
      await expect(prisma.opsSupplierQuote.findUniqueOrThrow({ where: { id: quoteId } }))
        .resolves.toMatchObject({ requestId });
      await expect(prisma.opsSupplierQuoteRequest.findUniqueOrThrow({ where: { id: requestId } }))
        .resolves.toBeTruthy();
    } finally {
      await prisma.opsSupplierQuote.deleteMany({ where: { id: quoteId } });
      await prisma.opsSupplierQuoteRequest.deleteMany({ where: { id: requestId } });
      await prisma.opsEvent.deleteMany({ where: { id: eventId } });
      await prisma.opsInquiry.deleteMany({ where: { id: inquiryId } });
      await prisma.opsSupplier.deleteMany({ where: { id: supplierId } });
      await prisma.opsSupplierCategory.deleteMany({ where: { id: categoryId } });
      await prisma.$disconnect();
    }
  });
});