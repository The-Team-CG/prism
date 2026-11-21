import type { Prisma } from '@prisma/client';

/**
 * The client reads the milestones of the statement in force for them: the latest one PMCM has sent. A statement PMCM
 * corrected stays in force for the client until the correction is sent, so they never read "paid in full" with no
 * milestones in between. PMCM always reads the live, unsuperseded milestones.
 */
export const CLIENT_VISIBLE_MILESTONE = {
  OR: [
    { statementId: null, supersededAt: null },
    { statement: { is: { sentAt: { not: null }, revisions: { none: { sentAt: { not: null } } } } } },
  ],
} satisfies Prisma.OpsPaymentMilestoneWhereInput;
