import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole } from '../ops.constants';
import { AuditService } from './audit.service';
import { DocumentVaultService, type UploadMetadataInput } from './document-vault.service';
import { WorkflowCommandService } from './workflow-command.service';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: unknown[] };

export type GuestCheckInInput = {
  guestName: string;
  checkInMode?: string;
  walkIn?: boolean;
  verificationStatus?: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

export type GuestFeedbackInput = {
  guestName: string;
  rating: number;
  comment?: string;
  photo?: UploadMetadataInput;
  video?: UploadMetadataInput;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const GUEST_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'] as const;

export class GuestWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowCommandService: WorkflowCommandService,
    private readonly documentVaultService = new DocumentVaultService(),
  ) {}

  async getEventByAccessCode(accessCode: string) {
    return this.resolveGuestEventByAccessCode(accessCode);
  }

  async checkInByAccessCode(accessCode: string, input: GuestCheckInInput): Promise<OpsGuestCheckIn> {
    let event: EventWithDrafts | null = null;
    let guestName = '';
    let checkInMode = 'name_search';

    return this.workflowCommandService.execute<OpsGuestCheckIn>({
      name: 'guest_check_in',
      validateState: async () => {
        event = await this.resolveGuestEventByAccessCode(accessCode);
        guestName = input.guestName?.trim();
        if (!guestName) throw new BadRequestException('Guest name is required');
        if (!input.privacyConsentAccepted) {
          throw new BadRequestException('Privacy consent is required before guest check-in');
        }
        checkInMode = input.checkInMode ?? (input.walkIn ? 'walk_in' : 'name_search');
      },
      write: () => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        return this.prisma.opsGuestCheckIn.create({
          data: {
            id: `gci_${randomUUID()}`,
            eventId: event.id,
            guestName,
            checkInMode,
            status: 'checked_in',
            walkIn: Boolean(input.walkIn),
            verificationStatus: input.verificationStatus ?? (input.walkIn ? 'flagged' : 'verified'),
            privacyConsentAccepted: true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
          },
        });
      },
      sideEffects: async (checkIn) => {
        if (!event) return;
        await this.auditService.audit(event.id, guestName, `Guest checked in: ${guestName}`, {
          actorRole: OpsUserRole.Guest,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'guest_check_in',
          affectedId: checkIn.id,
          affectedLabel: guestName,
          metadata: { walkIn: Boolean(input.walkIn), checkInMode },
        });
      },
    });
  }

  async submitFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput): Promise<OpsGuestFeedback> {
    let event: EventWithDrafts | null = null;
    let guestName = '';
    let photoFileName: string | null = null;
    let videoFileName: string | null = null;

    return this.workflowCommandService.execute<OpsGuestFeedback>({
      name: 'guest_feedback',
      validateState: async () => {
        event = await this.resolveGuestEventByAccessCode(accessCode);
        guestName = input.guestName?.trim();
        if (!guestName) throw new BadRequestException('Guest name is required');
        if (!input.privacyConsentAccepted) {
          throw new BadRequestException('Privacy consent is required before guest feedback submission');
        }
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
          throw new BadRequestException('Rating must be between 1 and 5');
        }

        const prefix = `events/${event.id}/guest-feedback`;
        photoFileName = input.photo ? this.validateUploadMetadata(input.photo, prefix).generatedFileName : null;
        videoFileName = input.video ? this.validateUploadMetadata(input.video, prefix).generatedFileName : null;
      },
      write: () => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        return this.prisma.opsGuestFeedback.create({
          data: {
            id: `gfb_${randomUUID()}`,
            eventId: event.id,
            guestName,
            rating: input.rating,
            comment: input.comment?.trim() ?? '',
            photoFileName,
            videoFileName,
            privacyConsentAccepted: true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
            moderationStatus: 'pending_review',
          },
        });
      },
      sideEffects: async (feedback) => {
        if (!event) return;
        await this.auditService.audit(event.id, guestName, `Guest feedback submitted: ${guestName}`, {
          actorRole: OpsUserRole.Guest,
          category: AuditCategory.Events,
          actionType: AuditActionType.Create,
          affectedType: 'guest_feedback',
          affectedId: feedback.id,
          affectedLabel: guestName,
          metadata: { rating: input.rating, moderationStatus: 'pending_review' },
        });
      },
    });
  }

  private async resolveGuestEventByAccessCode(accessCode: string) {
    const normalizedCode = this.normalizeGuestAccessCode(accessCode);
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
    const event = events.find((item) => this.guestAccessCode(item) === normalizedCode);
    if (!event) throw new NotFoundException('Guest event code was not found');
    return event;
  }

  private guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>) {
    const namePart =
      event.eventName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .split('-')
        .filter(Boolean)
        .slice(0, 2)
        .join('-') || 'PRISM';
    const idPart = event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EVNT';
    return `${namePart}-${idPart}`;
  }

  private normalizeGuestAccessCode(accessCode: string) {
    return accessCode.trim().toUpperCase().replace(/\s+/g, '-');
  }

  private validateUploadMetadata(input: UploadMetadataInput, prefix: string) {
    return this.documentVaultService.validateUploadMetadata(input, prefix, {
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      allowedMimeTypes: GUEST_UPLOAD_MIME_TYPES,
    });
  }
}
