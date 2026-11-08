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
import { canListStoredObject, canReadDocumentRow, requirementVisibilityFor, type FileAccessActor, type FileAccessObject } from '@prism/kernel/access-control';
import { readUnresolvedCloseoutIssues } from '@prism/contexts/read-models/closeout';
import { readEventAccessScope } from '@prism/contexts/read-models/event-scope';
import { readStoredConformeEvidence } from '@prism/contexts/read-models/file-evidence';
import type { PrismFileRequirementItem, PrismFileRequirementStatus, PrismFileRequirementsMatrix } from '@prism/types';
import {
  mergeFileRequirementOverrides,
  type DerivedFileRequirementItem,
  type FileRequirementSupplier,
} from '../../domain/file-requirement-matrix.policy';

export type FileRequirementStatus = PrismFileRequirementStatus;
export type FileRequirementMatrixItem = PrismFileRequirementItem;
export type FileRequirementsMatrix = PrismFileRequirementsMatrix;

/** Selected quote requests per event; a bound event has a handful, so the cap only guards against runaway rows. */
const MAX_SELECTED_SUPPLIERS = 200;

function trackedDeliverablesStatus(documents: OpsPostEventDocument[]): FileRequirementStatus {
  return documents.length > 0 && documents.every(document => document.status === 'submitted') ? 'complete' : 'missing';
}

function distinctSuppliers(rows: Array<{ supplierId: string | null; supplierName: string }>): FileRequirementSupplier[] {
  const byId = new Map<string, FileRequirementSupplier>();
  for (const row of rows) {
    if (row.supplierId && !byId.has(row.supplierId)) byId.set(row.supplierId, { supplierId: row.supplierId, supplierName: row.supplierName });
  }
  return [...byId.values()];
}

/** The billing row the matrix references is the first statement; it is referenceable only once that statement is sent. */
function firstStatementSent(statements: ReadonlyArray<{ id: string }>, sentIds: ReadonlySet<string>) {
  const first = statements[0];
  return Boolean(first && sentIds.has(first.id));
}

/**
 * What an audience may reference in the matrix: documents, the signed conforme, and the billing row, each
 * decided by the shared file policy. No audience is the full PMCM view.
 */
function audienceView<T extends { type: string; storageKey?: string | null }>(
  audience: FileAccessActor | undefined,
  input: {
    documents: ReadonlyArray<{ type: string; storageKey: string | null }>;
    documentFacts: T[];
    storedObjectById: ReadonlyMap<string, FileAccessObject & { id: string }>;
    storedConforme: (FileAccessObject & { id: string }) | null;
    persistedRequirements: ReadonlyArray<{ key: string; visibleToRoles: string[] }>;
    billingStatements: ReadonlyArray<{ id: string; sentAt: Date | null }>;
  },
) {
  if (!audience) return { visibleDocuments: input.documentFacts, visibleStoredConforme: input.storedConforme, billingReferenceable: true };
  const sentStatementIds = new Set(input.billingStatements.filter((statement) => statement.sentAt !== null).map((statement) => statement.id));
  const boundTypes = new Map<string, string[]>();
  for (const document of input.documents) {
    if (document.storageKey) boundTypes.set(document.storageKey, [...(boundTypes.get(document.storageKey) ?? []), document.type]);
  }
  const visibility: Record<string, string[]> = Object.fromEntries(input.persistedRequirements.map((row) => [row.key, row.visibleToRoles]));
  const accessContext = (object: FileAccessObject & { id: string }) => ({
    requirementVisibility: requirementVisibilityFor(object, boundTypes.get(object.id) ?? [], visibility),
    billingStatementSent: sentStatementIds.has(object.ownerRecordId),
  });
  const visibleDocuments = input.documentFacts.filter((document) => {
    const object = document.storageKey ? input.storedObjectById.get(document.storageKey) ?? null : null;
    return canReadDocumentRow(audience, { type: document.type, storageKey: document.storageKey ?? null },
      object ? { object, ...accessContext(object) } : { object: null, requirementVisibility: [], billingStatementSent: false });
  });
  const storedConforme = input.storedConforme;
  const visibleStoredConforme = storedConforme && !canListStoredObject(audience, storedConforme, accessContext(storedConforme)) ? null : storedConforme;
  const billingReferenceable = canReadDocumentRow(audience, { type: 'billing_statement', storageKey: null },
    { object: null, requirementVisibility: [], billingStatementSent: firstStatementSent(input.billingStatements, sentStatementIds) });
  return { visibleDocuments, visibleStoredConforme, billingReferenceable };
}

