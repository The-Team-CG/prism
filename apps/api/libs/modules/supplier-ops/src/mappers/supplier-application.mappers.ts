import type { OpsSupplierApplication, OpsSupplierCategory } from '@prisma/client';

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapSupplierApplication(
  row: OpsSupplierApplication & { category?: OpsSupplierCategory | null },
) {
  return {
    id: row.id,
    companyName: row.companyName,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    categoryId: row.categoryId ?? null,
    categoryName: row.category?.name ?? null,
    pastEvents: row.pastEvents,
    serviceInclusions: row.serviceInclusions,
    certifications: row.certifications,
    priceRange: row.priceRange,
    bniMember: row.bniMember,
    portfolioUrl: row.portfolioUrl,
    additionalNotes: row.additionalNotes,
    status: row.status,
    createdAt: timestamp(row.createdAt),
  };
}
