import type { OpsBriefing } from '@prisma/client';
import type { SubmitBriefingInput } from '@prism/types';

export interface ClientOnboardingCommands {
  submitBriefing(eventId: string, input: SubmitBriefingInput): Promise<OpsBriefing>;
}
