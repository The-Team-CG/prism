import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { findFloorPlanDraftsByEvent, withFloorPlanDrafts } from '@prism/contexts/floorplan/event-drafts';
import type { MergeInquiryInput, PrismEventOpsActorContext, PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { EventAccessPolicyService } from '@prism/kernel/access-control';
import type { InquiriesService } from './inquiries.service';
import type { OpsInquiry } from '@prisma/client';
import type { InquiryListCues, mapDocument, mapInquiry, mapOnboardingEvent, mapPublicInquiryReceipt } from './inquiry.mappers';

type OpsUserRoleValue = (typeof OpsUserRole)[keyof typeof OpsUserRole];

export type CreateInquiryInput = {
  clientName: string;
  companyName?: string;
  email: string;
  eventName: string;
  eventType?: string;
  eventDate: string;
  clientType: string;
  source?: string;
  channel?: string;
  referralDetails?: string;
  message: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

export type UpdateInquiryStatusInput = {
  status: string;
  declineReason?: string;
};

export interface InquiryWorkflowContext {
  inquiriesService: InquiriesService;
  resolveActor: EventAccessPolicyService['resolveActor'];
  requireActorRole: EventAccessPolicyService['requireActorRole'];
  allowedAdminRoles: OpsUserRoleValue[];
  mapInquiry: (inquiry: Parameters<typeof mapInquiry>[0], cues?: InquiryListCues) => ReturnType<typeof mapInquiry>;
  mapPublicInquiry: (inquiry: OpsInquiry) => ReturnType<typeof mapPublicInquiryReceipt>;
  mapDocument: (document: Parameters<typeof mapDocument>[0]) => ReturnType<typeof mapDocument>;
  mapEvent: (event: Parameters<typeof mapOnboardingEvent>[0]) => ReturnType<typeof mapOnboardingEvent>;
}

const inquiryTriageInclude = {
  mergedInto: true,
  mergesAsPrimary: {
    orderBy: { createdAt: 'asc' as const },
    include: { mergedInquiry: { select: { clientName: true } } },
  },
} as const;

/** Open inquiries that share an organization key with each other; declined and merged records are excluded. */
function parallelInquiryCues(rows: Array<Pick<OpsInquiry, 'id' | 'organizationKey' | 'status'> & { mergedInto?: unknown }>) {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.organizationKey || row.mergedInto || row.status === 'declined') continue;
    groups.set(row.organizationKey, [...(groups.get(row.organizationKey) ?? []), row.id]);
  }
  const cues = new Map<string, InquiryListCues>();
  for (const ids of groups.values()) {
    for (const id of ids) cues.set(id, { parallelInquiryIds: ids.filter((other) => other !== id) });
  }
  return cues;
}

@Injectable()
export class InquiryWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async listInquiries(actorInput: PrismEventOpsActorContext = {}, context: InquiryWorkflowContext, verifiedActor?: PrismVerifiedEventActor) {
    const actor = context.resolveActor(verifiedActor ? {} : actorInput, verifiedActor);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'inquiries');

    const inquiries = await this.prisma.opsInquiry.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
      include: inquiryTriageInclude,
    });
    const cues = parallelInquiryCues(inquiries);

    return inquiries.map((inquiry) => context.mapInquiry(inquiry, cues.get(inquiry.id)));
  }

  async listOnboarding(actorInput: PrismEventOpsActorContext = {}, context: InquiryWorkflowContext, verifiedActor?: PrismVerifiedEventActor) {
    const actor = context.resolveActor(verifiedActor ? {} : actorInput, verifiedActor);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'onboarding');

    const [inquiries, eventRows, documents] = await Promise.all([
      this.prisma.opsInquiry.findMany({
        take: 500,
        include: { ...inquiryTriageInclude, statusHistory: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opsEvent.findMany({ take: 500, orderBy: { eventDate: 'asc' } }),
      this.prisma.opsDocument.findMany({ take: 500, orderBy: { uploadedAt: 'desc' } }),
    ]);
    const events = withFloorPlanDrafts(eventRows, await findFloorPlanDraftsByEvent(this.prisma, eventRows.map(({ id }) => id)));
    const cues = parallelInquiryCues(inquiries);

    return {
      inquiries: inquiries.map((inquiry) => context.mapInquiry(inquiry, cues.get(inquiry.id))),
      events: events.map(context.mapEvent),
      documents: documents.map(context.mapDocument),
    };
  }

  async createInquiry(input: CreateInquiryInput, context: InquiryWorkflowContext) {
    const inquiry = await context.inquiriesService.createInquiry(input);
    return context.mapPublicInquiry(inquiry);
  }

  async mergeInquiry(
    primaryInquiryId: string,
    input: MergeInquiryInput,
    context: InquiryWorkflowContext,
    verifiedActor?: PrismVerifiedEventActor,
  ) {
    const actor = context.resolveActor({}, verifiedActor);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'inquiry merge');
    return context.inquiriesService.mergeInquiry(primaryInquiryId, input, actor);
  }

  async logInquiryOnBehalf(
    input: CreateInquiryInput,
    actorInput: PrismEventOpsActorContext = {},
    context: InquiryWorkflowContext,
    verifiedActor?: PrismVerifiedEventActor,
  ) {
    const actor = verifiedActor ? context.resolveActor({}, verifiedActor) : context.resolveActor(actorInput);
    if (actor.verified !== true || !actor.id?.trim() || !actor.name?.trim()) {
      throw new ForbiddenException('A verified actor is required to log an inquiry on behalf of a client');
    }
    await context.requireActorRole(actor, context.allowedAdminRoles, 'log inquiry on behalf');

    const inquiry = await context.inquiriesService.logInquiryOnBehalf(input, actor);
    return context.mapInquiry(inquiry);
  }

  async updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput, context: InquiryWorkflowContext, verifiedActor?: PrismVerifiedEventActor) {
    const actor = context.resolveActor({}, verifiedActor);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'inquiry status');
    const inquiry = await context.inquiriesService.updateInquiryStatus(inquiryId, input, actor);
    return context.mapInquiry(inquiry);
  }

  async sendConformeReminder(inquiryId: string, context: InquiryWorkflowContext, verifiedActor?: PrismVerifiedEventActor) {
    const actor = context.resolveActor({}, verifiedActor);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'conforme reminder');
    const inquiry = await context.inquiriesService.sendConformeReminder(inquiryId, actor);
    return context.mapInquiry(inquiry);
  }

  async uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number; storageObjectId?: string },
    actorInput: PrismEventOpsActorContext = {},
    context: InquiryWorkflowContext,
    verifiedActor?: PrismVerifiedEventActor,
  ) {
    const actor = verifiedActor ? context.resolveActor({}, verifiedActor) : context.resolveActor(actorInput);
    await context.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'conforme upload');

    const document = await context.inquiriesService.uploadConforme(inquiryId, input, actor);
    return context.mapDocument(document);
  }
}
