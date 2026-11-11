import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import type { AuditWriter } from '@prism/kernel/access-control';
import type { PlanningTemplateItemInput, PrismDateChangeImpact } from '@prism/types';
import { EventDateImpactService } from '../../src/modules/event-lifecycle/application/change/event-date-impact.service';
import { EventPlanService } from '../../src/modules/event-lifecycle/application/planning/event-plan.service';
import { PlanningTemplatesService } from '../../src/modules/event-lifecycle/application/planning/planning-templates.service';
import { DateChangeFactsReaderService } from '../../src/modules/read-models/date-change-facts/date-change-facts-reader.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

const item = (key: string, offsetDays: number): PlanningTemplateItemInput => ({ key, title: `Task ${key}`, ownerRole: 'Account manager', offsetDays, dependsOn: null, notes: '' });
const CURRENT = '2031-04-18';
const MOVED = '2031-05-02';

describe.skipIf(!live)('event date impact against PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 14);
  const actor = { id: `impact-actor-${suffix}`, name: `Impact Test ${suffix}`, role: 'pmcm-admin', email: 'impact-test@example.test' };
  const id = (key: string) => `impact_${key}_${suffix}`;
  const auditWriter: AuditWriter = { write: async () => undefined };
  let prisma: PrismaService;
  let plans: EventPlanService;
  let templates: PlanningTemplatesService;
  let impact: EventDateImpactService;
  let templateOne: string;
  let templateTwo: string;

  const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
  const moveEvent = (date: string) => prisma.opsEvent.update({ where: { id: id('event_a') }, data: { eventDate: at(date) } });
  const planOf = async () => Object.fromEntries((await prisma.opsEventPlanItem.findMany({ where: { eventId: id('event_a') } })).map((row) => [`${row.templateId === templateOne ? 't1' : 't2'}:${row.itemKey}`, row]));
  const tokensOf = (result: PrismDateChangeImpact) => result.plan.templates.map((template) => ({ templateId: template.templateId, version: template.version, previewToken: template.previewToken }));
  const moneyAndBookings = async () => JSON.stringify([
    await prisma.opsPaymentMilestone.findMany({ where: { eventId: id('event_a') }, orderBy: { id: 'asc' } }),
    await prisma.opsSupplierQuoteRequest.findMany({ where: { eventId: id('event_a') }, orderBy: { id: 'asc' }, select: { id: true, status: true, assignmentStatus: true } }),
    await prisma.opsBillingStatement.findMany({ where: { eventId: id('event_a') }, select: { id: true, sentAt: true, totalAmount: true } }),
  ]);

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PRISMA_DATABASE_URL = databaseUrl!;
    process.env.DIRECT_URL = databaseUrl!;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    plans = new EventPlanService(prisma, auditWriter);
    templates = new PlanningTemplatesService(prisma, auditWriter);
    impact = new EventDateImpactService(new DateChangeFactsReaderService(prisma), plans);

    for (const [key, name, date] of [['a', 'Impact Event A', CURRENT], ['b', 'Impact Gala B', MOVED]] as const) {
      await prisma.opsInquiry.create({ data: {
        id: id(`inquiry_${key}`), clientName: `Impact Client ${key}`, email: `${id(`inquiry_${key}`)}@example.test`, normalizedEmail: `${id(`inquiry_${key}`)}@example.test`,
        eventName: name, eventDate: at(date), clientType: 'corporate',
      } });
      await prisma.opsEvent.create({ data: { id: id(`event_${key}`), inquiryId: id(`inquiry_${key}`), clientName: `Impact Client ${key}`, eventName: name, eventDate: at(date) } });
    }
    // The event has a signed conforme, an approved proposal and floor plan, and a billing statement the client was sent.
    await prisma.opsConformeExecution.create({ data: {
      id: id('conforme'), inquiryId: id('inquiry_a'), eventId: id('event_a'), templateVersion: 1, templateContent: 't', templateSha256: 'a'.repeat(64),
      documentContent: 'd', documentSha256: 'b'.repeat(64), status: 'completed', completedAt: new Date(),
    } });
    await prisma.opsEvent.update({ where: { id: id('event_a') }, data: { proposalClientStatus: 'approved', floorPlanStatus: 'approved' } });
    await prisma.opsBillingStatement.create({ data: { id: id('statement'), eventId: id('event_a'), number: `IMP-${suffix}`, totalAmount: 150000, status: 'sent', sentAt: new Date() } });
    await prisma.opsPaymentMilestone.createMany({ data: [
      { id: id('paid'), eventId: id('event_a'), statementId: id('statement'), label: 'Deposit', amount: 100000, amountPaid: 100000, remainingBalance: 0, dueDate: at('2031-02-01'), status: 'paid' },
      { id: id('balance'), eventId: id('event_a'), statementId: id('statement'), label: 'Balance', amount: 50000, remainingBalance: 50000, dueDate: at('2031-04-11') },
      { id: id('old'), eventId: id('event_a'), statementId: id('statement'), label: 'Replaced', amount: 20000, remainingBalance: 20000, dueDate: at('2031-04-01'), supersededAt: new Date() },
    ] });

    // Three selected bookings for the event, and one quote that is only received. Another event on the new date holds supplier one.
    await prisma.opsSupplierCategory.create({ data: { id: id('category'), slug: `${id('category')}-slug`, name: 'Impact Category' } });
    for (const key of ['s1', 's2', 's3']) {
      await prisma.opsSupplier.create({ data: { id: id(key), categoryId: id('category'), name: `Impact Supplier ${key}`, email: `${id(key)}@example.test` } });
    }
    const request = (key: string, eventKey: string, supplierKey: string, status: string, assignmentStatus: string, category: string) =>
      prisma.opsSupplierQuoteRequest.create({ data: {
        id: id(key), eventId: id(eventKey), supplierId: id(supplierKey), categoryId: id('category'), supplierName: `Impact Supplier ${supplierKey}`, category,
        accessToken: `${id(key)}-token`, status, assignmentStatus,
      } });
    await request('req1', 'event_a', 's1', 'selected', 'confirmed', 'Catering');
    await request('req2', 'event_a', 's2', 'selected', 'pending_confirmation', 'Sound');
    await request('req3', 'event_a', 's3', 'selected', 'confirmed', 'Lights');
    await request('req4', 'event_a', 's3', 'received', 'pending_confirmation', 'Decor');
    await request('reqb', 'event_b', 's1', 'selected', 'confirmed', 'Catering');
    await prisma.opsSupplierAvailability.create({ data: { id: id('blocked'), supplierId: id('s2'), availableOn: at(MOVED), blocked: true } });

    // Two templates applied to the event: one with a finished task, an edited task and an open one; one with a single open task.
    templateOne = (await templates.create({ name: `Impact One ${suffix}`, description: '', items: [item('a', -30), item('b', -10), item('c', -3)] }, actor)).id;
    templateTwo = (await templates.create({ name: `Impact Two ${suffix}`, description: '', items: [item('x', -20)] }, actor)).id;
    for (const templateId of [templateOne, templateTwo]) {
      const preview = await plans.preview(id('event_a'), { templateId });
      await plans.apply(id('event_a'), { templateId, version: 1, previewToken: preview.previewToken }, actor);
    }
    const rows = await planOf();
    await plans.updateItem(id('event_a'), rows['t1:a']!.id, { status: 'done' }, actor);
    await plans.updateItem(id('event_a'), rows['t1:b']!.id, { dueDate: '2031-04-09' }, actor);
  });

  afterAll(async () => {
    if (!live) return;
    const eventIds = [id('event_a'), id('event_b')];
    await prisma.opsEventPlanItem.deleteMany({ where: { eventId: { in: eventIds } } });
    const owned = await prisma.opsPlanningTemplate.findMany({ where: { name: { contains: suffix } }, select: { id: true } });
    await prisma.opsPlanningTemplateVersion.deleteMany({ where: { templateId: { in: owned.map((template) => template.id) } } });
    await prisma.opsPlanningTemplate.deleteMany({ where: { id: { in: owned.map((template) => template.id) } } });
    await prisma.opsSupplierQuoteRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsSupplierAvailability.deleteMany({ where: { supplierId: { in: [id('s1'), id('s2'), id('s3')] } } });
    await prisma.opsSupplier.deleteMany({ where: { id: { in: [id('s1'), id('s2'), id('s3')] } } });
    await prisma.opsSupplierCategory.deleteMany({ where: { id: id('category') } });
    await prisma.opsPaymentMilestone.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsBillingStatement.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsConformeExecution.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.opsInquiry.deleteMany({ where: { id: { in: [id('inquiry_a'), id('inquiry_b')] } } });
    await prisma.$disconnect();
  });

  it('shows what a date still being considered would touch, and changes nothing', async () => {
    const before = await moneyAndBookings();
    const planBefore = JSON.stringify(Object.values(await planOf()).map((row) => [row.id, row.dueDate, row.status, row.templateVersion]).sort());

    const result = await impact.impact(id('event_a'), { newDate: MOVED });

    expect(result).toMatchObject({ currentDate: CURRENT, newDate: MOVED, shiftDays: 14, planApplicable: false, eventName: 'Impact Event A' });
    // Suppliers: only selected bookings, each with why it may not serve that day.
    expect(result.suppliers.map((supplier) => [supplier.category, supplier.conflicts])).toEqual([
      ['Catering', ['Already booked for Impact Gala B on that date']],
      ['Lights', []],
      ['Sound', ['Marked unavailable on that date']],
    ]);
    // Payments: the paid deposit is left alone; the balance owed is offered the same shift; the replaced milestone is not listed.
    expect(result.payments.map((payment) => [payment.label, payment.state, payment.amountPaid, payment.suggestedDueDate])).toEqual([
      ['Deposit', 'paid', 100000, null],
      ['Balance', 'open', 0, '2031-04-25'],
    ]);
    // What the client signed or approved is listed and never touched.
    expect(result.approvedWork.map((entry) => entry.kind)).toEqual(['conforme', 'proposal', 'floorplan', 'billing']);
    // The plan: the open untouched tasks would move, finished and edited ones would stay.
    expect(result.plan).toMatchObject({ movable: 2, kept: 2 });
    expect(result.plan.templates.every((template) => template.eventDate === MOVED)).toBe(true);

    expect(await moneyAndBookings()).toBe(before);
    expect(JSON.stringify(Object.values(await planOf()).map((row) => [row.id, row.dueDate, row.status, row.templateVersion]).sort())).toBe(planBefore);
  });

  it('treats the date the event already has as no change, and reports no supplier conflicts or payment suggestions for it', async () => {
    const result = await impact.impact(id('event_a'), { newDate: CURRENT });
    expect(result).toMatchObject({ newDate: null, shiftDays: null, planApplicable: true });
    expect(result.suppliers.every((supplier) => supplier.conflicts.length === 0)).toBe(true);
    expect(result.payments.every((payment) => payment.suggestedDueDate === null)).toBe(true);
    // Only the task someone moved by hand differs from the template, and it is kept.
    expect(result.plan).toMatchObject({ movable: 0, kept: 1 });
    await expect(impact.impact(`missing_${suffix}`, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('moves only the plan once the date is recorded, applying exactly what was previewed and nothing else', async () => {
    await moveEvent(MOVED);
    const before = await moneyAndBookings();
    const result = await impact.impact(id('event_a'), {});
    expect(result).toMatchObject({ currentDate: MOVED, planApplicable: true, plan: { movable: 2, kept: 2 } });

    const applied = await impact.syncPlan(id('event_a'), { templates: tokensOf(result) }, actor);
    expect(applied).toMatchObject({ added: 0, updated: 2, kept: 2 });
    const rows = await planOf();
    // The open untouched tasks follow the event; the finished and the edited task stay exactly where they were.
    expect(rows['t1:c']!.dueDate).toEqual(at('2031-04-29'));
    expect(rows['t2:x']!.dueDate).toEqual(at('2031-04-12'));
    expect(rows['t1:a']).toMatchObject({ status: 'done', dueDate: at('2031-03-19') });
    expect(rows['t1:b']).toMatchObject({ customized: true, dueDate: at('2031-04-09') });
    // Money, bookings and approvals are exactly as they were.
    expect(await moneyAndBookings()).toBe(before);

    // Nothing is left to move, and the same previews cannot be applied again.
    expect((await impact.impact(id('event_a'), {})).plan).toMatchObject({ movable: 0 });
    await expect(impact.syncPlan(id('event_a'), { templates: tokensOf(result) }, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies every previewed template or none: one that changed since its preview refuses the lot', async () => {
    await moveEvent(CURRENT);
    const result = await impact.impact(id('event_a'), {});
    expect(result.plan.movable).toBe(2);
    // Someone finishes the only open task of template two after the preview.
    const rows = await planOf();
    await plans.updateItem(id('event_a'), rows['t2:x']!.id, { status: 'done' }, actor);
    const before = JSON.stringify(Object.values(await planOf()).map((row) => [row.id, row.dueDate]).sort());

    await expect(impact.syncPlan(id('event_a'), { templates: tokensOf(result) }, actor)).rejects.toThrow(/plan changed since you previewed/);
    expect(JSON.stringify(Object.values(await planOf()).map((row) => [row.id, row.dueDate]).sort())).toBe(before);
  });

  it('keeps an archived template in step with the date, but refuses a date only being considered and an archived event', async () => {
    await templates.setArchived(templateOne, true, actor);
    const result = await impact.impact(id('event_a'), {});
    expect(result.plan.templates.map((template) => template.templateId)).toContain(templateOne);

    // A token from a date that is only being considered can never be applied: the event does not have that date.
    const hypothetical = await impact.impact(id('event_a'), { newDate: '2031-06-01' });
    await expect(impact.syncPlan(id('event_a'), { templates: tokensOf(hypothetical) }, actor)).rejects.toBeInstanceOf(ConflictException);

    await prisma.opsEvent.update({ where: { id: id('event_a') }, data: { archived: true } });
    expect((await impact.impact(id('event_a'), {})).planApplicable).toBe(false);
    await expect(impact.syncPlan(id('event_a'), { templates: tokensOf(result) }, actor)).rejects.toThrow(/archived/);
    await prisma.opsEvent.update({ where: { id: id('event_a') }, data: { archived: false } });
    await templates.setArchived(templateOne, false, actor);
  });
});
