import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismEventOpsActorContext, PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { InquiriesService } from './inquiries.service';

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
  loggedByRole?: string;
  loggedByName?: string;
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
  resolveActor: (input?: PrismEventOpsActorContext, verifiedActor?: PrismVerifiedEventActor) => any;
  requireActorRole: (actor: any, roles: OpsUserRoleValue[], resource: string) => Promise<void>;
  allowedAdminRoles: OpsUserRoleValue[];
  mapInquiry: (inquiry: unknown) => any;
  mapDocument: (document: unknown) => any;
  mapEvent: (event: unknown) => any;
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
    });

    return inquiries.map(context.mapInquiry);
  }

  async listOnboarding(actorInput: PrismEventOpsActorContext = {}, context: InquiryWorkflowContext, verifiedActor?: PrismVerifiedEventActor) {
    const actor = context.resolveActor(verifiedActor ? {} : actorInput, verifiedActor);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'onboarding');

    const [inquiries, events, documents] = await Promise.all([
      this.prisma.opsInquiry.findMany({ take: 500, include: { statusHistory: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEvent.findMany({
        take: 500,
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.opsDocument.findMany({ take: 500, orderBy: { uploadedAt: 'desc' } }),
    ]);

    return {
      inquiries: inquiries.map(context.mapInquiry),
      events: events.map(context.mapEvent),
      documents: documents.map(context.mapDocument),
    };
  }

  async createInquiry(input: CreateInquiryInput, context: InquiryWorkflowContext) {
    const inquiry = await context.inquiriesService.createInquiry(input);
    return context.mapInquiry(inquiry);
  }

  async logInquiryOnBehalf(
    input: CreateInquiryInput,
    actorInput: PrismEventOpsActorContext = {},
    context: InquiryWorkflowContext,
    verifiedActor?: PrismVerifiedEventActor,
  ) {
    const actor = verifiedActor ? context.resolveActor({}, verifiedActor) : context.resolveActor(actorInput);
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
    const inquiry = await context.inquiriesService.sendConformeReminder(inquiryId);
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
