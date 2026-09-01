import { describe, expect, it } from 'vitest';
import { LiveOpsEscalationLevel } from '@prism/kernel/event-core';
import { EscalationPolicyViolation, resolveEscalationLevel } from './live-ops-escalation.policy';

describe('resolveEscalationLevel', () => {
  it('defaults to RoleLead when no value is given', () => {
    expect(resolveEscalationLevel(undefined)).toBe(LiveOpsEscalationLevel.RoleLead);
  });

  it('accepts RoleLead, Pmcm, and Critical', () => {
    expect(resolveEscalationLevel('role_lead')).toBe(LiveOpsEscalationLevel.RoleLead);
    expect(resolveEscalationLevel('pmcm')).toBe(LiveOpsEscalationLevel.Pmcm);
    expect(resolveEscalationLevel('critical')).toBe(LiveOpsEscalationLevel.Critical);
  });

  it('rejects None even though it is a valid ops constant', () => {
    expect(() => resolveEscalationLevel('none')).toThrow(EscalationPolicyViolation);
  });

  it('rejects an unknown value', () => {
    expect(() => resolveEscalationLevel('made-up-level')).toThrow(EscalationPolicyViolation);
  });

  it('trims whitespace before validating', () => {
    expect(resolveEscalationLevel('  critical  ')).toBe(LiveOpsEscalationLevel.Critical);
  });
});