@Injectable()
export class FileRequirementsMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  async requireEvent(eventId: string) {
    const event = await readEventAccessScope(this.prisma, eventId);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  /** Non-PMCM readers see the billing row only once PMCM has sent a statement. */
  async hasSentBillingStatement(eventId: string): Promise<boolean> {
    return (await this.prisma.opsBillingStatement.count({ where: { eventId, sentAt: { not: null } } })) > 0;
  }

  /** `audience` narrows the matrix to what that actor may reference; omitted means the full PMCM view. */
  async buildForEvent(eventId: string, prisma: Prisma.TransactionClient = this.prisma, now: Date = new Date(), audience?: FileAccessActor): Promise<FileRequirementsMatrix> {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const [documents, postEventDocuments, billingStatements, milestones, supplierReviews, issues, clientCloseoutResponse, storedConforme, digitalConforme, logisticsCompletion, persistedRequirements, selectedSupplierRows] = await Promise.all([
      prisma.opsDocument.findMany({ where: { eventId } }),
      prisma.opsPostEventDocument.findMany({ where: { eventId } }),
      prisma.opsBillingStatement.findMany({ where: { eventId } }),
      prisma.opsPaymentMilestone.findMany({ where: { eventId, supersededAt: null } }),
      prisma.opsSupplierReview.findMany({ where: { eventId } }),
      readUnresolvedCloseoutIssues(prisma, eventId),
      prisma.opsClientCloseoutResponse.findUnique({ where: { eventId }, select: { id: true, rating: true, submittedAt: true } }),
      readStoredConformeEvidence(prisma, eventId),
      prisma.opsConformeExecution.findFirst({ where: { eventId, status: 'completed' }, orderBy: { templateVersion: 'desc' }, select: { id: true } }),
      prisma.opsLogisticsCompletion.findUnique({ where: { eventId }, select: { assetReturnsVerified: true, recordedAt: true } }),
      prisma.opsFileRequirement.findMany({ where: { eventId }, orderBy: { key: 'asc' }, take: 200 }),
      prisma.opsSupplierQuoteRequest.findMany({ where: { eventId, status: 'selected' }, select: { supplierId: true, supplierName: true }, orderBy: { id: 'asc' }, take: MAX_SELECTED_SUPPLIERS }),
    ]);
    const storedObjectIds = [...new Set(documents.map((document) => document.storageKey).filter((key): key is string => Boolean(key)))];
    const storedObjects = storedObjectIds.length
      ? await prisma.opsStoredObject.findMany({ where: { id: { in: storedObjectIds } }, select: { id: true, usage: true, lifecycleState: true, ownerRecordType: true, ownerRecordId: true, deletedAt: true } })
      : [];
    const storedObjectById = new Map(storedObjects.map((object) => [object.id, object]));
    const objectAvailability = new Map(storedObjects.map((object) => [object.id, object.lifecycleState === 'stored']));
    // A document belongs to the supplier that owns its stored object; event-owned and unbound files belong to no supplier.
    const objectOwnerSupplier = new Map(storedObjects.map((object) => [object.id, object.ownerRecordType === 'supplier' ? object.ownerRecordId : null]));
    const documentFacts = documents.map((document) => ({
      ...document,
      available: !document.storageKey || objectAvailability.get(document.storageKey) !== false,
      ownerSupplierId: document.storageKey ? objectOwnerSupplier.get(document.storageKey) ?? null : null,
    }));
    const suppliers = distinctSuppliers(selectedSupplierRows);

    // An audience sees only what the shared file policy lets it reference, so counts, status, and ids
    // all come from what it may download.
    const { visibleDocuments, visibleStoredConforme, billingReferenceable } = audienceView(audience, {
      documents, documentFacts, storedObjectById, storedConforme, persistedRequirements, billingStatements,
    });

    const derived: DerivedFileRequirementItem[] = [
      ...this.itemsForEvent(event, visibleDocuments, postEventDocuments, billingStatements, milestones, supplierReviews, clientCloseoutResponse, visibleStoredConforme, digitalConforme, billingReferenceable),
      this.logisticsItem(logisticsCompletion),
      {
        key: 'issues', label: 'Issues', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
        sourceWorkflow: 'live_ops', status: issues.length === 0 ? 'complete' : 'pending', auditCategory: 'events',
        detail: `${issues.length} unresolved urgent issue(s)`,
      },
    ];
    // Overrides change ownership, visibility, required state, and due dates only; close gates read derived status.
    return { eventId, items: mergeFileRequirementOverrides(derived, persistedRequirements, visibleDocuments, suppliers, now) };
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
    billingReferenceable: boolean,
  ): DerivedFileRequirementItem[] {
    return [
      this.signedConformeItem(documents, storedConforme, digitalConforme),
      this.postEventDocumentsItem(postEventDocuments),
      this.billingItem(billingStatements, milestones, billingReferenceable),
      this.floorplanItem(event),
      this.supplierReviewItem(supplierReviews),
      this.clientFeedbackItem(documents, postEventDocuments, clientCloseoutResponse),
    ];
  }

