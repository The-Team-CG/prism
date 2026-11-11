import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import type { AuditWriter } from '@prism/kernel/access-control';
import type { PlanningTemplateItemInput, PrismPlanPreview } from '@prism/types';
import { EventPlanService } from '../../src/modules/event-lifecycle/application/planning/event-plan.service';
import { PlanningTemplatesService } from '../../src/modules/event-lifecycle/application/planning/planning-templates.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

const item = (key: string, overrides: Partial<PlanningTemplateItemInput> = {}): PlanningTemplateItemInput => ({
  key, title: `Task ${key}`, ownerRole: 'Account manager', offsetDays: -30, dependsOn: null, notes: '', ...overrides,
});

describe.skipIf(!live)('event planning against PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const actor = { id: `plan-actor-${suffix}`, name: `Plan Test ${suffix}`, role: 'pmcm-admin', email: 'plan-test@example.test' };
  const ids = { inquiryA: `plan_inquiry_a_${suffix}`, inquiryB: `plan_inquiry_b_${suffix}`, eventA: `plan_event_a_${suffix}`, eventB: `plan_event_b_${suffix}` };
  const audits: string[] = [];
  const auditWriter: AuditWriter = { write: async (input) => { audits.push(input.action); } };
  let prisma: PrismaService;
  let templates: PlanningTemplatesService;
  let plans: EventPlanService;
  let sequence = 0;

  const newTemplate = async (items: PlanningTemplateItemInput[]) => templates.create({ name: `Wedding ${suffix} ${(sequence += 1)}`, description: '', items }, actor);
  const rows = (eventId: string, templateId: string) =>
    prisma.opsEventPlanItem.findMany({ where: { eventId, templateId }, orderBy: { itemKey: 'asc' } });
  const applyPreview = (eventId: string, preview: PrismPlanPreview) =>
    plans.apply(eventId, { templateId: preview.templateId, version: preview.version, previewToken: preview.previewToken }, actor);
  const previewAndApply = async (eventId: string, templateId: string, version?: number) => {
    const preview = await plans.preview(eventId, { templateId, version });
    return { preview, result: await applyPreview(eventId, preview) };
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PRISMA_DATABASE_URL = databaseUrl!;
    process.env.DIRECT_URL = databaseUrl!;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    templates = new PlanningTemplatesService(prisma, auditWriter);
    plans = new EventPlanService(prisma, auditWriter);
    for (const [inquiryId, eventId, name, date] of [[ids.inquiryA, ids.eventA, 'A', '2031-04-18'], [ids.inquiryB, ids.eventB, 'B', '2031-06-20']] as const) {
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: `Plan Client ${name}`, email: `${inquiryId}@example.test`, normalizedEmail: `${inquiryId}@example.test`,
        eventName: `Plan Event ${name}`, eventDate: new Date(`${date}T00:00:00.000Z`), clientType: 'corporate',
      } });
      await prisma.opsEvent.create({ data: {
        id: eventId, inquiryId, clientName: `Plan Client ${name}`, eventName: `Plan Event ${name}`, eventDate: new Date(`${date}T00:00:00.000Z`),
      } });
    }
  });

  afterAll(async () => {
    if (!live) return;
    const eventIds = [ids.eventA, ids.eventB];
    await prisma.opsEventPlanItem.deleteMany({ where: { eventId: { in: eventIds } } });
    const owned = await prisma.opsPlanningTemplate.findMany({ where: { name: { contains: suffix } }, select: { id: true } });
    await prisma.opsPlanningTemplateVersion.deleteMany({ where: { templateId: { in: owned.map((template) => template.id) } } });
    await prisma.opsPlanningTemplate.deleteMany({ where: { id: { in: owned.map((template) => template.id) } } });
    await prisma.opsEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.opsInquiry.deleteMany({ where: { id: { in: [ids.inquiryA, ids.inquiryB] } } });
    await prisma.$disconnect();
  });

  it('publishes immutable versions: a change adds the next one, an identical list is refused, a name cannot repeat', async () => {
    const created = await newTemplate([item('a'), item('b', { offsetDays: -10, dependsOn: 'a' })]);
    expect(created).toMatchObject({ currentVersion: 1, itemCount: 2, archived: false });

    await expect(templates.publishVersion(created.id, { changeNote: '', items: [item('a'), item('b', { offsetDays: -10, dependsOn: 'a' })] }, actor)).rejects.toThrow(/Nothing changed since version 1/);
    const second = await templates.publishVersion(created.id, { changeNote: 'Earlier call', items: [item('a', { offsetDays: -45 }), item('b', { offsetDays: -10, dependsOn: 'a' })] }, actor);

    expect(second).toMatchObject({ currentVersion: 2 });
    expect(second.versions.map((version) => version.version)).toEqual([2, 1]);
    // The first version is exactly what was published, however many came after.
    expect(second.versions[1]!.items.map((entry) => entry.offsetDays)).toEqual([-30, -10]);
    expect((await templates.list()).find((entry) => entry.id === created.id)).toMatchObject({ currentVersion: 2, itemCount: 2 });
    await expect(templates.create({ name: created.name, description: '', items: [item('x')] }, actor)).rejects.toBeInstanceOf(ConflictException);
    await expect(templates.get(`missing_${suffix}`)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applies a previewed template once: dated from the event, owned, waiting on what it depends on, never duplicated', async () => {
    const template = await newTemplate([
      item('book-venue', { offsetDays: -90, ownerRole: 'Operations' }),
      item('send-invoice', { offsetDays: -30, dependsOn: 'book-venue', notes: 'Use the PMCM template' }),
    ]);
    const preview = await plans.preview(ids.eventA, { templateId: template.id });
    expect(preview).toMatchObject({ eventDate: '2031-04-18', version: 1, unchanged: 0, update: [], kept: [] });
    expect(preview.add.map((entry) => [entry.key, entry.dueDate])).toEqual([['book-venue', '2031-01-18'], ['send-invoice', '2031-03-19']]);
    // A preview changes nothing.
    expect(await rows(ids.eventA, template.id)).toHaveLength(0);

    const result = await applyPreview(ids.eventA, preview);
    expect(result).toMatchObject({ added: 2, updated: 0, kept: 0 });
    const invoice = result.items.find((entry) => entry.key === 'send-invoice')!;
    expect(invoice).toMatchObject({ dueDate: '2031-03-19', ownerRole: 'Account manager', dependsOn: 'book-venue', dependsOnTitle: 'Task book-venue', waiting: true, status: 'open', customized: false, notes: 'Use the PMCM template' });
    expect(result.items.find((entry) => entry.key === 'book-venue')).toMatchObject({ waiting: false, ownerRole: 'Operations' });

    // Presenting the same preview again is refused rather than applied twice; a fresh preview finds nothing to do.
    await expect(applyPreview(ids.eventA, preview)).rejects.toThrow(/plan changed since you previewed/);
    const again = await previewAndApply(ids.eventA, template.id);
    expect(again.preview).toMatchObject({ add: [], update: [], kept: [], unchanged: 2 });
    expect(await rows(ids.eventA, template.id)).toHaveLength(2);
    expect(audits.some((action) => action.startsWith('Applied planning template'))).toBe(true);
  });

  it('reapplies a newer version without touching finished or edited work, and never deletes a dropped task', async () => {
    const template = await newTemplate([item('a'), item('b'), item('c'), item('d'), item('e')]);
    await previewAndApply(ids.eventA, template.id);
    const byKey = async () => Object.fromEntries((await rows(ids.eventA, template.id)).map((row) => [row.itemKey, row]));
    const first = await byKey();

    await plans.updateItem(ids.eventA, first.a!.id, { status: 'done' }, actor);
    await plans.updateItem(ids.eventA, first.b!.id, { dueDate: '2031-03-01', ownerName: 'Ana' }, actor);
    await plans.updateItem(ids.eventA, first.c!.id, { status: 'skipped' }, actor);

    await templates.publishVersion(template.id, {
      changeNote: 'Tighter timeline',
      items: [
        item('a', { offsetDays: -60, title: 'A, renamed' }),
        item('b', { offsetDays: -60 }),
        item('c', { offsetDays: -60 }),
        item('d', { offsetDays: -60, ownerRole: 'Finance' }),
        item('f', { offsetDays: -5 }),
      ],
    }, actor);

    const preview = await plans.preview(ids.eventA, { templateId: template.id });
    expect(preview.version).toBe(2);
    expect(preview.add.map((entry) => entry.key)).toEqual(['f']);
    expect(preview.update.map((entry) => entry.key)).toEqual(['d']);
    expect(preview.kept.map((entry) => [entry.key, entry.reason])).toEqual([['a', 'done'], ['b', 'edited'], ['c', 'skipped']]);
    expect(preview.removedFromTemplate.map((entry) => entry.key)).toEqual(['e']);

    const result = await applyPreview(ids.eventA, preview);
    expect(result).toMatchObject({ added: 1, updated: 1, kept: 3 });
    const after = await byKey();
    // Finished and edited work is exactly as it was.
    expect(after.a).toMatchObject({ title: 'Task a', status: 'done', dueDate: first.a!.dueDate, templateVersion: 1 });
    expect(after.b).toMatchObject({ dueDate: new Date('2031-03-01T00:00:00.000Z'), ownerName: 'Ana', customized: true });
    expect(after.c).toMatchObject({ status: 'skipped', dueDate: first.c!.dueDate });
    // The untouched open task moved and was stamped with the new version; the new task arrived.
    expect(after.d).toMatchObject({ ownerRole: 'Finance', templateVersion: 2, dueDate: new Date('2031-02-17T00:00:00.000Z') });
    expect(after.f).toMatchObject({ templateVersion: 2, status: 'open' });
    // The task the template dropped is still on the plan.
    expect(after.e).toMatchObject({ status: 'open', templateVersion: 1 });
    expect(Object.keys(after)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('moves open tasks when the event date moves, and keeps the other event untouched', async () => {
    const template = await newTemplate([item('open-one', { offsetDays: -14 }), item('done-one', { offsetDays: -14 })]);
    await previewAndApply(ids.eventA, template.id);
    await previewAndApply(ids.eventB, template.id);
    const done = (await rows(ids.eventA, template.id)).find((row) => row.itemKey === 'done-one')!;
    await plans.updateItem(ids.eventA, done.id, { status: 'done' }, actor);

    await prisma.opsEvent.update({ where: { id: ids.eventA }, data: { eventDate: new Date('2031-05-02T00:00:00.000Z') } });
    const preview = await plans.preview(ids.eventA, { templateId: template.id });
    expect(preview.update.map((entry) => [entry.key, entry.changes[0]])).toEqual([['open-one', { field: 'dueDate', from: '2031-04-04', to: '2031-04-18' }]]);
    expect(preview.kept.map((entry) => [entry.key, entry.reason])).toEqual([['done-one', 'done']]);
    await applyPreview(ids.eventA, preview);

    expect((await plans.listItems(ids.eventA)).filter((entry) => entry.templateId === template.id).map((entry) => [entry.key, entry.dueDate])).toEqual([['done-one', '2031-04-04'], ['open-one', '2031-04-18']]);
    // The other event follows its own date and was never touched.
    expect((await plans.listItems(ids.eventB)).filter((entry) => entry.templateId === template.id).map((entry) => entry.dueDate)).toEqual(['2031-06-06', '2031-06-06']);
    await prisma.opsEvent.update({ where: { id: ids.eventA }, data: { eventDate: new Date('2031-04-18T00:00:00.000Z') } });
  });

  it('lets only one of two simultaneous applies of the same preview through, with no duplicate task', async () => {
    const template = await newTemplate([item('a'), item('b'), item('c')]);
    const preview = await plans.preview(ids.eventB, { templateId: template.id });
    const settled = await Promise.allSettled([applyPreview(ids.eventB, preview), applyPreview(ids.eventB, preview)]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((settled.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(await rows(ids.eventB, template.id)).toHaveLength(3);
  });

  it('edits one task: finishing stamps who and when, reopening clears it, and only wording or date changes pin it', async () => {
    const template = await newTemplate([item('a'), item('b')]);
    await previewAndApply(ids.eventA, template.id);
    const [a, b] = await rows(ids.eventA, template.id);

    const done = await plans.updateItem(ids.eventA, a!.id, { status: 'done' }, actor);
    expect(done).toMatchObject({ status: 'done', completedBy: actor.name, customized: false });
    expect(done.completedAt).not.toBeNull();
    expect(await plans.updateItem(ids.eventA, a!.id, { status: 'open' }, actor)).toMatchObject({ status: 'open', completedAt: null, completedBy: null });

    // Naming the person doing it is not a change to the task; changing its date is.
    expect(await plans.updateItem(ids.eventA, b!.id, { ownerName: 'Ana Reyes' }, actor)).toMatchObject({ ownerName: 'Ana Reyes', customized: false });
    expect(await plans.updateItem(ids.eventA, b!.id, { dueDate: '2031-03-30' }, actor)).toMatchObject({ dueDate: '2031-03-30', customized: true });

    await expect(plans.updateItem(ids.eventB, a!.id, { status: 'done' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(plans.updateItem(ids.eventA, `missing_${suffix}`, { status: 'done' }, actor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses an archived template, a version that does not exist, an unknown event, and an archived event', async () => {
    const template = await newTemplate([item('a')]);
    await expect(plans.preview(ids.eventA, { templateId: template.id, version: 9 })).rejects.toThrow(/Version 9 .* does not exist/);
    await expect(plans.preview(`missing_${suffix}`, { templateId: template.id })).rejects.toBeInstanceOf(NotFoundException);

    const preview = await plans.preview(ids.eventA, { templateId: template.id });
    await templates.setArchived(template.id, true, actor);
    await expect(plans.preview(ids.eventA, { templateId: template.id })).rejects.toThrow(/archived/);
    await expect(applyPreview(ids.eventA, preview)).rejects.toThrow(/archived/);
    await expect(templates.publishVersion(template.id, { changeNote: '', items: [item('b')] }, actor)).rejects.toThrow(/archived/);
    await expect(templates.setArchived(template.id, true, actor)).rejects.toThrow(/already archived/);
    await templates.setArchived(template.id, false, actor);

    await prisma.opsEvent.update({ where: { id: ids.eventB }, data: { archived: true } });
    const live = await plans.preview(ids.eventB, { templateId: template.id });
    await expect(applyPreview(ids.eventB, live)).rejects.toThrow(/archived/);
    await prisma.opsEvent.update({ where: { id: ids.eventB }, data: { archived: false } });
  });

  it('holds the database to a coherent task: only a finished one has a completion time, and a task key is used once per template', async () => {
    const template = await newTemplate([item('a')]);
    await previewAndApply(ids.eventA, template.id);
    const [row] = await rows(ids.eventA, template.id);
    await expect(prisma.opsEventPlanItem.update({ where: { id: row!.id }, data: { completedAt: new Date() } })).rejects.toThrow();
    await expect(prisma.opsEventPlanItem.update({ where: { id: row!.id }, data: { status: 'done' } })).rejects.toThrow();
    await expect(prisma.opsEventPlanItem.update({ where: { id: row!.id }, data: { status: 'cancelled' } })).rejects.toThrow();
    await expect(prisma.opsEventPlanItem.create({
      data: { id: `plan_dup_${suffix}`, eventId: ids.eventA, templateId: template.id, templateVersion: 1, itemKey: 'a', title: 'Again', ownerRole: 'X', dueDate: new Date('2031-01-01T00:00:00.000Z') },
    })).rejects.toThrow();
  });
});
