import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalHash } from '../src/modules/floorplan/application/live/canonical-hash.cjs';
import { planFloorplanConversion } from './floorplan-conversion.mjs';

const table = (id, label, assignedGuestIds) => ({
  id, kind: 'ellipse', category: 'furniture', name: 'Round Table', x: 1, y: 1, w: 2, h: 2, rotation: 0, seats: 8, label, assignedGuestIds,
});
const legacyGuests = [{ id: 'lg-ana', name: 'Ana Reyes' }, { id: 'lg-ben', name: ' Ben Cruz ' }, { id: 'lg-dup', name: 'Ana Reyes' }];
const roster = [{ id: 'ros-ana', name: 'Ana Reyes' }, { id: 'ros-ben', name: 'Ben Cruz' }];
const legacySnapshot = (objects) => ({ id: 'plan-1', name: 'Gala', venue: '', width: 20, height: 15, gridSize: 20, pax: 40, objects, guests: legacyGuests, suppliers: [], seats: [], seatCategories: [], updatedAt: '2026-11-01T00:00:00.000Z' });

function fixture(overrides = {}) {
  const objects = [table('t-1', 'T1', ['lg-ana', 'lg-dup', 'lg-missing']), table('t-2', 'T2', ['lg-ben'])];
  const snapshot = legacySnapshot(objects);
  return {
    plans: [{ id: 'plan-1', name: 'Gala', width: 20, height: 15, objects, guests: legacyGuests, scene: null, objectRows: [] }],
    drafts: [{ id: 'draft-1', eventId: 'event-1', floorPlanId: 'plan-1', sourceType: 'blank', submittedSnapshot: snapshot, approvedSnapshot: null }],
    versions: [{ id: 'version-1', draftId: 'draft-1', snapshot }],
    templatePlanIds: new Set(),
    roster: new Map([['event-1', roster]]),
    annotations: [{ id: 'note-1', draftId: 'draft-1', snapshotHash: canonicalHash(snapshot), objectId: 't-2' }],
    decisions: [{ id: 'decision-1', eventId: 'event-1', draftId: 'draft-1', snapshotHash: canonicalHash(snapshot), action: 'approve', comment: '' }],
    ...overrides,
  };
}

/** Applies planned statements to fixture rows the way the database would, so the second run sees converted rows. */
function applyToRows(data, statements) {
  const next = structuredClone(data);
  for (const { text, values } of statements) {
    if (text.startsWith('update floorplan.floor_plans')) next.plans.find((row) => row.id === values[2]).scene = values[0];
    else if (text.includes('floor_plan_drafts set submitted_snapshot')) next.drafts.find((row) => row.id === values[1]).submittedSnapshot = values[0];
    else if (text.includes('floor_plan_snapshot_versions')) next.versions.find((row) => row.id === values[1]).snapshot = values[0];
    else if (text.includes('client_annotations')) Object.assign(next.annotations.find((row) => row.id === values[2]), { snapshotHash: values[0], objectId: values[1] });
    else if (text.includes('client_decisions')) Object.assign(next.decisions.find((row) => row.id === values[2]), { snapshotHash: values[0] });
  }
  return next;
}

const sceneTables = (scene) => Object.values(scene.nodes).filter((node) => node.type === 'prism-table');

test('an event draft keeps a seat whose guest is on the roster and drops one with no match or a repeat', () => {
  const { statements, report } = planFloorplanConversion(fixture());
  const planWrite = statements.find((statement) => statement.text.includes('update floorplan.floor_plans'));
  const tables = Object.fromEntries(sceneTables(planWrite.values[0]).map((node) => [node.metadata.legacyId, node]));

  assert.deepEqual(tables['t-1'].guestIds, ['ros-ana']);
  assert.deepEqual(tables['t-2'].guestIds, ['ros-ben']);
  assert.deepEqual(report.seatsDroppedByEvent, { 'event-1': 2 });
  assert.equal(report.plans.eventDraft, 1);
});

test('a client preference draft and a venue template keep their layout and lose every seat', () => {
  const preference = fixture({
    drafts: [{ id: 'draft-1', eventId: 'event-1', floorPlanId: 'plan-1', sourceType: 'client_preference', submittedSnapshot: null, approvedSnapshot: null }],
    versions: [],
    annotations: [],
    decisions: [],
  });
  const template = fixture({ drafts: [], versions: [], annotations: [], decisions: [], templatePlanIds: new Set(['plan-1']) });

  for (const data of [preference, template]) {
    const { statements, report } = planFloorplanConversion(data);
    const scene = statements.find((statement) => statement.text.includes('update floorplan.floor_plans')).values[0];
    assert.deepEqual(sceneTables(scene).map((node) => node.guestIds), [[], []]);
    assert.deepEqual(report.seatsDroppedByEvent, {});
  }
});

test('a legacy snapshot gains a scene, and its annotation and decision follow the new hash and object id', () => {
  const data = fixture();
  const oldHash = canonicalHash(data.drafts[0].submittedSnapshot);
  const { statements, report } = planFloorplanConversion(data);

  const draftWrite = statements.find((statement) => statement.text.includes('submitted_snapshot'));
  const newSnapshot = draftWrite.values[0];
  const newHash = canonicalHash(newSnapshot);
  assert.notEqual(newHash, oldHash);
  assert.equal(newSnapshot.scene.format, 'pascal-v1');
  assert.equal(newSnapshot.name, 'Gala', 'the rest of the snapshot is kept');

  const annotationWrite = statements.find((statement) => statement.text.includes('client_annotations'));
  const expectedNode = sceneTables(newSnapshot.scene).find((node) => node.metadata.legacyId === 't-2');
  assert.deepEqual(annotationWrite.values, [newHash, expectedNode.id, 'note-1']);
  assert.equal(report.annotationsRemapped, 1);

  const decisionWrite = statements.find((statement) => statement.text.includes('client_decisions'));
  assert.equal(decisionWrite.values[0], newHash);
  assert.equal(decisionWrite.values[1], canonicalHash({ eventId: 'event-1', draftId: 'draft-1', snapshotHash: newHash, action: 'approve', comment: '' }));
});

test('an annotation on an object the conversion did not keep points at no scene node', () => {
  const base = fixture();
  const data = fixture({ annotations: [{ id: 'note-2', draftId: 'draft-1', snapshotHash: canonicalHash(base.drafts[0].submittedSnapshot), objectId: 'gone' }] });
  const { statements, report } = planFloorplanConversion(data);
  const annotationWrite = statements.find((statement) => statement.text.includes('client_annotations'));
  assert.equal(annotationWrite.values[1], null);
  assert.equal(report.annotationObjectsUnmatched, 1);
});

test('a second run after the first writes nothing', () => {
  const first = planFloorplanConversion(fixture());
  const second = planFloorplanConversion(applyToRows(fixture(), first.statements));
  assert.deepEqual(second.statements, []);
  assert.equal(second.report.plans.eventDraft, 0);
  assert.equal(second.report.snapshots, 0);
});
