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
import { readUnresolvedCloseoutIssues } from '@prism/contexts/read-models/closeout';
import { readEventAccessScope } from '@prism/contexts/read-models/event-scope';
import { readStoredConformeEvidence } from '@prism/contexts/read-models/file-evidence';

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

  async requireEvent(eventId: string) {
    const event = await readEventAccessScope(this.prisma, eventId);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async buildForEvent(eventId: string, prisma: Prisma.TransactionClient = this.prisma): Promise<FileRequirementsMatrix> {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const [documents, postEventDocuments, billingStatements, milestones, supplierReviews, issues, clientCloseoutResponse, storedConforme, digitalConforme, logisticsCompletion] = await Promise.all([
      prisma.opsDocument.findMany({ where: { eventId } }),
      prisma.opsPostEventDocument.findMany({ where: { eventId } }),
      prisma.opsBillingStatement.findMany({ where: { eventId } }),
      prisma.opsPaymentMilestone.findMany({ where: { eventId } }),
      prisma.opsSupplierReview.findMany({ where: { eventId } }),
      readUnresolvedCloseoutIssues(prisma, eventId),
      prisma.opsClientCloseoutResponse.findUnique({ where: { eventId }, select: { id: true, rating: true, submittedAt: true } }),
      readStoredConformeEvidence(prisma, eventId),
      prisma.opsConformeExecution.findFirst({ where: { eventId, status: 'completed' }, orderBy: { templateVersion: 'desc' }, select: { id: true } }),
      prisma.opsLogisticsCompletion.findUnique({ where: { eventId }, select: { assetReturnsVerified: true, recordedAt: true } }),
    ]);

    return {
      eventId,
      items: [
        ...this.itemsForEvent(event, documents, postEventDocuments, billingStatements, milestones, supplierReviews, clientCloseoutResponse, storedConforme, digitalConforme),
        this.logisticsItem(logisticsCompletion),
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
    clientCloseoutResponse: { id: string; rating: number; submittedAt: Date } | null,
    storedConforme: { id: string } | null,
    digitalConforme: { id: string } | null,
  ): FileRequirementMatrixItem[] {
    return [
      this.signedConformeItem(documents, storedConforme, digitalConforme),
      this.postEventDocumentsItem(postEventDocuments),
      this.billingItem(billingStatements, milestones),
      this.floorplanItem(event),
      this.supplierReviewItem(supplierReviews),
      this.clientFeedbackItem(documents, postEventDocuments, clientCloseoutResponse),
    ];
  }

  /** Detail text is deliberately generic: the completion summary and private notes never enter the matrix. */
  private logisticsItem(record: { assetReturnsVerified: boolean; recordedAt: Date } | null): FileRequirementMatrixItem {
    const recorded = record?.assetReturnsVerified === true;
    return {
      key: 'logistics', label: 'Logistics', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
      sourceWorkflow: 'closure', status: recorded ? 'complete' : 'missing', auditCategory: 'events',
      detail: recorded && record
        ? `Logistics completion recorded by PMCM on ${record.recordedAt.toISOString()}; asset returns verified`
        : 'Logistics completion is not recorded. PMCM must verify asset returns and record completion or document an archive override.',
    };
  }

  private signedConformeItem(documents: OpsDocument[], stored: { id: string } | null, digital: { id: string } | null): FileRequirementMatrixItem {
    const hasApprovedFile = documents.some((document) => document.type === 'signed_conforme' && document.status === 'approved');
    const hasSignedFile = documents.some((document) => document.type === 'signed_conforme');
    const status = digital ? 'approved' : stored && hasApprovedFile ? 'submitted' : stored || hasSignedFile ? 'pending' : 'missing';
    return {
      key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
      sourceWorkflow: 'client_onboarding', status, uploadedAssetId: stored?.id, generatedDocumentId: digital?.id,
      auditCategory: 'documents',
      detail: digital ? 'Completed client and PMCM acknowledgments for an immutable conforme version.' : 'A confirmed signed file and PMCM acceptance are required; metadata alone is pending.',
    };
  }

  private postEventDocumentsItem(documents: OpsPostEventDocument[]): FileRequirementMatrixItem {
    const pendingCount = documents.filter((document) => document.status !== 'submitted').length;
    return {
      key: 'post_event_documents', label: 'Post-event documents', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
      sourceWorkflow: 'closure', status: trackedDeliverablesStatus(documents), generatedDocumentId: documents[0]?.id,
      auditCategory: 'documents', detail: `${documents.length} tracked deliverable(s); ${pendingCount} awaiting submission`,
    };
  }

  private billingItem(statements: OpsBillingStatement[], milestones: OpsPaymentMilestone[]): FileRequirementMatrixItem {
    const unpaid = milestones.filter((milestone) => milestone.status !== 'paid' || milestone.remainingBalance > 0).length;
    return {
      key: 'billing_statement', label: 'Billing and payment schedule', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
      sourceWorkflow: 'commercial', status: statements.length > 0 && milestones.length > 0 && unpaid === 0 ? 'complete' : 'pending',
      generatedDocumentId: statements[0]?.id, auditCategory: 'finance',
      detail: statements.length === 0 ? 'No billing statement generated' : `${milestones.length} payment milestone(s); ${unpaid} still unpaid`,
    };
  }

  private floorplanItem(event: OpsEvent | null): FileRequirementMatrixItem {
    return {
      key: 'official_floorplan', label: 'Official floorplan', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client', 'coordinator'],
      sourceWorkflow: 'floorplans', status: event?.floorPlanStatus === 'approved' ? 'approved' : 'pending',
      auditCategory: 'events', detail: `Floorplan status is ${event?.floorPlanStatus ?? 'unknown'}`,
    };
  }

  private supplierReviewItem(reviews: OpsSupplierReview[]): FileRequirementMatrixItem {
    return {
      key: 'supplier_reviews', label: 'Supplier review capture', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
      sourceWorkflow: 'supplier_network', status: reviews.length > 0 ? 'complete' : 'missing', auditCategory: 'suppliers',
      detail: `${reviews.length} supplier review(s) recorded`,
    };
  }

  private clientFeedbackItem(documents: OpsDocument[], postEventDocuments: OpsPostEventDocument[], response: { id: string; rating: number; submittedAt: Date } | null): FileRequirementMatrixItem {
    const feedbackDocs = [
      ...postEventDocuments.filter((document) => ['client feedback', 'client feedback form'].includes(document.title.trim().toLowerCase()) && document.status === 'submitted'),
      ...documents.filter((document) => document.type === 'client_feedback' && ['submitted', 'approved'].includes(document.status)),
    ];
    return {
      key: 'client_feedback', label: 'Client feedback indicator', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'],
      sourceWorkflow: 'closure', status: feedbackDocs.length > 0 || response ? 'submitted' : 'missing',
      uploadedAssetId: feedbackDocs[0]?.id, auditCategory: 'documents',
      detail: response ? `Client submitted feedback (rating ${response.rating}/5) at ${response.submittedAt.toISOString()}` : `${feedbackDocs.length} feedback document(s) recorded`,
    };
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
