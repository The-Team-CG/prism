import type { OpsSupplierApplication, OpsSupplierCategory } from '@prisma/client';
import type { PrismSupplierApplicationStatusResult } from '@prism/types';

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
    declineReason: row.declineReason ?? null,
    reviewedAt: row.reviewedAt ? timestamp(row.reviewedAt) : null,
    createdAt: timestamp(row.createdAt),
  };
}

export function mapSupplierApplicationStatus(row: Pick<OpsSupplierApplication, 'id' | 'companyName' | 'status' | 'createdAt' | 'reviewedAt'>): PrismSupplierApplicationStatusResult {
  if (!['pending', 'under_review', 'proposal_requested', 'meeting_scheduled', 'approved', 'declined'].includes(row.status)) {
    throw new Error(`Unexpected supplier application status: ${row.status}`);
  }
  return {
    id: row.id,
    companyName: row.companyName,
    status: row.status as PrismSupplierApplicationStatusResult['status'],
    submittedAt: timestamp(row.createdAt),
    reviewedAt: row.reviewedAt ? timestamp(row.reviewedAt) : null,
  };
}
