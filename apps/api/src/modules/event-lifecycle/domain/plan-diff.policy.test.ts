import { describe, expect, it } from 'vitest';
import type { PlanningTemplateItemInput } from '@prism/types';
import { diffPlan, planPreviewToken, type ExistingPlanItem } from './plan-diff.policy';

const EVENT_DATE = '2026-12-20';
const TODAY = '2026-11-11';

const templateItem = (key: string, overrides: Partial<PlanningTemplateItemInput> = {}): PlanningTemplateItemInput => ({
  key, title: `Task ${key}`, ownerRole: 'Account manager', offsetDays: -30, dependsOn: null, notes: '', ...overrides,
});

/** The item as an earlier apply of the same version left it. */
const placed = (key: string, overrides: Partial<ExistingPlanItem> = {}): ExistingPlanItem => ({
  id: `item_${key}`, key, title: `Task ${key}`, ownerRole: 'Account manager', dueDate: '2026-11-20', notes: '', dependsOn: null,
  status: 'open', customized: false, templateVersion: 1, ...overrides,
});

const run = (items: PlanningTemplateItemInput[], existing: ExistingPlanItem[], version = 1, eventDateKey = EVENT_DATE) =>
  diffPlan({ eventDateKey, todayKey: TODAY, items, existing, version });

describe('plan diff', () => {
  it('adds every task with a date counted from the event, flagging the ones already past due', () => {
    const diff = run([
      templateItem('book-venue', { offsetDays: -90 }),
      templateItem('send-invoice', { offsetDays: -30, dependsOn: 'book-venue', notes: 'Use the PMCM template' }),
      templateItem('thank-you', { offsetDays: 7 }),
    ], []);

    expect(diff.add.map((entry) => [entry.key, entry.dueDate, entry.pastDue])).toEqual([
      ['book-venue', '2026-09-21', true],
      ['send-invoice', '2026-11-20', false],
      ['thank-you', '2026-12-27', false],
    ]);
    expect(diff.add[1]).toMatchObject({ dependsOn: 'book-venue', notes: 'Use the PMCM template', ownerRole: 'Account manager' });
    expect(diff).toMatchObject({ update: [], kept: [], removedFromTemplate: [], unchanged: 0 });
  });

  it('does nothing when the same version is applied again, so a repeat cannot duplicate a task', () => {
    const diff = run([templateItem('a'), templateItem('b', { offsetDays: -10 })], [placed('a'), placed('b', { dueDate: '2026-12-10' })]);
    expect(diff).toEqual({ add: [], update: [], kept: [], removedFromTemplate: [], unchanged: 2, restamp: [] });
  });

  it('updates an open task nobody touched when the template changed, naming each field', () => {
    const diff = run([templateItem('a', { title: 'Confirm the venue', ownerRole: 'Operations', offsetDays: -45, notes: 'Call first' })], [placed('a')], 2);

    expect(diff.update).toHaveLength(1);
    expect(diff.update[0]).toMatchObject({ id: 'item_a', key: 'a', title: 'Task a' });
    expect(diff.update[0]!.changes).toEqual([
      { field: 'title', from: 'Task a', to: 'Confirm the venue' },
      { field: 'ownerRole', from: 'Account manager', to: 'Operations' },
      { field: 'dueDate', from: '2026-11-20', to: '2026-11-05' },
      { field: 'notes', from: '', to: 'Call first' },
    ]);
    expect(diff.update[0]!.patch).toEqual({ title: 'Confirm the venue', ownerRole: 'Operations', dueDate: '2026-11-05', notes: 'Call first', dependsOn: null });
    expect(diff.add).toEqual([]);
  });

  it('keeps finished work exactly as it is, whatever the template now says', () => {
    const changed = [templateItem('done-one', { title: 'Renamed', offsetDays: -5 }), templateItem('skipped-one', { ownerRole: 'Finance' })];
    const diff = run(changed, [placed('done-one', { status: 'done' }), placed('skipped-one', { status: 'skipped' })], 2);

    expect(diff.update).toEqual([]);
    expect(diff.kept.map((entry) => [entry.key, entry.reason])).toEqual([['done-one', 'done'], ['skipped-one', 'skipped']]);
    expect(diff.kept[0]!.changes.map((change) => change.field)).toEqual(['title', 'dueDate']);
  });

  it('keeps a task someone edited, and still adds what is new beside it', () => {
    const diff = run(
      [templateItem('a', { offsetDays: -45 }), templateItem('b')],
      [placed('a', { customized: true, dueDate: '2026-11-25' })],
      2,
    );

    expect(diff.kept).toEqual([expect.objectContaining({ key: 'a', reason: 'edited', changes: [{ field: 'dueDate', from: '2026-11-25', to: '2026-11-05' }] })]);
    expect(diff.update).toEqual([]);
    expect(diff.add.map((entry) => entry.key)).toEqual(['b']);
  });

  it('never deletes: a task the new version dropped is listed and left on the plan, whatever its state', () => {
    const diff = run([templateItem('a')], [placed('a'), placed('retired', { status: 'done' }), placed('also-retired', { customized: true })], 2);

    expect(diff.removedFromTemplate).toEqual([
      { id: 'item_retired', key: 'retired', title: 'Task retired', status: 'done' },
      { id: 'item_also-retired', key: 'also-retired', title: 'Task also-retired', status: 'open' },
    ]);
    expect(diff.add).toEqual([]);
    expect(diff.update).toEqual([]);
  });

  it('moves open tasks with the event but leaves finished and edited ones where they are', () => {
    const diff = run(
      [templateItem('open-one'), templateItem('done-one'), templateItem('edited-one')],
      [placed('open-one'), placed('done-one', { status: 'done' }), placed('edited-one', { customized: true })],
      1,
      '2027-01-10',
    );

    expect(diff.update.map((entry) => [entry.key, entry.patch.dueDate])).toEqual([['open-one', '2026-12-11']]);
    expect(diff.kept.map((entry) => [entry.key, entry.reason])).toEqual([['done-one', 'done'], ['edited-one', 'edited']]);
  });

  it('treats a changed dependency as a change, and restamps tasks that already match the new version', () => {
    const diff = run([templateItem('a'), templateItem('b', { dependsOn: 'a' })], [placed('a'), placed('b')], 2);
    expect(diff.update[0]).toMatchObject({ key: 'b', changes: [{ field: 'dependsOn', from: '', to: 'a' }] });
    expect(diff.restamp).toEqual(['item_a']);
    expect(diff.unchanged).toBe(1);
  });
});

