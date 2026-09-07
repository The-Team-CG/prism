import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  OpsBillingStatement,
  OpsDocument,
  OpsEvent,
  OpsPaymentMilestone,
  OpsPostEventDocument,
  OpsSupplierReview,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { readUnresolvedCloseoutIssues } from '@prism/contexts/read-models';

export type FileRequirementStatus = 'missing' | 'pending' | 'submitted' | 'generated' | 'approved' | 'complete';

export type FileRequirementMatrixItem = {
  key: string;
  label: string;
  ownerRole: string;
  visibleToRoles: string[];
  sourceWorkflow: string;
  status: FileRequirementStatus;
  dueDate?: string;
  uploadedAssetId?: string;
  generatedDocumentId?: string;
  auditCategory: string;
  detail: string;
};

export type FileRequirementsMatrix = {
  eventId: string;
  items: FileRequirementMatrixItem[];
};

function trackedDeliverablesStatus(documents: OpsPostEventDocument[]): FileRequirementStatus {
  return documents.length > 0 && documents.every(document => document.status === 'submitted') ? 'complete' : 'missing';
}

@Injectable()
export class FileRequirementsMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  async requireEvent(eventId: string): Promise<OpsEvent> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async buildForEvent(eventId: string, prisma: Prisma.TransactionClient = this.prisma): Promise<FileRequirementsMatrix> {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const [documents, postEventDocuments, billingStatements, milestones, supplierReviews, issues] = await Promise.all([
      prisma.opsDocument.findMany({ where: { eventId } }),
      prisma.opsPostEventDocument.findMany({ where: { eventId } }),
      prisma.opsBillingStatement.findMany({ where: { eventId } }),
      prisma.opsPaymentMilestone.findMany({ where: { eventId } }),
      prisma.opsSupplierReview.findMany({ where: { eventId } }),
      readUnresolvedCloseoutIssues(prisma, eventId),
    ]);

    return {
      eventId,
      items: [
        ...this.itemsForEvent(event, documents, postEventDocuments, billingStatements, milestones, supplierReviews),
        {
          key: 'logistics', label: 'Logistics', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
          sourceWorkflow: 'closure', status: 'missing', auditCategory: 'events',
          detail: 'Logistics completion is not recorded by the current workflow. PMCM must verify asset returns and document an archive override.',
        },
        {
          key: 'issues', label: 'Issues', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
          sourceWorkflow: 'live_ops', status: issues.length === 0 ? 'complete' : 'pending', auditCategory: 'events',
          detail: `${issues.length} unresolved urgent issue(s)`,
        },
      ],
    };
  }

  async closeGates(eventId: string, prisma: Prisma.TransactionClient = this.prisma) {
    const matrix = await this.buildForEvent(eventId, prisma);
    const byKey = new Map(matrix.items.map((item) => [item.key, item]));
    const gates = [
      this.gate('documents', 'Deliverables', byKey.get('post_event_documents')),
      this.gate('billing', 'Billing and payment schedule', byKey.get('billing_statement')),
      this.gate('logistics', 'Logistics', byKey.get('logistics')),
      this.gate('issues', 'Issues', byKey.get('issues')),
      this.gate('feedback', 'Client feedback indicator', byKey.get('client_feedback')),
    ];

    return {
      eventId,
      ready: gates.every((gate) => gate.passed),
      gates,
      missingKeys: gates.filter((gate) => !gate.passed).map((gate) => gate.key),
      matrix,
    };
  }

  private itemsForEvent(
    event: OpsEvent | null,
    documents: OpsDocument[],
    postEventDocuments: OpsPostEventDocument[],
    billingStatements: OpsBillingStatement[],
    milestones: OpsPaymentMilestone[],
    supplierReviews: OpsSupplierReview[],
  ): FileRequirementMatrixItem[] {
    const pendingDeliverables = postEventDocuments.filter(document => document.status !== 'submitted');
    const feedbackDocs = [
      ...postEventDocuments.filter((document) =>
        ['client feedback', 'client feedback form'].includes(document.title.trim().toLowerCase()) && document.status === 'submitted',
      ),
      ...documents.filter((document) =>
        document.type === 'client_feedback' && ['submitted', 'approved'].includes(document.status),
      ),
    ];
    const unpaidMilestones = milestones.filter((milestone) => milestone.status !== 'paid' || milestone.remainingBalance > 0);

    return [
      {
        key: 'signed_conforme',
        label: 'Signed conforme',
        ownerRole: 'pmcm-admin',
        visibleToRoles: ['pmcm-admin', 'client'],
        sourceWorkflow: 'client_onboarding',
        status: documents.some((document) => document.type.toLowerCase().includes('conforme')) ? 'submitted' : 'missing',
        uploadedAssetId: documents.find((document) => document.type.toLowerCase().includes('conforme'))?.id,
        auditCategory: 'documents',
        detail: 'Formal authorization file required before portal activation.',
      },
      {
        key: 'post_event_documents',
        label: 'Post-event documents',
        ownerRole: 'pmcm-admin',
        visibleToRoles: ['pmcm-admin', 'client'],
        sourceWorkflow: 'closure',
        status: trackedDeliverablesStatus(postEventDocuments),
        generatedDocumentId: postEventDocuments[0]?.id,
        auditCategory: 'documents',
        detail: `${postEventDocuments.length} tracked deliverable(s); ${pendingDeliverables.length} awaiting submission`,
      },
      {
        key: 'billing_statement',
        label: 'Billing and payment schedule',
        ownerRole: 'pmcm-admin',
        visibleToRoles: ['pmcm-admin', 'client'],
        sourceWorkflow: 'commercial',
        status: billingStatements.length > 0 && milestones.length > 0 && unpaidMilestones.length === 0 ? 'complete' : 'pending',
        generatedDocumentId: billingStatements[0]?.id,
        auditCategory: 'finance',
        detail:
          billingStatements.length === 0
            ? 'No billing statement generated'
            : `${milestones.length} payment milestone(s); ${unpaidMilestones.length} still unpaid`,
      },
      {
        key: 'official_floorplan',
        label: 'Official floorplan',
        ownerRole: 'pmcm-admin',
        visibleToRoles: ['pmcm-admin', 'client', 'coordinator'],
        sourceWorkflow: 'floorplans',
        status: event?.floorPlanStatus === 'approved' ? 'approved' : 'pending',
        auditCategory: 'events',
        detail: `Floorplan status is ${event?.floorPlanStatus ?? 'unknown'}`,
      },
      {
        key: 'supplier_reviews',
        label: 'Supplier review capture',
        ownerRole: 'pmcm-admin',
        visibleToRoles: ['pmcm-admin'],
        sourceWorkflow: 'supplier_network',
        status: supplierReviews.length > 0 ? 'complete' : 'missing',
        auditCategory: 'suppliers',
        detail: `${supplierReviews.length} supplier review(s) recorded`,
      },
      {
        key: 'client_feedback',
        label: 'Client feedback indicator',
        ownerRole: 'client',
        visibleToRoles: ['pmcm-admin', 'client'],
        sourceWorkflow: 'closure',
        status: feedbackDocs.length > 0 ? 'submitted' : 'missing',
        uploadedAssetId: feedbackDocs[0]?.id,
        auditCategory: 'documents',
        detail: `${feedbackDocs.length} feedback document(s) recorded`,
      },
    ];
  }

  private gate(key: string, label: string, item: FileRequirementMatrixItem | undefined) {
    return {
      key,
      label,
      passed: item ? ['submitted', 'generated', 'approved', 'complete'].includes(item.status) : false,
      detail: item?.detail ?? 'Requirement missing from file matrix',
    };
  }
}
