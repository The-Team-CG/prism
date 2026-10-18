import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection, PrivacyCorrectionPatch } from '@prism/types';
import type { CommercialPrivacyRedactor, CommercialRedactionResult } from '../../contracts/privacy-redaction.port';

@Injectable()
export class CommercialPrivacyRedactorService implements CommercialPrivacyRedactor {
  async redactClientBilling(
    input: { eventIds: string[]; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult> {
    const billing = await transaction.opsBillingStatement.updateMany({
      where: { eventId: { in: input.eventIds } },
      data: { clientName: 'Redacted data subject', clientContact: input.redactedEmail },
    });
    return {
      surfaces: billing.count ? ['billing_client_copy'] : [],
      touchedRecords: billing.count,
    };
  }

  async redactSupplier(
    input: { email: string; redactedEmail: string },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult> {
    const suppliers = await transaction.opsSupplier.updateMany({
      where: { email: { equals: input.email, mode: 'insensitive' } },
      data: {
        contactName: 'Redacted supplier contact',
        email: input.redactedEmail,
        phone: '',
        performanceNotes: '[redacted by privacy request]',
      },
    });
    const applications = await transaction.opsSupplierApplication.updateMany({
      where: { OR: [{ email: { equals: input.email, mode: 'insensitive' } }, { normalizedEmail: input.email }] },
      data: {
        contactName: 'Redacted supplier contact',
        email: input.redactedEmail,
        normalizedEmail: input.redactedEmail,
        phone: '',
        portfolioUrl: '',
        additionalNotes: '[redacted by privacy request]',
      },
    });
    return {
      surfaces: [
        ...(suppliers.count ? ['supplier'] : []),
        ...(applications.count ? ['supplier_application'] : []),
      ],
      touchedRecords: suppliers.count + applications.count,
    };
  }

  async correctClientBilling(
    input: { eventIds: string[]; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult> {
    const data: Prisma.OpsBillingStatementUpdateManyMutationInput = {};
    if (input.patch.name !== undefined) data.clientName = input.patch.name;
    if (input.patch.email !== undefined) data.clientContact = input.patch.email;
    const billing = input.eventIds.length && Object.keys(data).length
      ? await transaction.opsBillingStatement.updateMany({ where: { eventId: { in: input.eventIds } }, data })
      : { count: 0 };
    return {
      surfaces: billing.count ? ['billing_client_copy'] : [],
      touchedRecords: billing.count,
    };
  }

  async correctSupplier(
    input: { email: string; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<CommercialRedactionResult> {
    const { name, email } = input.patch;
    const normalizedEmail = email?.toLowerCase();
    const supplierData: Prisma.OpsSupplierUpdateManyMutationInput = {};
    const applicationData: Prisma.OpsSupplierApplicationUpdateManyMutationInput = {};
    if (name !== undefined) {
      supplierData.contactName = name;
      applicationData.contactName = name;
    }
    if (normalizedEmail !== undefined) {
      supplierData.email = normalizedEmail;
      applicationData.email = normalizedEmail;
      applicationData.normalizedEmail = normalizedEmail;
    }
    const hasChange = Object.keys(supplierData).length > 0;
    const suppliers = hasChange
      ? await transaction.opsSupplier.updateMany({ where: { email: { equals: input.email, mode: 'insensitive' } }, data: supplierData })
      : { count: 0 };
    const applications = hasChange
      ? await transaction.opsSupplierApplication.updateMany({
          where: { OR: [{ email: { equals: input.email, mode: 'insensitive' } }, { normalizedEmail: input.email }] },
          data: applicationData,
        })
      : { count: 0 };
    return {
      surfaces: [
        ...(suppliers.count ? ['supplier'] : []),
        ...(applications.count ? ['supplier_application'] : []),
      ],
      touchedRecords: suppliers.count + applications.count,
    };
  }

  /** Billing copies for the subject's own events. Statement line items stay out of the export. */
  async exportClientBilling(input: { eventIds: string[] }, transaction: Prisma.TransactionClient): Promise<PrismPrivacyExportSection[]> {
    const statements = input.eventIds.length
      ? await transaction.opsBillingStatement.findMany({
          where: { eventId: { in: input.eventIds } },
          select: {
            id: true, eventId: true, number: true, clientName: true, clientContact: true, eventName: true,
            eventDate: true, totalAmount: true, status: true, sentAt: true, generatedAt: true,
          },
        })
      : [];
    return statements.length
      ? [{
          owner: 'commercial',
          surface: 'billing_client_copy',
          records: statements.map((statement) => ({
            id: statement.id,
            eventId: statement.eventId,
            number: statement.number,
            clientName: statement.clientName,
            clientContact: statement.clientContact,
            eventName: statement.eventName,
            eventDate: statement.eventDate?.toISOString() ?? null,
            totalAmount: statement.totalAmount,
            status: statement.status,
            sentAt: statement.sentAt?.toISOString() ?? null,
            generatedAt: statement.generatedAt.toISOString(),
          })),
        }]
      : [];
  }

  /** Supplier profile and applications. PMCM performance notes and decline reasons are internal and stay out. */
  async exportSupplier(input: { email: string }, transaction: Prisma.TransactionClient): Promise<PrismPrivacyExportSection[]> {
    const suppliers = await transaction.opsSupplier.findMany({
      where: { email: { equals: input.email, mode: 'insensitive' } },
      select: { id: true, name: true, contactName: true, email: true, phone: true, tier: true, serviceInclusions: true, applicationDate: true, createdAt: true },
    });
    const applications = await transaction.opsSupplierApplication.findMany({
      where: { OR: [{ email: { equals: input.email, mode: 'insensitive' } }, { normalizedEmail: input.email.trim().toLowerCase() }] },
      select: {
        id: true, companyName: true, contactName: true, email: true, phone: true, pastEvents: true, serviceInclusions: true,
        certifications: true, priceRange: true, portfolioUrl: true, additionalNotes: true, status: true,
        privacyConsentAccepted: true, privacyNoticeVersion: true, createdAt: true, reviewedAt: true,
      },
    });
    const sections: PrismPrivacyExportSection[] = [
      {
        owner: 'commercial',
        surface: 'supplier',
        records: suppliers.map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          tier: supplier.tier,
          serviceInclusions: supplier.serviceInclusions,
          applicationDate: supplier.applicationDate.toISOString(),
          createdAt: supplier.createdAt.toISOString(),
        })),
      },
      {
        owner: 'commercial',
        surface: 'supplier_application',
        records: applications.map((application) => ({
          id: application.id,
          companyName: application.companyName,
          contactName: application.contactName,
          email: application.email,
          phone: application.phone,
          pastEvents: application.pastEvents,
          serviceInclusions: application.serviceInclusions,
          certifications: application.certifications,
          priceRange: application.priceRange,
          portfolioUrl: application.portfolioUrl,
          additionalNotes: application.additionalNotes,
          status: application.status,
          privacyConsentAccepted: application.privacyConsentAccepted,
          privacyNoticeVersion: application.privacyNoticeVersion,
          createdAt: application.createdAt.toISOString(),
          reviewedAt: application.reviewedAt?.toISOString() ?? null,
        })),
      },
    ];
    return sections.filter((section) => section.records.length > 0);
  }
}