describe('plan preview token', () => {
  const tokenOf = (diff: ReturnType<typeof run>, version = 2) => planPreviewToken({ eventId: 'evt_1', templateId: 'tpl_1', version, eventDateKey: EVENT_DATE, diff });

  it('is the same for the same plan and changes as soon as anything the apply would write changes', () => {
    const items = [templateItem('a', { offsetDays: -45 })];
    const base = run(items, [placed('a')], 2);
    expect(tokenOf(base)).toBe(tokenOf(run(items, [placed('a')], 2)));
    expect(tokenOf(base)).toMatch(/^[0-9a-f]{32}$/);

    // Someone finished the task between the preview and the apply: it is now kept, so the preview no longer holds.
    expect(tokenOf(base)).not.toBe(tokenOf(run(items, [placed('a', { status: 'done' })], 2)));
    // Someone added a task by another route.
    expect(tokenOf(base)).not.toBe(tokenOf(run([...items, templateItem('b')], [placed('a')], 2)));
    // Another version of the same template.
    expect(tokenOf(base, 2)).not.toBe(tokenOf(base, 3));
  });

  it('does not change when only the clock moves a task past due', () => {
    const items = [templateItem('a', { offsetDays: -30 })];
    const early = diffPlan({ eventDateKey: EVENT_DATE, todayKey: '2026-11-11', items, existing: [], version: 1 });
    const late = diffPlan({ eventDateKey: EVENT_DATE, todayKey: '2026-12-01', items, existing: [], version: 1 });
    expect(early.add[0]!.pastDue).toBe(false);
    expect(late.add[0]!.pastDue).toBe(true);
    expect(tokenOf(early, 1)).toBe(tokenOf(late, 1));
  });
});
