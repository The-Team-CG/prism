import { Injectable } from '@nestjs/common';
import type { PrismaService } from '@prism/database';
import { OpsUserRole } from '../ops.constants';
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
  resolveActor: (input?: Record<string, unknown>) => any;
  requireActorRole: (actor: any, roles: OpsUserRoleValue[], resource: string) => Promise<void>;
  allowedAdminRoles: OpsUserRoleValue[];
  mapInquiry: (inquiry: unknown) => any;
  mapDocument: (document: unknown) => any;
}

@Injectable()
export class InquiryWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async listInquiries(actorInput: Record<string, unknown> = {}, context: InquiryWorkflowContext) {
    const actor = context.resolveActor(actorInput);
    await context.requireActorRole(actor, context.allowedAdminRoles, 'inquiries');

    const inquiries = await this.prisma.opsInquiry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return inquiries.map(context.mapInquiry);
  }

  async createInquiry(input: CreateInquiryInput, context: InquiryWorkflowContext) {
    const inquiry = await context.inquiriesService.createInquiry(input);
    return context.mapInquiry(inquiry);
  }

  async logInquiryOnBehalf(
    input: CreateInquiryInput,
    actorInput: Record<string, unknown> = {},
    context: InquiryWorkflowContext,
  ) {
    const inquiry = await context.inquiriesService.logInquiryOnBehalf(input, actorInput);
    return context.mapInquiry(inquiry);
  }

  async updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput, context: InquiryWorkflowContext) {
    const inquiry = await context.inquiriesService.updateInquiryStatus(inquiryId, input);
    return context.mapInquiry(inquiry);
  }

  async sendConformeReminder(inquiryId: string, context: InquiryWorkflowContext) {
    const inquiry = await context.inquiriesService.sendConformeReminder(inquiryId);
    return context.mapInquiry(inquiry);
  }

  async uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number },
    context: InquiryWorkflowContext,
  ) {
    const document = await context.inquiriesService.uploadConforme(inquiryId, input);
    return context.mapDocument(document);
  }
}
