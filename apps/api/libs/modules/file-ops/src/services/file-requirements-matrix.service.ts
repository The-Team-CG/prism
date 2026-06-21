import { Injectable } from '@nestjs/common';
import type {
  OpsBillingStatement,
  OpsDocument,
  OpsEvent,
  OpsPaymentMilestone,
  OpsPostEventDocument,
  OpsSupplierReview,
} from '@prisma/client';
import type { PrismaService } from '@prism/database';

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

@Injectable()
export class FileRequirementsMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  async buildForEvent(eventId: string): Promise<FileRequirementsMatrix> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    const [documents, postEventDocuments, billingStatements, milestones, supplierReviews] = await Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId } }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId } }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId } }),
      this.prisma.opsSupplierReview.findMany({ where: { eventId } }),
    ]);

    return {
      eventId,
      items: this.itemsForEvent(event, documents, postEventDocuments, billingStatements, milestones, supplierReviews),
    };
  }

  async closeGates(eventId: string) {
    const matrix = await this.buildForEvent(eventId);
    const byKey = new Map(matrix.items.map((item) => [item.key, item]));
    const gates = [
      this.gate('documents', 'Post-event documents', byKey.get('post_event_documents')),
      this.gate('billing', 'Billing and payment schedule', byKey.get('billing_statement')),
      this.gate('floorplan_logistics', 'Floorplan/logistics closure', byKey.get('official_floorplan')),
      this.gate('supplier_reviews', 'Supplier review capture', byKey.get('supplier_reviews')),
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
    const submittedDocuments = documents.filter((document) =>
      ['submitted', 'approved', 'generated', 'sent'].includes(document.status),
    );
    const feedbackDocs = [
      ...postEventDocuments.filter((document) =>
        document.title.toLowerCase().includes('feedback') && document.status === 'submitted',
      ),
      ...documents.filter((document) =>
        document.type.toLowerCase().includes('feedback') && ['submitted', 'approved'].includes(document.status),
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
        status: submittedDocuments.length > 0 ? 'complete' : 'missing',
        uploadedAssetId: submittedDocuments[0]?.id,
        generatedDocumentId: postEventDocuments[0]?.id,
        auditCategory: 'documents',
        detail: `${submittedDocuments.length} submitted/generated document(s) on file`,
      },
      {
        key: 'billing_statement',
        label: 'Billing and payment schedule',
        ownerRole: 'pmcm-admin',
        visibleToRoles: ['pmcm-admin', 'client'],
        sourceWorkflow: 'commercial',
        status: billingStatements.length > 0 && unpaidMilestones.length === 0 ? 'complete' : 'pending',
        generatedDocumentId: billingStatements[0]?.id,
        auditCategory: 'finance',
        detail:
          billingStatements.length === 0
            ? 'No billing statement generated'
            : unpaidMilestones.length === 0
              ? 'Billing exists and all milestones are paid'
              : `${unpaidMilestones.length} payment milestone(s) still unpaid`,
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