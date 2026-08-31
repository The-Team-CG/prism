import { LiveOpsEscalationLevel, isOpsConstantValue } from '@prism/modules/event-core';

type LiveOpsEscalationLevelValue = (typeof LiveOpsEscalationLevel)[keyof typeof LiveOpsEscalationLevel];

const ESCALATABLE_LEVELS: readonly LiveOpsEscalationLevelValue[] = [
  LiveOpsEscalationLevel.RoleLead,
  LiveOpsEscalationLevel.Pmcm,
  LiveOpsEscalationLevel.Critical,
];

/**
 * Framework-independent policy violation. Service callers translate this
 * into a transport-specific error (e.g. Nest's BadRequestException).
 */
export class EscalationPolicyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EscalationPolicyViolation';
  }
}

/**
 * Resolves and validates a requested escalation level. `none` is a valid
 * ops constant (the resting state before any escalation) but is not a
 * level a caller may escalate *to* — escalation always moves to
 * RoleLead, Pmcm, or Critical.
 */
export function resolveEscalationLevel(value?: string): LiveOpsEscalationLevelValue {
  const escalationLevel = value?.trim();
  if (!escalationLevel) return LiveOpsEscalationLevel.RoleLead;

  if (
    !isOpsConstantValue(LiveOpsEscalationLevel, escalationLevel) ||
    !ESCALATABLE_LEVELS.some((allowedLevel) => allowedLevel === escalationLevel)
  ) {
    throw new EscalationPolicyViolation('Unsupported escalation level');
  }

  return escalationLevel as LiveOpsEscalationLevelValue;
}
