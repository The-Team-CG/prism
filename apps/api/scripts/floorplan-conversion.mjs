// Pure planning for `db:convert:floorplans`: decides every row write from rows the script has already loaded.
// Nothing here touches the database, so the rules are tested on fixture rows (floorplan-conversion.test.mjs).
//
// Rules (see docs/superpowers/plans/2026-11-19-floorplan-pascal-default.md, decision 5):
// - A plan with scene null becomes a scene. Its objects are the plan's object rows when it has any, else its objects JSON.
// - An event draft's seats move to roster ids through matchLegacyGuests; a seat with no roster match, or whose roster
//   guest is already seated in that plan, is dropped and counted. Preference drafts, venue template plans and any other
//   plan have every seat cleared.
// - A snapshot without a scene gets one, converted from its own objects with the same seating rule. Its draft's
//   submitted/approved snapshot columns get the same treatment, and annotations and decisions pinned to the old
//   snapshot hash move to the new hash (decisions also get the payload hash the review service would now compute).
// - Annotation object ids move from the legacy object id to the scene node whose metadata.legacyId equals it, or null.

import { convertLegacyPlan, matchLegacyGuests } from '@prism/floorplan-scene';
import { canonicalHash } from '../src/modules/floorplan/application/live/canonical-hash.cjs';

export const PASCAL_VERSION = '1.1.6';

const asArray = (value) => (Array.isArray(value) ? value : []);

function byZThenObjectId(a, b) {
  if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
  return a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0;
}

/** The plan's legacy objects, in the same precedence the API uses: object rows when present, else the objects JSON. */
export function legacyObjectsOf(objectRows, objectsJson) {
  return objectRows.length > 0 ? [...objectRows].sort(byZThenObjectId).map((row) => row.objectData) : asArray(objectsJson);
}

function clearSeats(object) {
  return asArray(object.assignedGuestIds).length === 0 ? object : { ...object, assignedGuestIds: [] };
}

/** Rewrites each seat from a legacy guest id to a roster id. Returns the dropped-seat count too. */
export function seatOnRoster(objects, guests, roster) {
  const matches = matchLegacyGuests(guests, roster);
  const seated = new Set();
  let dropped = 0;
  const next = objects.map((object) => {
    const assigned = asArray(object.assignedGuestIds);
    if (assigned.length === 0) return object;
    const kept = [];
    for (const legacyGuestId of assigned) {
      const rosterId = matches.get(legacyGuestId);
      if (rosterId === undefined || seated.has(rosterId)) {
        dropped += 1;
        continue;
      }
      seated.add(rosterId);
      kept.push(rosterId);
    }
    return { ...object, assignedGuestIds: kept };
  });
  return { objects: next, dropped };
}

/**
 * Converts one legacy room into a scene. `roster` is the event's roster for an event draft; null clears every seat.
 * Returns the scene and how many seats the roster rule dropped.
 */
/**
 * The room size a legacy plan was drawn at, in metres. The legacy editor saved the room in whole metres; a draft
 * created without opening it kept the API's old pixel-era default (1200 by 800, or 1400 by 900 for a client
 * preference), which no event hall measures. Such a size reads as the 30 m by 20 m hall a new draft starts as.
 */
export const LEGACY_DEFAULT_ROOM_M = { width: 30, height: 20 };
const LARGEST_PLAUSIBLE_ROOM_M = 500;
export function legacyRoomMetres(width, height) {
  const plausible = (value) => Number.isFinite(value) && value > 0 && value <= LARGEST_PLAUSIBLE_ROOM_M;
  return plausible(width) && plausible(height) ? { widthM: width, heightM: height } : { widthM: LEGACY_DEFAULT_ROOM_M.width, heightM: LEGACY_DEFAULT_ROOM_M.height };
}

