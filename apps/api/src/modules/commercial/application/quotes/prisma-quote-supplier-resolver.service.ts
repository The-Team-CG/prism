import { Injectable } from '@nestjs/common';
import type { AddSupplierQuoteInput } from '@prism/types';
import type { QuoteSupplierProfile, QuoteSupplierResolver } from '../../contracts/quote-supplier-resolver.port';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class PrismaQuoteSupplierResolver implements QuoteSupplierResolver {
  constructor(private readonly suppliers: SuppliersService) {}

  async resolveQuoteSupplier(input: AddSupplierQuoteInput) {
    return this.suppliers.resolveQuoteSupplier(input) as Promise<QuoteSupplierProfile | null>;
  }
}
