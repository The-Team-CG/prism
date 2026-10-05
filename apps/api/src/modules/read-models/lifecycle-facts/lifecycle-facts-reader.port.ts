import type { Prisma } from '@prisma/client';

export type ComplianceLifecycleFacts = {
  coverageRequirements: Array<{ role: string; required: number }>;
  coordinatorAssignments: Array<{ role: string; status: string; withdrawnAt: Date | null }>;
  guestRosterCount: number;
};

export type ClosureLifecycleFacts = {
  guestFeedback: Array<{ id: string; rating: number; moderationStatus: string; privacyConsentAccepted: boolean; privacyConsentWithdrawnAt: Date | null }>;
  issues: Array<{ id: string }>;
  scheduleDays: Array<{ id: string; segments: Array<{ id: string; actualEndedAt: Date | null; plannedEndAt: Date }> }>;
};

export type LifecycleFactsClient = Prisma.TransactionClient;

export interface LifecycleFactsReader {
  getComplianceFacts(eventId: string, client?: LifecycleFactsClient): Promise<ComplianceLifecycleFacts>;
  getClosureFacts(eventId: string, client?: LifecycleFactsClient): Promise<ClosureLifecycleFacts>;
}

export const LIFECYCLE_FACTS_READER = Symbol('LIFECYCLE_FACTS_READER');