export function convertPlanScene({ name, width, height, objects, guests, roster }) {
  const seating = roster ? seatOnRoster(objects, guests, roster) : { objects: objects.map(clearSeats), dropped: 0 };
  const scene = convertLegacyPlan({ name, ...legacyRoomMetres(width, height), objects: seating.objects }, PASCAL_VERSION);
  return { scene, dropped: seating.dropped };
}

/** The scene node that came from a legacy object, or null when the conversion made none. */
export function sceneNodeForLegacyId(scene, legacyId) {
  if (!legacyId) return null;
  const node = Object.values(scene.nodes).find((candidate) => candidate.metadata?.legacyId === legacyId);
  return node ? node.id : null;
}

/** A legacy snapshot with a scene added. The rest of the snapshot is kept as it was. */
export function convertSnapshot(snapshot, roster) {
  const { scene, dropped } = convertPlanScene({
    name: snapshot.name,
    width: snapshot.width,
    height: snapshot.height,
    objects: asArray(snapshot.objects),
    guests: asArray(snapshot.guests),
    roster,
  });
  return { snapshot: { ...snapshot, scene, sceneFormat: scene.format }, scene, dropped };
}

function emptyReport() {
  return {
    plans: { eventDraft: 0, clientPreference: 0, venueTemplate: 0, other: 0 },
    snapshots: 0,
    draftSnapshots: 0,
    annotationsRemapped: 0,
    annotationObjectsUnmatched: 0,
    decisionsRehashed: 0,
    seatsDroppedByEvent: {},
  };
}

/**
 * Plans every write. `data` is the loaded rows:
 *  plans: { id, name, width, height, objects, guests, scene, objectRows: [{ objectId, zIndex, objectData }] }
 *  drafts: { id, eventId, floorPlanId, sourceType, submittedSnapshot, approvedSnapshot }
 *  versions: { id, draftId, snapshot }
 *  templatePlanIds: Set of plan ids that are venue template base layouts
 *  roster: Map eventId -> [{ id, name }] (eligible, unwithdrawn, not declined)
 *  annotations: { id, draftId, snapshotHash, objectId }
 *  decisions: { id, eventId, draftId, snapshotHash, action, comment }
 * Returns { statements, report }. Each statement is { unitId, text, values }; statements of one unitId run in one
 * transaction (the unit is a plan id). Every statement is idempotent: a row already converted has nothing left to write.
 */
export function planFloorplanConversion(data) {
  const report = emptyReport();
  const statements = [];
  const draftsByPlan = new Map(data.drafts.map((draft) => [draft.floorPlanId, draft]));
  const isPreference = (draft) => draft?.sourceType === 'client_preference';
  const seatingRosterFor = (draft) => (draft && !isPreference(draft) ? data.roster.get(draft.eventId) ?? [] : null);

  for (const plan of data.plans) {
    if (plan.scene) continue;
    const draft = draftsByPlan.get(plan.id);
    const kind = draft ? (isPreference(draft) ? 'clientPreference' : 'eventDraft') : data.templatePlanIds.has(plan.id) ? 'venueTemplate' : 'other';
    report.plans[kind] += 1;
    const roster = seatingRosterFor(draft);
    const { scene, dropped } = convertPlanScene({
      name: plan.name,
      width: plan.width,
      height: plan.height,
      objects: legacyObjectsOf(plan.objectRows, plan.objects),
      guests: asArray(plan.guests),
      roster,
    });
    if (draft && roster) report.seatsDroppedByEvent[draft.eventId] = (report.seatsDroppedByEvent[draft.eventId] ?? 0) + dropped;
    statements.push({
      unitId: plan.id,
      text: 'update floorplan.floor_plans set scene = $1, scene_format = $2 where id = $3 and scene is null',
      values: [scene, scene.format, plan.id],
    });
  }

  for (const draft of data.drafts) {
    const roster = seatingRosterFor(draft);
    const rehashed = new Map();
    for (const column of ['submittedSnapshot', 'approvedSnapshot']) {
      const stored = draft[column];
      if (!stored || stored.scene) continue;
      const oldHash = canonicalHash(stored);
      const converted = convertSnapshot(stored, roster);
      rehashed.set(oldHash, converted);
      report.draftSnapshots += 1;
      statements.push({
        unitId: draft.floorPlanId,
        text: `update floorplan.floor_plan_drafts set ${column === 'submittedSnapshot' ? 'submitted_snapshot' : 'approved_snapshot'} = $1 where id = $2`,
        values: [converted.snapshot, draft.id],
      });
    }
    if (rehashed.size === 0) continue;
    planSnapshotRehash(data, draft, rehashed, statements, report);
  }

  for (const version of data.versions) {
    if (version.snapshot?.scene) continue;
    const draft = data.drafts.find((candidate) => candidate.id === version.draftId);
    if (!draft) continue;
    const converted = convertSnapshot(version.snapshot, seatingRosterFor(draft));
    report.snapshots += 1;
    statements.push({
      unitId: draft.floorPlanId,
      text: 'update floorplan.floor_plan_snapshot_versions set snapshot = $1 where id = $2',
      values: [converted.snapshot, version.id],
    });
  }

  return { statements, report };
}

