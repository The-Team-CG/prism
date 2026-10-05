import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  RegistrationSupplierReference,
  RegistrationSupplierReferenceReader,
} from '../../contracts/registration-supplier-reference.port';

@Injectable()
export class RegistrationSupplierReferenceService implements RegistrationSupplierReferenceReader {
  constructor(private readonly prisma: PrismaService) {}

  async findRegistrationSupplier(
    eventId: string,
    supplierId: string,
    transaction?: PrismTransactionContext,
  ): Promise<RegistrationSupplierReference | null> {
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: serialize registration eligibility with supplier/category/selection changes.
      const supplierLock = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "commercial"."suppliers" WHERE "id" = $1 FOR UPDATE',
        supplierId,
      );
      if (supplierLock.length === 0) return null;
    }
    const database = transaction?.prisma ?? this.prisma;
    const supplier = await database.opsSupplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        categoryId: true,
        category: { select: { name: true, slug: true, active: true } },
      },
    });
    if (!supplier) return null;

    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: lock the Commercial category row before using its current eligibility.
      const categoryLock = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "commercial"."supplier_categories" WHERE "id" = $1 FOR UPDATE',
        supplier.categoryId,
      );
      if (categoryLock.length === 0) return null;
    }

    const categoryLabel = supplier.category?.name ?? supplier.category?.slug ?? '';
    const normalizedCategory = categoryLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
    let selectedForEvent = false;
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: lock the selected Commercial quote row until Operations commits the link.
      const selected = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "commercial"."supplier_quote_requests" WHERE "event_id" = $1 AND "supplier_id" = $2 AND "status" = $3 ORDER BY "id" LIMIT 1 FOR UPDATE',
        eventId,
        supplierId,
        'selected',
      );
      selectedForEvent = selected.length > 0;
    } else {
      const selected = await database.opsSupplierQuoteRequest.findFirst({
        where: { eventId, supplierId, status: 'selected' },
        select: { id: true },
      });
      selectedForEvent = selected !== null;
    }

    return {
      id: supplier.id,
      registrationCategory: ['digitalregistration', 'registration'].includes(normalizedCategory),
      categoryActive: supplier.category?.active ?? false,
      selectedForEvent,
    };
  }
}