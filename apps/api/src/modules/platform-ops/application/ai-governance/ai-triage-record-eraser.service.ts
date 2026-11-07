import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { toPrismaJson } from '@prism/kernel/database';
import { INQUIRY_TRIAGE_FEATURE, INQUIRY_TRIAGE_KEY_PREFIX } from './inquiry-triage.service';

const ERASED_MARKER = 'erased-for-privacy';

/**
 * Removes AI triage advice for inquiries whose subject was erased or reached retention. The advice
 * text is deleted, and the gateway audit row keeps only its route evidence: its stored input
 * carries the applicant's free-text message, which must not outlive the inquiry.
 */
@Injectable()
export class AiTriageRecordEraser {
  async eraseForInquiries(
    inquiryIds: readonly string[],
    transaction: Prisma.TransactionClient,
  ): Promise<{ surfaces: string[]; touchedRecords: number }> {
    if (inquiryIds.length === 0) return { surfaces: [], touchedRecords: 0 };

    // QUERY_AUDIT_ALLOW_UNBOUNDED: erasure must remove every triage record for these inquiries; a cap would leave personal data behind.
    const records = await transaction.opsAiApprovalRecord.findMany({
      where: {
        featureName: INQUIRY_TRIAGE_FEATURE,
        OR: inquiryIds.map((inquiryId) => ({ sourceDispatchId: { startsWith: `${INQUIRY_TRIAGE_KEY_PREFIX}${inquiryId}:` } })),
      },
      select: { id: true, aiAuditLogId: true },
    });
    if (records.length === 0) return { surfaces: [], touchedRecords: 0 };

    const audits = await transaction.opsAiAuditLog.findMany({
      where: { id: { in: records.map((record) => record.aiAuditLogId) } },
      select: { id: true, sanitizedPayload: true },
    });
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: covers exactly the matched records of the inquiries being erased: one update per audit log referenced by those approval records (the audits read above); each row needs its own sanitizedPayload update.
    for (const audit of audits) {
      const payload = audit.sanitizedPayload as Record<string, unknown> | null;
      const route = payload && typeof payload === 'object' ? payload._aiGatewayRoute : undefined;
      await transaction.opsAiAuditLog.update({
        where: { id: audit.id },
        data: { sanitizedPayload: toPrismaJson({ ...(route ? { _aiGatewayRoute: route } : {}), _erased: ERASED_MARKER }) },
      });
    }
    await transaction.opsAiApprovalRecord.deleteMany({ where: { id: { in: records.map((record) => record.id) } } });
    return { surfaces: ['ai_triage'], touchedRecords: records.length };
  }
}
