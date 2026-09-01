import { describe, expect, it } from 'vitest';
import { UrgentIssueStatus } from '@prism/kernel/event-core';
import { isTerminalUrgentIssueStatus, resolveUrgentIssueStatusOnCreate } from './urgent-issue-status.policy';

describe('resolveUrgentIssueStatusOnCreate', () => {
  it('resolves to Assigned when an owner role is given', () => {
    expect(resolveUrgentIssueStatusOnCreate({ ownerRole: 'coordinator' })).toBe(UrgentIssueStatus.Assigned);
  });

  it('resolves to Assigned when an owner name is given', () => {
    expect(resolveUrgentIssueStatusOnCreate({ ownerName: 'Maxine' })).toBe(UrgentIssueStatus.Assigned);
  });

  it('resolves to Open when no owner is given', () => {
    expect(resolveUrgentIssueStatusOnCreate({})).toBe(UrgentIssueStatus.Open);
  });
});

describe('isTerminalUrgentIssueStatus', () => {
  it('treats resolved and cancelled as terminal', () => {
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Resolved)).toBe(true);
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Cancelled)).toBe(true);
  });

  it('treats open and assigned as non-terminal', () => {
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Open)).toBe(false);
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Assigned)).toBe(false);
  });
});
