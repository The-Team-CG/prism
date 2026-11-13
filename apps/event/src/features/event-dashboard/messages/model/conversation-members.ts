import type { PrismCommunicationParticipantChoice } from "@prism/types";

type Member = { actorId: string; actorRole: string; active: boolean };

const PMCM_ROLES: readonly string[] = ["pmcm-admin", "system"];

export function isPmcmMember(member: Pick<Member, "actorRole">) {
  return PMCM_ROLES.includes(member.actorRole);
}

/**
 * Why this member cannot be removed now, or undefined when they can. The same rule the API enforces: at least two
 * members and one PMCM member must remain.
 */
export function removalBlocker(members: Member[], actorId: string): string | undefined {
  const remaining = members.filter((member) => member.active && member.actorId !== actorId);
  if (remaining.length < 2) return "A conversation needs at least two members.";
  if (!remaining.some(isPmcmMember)) return "Keep at least one PMCM member in the conversation.";
  return undefined;
}

/** Eligible people who are not in the conversation yet. */
export function addableChoices(eligible: PrismCommunicationParticipantChoice[], members: Member[]) {
  const inside = new Set(members.filter((member) => member.active).map((member) => member.actorId));
  return eligible.filter((person) => !inside.has(person.id));
}
