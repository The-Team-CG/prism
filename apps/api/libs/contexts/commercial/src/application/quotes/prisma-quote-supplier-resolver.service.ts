import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/database';
import { SupplierTier } from '@prism/modules/event-core';
import type { AddSupplierQuoteInput } from '../../contracts/commercial-workflow-commands.port';
import type { QuoteSupplierProfile, QuoteSupplierResolver } from '../../contracts/quote-supplier-resolver.port';

@Injectable()
export class PrismaQuoteSupplierResolver implements QuoteSupplierResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveQuoteSupplier(input: AddSupplierQuoteInput) {
    if (input.supplierId) {
      return this.supplierRow(input.supplierId);
    }

    if (!input.categoryId) return null;

    const category = await this.prisma.opsSupplierCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundException('Supplier category not found');

    const tierOneSupplier = await this.prisma.opsSupplier.findFirst({
      where: { categoryId: category.id, tier: SupplierTier.Tier1 },
      orderBy: { name: 'asc' },
    });
    if (!tierOneSupplier) {
      throw new BadRequestException('No Tier 1 supplier exists for this category');
    }

    return this.supplierRow(tierOneSupplier.id);
  }

  private async supplierRow(supplierId: string): Promise<QuoteSupplierProfile> {
    const supplier = await this.prisma.opsSupplier.findUnique({
      where: { id: supplierId },
      include: {
        category: true,
        reviews: { include: { event: true }, orderBy: { createdAt: 'desc' } },
        reliabilityNotes: { include: { event: true }, orderBy: { createdAt: 'desc' } },
        certifications: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier as QuoteSupplierProfile;
  }
}