  /** Detail text is deliberately generic: the completion summary and private notes never enter the matrix. */
  private logisticsItem(record: { assetReturnsVerified: boolean; recordedAt: Date } | null): DerivedFileRequirementItem {
    const recorded = record?.assetReturnsVerified === true;
    return {
      key: 'logistics', label: 'Logistics', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
      sourceWorkflow: 'closure', status: recorded ? 'complete' : 'missing', auditCategory: 'events',
      detail: recorded && record
        ? `Logistics completion recorded by PMCM on ${record.recordedAt.toISOString()}; asset returns verified`
        : 'Logistics completion is not recorded. PMCM must verify asset returns and record completion or document an archive override.',
    };
  }

  private signedConformeItem(documents: OpsDocument[], stored: { id: string } | null, digital: { id: string } | null): DerivedFileRequirementItem {
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

  private postEventDocumentsItem(documents: OpsPostEventDocument[]): DerivedFileRequirementItem {
    const pendingCount = documents.filter((document) => document.status !== 'submitted').length;
    return {
      key: 'post_event_documents', label: 'Post-event documents', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
      sourceWorkflow: 'closure', status: trackedDeliverablesStatus(documents), generatedDocumentId: documents[0]?.id,
      auditCategory: 'documents', detail: `${documents.length} tracked deliverable(s); ${pendingCount} awaiting submission`,
    };
  }

  private billingItem(statements: OpsBillingStatement[], milestones: OpsPaymentMilestone[], referenceable: boolean): DerivedFileRequirementItem {
    const unpaid = milestones.filter((milestone) => milestone.status !== 'paid' || milestone.remainingBalance > 0).length;
    return {
      key: 'billing_statement', label: 'Billing and payment schedule', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
      sourceWorkflow: 'commercial', status: statements.length > 0 && milestones.length > 0 && unpaid === 0 ? 'complete' : 'pending',
      generatedDocumentId: referenceable ? statements[0]?.id : undefined, auditCategory: 'finance',
      detail: statements.length === 0 ? 'No billing statement generated' : `${milestones.length} payment milestone(s); ${unpaid} still unpaid`,
    };
  }

  private floorplanItem(event: OpsEvent | null): DerivedFileRequirementItem {
    return {
      key: 'official_floorplan', label: 'Official floorplan', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client', 'coordinator'],
      sourceWorkflow: 'floorplans', status: event?.floorPlanStatus === 'approved' ? 'approved' : 'pending',
      auditCategory: 'events', detail: `Floorplan status is ${event?.floorPlanStatus ?? 'unknown'}`,
    };
  }

  private supplierReviewItem(reviews: OpsSupplierReview[]): DerivedFileRequirementItem {
    return {
      key: 'supplier_reviews', label: 'Supplier review capture', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'],
      sourceWorkflow: 'supplier_network', status: reviews.length > 0 ? 'complete' : 'missing', auditCategory: 'suppliers',
      detail: `${reviews.length} supplier review(s) recorded`,
    };
  }

  private clientFeedbackItem(documents: OpsDocument[], postEventDocuments: OpsPostEventDocument[], response: { id: string; rating: number; submittedAt: Date } | null): DerivedFileRequirementItem {
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
