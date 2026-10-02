import { canonicalCoordinatorRole } from '@prism/types';
import type { CoordinatorRole, PrismCoordinatorSuggestion } from '@prism/types';

export interface CoordinatorSuggestionCandidate {
  id: string;
  name: string;
  roleTags: string[];
  skillsTags: string[];
}

export function normalizeCoordinatorMatchText(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function displaySkill(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function rankCoordinatorSuggestions(input: {
  coordinators: CoordinatorSuggestionCandidate[];
  role: CoordinatorRole;
  requiredSkills: string[];
  selectedSkills?: string[];
  excludeCoordinatorId?: string;
}): PrismCoordinatorSuggestion[] {
  const requiredSkills = new Map<string, string>();
  for (const skill of input.requiredSkills) {
    const key = normalizeCoordinatorMatchText(skill);
    if (key && !requiredSkills.has(key)) requiredSkills.set(key, displaySkill(skill));
  }

  const selectedSkills = [...new Set((input.selectedSkills ?? []).map(normalizeCoordinatorMatchText).filter(Boolean))];
  const candidates = input.coordinators
    .filter((coordinator) => coordinator.id !== input.excludeCoordinatorId)
    .filter((coordinator) => coordinator.roleTags.some((roleTag) => canonicalCoordinatorRole(roleTag) === input.role))
    .map((coordinator) => {
      const coordinatorSkills = new Set(coordinator.skillsTags.map(normalizeCoordinatorMatchText).filter(Boolean));
      if (!selectedSkills.every((skill) => coordinatorSkills.has(skill))) return undefined;

      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];
      for (const [key, label] of requiredSkills) {
        (coordinatorSkills.has(key) ? matchedSkills : missingSkills).push(label);
      }

      const suggestion: PrismCoordinatorSuggestion = {
        id: coordinator.id,
        name: coordinator.name,
        role: input.role,
        matchedSkills,
        missingSkills,
        matchedSkillCount: matchedSkills.length,
        requiredSkillCount: requiredSkills.size,
      };
      return suggestion;
    })
    .filter((candidate): candidate is PrismCoordinatorSuggestion => candidate !== undefined);

  return candidates
    .sort((left, right) =>
      right.matchedSkillCount - left.matchedSkillCount ||
      compareText(normalizeCoordinatorMatchText(left.name), normalizeCoordinatorMatchText(right.name)) ||
      compareText(left.id, right.id),
    )
    .slice(0, 5);
}
