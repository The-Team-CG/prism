import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { PrismaService } from '@prism/kernel/database';
import type {
  ConformeReminderInquirySnapshot,
  ConformeReminderWindowClaimer,
  ConformeReminderWindowClaimInput,
  ConformeReminderWindowClaimResult,
  EligibleConformeReminderInquiry,
} from '../../contracts/conforme-reminder-window-claim.port';
import { claimConformeReminderWindowState } from './conforme-reminder-window';

const MIN_CONFORME_AGE_MS = 5 * 24 * 60 * 60 * 1000;

@Injectable()
export class ConformeReminderWindowClaimService implements ConformeReminderWindowClaimer {
  constructor(private readonly prisma: PrismaService) {}

  async getInquiry(inquiryId: string): Promise<ConformeReminderInquirySnapshot | null> {
    const inquiry = await this.prisma.opsInquiry.findUnique({
      where: { id: inquiryId },
      select: {
        id: true,
        status: true,
        conformeSentAt: true,
        conformeSignedAt: true,
        lastConformeReminderAt: true,
      },
    });
    return inquiry ? this.toSnapshot(inquiry) : null;
  }

  async requireEligible(inquiryId: string, now: Date = new Date()): Promise<EligibleConformeReminderInquiry> {
    const inquiry = await this.getInquiry(inquiryId);
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.status !== 'accepted') throw new ConflictException('Only accepted inquiries can receive a conforme draft');
    if (inquiry.conformeSignedAt) throw new ConflictException('The conforme has already been signed');
    if (!inquiry.conformeSentAt) throw new ConflictException('The conforme must be sent before a draft is available');
    if (now.getTime() - Date.parse(inquiry.reminderWindowBaseAt ?? inquiry.conformeSentAt) < MIN_CONFORME_AGE_MS) {
      throw new ConflictException('A draft is available five days after the conforme or previous reminder');
    }
    return {
      ...inquiry,
      status: 'accepted',
      conformeSignedAt: null,
      conformeSentAt: inquiry.conformeSentAt,
      reminderWindowBaseAt: inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt,
    };
  }

  async claim(
    input: ConformeReminderWindowClaimInput,
    context: PrismTransactionContext,
  ): Promise<ConformeReminderWindowClaimResult> {
    const now = input.now ?? new Date();
    const expectedSentAt = parseDate(input.expectedConformeSentAt);
    const expectedLastReminderAt = input.expectedLastConformeReminderAt
      ? parseDate(input.expectedLastConformeReminderAt)
      : null;
    const inquiry = await context.prisma.opsInquiry.findUnique({ where: { id: input.inquiryId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.status !== 'accepted') throw new ConflictException('Only accepted inquiries can receive a conforme draft');
    if (inquiry.conformeSignedAt) throw new ConflictException('The conforme has already been signed');
    if (!inquiry.conformeSentAt) throw new ConflictException('The conforme must be sent before a draft is available');
    const reminderWindowBaseAt = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
    if (now.getTime() - reminderWindowBaseAt.getTime() < MIN_CONFORME_AGE_MS) {
      throw new ConflictException('A draft is available five days after the conforme or previous reminder');
    }
    if (inquiry.conformeSentAt.getTime() !== expectedSentAt.getTime()) {
      throw new ConflictException('The conforme changed; refresh before continuing');
    }
    if ((inquiry.lastConformeReminderAt?.getTime() ?? null) !== (expectedLastReminderAt?.getTime() ?? null)) {
      throw new ConflictException('The reminder window changed; refresh before continuing');
    }
    const claimed = await claimConformeReminderWindowState(context.prisma, {
      inquiryId: input.inquiryId,
      conformeSentAt: expectedSentAt,
      expectedLastReminderAt,
      now,
    });
    if (!claimed.inquiry.email.trim()) throw new ConflictException('Inquiry has no email recipient');
    return {
      windowKey: claimed.windowKey,
      recipient: claimed.inquiry.email.trim(),
      lastConformeReminderAt: claimed.inquiry.lastConformeReminderAt!.toISOString(),
    };
  }

  private toSnapshot(inquiry: {
    id: string;
    status: string;
    conformeSentAt: Date | null;
    conformeSignedAt: Date | null;
    lastConformeReminderAt: Date | null;
  }): ConformeReminderInquirySnapshot {
    return {
      inquiryId: inquiry.id,
      status: inquiry.status,
      conformeSentAt: inquiry.conformeSentAt?.toISOString() ?? null,
      conformeSignedAt: inquiry.conformeSignedAt?.toISOString() ?? null,
      lastConformeReminderAt: inquiry.lastConformeReminderAt?.toISOString() ?? null,
      reminderWindowBaseAt: (inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt)?.toISOString() ?? null,
    };
  }
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new ConflictException('The reminder window is invalid');
  return parsed;
}
