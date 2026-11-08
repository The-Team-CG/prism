import type { PrismCoordinatorReplacementCandidate, PrismCoordinatorSuggestion } from '@prism/types';

/**
 * FR-AI-04 PARE coordinator mode. The package follows the PARE stages: event context (role, event, time left),
 * replacement search (free same-role coordinators ranked by skills), risk, and a drafted message to the first pick.
 * There is no budget stage, because coordinators are PMCM staff. PMCM approves before anyone is assigned or contacted.
 */
export function buildCoordinatorReplacementPackage(input: {
  role: string;
  withdrawnCoordinatorName: string;
  eventName: string;
  eventDate: Date;
  now: Date;
  suggestions: PrismCoordinatorSuggestion[];
}) {
  const hoursToEvent = Math.max(0, Math.round((input.eventDate.getTime() - input.now.getTime()) / 3_600_000));
  const candidates: PrismCoordinatorReplacementCandidate[] = input.suggestions.map((suggestion) => ({
    coordinatorId: suggestion.id, name: suggestion.name, matchedSkills: suggestion.matchedSkills, missingSkills: suggestion.missingSkills,
  }));
  const critical = candidates.length === 0 || hoursToEvent <= 24;
  const riskSummary = candidates.length === 0
    ? `No free ${input.role} coordinator on the event date, ${hoursToEvent} hours out. Consider reassigning from another role or bringing in an outside coordinator.`
    : `${input.role} is uncovered ${hoursToEvent} hours before the event. ${candidates.length} free coordinator(s) found; the first has ${candidates[0]!.missingSkills.length} missing skill(s).`;
  const day = input.eventDate.toISOString().slice(0, 10);
  const draftMessage = candidates.length
    ? `Hi ${candidates[0]!.name}, PMCM needs a ${input.role} for ${input.eventName} on ${day} after ${input.withdrawnCoordinatorName} withdrew. Please acknowledge the assignment in your coordinator portal as soon as you can.`
    : `PMCM needs a ${input.role} for ${input.eventName} on ${day}. No free coordinator was found; please reply if you can cover.`;
  return { hoursToEvent, riskLevel: critical ? 'critical' as const : 'high' as const, riskSummary, candidates, draftMessage };
}