function planSnapshotRehash(data, draft, rehashed, statements, report) {
  for (const annotation of data.annotations.filter((row) => row.draftId === draft.id)) {
    const converted = rehashed.get(annotation.snapshotHash);
    if (!converted) continue;
    const objectId = annotation.objectId ? sceneNodeForLegacyId(converted.scene, annotation.objectId) : null;
    if (annotation.objectId && objectId === null) report.annotationObjectsUnmatched += 1;
    report.annotationsRemapped += 1;
    statements.push({
      unitId: draft.floorPlanId,
      text: 'update floorplan.client_annotations set snapshot_hash = $1, object_id = $2 where id = $3',
      values: [canonicalHash(converted.snapshot), objectId, annotation.id],
    });
  }
  for (const decision of data.decisions.filter((row) => row.draftId === draft.id)) {
    const converted = rehashed.get(decision.snapshotHash);
    if (!converted) continue;
    const snapshotHash = canonicalHash(converted.snapshot);
    const payloadHash = canonicalHash({ eventId: decision.eventId, draftId: decision.draftId, snapshotHash, action: decision.action, comment: decision.comment });
    report.decisionsRehashed += 1;
    statements.push({
      unitId: draft.floorPlanId,
      text: 'update floorplan.client_decisions set snapshot_hash = $1, payload_hash = $2 where id = $3',
      values: [snapshotHash, payloadHash, decision.id],
    });
  }
}

/** Runs each unit's statements in one transaction. Returns the number of units committed. */
export async function applyFloorplanConversion(client, statements) {
  const units = new Map();
  for (const statement of statements) units.set(statement.unitId, [...(units.get(statement.unitId) ?? []), statement]);
  let committed = 0;
  for (const unitStatements of units.values()) {
    await client.query('begin');
    try {
      for (const statement of unitStatements) await client.query(statement.text, statement.values);
      await client.query('commit');
      committed += 1;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    }
  }
  return committed;
}

/** The report the script prints. Counts only: no seat, guest name or snapshot content is included. */
export function formatReport(report, { dryRun }) {
  const lines = [
    `Plans converted: ${JSON.stringify(report.plans)}`,
    `Snapshot versions converted: ${report.snapshots}`,
    `Draft snapshot columns converted: ${report.draftSnapshots}`,
    `Annotations remapped: ${report.annotationsRemapped} (object ids with no scene node: ${report.annotationObjectsUnmatched})`,
    `Decisions rehashed: ${report.decisionsRehashed}`,
    `Seats dropped per event: ${JSON.stringify(report.seatsDroppedByEvent)}`,
  ];
  if (dryRun) lines.push('Dry run: nothing was written.');
  return lines.join('\n');
}
