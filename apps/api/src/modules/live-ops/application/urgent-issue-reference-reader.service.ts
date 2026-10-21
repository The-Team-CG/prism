import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { UrgentIssueReference, UrgentIssueReferenceReader } from '../contracts/urgent-issue-reference-reader.port';

@Injectable()
export class UrgentIssueReferenceReaderService implements UrgentIssueReferenceReader {
  constructor(private readonly prisma: PrismaService) {}

  async findUrgentIssueForEvent(
    eventId: string,
    issueId: string,
    transaction?: PrismTransactionContext,
  ): Promise<UrgentIssueReference | null> {
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: retain the LiveOps issue row while a cross-domain billing reference is committed.
      const locked = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "live_ops"."urgent_issues" WHERE "id" = $1 AND "event_id" = $2 FOR UPDATE',
        issueId,
        eventId,
      );
      if (locked.length === 0) return null;
    }
    const database = transaction?.prisma ?? this.prisma;
    const issue = await database.opsUrgentIssue.findFirst({
      where: { id: issueId, eventId },
      select: { id: true, eventId: true },
    });
    return issue ? { id: issue.id, eventId: issue.eventId } : null;
  }
}
