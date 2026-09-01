import type { OpsBriefing } from '@prisma/client';
import type { SubmitBriefingInput } from '../application/onboarding/client-onboarding-workflow.service';

export interface ClientOnboardingCommands {
  submitBriefing(eventId: string, input: SubmitBriefingInput): Promise<OpsBriefing>;
}
