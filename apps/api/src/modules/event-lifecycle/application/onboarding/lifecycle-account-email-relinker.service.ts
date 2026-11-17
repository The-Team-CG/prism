import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { AccountEmailRelink, AccountEmailRelinker } from '@prism/kernel/shared-kernel';

/** A client's events are theirs through the inquiry email, so their inquiries (and unsent drafts) follow the account. */
@Injectable()
export class LifecycleAccountEmailRelinkerService implements AccountEmailRelinker {
  async relinkAccountEmail(input: AccountEmailRelink, tx: Prisma.TransactionClient) {
    if (input.role !== OpsUserRole.Client) return { surfaces: [], touchedRecords: 0 };
    const inquiries = await tx.opsInquiry.updateMany({
      where: { OR: [{ normalizedEmail: input.previousEmail }, { email: { equals: input.previousEmail, mode: 'insensitive' } }] },
      data: { email: input.newEmail, normalizedEmail: input.newEmail },
    });
    const drafts = await tx.opsInquiryDraft.updateMany({
      where: { email: { equals: input.previousEmail, mode: 'insensitive' } },
      data: { email: input.newEmail },
    });
    return { surfaces: ['inquiries', 'inquiry_drafts'], touchedRecords: inquiries.count + drafts.count };
  }
}
