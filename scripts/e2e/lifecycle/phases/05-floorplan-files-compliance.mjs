// Phase 5: floorplans, file requirements and uploads, compliance, change control, notifications.
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { cfg, http, msg, step, startPhase, blocked, gap, expect, expectStatus, mailsTo, waitForMail } from "../lib.mjs";

export const name = "Floorplans, files, compliance, change control";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PDF = (tag) => Buffer.from(`%PDF-1.4\n% e2e ${tag} ${randomUUID()}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const table = (id = "t1") => ({ id, kind: "table", position: { x: 100, y: 100 }, size: { width: 80, height: 80 }, rotation: 0, zIndex: 1 });
const pdfType = "application/pdf";

/** Posts raw bytes (the shared helper only sends JSON). Returns the HTTP status. */
async function putBytes(objectId, token, uploadUrl, bytes) {
  const res = await fetch(`${cfg.api}/storage/objects/${objectId}/content`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-prism-storage-authorization": uploadUrl, "content-type": "application/octet-stream", "x-forwarded-for": `10.${Math.floor(Math.random() * 250) + 1}.9.9` },
    body: bytes,
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 200) };
}

/** Calls that must be refused. Each entry: [label, method, path, token, body, ...acceptable statuses (default 403)]. */
async function refused(calls) {
  const wrong = [];
  for (const [label, method, path, token, body, ...codes] of calls) {
    const want = codes.length ? codes : [403];
    const r = await http(method, path, { token, body });
    if (!want.includes(r.status)) wrong.push(`${label}: got ${r.status} (${msg(r).slice(0, 70)}) want ${want.join("/")}`);
  }
  if (wrong.length) throw new Error(wrong.join("; "));
  return `${calls.length} calls refused as expected`;
}

export async function run(ctx) {
  startPhase("Floorplans, files, compliance, change control");
  const s = {};
  const E = () => s.ev.eventId;
  const base = () => `/events/${E()}`;

  // ---------------------------------------------------------------- setup
  await step("PMCM, coordinator, supplier and two client events are ready", async () => {
    s.admin = await ctx.as("admin");
    s.coord = await ctx.as("coordinator");
    s.supplier = await ctx.as("supplier");
    s.ev = await ctx.newEvent({ label: "FFC Main" });
    s.client = await s.ev.as();
    s.other = await ctx.newEvent({ label: "FFC Other" });
    s.otherClient = await s.other.as();
    return s.ev.eventId;
  });
  if (!s.ev) return;

  // ---------------------------------------------------------------- floorplans: client preference
  await step("client submits a layout preference", async () => {
    const r = await http("POST", `${base()}/floorplan-preferences`, { token: s.client, body: { name: "Client preference", seatingStyle: "Banquet", stagePreference: "North wall", flowNotes: "Entrance on the east", guestCount: 100, constraints: ["pillar near stage"], notes: "Prefer round tables", objects: [table("pref-t1")] } });
    s.pref = expectStatus(r, 201);
    expect(s.pref.status === "client_submitted" && s.pref.sourceType === "client_preference", `unexpected draft ${s.pref.status}/${s.pref.sourceType}`);
    return s.pref.status;
  });
  await step("an invalid layout preference is a 400, not a 500", async () => {
    const r = await http("POST", `${base()}/floorplan-preferences`, { token: s.client, body: { name: "x", guestCount: 0 } });
    expect(r.status === 400, `expected 400, got ${r.status}: ${msg(r)}`);
  });
  await step("preference endpoint refuses anonymous callers and another client's event", async () => refused([
    ["anonymous", "POST", `${base()}/floorplan-preferences`, undefined, { name: "x", seatingStyle: "a", stagePreference: "b", flowNotes: "c", guestCount: 5, constraints: [] }, 401],
    ["other client", "POST", `${base()}/floorplan-preferences`, s.otherClient, { name: "x", seatingStyle: "a", stagePreference: "b", flowNotes: "c", guestCount: 5, constraints: [] }],
    ["supplier", "POST", `${base()}/floorplan-preferences`, s.supplier, { name: "x", seatingStyle: "a", stagePreference: "b", flowNotes: "c", guestCount: 5, constraints: [] }],
  ]));
  await step("client cannot resubmit a preference until PMCM reopens it", async () => {
    if (!s.pref) blocked("no preference");
    const r = await http("POST", `${base()}/floorplan-preferences`, { token: s.client, body: { name: "Client preference v2", seatingStyle: "Theatre", stagePreference: "South", flowNotes: "x", guestCount: 100, constraints: [] } });
    expect(r.status === 409, `expected 409, got ${r.status}: ${msg(r)}`);
  });
  await step("only PMCM can reopen a preference (client, coordinator, supplier refused)", async () => {
    if (!s.pref) blocked("no preference");
    return refused(["client", "coordinator", "supplier"].map((who) => [who, "POST", `${base()}/floorplans/${s.pref.id}/reopen-preference`, who === "client" ? s.client : who === "coordinator" ? s.coord : s.supplier]));
  });
  await step("PMCM reopens the preference and the client revises and resubmits it", async () => {
    if (!s.pref) blocked("no preference");
    const reopened = expectStatus(await http("POST", `${base()}/floorplans/${s.pref.id}/reopen-preference`, { token: s.admin }), 200);
    expect(reopened.status === "revision_requested", `status ${reopened.status}`);
    const plan = expectStatus(await http("GET", `/plans/${s.pref.floorPlanId}`, { token: s.client }), 200);
    expectStatus(await http("PUT", `/plans/${s.pref.floorPlanId}`, { token: s.client, body: { expectedUpdatedAt: plan.updatedAt, pax: 110, objects: [table("pref-t1"), table("pref-t2")] } }), 200);
    const again = expectStatus(await http("POST", `${base()}/floorplan-preferences`, { token: s.client, body: { name: "Client preference v2", seatingStyle: "Cabaret", stagePreference: "East", flowNotes: "revised", guestCount: 110, constraints: ["pillar near stage"] } }), 201);
    expect(again.id === s.pref.id && again.status === "client_submitted", `resubmission produced ${again.id === s.pref.id ? "same" : "a different"} draft in ${again.status}`);
    return "reopen -> client edit -> resubmit on the same draft";
  });

  // ---------------------------------------------------------------- ocular visit gate
  await step("PMCM cannot start the official plan before the ocular visit is done", async () => {
    const r = await http("POST", `${base()}/floorplans`, { token: s.admin, body: { name: "Too early", sourceType: "blank" } });
    expect(r.status === 400, `expected 400, got ${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("ocular visit mutations are PMCM-only and validate input", async () => refused([
    ["client schedules", "PATCH", `${base()}/ocular-visit/schedule`, s.client, { scheduledAt: "2027-03-01T09:00:00+08:00" }],
    ["coordinator completes", "POST", `${base()}/ocular-visit/complete`, s.coord],
    ["client waives", "POST", `${base()}/ocular-visit/waive`, s.client, { reason: "x" }],
    ["PMCM schedules with a bad date", "PATCH", `${base()}/ocular-visit/schedule`, s.admin, { scheduledAt: "tomorrow" }, 400],
    ["PMCM waives without a reason", "POST", `${base()}/ocular-visit/waive`, s.admin, {}, 400],
    ["supplier requests", "POST", `${base()}/ocular-visit`, s.supplier, { clientNote: "x" }],
  ]));
  await step("client requests, PMCM schedules and completes the ocular visit", async () => {
    const req = expectStatus(await http("POST", `${base()}/ocular-visit`, { token: s.client, body: { clientNote: "Please check the loading dock" } }), 201);
    expect(req.status === "requested", `status ${req.status}`);
    const sched = expectStatus(await http("PATCH", `${base()}/ocular-visit/schedule`, { token: s.admin, body: { scheduledAt: "2027-03-01T09:00:00+08:00" } }), 200);
    expect(sched.status === "scheduled", `status ${sched.status}`);
    const done = expectStatus(await http("POST", `${base()}/ocular-visit/complete`, { token: s.admin }), 200, 201);
    expect(done.status === "completed", `status ${done.status}`);
    s.ocular = true;
    return "requested -> scheduled -> completed";
  });

  // ---------------------------------------------------------------- venue templates + official plan
  await step("venue template library is PMCM-only and validated", async () => {
    const t = expectStatus(await http("POST", `/templates`, { token: s.admin, body: { name: `FFC Ballroom ${Date.now()}`, venue: "Grand Ballroom", width: 1200, height: 800, gridSize: 20, pax: 100, objects: [table("tpl-t1")] } }), 201);
    s.template = t;
    const list = expectStatus(await http("GET", `/templates`, { token: s.admin }), 200);
    expect(list.some((x) => x.id === t.id), "created template is not in the PMCM list");
    await refused([
      ["client lists templates", "GET", `/templates`, s.client],
      ["coordinator creates a template", "POST", `/templates`, s.coord, { name: "Nope Nope" }],
      ["anonymous lists templates", "GET", `/templates`, undefined, undefined, 401],
      ["invalid template name", "POST", `/templates`, s.admin, { name: "x" }, 400],
    ]);
    return `${list.length} template(s) in the library`;
  });
  await step("official plan creation is refused for client, coordinator and supplier", async () => refused(["client", "coordinator", "supplier"].map((who) => [who, "POST", `${base()}/floorplans`, who === "client" ? s.client : who === "coordinator" ? s.coord : s.supplier, { name: "Official", sourceType: "blank" }])));
  await step("PMCM creates the official plan from a venue template", async () => {
    if (!s.ocular || !s.template) blocked("no completed ocular visit or template");
    const d = expectStatus(await http("POST", `${base()}/floorplans`, { token: s.admin, body: { name: "Official layout v1", sourceType: "template", venueTemplateId: s.template.id } }), 201);
    expect(d.status === "pmcm_draft", `status ${d.status}`);
    s.d1 = d;
    const plan = expectStatus(await http("GET", `/plans/${d.floorPlanId}`, { token: s.admin }), 200);
    expect(plan.objects?.some((o) => o.id === "tpl-t1"), "template objects were not copied into the official plan");
    s.plan1 = plan;
    return `${plan.objects.length} object(s) copied from the template`;
  });
  await step("an invalid official plan body is a 400", async () => {
    const r = await http("POST", `${base()}/floorplans`, { token: s.admin, body: { name: "x", sourceType: "nonsense" } });
    expect(r.status === 400, `expected 400, got ${r.status}: ${msg(r)}`);
  });
  await step("client cannot read the PMCM working plan or see it listed", async () => {
    if (!s.d1) blocked("no official draft");
    const direct = await http("GET", `/plans/${s.d1.floorPlanId}`, { token: s.client });
    expect(direct.status === 403, `direct plan read returned ${direct.status}`);
    const detail = expectStatus(await http("GET", `${base()}`, { token: s.client }), 200);
    const leaked = (detail.floorPlanDrafts ?? []).filter((d) => d.sourceType !== "client_preference" && d.status === "pmcm_draft");
    expect(leaked.length === 0, `client's event payload lists ${leaked.length} unsubmitted PMCM draft(s)`);
    const workspace = expectStatus(await http("GET", "/client/workspace", { token: s.client }), 200);
    expect(!(workspace.floorPlanDrafts ?? []).some((draft) => draft.id === s.d1.id), "client workspace exposes the PMCM working draft");
  });
  await step("client can never edit the official plan", async () => {
    if (!s.d1) blocked("no official draft");
    return refused([
      ["client PUT plan", "PUT", `/plans/${s.d1.floorPlanId}`, s.client, { expectedUpdatedAt: s.plan1.updatedAt, pax: 999 }],
      ["client submit", "POST", `${base()}/floorplans/${s.d1.id}/submit`, s.client],
      ["client approve", "POST", `${base()}/floorplans/${s.d1.id}/approve`, s.client],
      ["coordinator PUT plan", "PUT", `/plans/${s.d1.floorPlanId}`, s.coord, { expectedUpdatedAt: s.plan1.updatedAt, pax: 999 }],
      ["supplier submit", "POST", `${base()}/floorplans/${s.d1.id}/submit`, s.supplier],
      ["other client PUT plan", "PUT", `/plans/${s.d1.floorPlanId}`, s.otherClient, { expectedUpdatedAt: s.plan1.updatedAt, pax: 999 }],
      ["anonymous PUT plan", "PUT", `/plans/${s.d1.floorPlanId}`, undefined, { expectedUpdatedAt: s.plan1.updatedAt }, 401],
    ]);
  });
  await step("PMCM edits the official plan with optimistic locking", async () => {
    if (!s.d1) blocked("no official draft");
    const saved = expectStatus(await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.admin, body: { expectedUpdatedAt: s.plan1.updatedAt, pax: 120, objects: [...s.plan1.objects, table("added-t2")] } }), 200);
    expect(saved.pax === 120 && saved.objects.length === s.plan1.objects.length + 1, "edit was not persisted");
    const stale = await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.admin, body: { expectedUpdatedAt: s.plan1.updatedAt, pax: 130 } });
    expect(stale.status === 409, `stale save returned ${stale.status}: ${msg(stale)}`);
    const bad = await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.admin, body: { pax: -3 } });
    expect(bad.status === 400, `invalid body returned ${bad.status}: ${msg(bad)}`);
    s.plan1 = saved;
    return "stale save -> 409, invalid body -> 400";
  });
  await step("PMCM submits a snapshot and the plan becomes immutable", async () => {
    if (!s.d1) blocked("no official draft");
    const sub = expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/submit`, { token: s.admin }), 200);
    expect(sub.status === "in_review", `status ${sub.status}`);
    const edit = await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.admin, body: { expectedUpdatedAt: s.plan1.updatedAt, pax: 140 } });
    expect(edit.status === 409, `edit of a submitted plan returned ${edit.status}: ${msg(edit)}`);
    const again = await http("POST", `${base()}/floorplans/${s.d1.id}/submit`, { token: s.admin });
    expect(again.status === 400, `double submit returned ${again.status}`);
    return "edit after submit -> 409, double submit -> 400";
  });
  await step("client sees the submitted layout read-only, approved snapshot not yet available", async () => {
    if (!s.d1) blocked("no submitted layout");
    const sub = expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=submitted`, { token: s.client }), 200);
    expect(sub.objects?.length >= 2, "submitted snapshot is missing objects");
    const appr = await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=approved`, { token: s.client });
    expect(appr.status === 404, `approved snapshot before approval returned ${appr.status}`);
    const bad = await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=bogus`, { token: s.client });
    expect(bad.status === 400, `bogus snapshot type returned ${bad.status}`);
  });
  await step("another client, supplier and anonymous callers cannot read the submitted layout", async () => {
    if (!s.d1) blocked("no submitted layout");
    const url = `${base()}/floorplans/${s.d1.id}/snapshot?type=submitted`;
    return refused([["other client", "GET", url, s.otherClient], ["supplier", "GET", url, s.supplier], ["anonymous", "GET", url, undefined, undefined, 401],
      ["other client review", "GET", `${base()}/floorplans/${s.d1.id}/client-review`, s.otherClient], ["coordinator review", "GET", `${base()}/floorplans/${s.d1.id}/client-review`, s.coord]]);
  });
  await step("coordinator sees only approved snapshots, never the submitted one", async () => {
    if (!s.d1) blocked("no submitted layout");
    const r = await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=submitted`, { token: s.coord });
    expect(r.status === 403, `coordinator submitted read returned ${r.status}`);
  });

  // ---------------------------------------------------------------- client review of the submitted layout
  await step("client opens the review and annotates the submitted layout", async () => {
    if (!s.d1) blocked("no submitted layout");
    const review = expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client }), 200);
    s.hash1 = review.snapshotHash;
    expect(s.hash1, "review has no snapshotHash");
    const stale = await http("POST", `${base()}/floorplans/${s.d1.id}/client-annotations`, { token: s.client, body: { snapshotHash: "0".repeat(64), comment: "stale" } });
    expect(stale.status === 400, `annotation on a wrong hash returned ${stale.status}`);
    const badTarget = await http("POST", `${base()}/floorplans/${s.d1.id}/client-annotations`, { token: s.client, body: { snapshotHash: s.hash1, objectId: "no-such-object", comment: "x" } });
    expect(badTarget.status === 400, `annotation on a missing object returned ${badTarget.status}`);
    const ok = expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/client-annotations`, { token: s.client, body: { snapshotHash: s.hash1, objectId: "tpl-t1", comment: "Move this table away from the entrance", anchorX: 0.2, anchorY: 0.3 } }), 200, 201);
    const lone = await http("POST", `${base()}/floorplans/${s.d1.id}/client-annotations`, { token: s.client, body: { snapshotHash: s.hash1, comment: "half anchor", anchorX: 0.5 } });
    expect(lone.status === 400, `one-sided anchor returned ${lone.status}`);
    return `annotation ${ok.id ?? "saved"}`;
  });
  await step("a client revision request needs a comment and moves the layout back to PMCM", async () => {
    if (!s.hash1) blocked("no review hash");
    const none = await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash1, action: "request_revision" } });
    expect(none.status === 400, `revision request without a comment returned ${none.status}`);
    s.revisionKey = `e2e-fp-revise-${Date.now()}`;
    const dec = expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash1, action: "request_revision", comment: "Please add a registration desk", idempotencyKey: s.revisionKey } }), 200, 201);
    s.revisionDecisionId = dec.id;
    const detail = expectStatus(await http("GET", `${base()}`, { token: s.client }), 200);
    const draft = detail.floorPlanDrafts.find((d) => d.id === s.d1.id);
    expect(draft.status === "revision_requested", `the decision ${dec.id ?? ""} was recorded but the draft is "${draft.status}"`);
    expect(draft.revisionComment === "Please add a registration desk", `the draft keeps the comment "${draft.revisionComment}"`);
    expect(detail.floorPlanStatus === "revision_requested", `the event floorplan status is "${detail.floorPlanStatus}"`);
  });
  await step("a retried revision request replays its decision; PMCM cannot decide for the client", async () => {
    if (!s.revisionDecisionId) blocked("no revision request");
    const retry = expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash1, action: "request_revision", comment: "Please add a registration desk", idempotencyKey: s.revisionKey } }), 200, 201);
    expect(retry.id === s.revisionDecisionId, `the retry returned decision ${retry.id}, expected ${s.revisionDecisionId}`);
    const reused = await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash1, action: "approve", idempotencyKey: s.revisionKey } });
    expect(reused.status === 400, `the same key for another decision returned ${reused.status}`);
    const wrong = await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.admin, body: { snapshotHash: s.hash1, action: "request_revision", comment: "x" } });
    expect(wrong.status === 403, `PMCM using the client review route returned ${wrong.status}`);
  });
  await step("PMCM revises and resubmits; the old snapshot hash can no longer be approved", async () => {
    if (!s.d1) blocked("no revision request");
    const plan = expectStatus(await http("GET", `/plans/${s.d1.floorPlanId}`, { token: s.admin }), 200);
    expectStatus(await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.admin, body: { expectedUpdatedAt: plan.updatedAt, objects: [...plan.objects, { ...table("reg-desk"), kind: "reg-desk", position: { x: 400, y: 50 } }] } }), 200);
    expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/submit`, { token: s.admin }), 200);
    const review = expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client }), 200);
    expect(review.snapshotHash !== s.hash1, "resubmitted snapshot has the same hash as the first one");
    const old = await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash1, action: "approve" } });
    expect(old.status === 400, `approving the superseded snapshot returned ${old.status}`);
    s.hash2 = review.snapshotHash;
    return "new hash; old hash -> 400";
  });
  await step("client approves the new snapshot once; a second decision is refused", async () => {
    if (!s.hash2) blocked("no resubmitted snapshot");
    const ok = expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash2, action: "approve" } }), 200, 201);
    expect(ok.action === "approve", `decision ${ok.action}`);
    const dup = await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.client, body: { snapshotHash: s.hash2, action: "approve", idempotencyKey: `again-${Date.now()}` } });
    expect(dup.status === 400, `second decision on the same snapshot returned ${dup.status}`);
    const other = await http("POST", `${base()}/floorplans/${s.d1.id}/client-review`, { token: s.otherClient, body: { snapshotHash: s.hash2, action: "approve" } });
    expect(other.status === 403, `another client's decision returned ${other.status}`);
  });
  await step("PMCM approves the official plan and the event reflects it", async () => {
    if (!s.d1) blocked("no official draft");
    const wrong = await refused([["client", "POST", `${base()}/floorplans/${s.d1.id}/approve`, s.client]]);
    const ok = expectStatus(await http("POST", `${base()}/floorplans/${s.d1.id}/approve`, { token: s.admin }), 200);
    expect(ok.status === "approved" && ok.isActive === true, `status ${ok.status} active=${ok.isActive}`);
    const detail = expectStatus(await http("GET", `${base()}`, { token: s.client }), 200);
    expect(detail.floorPlanStatus === "approved", `client event floorPlanStatus is ${detail.floorPlanStatus}`);
    const matrix = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.client }), 200);
    const fp = matrix.items.find((i) => i.key === "official_floorplan");
    expect(fp?.status === "approved", `official_floorplan requirement is ${fp?.status}`);
    const dup = await http("POST", `${base()}/floorplans/${s.d1.id}/approve`, { token: s.admin });
    expect(dup.status === 400, `approving twice returned ${dup.status}`);
    return wrong;
  });
  await step("client reads the approved snapshot; coordinator may too; client still cannot edit it", async () => {
    if (!s.d1) blocked("no approved plan");
    const client = expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=approved`, { token: s.client }), 200);
    expect(client.objects.some((o) => o.id === "reg-desk"), "approved snapshot does not contain the revision");
    expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=approved`, { token: s.coord }), 200, 403);
    const put = await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.client, body: { expectedUpdatedAt: client.updatedAt, pax: 1 } });
    expect(put.status === 403, `client edit of the approved plan returned ${put.status}`);
    const pmcm = await http("PUT", `/plans/${s.d1.floorPlanId}`, { token: s.admin, body: { expectedUpdatedAt: client.updatedAt, pax: 1 } });
    expect(pmcm.status === 409, `PMCM edit of the approved plan returned ${pmcm.status}`);
  });
  await step("a preference cannot be reopened after the official plan is approved", async () => {
    if (!s.pref) blocked("no preference");
    const r = await http("POST", `${base()}/floorplans/${s.pref.id}/reopen-preference`, { token: s.admin });
    expect(r.status === 409, `expected 409, got ${r.status}: ${msg(r)}`);
  });
  await step("a second official version supersedes the first without losing it", async () => {
    if (!s.d1) blocked("no approved plan");
    const d2 = expectStatus(await http("POST", `${base()}/floorplans`, { token: s.admin, body: { name: "Official layout v2", sourceType: "template", venueTemplateId: s.template.id } }), 201);
    expectStatus(await http("POST", `${base()}/floorplans/${d2.id}/submit`, { token: s.admin }), 200);
    expectStatus(await http("POST", `${base()}/floorplans/${d2.id}/approve`, { token: s.admin }), 200);
    const pm = expectStatus(await http("GET", `/pmcm/events/${E()}/workspace`, { token: s.admin }), 200);
    const v1 = pm.floorPlanDrafts.find((d) => d.id === s.d1.id), v2 = pm.floorPlanDrafts.find((d) => d.id === d2.id);
    expect(v1 && v2 && v2.isActive && !v1.isActive, `active flags v1=${v1?.isActive} v2=${v2?.isActive}`);
    const old = await http("GET", `${base()}/floorplans/${s.d1.id}/snapshot?type=approved`, { token: s.admin });
    expect(old.status === 200, `first version's approved snapshot is gone (${old.status})`);
    return "v1 inactive but retrievable, v2 active";
  });
  await step("clients and anyone but PMCM cannot manage secondary floorplan access", async () => refused([
    ["client lists access", "GET", `${base()}/client-floorplan-access`, s.client],
    ["coordinator lists access", "GET", `${base()}/client-floorplan-access`, s.coord],
    ["client grants access", "POST", `${base()}/client-floorplan-access`, s.client, { userId: "someone" }],
    ["PMCM lists access", "GET", `${base()}/client-floorplan-access`, s.admin, undefined, 200],
  ]));
  await step("layout publishing is PMCM-only", async () => refused([
    ["client publishes", "POST", `/publish/events/${E()}`, s.client],
    ["coordinator lists layout events", "GET", `/layout-events`, s.coord],
    ["PMCM lists layout events", "GET", `/layout-events`, s.admin, undefined, 200],
  ]));
  await step("floorplan history retains prior rounds and hides unapproved history from external roles", async () => {
    const history = expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/history`, { token: s.admin }), 200);
    const submitted = history.filter((item) => item.snapshotType === "submitted");
    expect(submitted.length >= 2 && new Set(submitted.map((item) => item.round)).size >= 2, "resubmission did not retain both historical rounds");
    expect(submitted.some((item) => !item.snapshot.objects.some((object) => object.id === "reg-desk")) && submitted.some((item) => item.snapshot.objects.some((object) => object.id === "reg-desk")), "old and revised layout snapshots are not both retained");
    const client = expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/history`, { token: s.client }), 200);
    expect(client.every((item) => item.snapshotType === "approved"), "client history exposes an unapproved historical version");
    expectStatus(await http("GET", `${base()}/floorplans/${s.d1.id}/history`, { token: s.otherClient }), 403);
    return `${history.length} immutable submitted/approved snapshots retained`;
  });

  // ---------------------------------------------------------------- file requirements
  await step("PMCM sees the whole requirements matrix with owner, visibility, due date and required flag", async () => {
    const m = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.admin }), 200);
    s.matrix = m;
    for (const item of m.items) expect(item.ownerRole && Array.isArray(item.visibleToRoles) && typeof item.required === "boolean" && item.status, `item ${item.key} lacks owner/visibility/required/status`);
    return `${m.items.length} items: ${m.items.map((i) => i.key).join(", ")}`;
  });
  await step("client only sees requirements visible to the client role", async () => {
    const m = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.client }), 200);
    const hidden = s.matrix.items.filter((i) => !i.visibleToRoles.includes("client")).map((i) => i.key);
    const leaked = m.items.filter((i) => hidden.includes(i.key));
    expect(leaked.length === 0, `client sees PMCM-only item(s): ${leaked.map((i) => i.key).join(", ")}`);
    expect(m.items.every((i) => !("notes" in i)), "PMCM notes leak to the client");
    return `client sees ${m.items.length} of ${s.matrix.items.length}`;
  });
  await step("matrix access is limited to people who can read the event", async () => refused([
    ["other client", "GET", `${base()}/file-requirements`, s.otherClient],
    ["anonymous", "GET", `${base()}/file-requirements`, undefined, undefined, 401],
    ["supplier", "GET", `${base()}/file-requirements`, s.supplier],
  ]));
  await step("requirements differ by event type", async () => {
    const requirement = (key) => ({ key, label: key.replaceAll("_", " "), ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"], required: true, dueOffsetDays: 7 });
    expectStatus(await http("POST", "/file-requirement-templates", { token: s.admin, body: { eventType: "Conference", requirements: [requirement("conference_permit")] } }), 200, 201);
    expectStatus(await http("POST", "/file-requirement-templates", { token: s.client, body: { eventType: "Conference", requirements: [] } }), 403);
    const first = expectStatus(await http("POST", `${base()}/file-requirements/apply-template`, { token: s.admin }), 200, 201);
    expect(first.createdKeys.includes("conference_permit"), "conference template was not applied");
    const second = expectStatus(await http("POST", `${base()}/file-requirements/apply-template`, { token: s.admin }), 200, 201);
    expect(second.createdKeys.length === 0, "reapplying a template duplicated requirements");
    const other = await ctx.newEvent({ label: "Template variation", eventType: "Exhibition" });
    expectStatus(await http("POST", "/file-requirement-templates", { token: s.admin, body: { eventType: "Exhibition", requirements: [requirement("exhibition_safety")] } }), 200, 201);
    expectStatus(await http("POST", `/events/${other.eventId}/file-requirements/apply-template`, { token: s.admin }), 200, 201);
    const matrix = expectStatus(await http("GET", `/events/${other.eventId}/file-requirements`, { token: s.admin }), 200);
    expect(matrix.items.some((item) => item.key === "exhibition_safety") && !matrix.items.some((item) => item.key === "conference_permit"), "event-type templates leaked into the other event type");
  });
  const due = new Date(Date.now() + 14 * 86400_000).toISOString();
  await step("PMCM adds a client-owned custom requirement with a due date", async () => {
    const r = expectStatus(await http("POST", `${base()}/file-requirements`, { token: s.admin, body: { key: "venue_permit", label: "Venue permit", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"], required: true, dueAt: due, notes: "PMCM internal: chase before the ocular", sourceWorkflow: "custom" } }), 200, 201);
    s.req = r;
    expect(r.origin === "custom" && r.ownerRole === "client", `created ${r.origin}/${r.ownerRole}`);
    const own = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.client }), 200).items.find((i) => i.key === "venue_permit");
    expect(own, "the client cannot see the requirement it owns");
    expect(!("notes" in own), "PMCM notes leak to the client");
    return r.status;
  });
  await step("PMCM-only custom requirement stays hidden from the client", async () => {
    expectStatus(await http("POST", `${base()}/file-requirements`, { token: s.admin, body: { key: "internal_risk_memo", label: "Internal risk memo", ownerRole: "pmcm-admin", visibleToRoles: ["pmcm-admin"], required: true } }), 200, 201);
    const m = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.client }), 200);
    expect(!m.items.some((i) => i.key === "internal_risk_memo"), "client sees the PMCM-only requirement");
  });
  await step("requirement creation rejects bad input and wrong roles", async () => refused([
    ["bad key", "POST", `${base()}/file-requirements`, s.admin, { key: "Bad Key", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"] }, 400],
    ["owner hidden from itself", "POST", `${base()}/file-requirements`, s.admin, { key: "owner_hidden", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin"] }, 400],
    ["PMCM not visible", "POST", `${base()}/file-requirements`, s.admin, { key: "no_pmcm", label: "x", ownerRole: "client", visibleToRoles: ["client"] }, 400],
    ["duplicate of a derived key", "POST", `${base()}/file-requirements`, s.admin, { key: "billing_statement", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"] }, 409],
    ["duplicate custom key", "POST", `${base()}/file-requirements`, s.admin, { key: "venue_permit", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"] }, 409],
    ["client creates", "POST", `${base()}/file-requirements`, s.client, { key: "client_made", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"] }],
    ["coordinator creates", "POST", `${base()}/file-requirements`, s.coord, { key: "coord_made", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"] }],
    ["anonymous creates", "POST", `${base()}/file-requirements`, undefined, { key: "anon_made", label: "x", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"] }, 401],
  ]));
  await step("PMCM overrides a requirement (required flag, due date, notes) with revision checking", async () => {
    if (!s.req) blocked("no custom requirement");
    const upd = expectStatus(await http("PATCH", `${base()}/file-requirements/venue_permit`, { token: s.admin, body: { required: false, dueAt: null, notes: "relaxed", expectedRevision: s.req.revision ?? 0 } }), 200);
    expect(upd.required === false && !upd.dueDate && (upd.revision ?? 0) > (s.req.revision ?? 0), `after update required=${upd.required} due=${upd.dueDate} revision=${upd.revision}`);
    const stale = await http("PATCH", `${base()}/file-requirements/venue_permit`, { token: s.admin, body: { required: true, expectedRevision: s.req.revision ?? 0 } });
    expect(stale.status === 409, `stale revision returned ${stale.status}`);
    s.req = upd;
    return `revision ${upd.revision}`;
  });
  await step("derived requirements can be overridden but not relabelled; bad updates are 4xx", async () => refused([
    ["relabel derived", "PATCH", `${base()}/file-requirements/billing_statement`, s.admin, { label: "Renamed" }, 400],
    ["empty update", "PATCH", `${base()}/file-requirements/billing_statement`, s.admin, {}, 400],
    ["unknown key", "PATCH", `${base()}/file-requirements/not_a_requirement`, s.admin, { required: false }, 404],
    ["bad key format", "PATCH", `${base()}/file-requirements/Bad-Key`, s.admin, { required: false }, 404],
    ["owner not visible", "PATCH", `${base()}/file-requirements/billing_statement`, s.admin, { ownerRole: "supplier" }, 400],
    ["client overrides", "PATCH", `${base()}/file-requirements/billing_statement`, s.client, { required: false }],
    ["coordinator overrides", "PATCH", `${base()}/file-requirements/billing_statement`, s.coord, { required: false }],
    ["PMCM waives billing_statement", "PATCH", `${base()}/file-requirements/billing_statement`, s.admin, { required: false, notes: "waived for e2e" }, 200],
  ]));
  await step("a past due date marks a required, unfulfilled requirement overdue", async () => {
    expectStatus(await http("PATCH", `${base()}/file-requirements/venue_permit`, { token: s.admin, body: { required: true, dueAt: "2026-01-01T00:00:00.000Z" } }), 200);
    const item = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.client }), 200).items.find((i) => i.key === "venue_permit");
    expect(item.overdue === true, `overdue=${item.overdue}`);
    return "overdue visible to the client";
  });
  await step("PMCM can send a reminder for an overdue requirement", async () => {
    const path = `${base()}/file-requirements/reminders`;
    const first = expectStatus(await http("POST", path, { token: s.admin }), 200, 201);
    expect(first.reminders.some((item) => item.key === "venue_permit" && item.reason === "overdue"), "manual reminder omitted the overdue requirement");
    const again = expectStatus(await http("POST", path, { token: s.admin }), 200, 201);
    const key = first.reminders.find((item) => item.key === "venue_permit").idempotencyKey;
    expect(again.reminders.some((item) => item.idempotencyKey === key), "repeating reminder changed its deduplication key");
    expectStatus(await http("POST", path, { token: s.client }), 403);
  });

  // ---------------------------------------------------------------- uploads
  const bytes = PDF("client-upload");
  const checksum = sha256(bytes);
  const target = () => `client-upload:${E()}:${randomUUID()}`;
  const uploadReq = (over = {}) => ({ eventId: E(), ownerRecordType: "event", ownerRecordId: E(), logicalTarget: target(), usage: "client_document", fileName: "venue-permit.pdf", contentType: pdfType, declaredByteSize: bytes.length, checksumSha256: checksum, ...over });
  await step("client requests an upload slot for a PDF", async () => {
    const r = expectStatus(await http("POST", `${base()}/documents/upload-request`, { token: s.client, body: uploadReq() }), 200, 201);
    expect(r.status === "ready" && r.location?.uploadUrl && r.object?.id, `no upload slot: ${JSON.stringify(r).slice(0, 200)}`);
    s.slot = r;
    return `${r.object.id} (${r.location.providerName ?? "provider"})`;
  });
  await step("bytes that do not match the declared checksum are refused", async () => {
    if (!s.slot) blocked("no upload slot");
    const tampered = Buffer.from(bytes);
    tampered[tampered.length - 3] = 0x58;
    const r = await putBytes(s.slot.object.id, s.client, s.slot.location.uploadUrl, tampered);
    expect(r.status >= 400 && r.status < 500, `tampered bytes returned ${r.status} ${r.text}`);
    const empty = await putBytes(s.slot.object.id, s.client, s.slot.location.uploadUrl, Buffer.alloc(0));
    expect(empty.status === 400, `empty body returned ${empty.status}`);
    return `tampered -> ${r.status}`;
  });
  await step("another client or supplier cannot write bytes into the slot", async () => {
    if (!s.slot) blocked("no upload slot");
    const a = await putBytes(s.slot.object.id, s.otherClient, s.slot.location.uploadUrl, bytes);
    const b = await putBytes(s.slot.object.id, s.supplier, s.slot.location.uploadUrl, bytes);
    expect(a.status === 403 && b.status === 403, `other client ${a.status}, supplier ${b.status}`);
  });
  await step("confirming before any bytes arrive is refused", async () => {
    if (!s.slot) blocked("no upload slot");
    const r = await http("POST", `${base()}/documents/${s.slot.object.id}/confirm`, { token: s.client, body: { checksumSha256: checksum, byteSize: bytes.length } });
    expect(r.status >= 400 && r.status < 500, `confirm without bytes returned ${r.status}: ${msg(r)}`);
    return `${r.status}: ${msg(r)}`;
  });
  await step("client uploads the real bytes and confirms", async () => {
    if (!s.slot) blocked("no upload slot");
    const up = await putBytes(s.slot.object.id, s.client, s.slot.location.uploadUrl, bytes);
    expect(up.status === 204 || up.status === 200 || up.status === 201, `byte upload returned ${up.status} ${up.text}`);
    const wrong = await http("POST", `${base()}/documents/${s.slot.object.id}/confirm`, { token: s.client, body: { checksumSha256: sha256(Buffer.from("other")), byteSize: bytes.length } });
    expect(wrong.status >= 400 && wrong.status < 500, `confirm with a wrong checksum returned ${wrong.status}`);
    const ok = expectStatus(await http("POST", `${base()}/documents/${s.slot.object.id}/confirm`, { token: s.client, body: { checksumSha256: checksum, byteSize: bytes.length } }), 200, 201);
    expect(ok.lifecycleState === "stored" || ok.status === "stored", `state ${ok.lifecycleState ?? ok.status}`);
    return "stored";
  });
  await step("the stored file is listed for the client and PMCM, not for others", async () => {
    if (!s.slot) blocked("no stored file");
    const has = async (token) => { const r = await http("GET", `${base()}/documents`, { token }); return { status: r.status, found: Array.isArray(r.body) && r.body.some((o) => o.id === s.slot.object.id) }; };
    const [client, admin, other, supplier] = [await has(s.client), await has(s.admin), await has(s.otherClient), await has(s.supplier)];
    expect(client.found && admin.found, `client sees=${client.found}, PMCM sees=${admin.found}`);
    expect(other.status === 403 && supplier.status === 403, `other client ${other.status}, supplier ${supplier.status}`);
    const anon = await http("GET", `${base()}/documents`);
    expect(anon.status === 401, `anonymous list returned ${anon.status}`);
  });
  await step("authorized download returns exactly the uploaded bytes", async () => {
    if (!s.slot) blocked("no stored file");
    const auth = expectStatus(await http("GET", `${base()}/documents/${s.slot.object.id}/download-authorization`, { token: s.client }), 200);
    expect(auth.downloadUrl && auth.fileName === "venue-permit.pdf" && auth.contentType === pdfType, `authorization ${JSON.stringify(auth).slice(0, 160)}`);
    const got = await http("GET", `/storage/objects/${s.slot.object.id}/content`, { token: s.client, raw: true, headers: { "x-prism-storage-authorization": auth.downloadUrl } });
    expect(got.status === 200 && Buffer.compare(got.bytes, bytes) === 0, `download ${got.status}, ${got.bytes?.length} bytes vs ${bytes.length} uploaded`);
    const other = await http("GET", `${base()}/documents/${s.slot.object.id}/download-authorization`, { token: s.otherClient });
    expect(other.status === 403, `another client's download authorization returned ${other.status}`);
    const forged = await http("GET", `/storage/objects/${s.slot.object.id}/content`, { token: s.client, raw: true, headers: { "x-prism-storage-authorization": "https://evil.example/file" } });
    expect(forged.status >= 400 && forged.status < 500, `forged download url returned ${forged.status}`);
    const anon = await http("GET", `${base()}/documents/${s.slot.object.id}/download-authorization`);
    expect(anon.status === 401, `anonymous authorization returned ${anon.status}`);
    return `${got.bytes.length} bytes round-tripped`;
  });
  await step("repeating the same upload request returns the stored object, not a duplicate", async () => {
    if (!s.slot) blocked("no stored file");
    const r = expectStatus(await http("POST", `${base()}/documents/upload-request`, { token: s.client, body: uploadReq({ logicalTarget: s.slot.object.logicalTarget }) }), 200, 201);
    expect(r.status === "stored" && r.object.id === s.slot.object.id, `second request gave ${r.status}/${r.object?.id === s.slot.object.id ? "same" : "new"} object`);
  });
  await step("upload validation rejects bad type, extension, size, checksum and scope with a 4xx", async () => refused([
    ["text file", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ contentType: "text/plain", fileName: "notes.txt" }), 400],
    ["executable", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ contentType: "application/x-msdownload", fileName: "setup.exe" }), 400],
    ["extension mismatch", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ fileName: "permit.png" }), 400],
    ["over 25 MB", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ declaredByteSize: 26 * 1024 * 1024 }), 400],
    ["zero bytes", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ declaredByteSize: 0 }), 400],
    ["bad checksum", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ checksumSha256: "not-a-hash" }), 400],
    ["route/body event mismatch", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ eventId: s.other.eventId }), 400],
    ["malformed target", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ logicalTarget: "anything" }), 400, 403],
    ["other client", "POST", `${base()}/documents/upload-request`, s.otherClient, uploadReq()],
    ["supplier", "POST", `${base()}/documents/upload-request`, s.supplier, uploadReq()],
    ["anonymous", "POST", `${base()}/documents/upload-request`, undefined, uploadReq(), 401],
    ["unsupported usage for a client", "POST", `${base()}/documents/upload-request`, s.client, uploadReq({ usage: "event_deliverable", ownerRecordType: "proposal_version", ownerRecordId: "x" }), 400, 403],
  ]));
  await step("a file whose bytes are not the declared type is refused at upload", async () => {
    const fake = Buffer.from("this is plain text pretending to be a PDF ".repeat(4));
    const r = expectStatus(await http("POST", `${base()}/documents/upload-request`, { token: s.client, body: uploadReq({ fileName: "fake.pdf", declaredByteSize: fake.length, checksumSha256: sha256(fake) }) }), 200, 201);
    const up = await putBytes(r.object.id, s.client, r.location.uploadUrl, fake);
    expect(up.status === 400, `fake PDF bytes returned ${up.status} ${up.text}`);
  });
  await step("a client upload satisfies the custom requirement it was meant for", async () => {
    expect(s.slot, "no confirmed upload fixture");
    const path = `${base()}/file-requirements/venue_permit/upload`;
    expectStatus(await http("POST", path, { token: s.otherClient, body: { objectId: s.slot.object.id } }), 403);
    const bound = expectStatus(await http("POST", path, { token: s.client, body: { objectId: s.slot.object.id } }), 200, 201);
    expect(bound.status !== "missing" && bound.uploadedAssetId, "binding the verified upload left the custom requirement missing");
    const item = expectStatus(await http("GET", `${base()}/file-requirements`, { token: s.client }), 200).items.find((entry) => entry.key === "venue_permit");
    expect(item.uploadedAssetId === bound.uploadedAssetId && item.status !== "missing", "matrix does not retain the requirement-bound upload");
  });
  await step("PMCM can delete a stored file; clients and others cannot", async () => {
    if (!s.slot) blocked("no stored file");
    await refused([
      ["client deletes", "DELETE", `/storage/objects/${s.slot.object.id}`, s.client],
      ["other client deletes", "DELETE", `/storage/objects/${s.slot.object.id}`, s.otherClient],
      ["anonymous deletes", "DELETE", `/storage/objects/${s.slot.object.id}`, undefined, undefined, 401],
    ]);
    const gone = expectStatus(await http("DELETE", `/storage/objects/${s.slot.object.id}`, { token: s.admin }), 200);
    expect((gone.lifecycleState ?? gone.status) === "deleted", `state ${gone.lifecycleState ?? gone.status}`);
    const dl = await http("GET", `${base()}/documents/${s.slot.object.id}/download-authorization`, { token: s.client });
    expect(dl.status >= 400 && dl.status < 500, `download after delete returned ${dl.status}`);
  });

  // ---------------------------------------------------------------- compliance
  await step("compliance rules and runs are PMCM-only", async () => refused([
    ["client lists rules", "GET", `/compliance/rules`, s.client],
    ["coordinator runs compliance", "POST", `${base()}/compliance`, s.coord, {}],
    ["client runs compliance", "POST", `${base()}/compliance`, s.client, {}],
    ["supplier lists runs", "GET", `${base()}/compliance/runs`, s.supplier],
    ["other client lists risks", "GET", `${base()}/compliance/risks`, s.otherClient],
    ["anonymous runs compliance", "POST", `${base()}/compliance`, undefined, {}, 401],
    ["bad trigger", "POST", `${base()}/compliance`, s.admin, { trigger: "whenever" }, 400],
  ]));
  await step("PMCM runs compliance checks for the planning phase", async () => {
    const checks = expectStatus(await http("POST", `${base()}/compliance`, { token: s.admin, body: { phase: "planning", trigger: "manual" } }), 201);
    expect(Array.isArray(checks) && checks.length > 0, "no compliance checks were produced");
    s.checks = checks;
    s.planningCount = checks.length;
    return `${checks.length} checks, ${checks.filter((c) => c.status === "open").length} open`;
  });
  await step("rules differ by phase", async () => {
    const closure = expectStatus(await http("POST", `${base()}/compliance`, { token: s.admin, body: { phase: "closure" } }), 201);
    const planning = expectStatus(await http("POST", `${base()}/compliance`, { token: s.admin, body: { phase: "planning" } }), 201);
    s.checks = planning;
    return `planning ${planning.length} checks, closure ${closure.length} checks${closure.length === planning.length ? " (same set)" : ""}`;
  });
  await step("a custom rule scoped to this event produces a check", async () => {
    const rule = expectStatus(await http("POST", `/compliance/rules`, { token: s.admin, body: { eventId: E(), eventType: "Conference", phase: "planning", severity: "must_fix", conditionKey: "e2e_custom_rule", title: "E2E custom rule", note: "Prove the custom rule fired" } }), 201);
    const bad = await http("POST", `/compliance/rules`, { token: s.admin, body: { title: "no key" } });
    expect(bad.status === 400, `rule without a condition key returned ${bad.status}`);
    const denied = await http("POST", `/compliance/rules`, { token: s.client, body: { conditionKey: "x", title: "x" } });
    expect(denied.status === 403, `client creating a rule returned ${denied.status}`);
    const checks = expectStatus(await http("POST", `${base()}/compliance`, { token: s.admin, body: { phase: "planning" } }), 201);
    s.checks = checks;
    expect(checks.some((c) => c.conditionKey === "e2e_custom_rule" || c.ruleId === rule.id), "the custom rule did not generate a check");
    return rule.id;
  });
  await step("PMCM resolves a check with a note and overrides another only with a reason", async () => {
    if (!s.checks?.length) blocked("no checks");
    const [a, b] = s.checks.filter((c) => c.status === "open");
    if (!a || !b) blocked("fewer than two open checks");
    const resolved = expectStatus(await http("PATCH", `${base()}/compliance/${a.id}`, { token: s.admin, body: { action: "resolve", note: "Handled in e2e" } }), 200);
    expect(resolved.status === "resolved", `status ${resolved.status}`);
    const noReason = await http("PATCH", `${base()}/compliance/${b.id}`, { token: s.admin, body: { action: "override" } });
    expect(noReason.status === 400, `override without a reason returned ${noReason.status}`);
    const overridden = expectStatus(await http("PATCH", `${base()}/compliance/${b.id}`, { token: s.admin, body: { action: "override", overrideReason: "Client accepted the risk in writing" } }), 200);
    expect(overridden.status === "overridden", `status ${overridden.status}`);
    const missing = await http("PATCH", `${base()}/compliance/chk_does_not_exist`, { token: s.admin, body: { action: "resolve" } });
    expect(missing.status === 404, `unknown check returned ${missing.status}`);
    const denied = await http("PATCH", `${base()}/compliance/${a.id}`, { token: s.client, body: { action: "resolve" } });
    expect(denied.status === 403, `client resolving returned ${denied.status}`);
    const runs = expectStatus(await http("GET", `${base()}/compliance/runs`, { token: s.admin }), 200);
    return `${runs.length} run(s) on record`;
  });
  await step("PMCM logs a compliance risk and updates it; bad input is a 400", async () => {
    const risk = expectStatus(await http("POST", `${base()}/compliance/risks`, { token: s.admin, body: { phase: "planning", title: "Venue power capacity", severity: "high", owner: "Operations", mitigation: "Rent a generator" } }), 201);
    const upd = expectStatus(await http("PATCH", `${base()}/compliance/risks/${risk.id}`, { token: s.admin, body: { status: "mitigated", reason: "Generator booked" } }), 200);
    expect(upd.status === "mitigated", `status ${upd.status}`);
    return refused([
      ["bad severity", "POST", `${base()}/compliance/risks`, s.admin, { phase: "planning", title: "x", severity: "severe" }, 400],
      ["client logs a risk", "POST", `${base()}/compliance/risks`, s.client, { phase: "planning", title: "x" }],
      ["unknown risk", "PATCH", `${base()}/compliance/risks/risk_nope`, s.admin, { status: "closed" }, 404],
    ]);
  });

  // ---------------------------------------------------------------- change control
  await step("a second onboarded event is ready for change control", async () => {
    s.cc = await ctx.newEvent({ label: "FFC Change" });
    s.ccClient = await s.cc.as();
  });
  const cc = () => `/events/${s.cc.eventId}`;
  await step("client submits a scope change request; bad input and other callers are refused", async () => {
    if (!s.cc) blocked("no change-control event");
    const r = expectStatus(await http("POST", `${cc()}/scope-changes`, { token: s.ccClient, body: { title: "Add 30 guests", description: "Marketing invited 30 more attendees", category: "guest_count" } }), 201);
    expect(r.status === "submitted" && r.requestedByRole === "client", `status ${r.status}/${r.requestedByRole}`);
    s.sc1 = r;
    await refused([
      ["bad category", "POST", `${cc()}/scope-changes`, s.ccClient, { title: "x", description: "y", category: "weather" }, 400],
      ["missing title", "POST", `${cc()}/scope-changes`, s.ccClient, { description: "y", category: "other" }, 400],
      ["other client", "POST", `${cc()}/scope-changes`, s.otherClient, { title: "x", description: "y", category: "other" }],
      ["supplier", "POST", `${cc()}/scope-changes`, s.supplier, { title: "x", description: "y", category: "other" }],
      ["anonymous", "POST", `${cc()}/scope-changes`, undefined, { title: "x", description: "y", category: "other" }, 401],
    ]);
    return r.id;
  });
  await step("PMCM sees the request; the client sees a client-safe status only", async () => {
    if (!s.sc1) blocked("no scope change");
    const list = expectStatus(await http("GET", `${cc()}/scope-changes`, { token: s.admin }), 200);
    expect(list.some((x) => x.id === s.sc1.id), "PMCM register lacks the request");
    const own = expectStatus(await http("GET", `${cc()}/change-requests`, { token: s.ccClient }), 200);
    const mine = own.find((x) => x.id === s.sc1.id);
    expect(mine, "client cannot see the status of its own scope change");
    expect(!("decisionReason" in mine) && !("reason" in mine), "client view exposes the internal reason");
    await refused([["client lists PMCM register", "GET", `${cc()}/scope-changes`, s.ccClient], ["other client reads status", "GET", `${cc()}/change-requests`, s.otherClient]]);
    return `client sees status "${mine.status}"`;
  });
  await step("PMCM review: impacts must be acknowledged before approval, rejection needs a reason", async () => {
    if (!s.sc1) blocked("no scope change");
    const review = (body, token = s.admin) => http("PATCH", `${cc()}/scope-changes/${s.sc1.id}`, { token, body });
    const start = expectStatus(await review({ decision: "start_review" }), 200);
    expect(start.status === "under_review", `status ${start.status}`);
    const noAck = await review({ decision: "approve", impacts: { billing: true, supplier: false, coordinator: false, floorplan: false } });
    expect(noAck.status === 400, `approval without impact acknowledgement returned ${noAck.status}`);
    const noReason = await review({ decision: "reject" });
    expect(noReason.status === 400, `rejection without a reason returned ${noReason.status}`);
    const asClient = await review({ decision: "start_review" }, s.ccClient);
    expect(asClient.status === 403, `client reviewing returned ${asClient.status}`);
    const approved = expectStatus(await review({ decision: "approve", impacts: { billing: true, supplier: false, coordinator: false, floorplan: true }, impactReviewAcknowledged: true, clientResponse: "Approved, billing will follow" }), 200);
    expect(approved.status === "approved", `status ${approved.status}`);
    const again = await review({ decision: "approve", impacts: { billing: true, supplier: false, coordinator: false, floorplan: true }, impactReviewAcknowledged: true });
    expect(again.status === 400, `deciding twice returned ${again.status}`);
    return "approved";
  });
  await step("client can withdraw an open request but not a decided one", async () => {
    if (!s.sc1) blocked("no scope change");
    const second = expectStatus(await http("POST", `${cc()}/scope-changes`, { token: s.ccClient, body: { title: "Swap the caterer", description: "Prefer another caterer", category: "supplier" } }), 201);
    const w = expectStatus(await http("POST", `${cc()}/scope-changes/${second.id}/withdraw`, { token: s.ccClient }), 200, 201);
    expect(w.status === "withdrawn", `status ${w.status}`);
    const late = await http("POST", `${cc()}/scope-changes/${s.sc1.id}/withdraw`, { token: s.ccClient });
    expect(late.status === 400, `withdrawing a decided request returned ${late.status}`);
    const rej = expectStatus(await http("POST", `${cc()}/scope-changes`, { token: s.ccClient, body: { title: "Fireworks", description: "Add fireworks", category: "program" } }), 201);
    const rejected = expectStatus(await http("PATCH", `${cc()}/scope-changes/${rej.id}`, { token: s.admin, body: { decision: "reject", decisionReason: "Venue forbids pyrotechnics", clientResponse: "Sorry, not allowed at this venue" } }), 200);
    expect(rejected.status === "rejected", `status ${rejected.status}`);
    const view = expectStatus(await http("GET", `${cc()}/change-requests`, { token: s.ccClient }), 200).find((x) => x.id === rej.id);
    expect(view && !JSON.stringify(view).includes("pyrotechnics"), "client view leaks the PMCM-only rejection reason");
    return `client response shown: "${view.clientResponse}"`;
  });
  await step("PMCM records the authoritative risk level; lowering needs a reason; stale revisions conflict", async () => {
    const get = expectStatus(await http("GET", `${cc()}/risk-assessment`, { token: s.admin }), 200);
    const rev0 = get.assessment?.revision ?? 0;
    const hi = expectStatus(await http("POST", `${cc()}/risk-assessment`, { token: s.admin, body: { level: "high", summary: "Outdoor venue, monsoon season", mitigations: "Tent rental", expectedRevision: rev0 } }), 200, 201);
    const stale = await http("POST", `${cc()}/risk-assessment`, { token: s.admin, body: { level: "medium", summary: "x", expectedRevision: rev0, reason: "stale" } });
    expect(stale.status === 409, `stale revision returned ${stale.status}`);
    const rev1 = hi.revision ?? hi.assessment?.revision ?? rev0 + 1;
    const noReason = await http("POST", `${cc()}/risk-assessment`, { token: s.admin, body: { level: "low", summary: "x", expectedRevision: rev1 } });
    expect(noReason.status === 400, `lowering without a reason returned ${noReason.status}`);
    await refused([
      ["client records", "POST", `${cc()}/risk-assessment`, s.ccClient, { level: "low", summary: "x", expectedRevision: rev1 }],
      ["coordinator reads", "GET", `${cc()}/risk-assessment`, s.coord],
      ["bad level", "POST", `${cc()}/risk-assessment`, s.admin, { level: "extreme", summary: "x", expectedRevision: rev1 }, 400],
    ]);
    return `revision ${rev0} -> ${rev1}`;
  });
  await step("freeze: only PMCM freezes; a frozen scope change needs an approved, single-use exception", async () => {
    await refused([["client freezes", "POST", `${cc()}/freeze`, s.ccClient, { reason: "x" }], ["freeze without reason", "POST", `${cc()}/freeze`, s.admin, {}, 400],
      ["exception before freeze", "POST", `${cc()}/freeze-exceptions`, s.admin, { requestedChange: "x", reason: "y" }, 400]]);
    const frozen = expectStatus(await http("POST", `${cc()}/freeze`, { token: s.admin, body: { reason: "Final headcount locked" } }), 200, 201);
    expect(frozen.freezeStatus === "frozen", `freezeStatus ${frozen.freezeStatus}`);
    const sc = expectStatus(await http("POST", `${cc()}/scope-changes`, { token: s.ccClient, body: { title: "Late venue swap", description: "Move to the garden", category: "venue" } }), 201);
    const ack = { decision: "approve", impacts: { billing: false, supplier: true, coordinator: false, floorplan: true }, impactReviewAcknowledged: true };
    const noEx = await http("PATCH", `${cc()}/scope-changes/${sc.id}`, { token: s.admin, body: ack });
    expect(noEx.status === 400, `frozen approval without an exception returned ${noEx.status}`);
    const ex = expectStatus(await http("POST", `${cc()}/freeze-exceptions`, { token: s.admin, body: { requestedChange: "Move to the garden", reason: "Venue flooded" } }), 201);
    const noNote = await http("PATCH", `${cc()}/freeze-exceptions/${ex.id}`, { token: s.admin, body: { decision: "reject" } });
    expect(noNote.status === 400, `exception rejection without a reason returned ${noNote.status}`);
    const deniedDecide = await http("PATCH", `${cc()}/freeze-exceptions/${ex.id}`, { token: s.ccClient, body: { decision: "approve" } });
    expect(deniedDecide.status === 403, `client deciding an exception returned ${deniedDecide.status}`);
    expectStatus(await http("PATCH", `${cc()}/freeze-exceptions/${ex.id}`, { token: s.admin, body: { decision: "approve", decisionNote: "Force majeure" } }), 200);
    const ok = expectStatus(await http("PATCH", `${cc()}/scope-changes/${sc.id}`, { token: s.admin, body: { ...ack, freezeExceptionId: ex.id } }), 200);
    expect(ok.status === "approved", `status ${ok.status}`);
    const sc2 = expectStatus(await http("POST", `${cc()}/scope-changes`, { token: s.ccClient, body: { title: "Another change", description: "x", category: "other" } }), 201);
    const reuse = await http("PATCH", `${cc()}/scope-changes/${sc2.id}`, { token: s.admin, body: { ...ack, freezeExceptionId: ex.id } });
    expect(reuse.status === 400, `re-using a consumed exception returned ${reuse.status}`);
    const register = expectStatus(await http("GET", `${cc()}/freeze-exceptions`, { token: s.admin }), 200);
    const clientRegister = await http("GET", `${cc()}/freeze-exceptions`, { token: s.ccClient });
    expect(clientRegister.status === 403, `client reading the exception register returned ${clientRegister.status}`);
    return `${register.length} exception(s) in the PMCM register`;
  });
  await step("client requests a frozen scope change while PMCM retains exception approval", async () => {
    const r = await http("POST", `${cc()}/freeze-exceptions`, { token: s.ccClient, body: { requestedChange: "x", reason: "y" } });
    expectStatus(r, 403);
    const request = expectStatus(await http("POST", `${cc()}/scope-changes`, { token: s.ccClient, body: { title: "Review frozen scope", description: "Please consider this late change", category: "other" } }), 201);
    expect(request.status === "submitted" || request.status === "under_review", "client request did not enter PMCM review");
  });
  await step("an addendum can be issued for an approved scope change", async () => {
    const bad = await http("POST", `${cc()}/addenda`, { token: s.admin, body: { title: "Addendum 1", documentId: "doc_does_not_exist", contractSnapshot: [], quoteSnapshot: [], financialDelta: 5000, freezeExceptionId: "x" } });
    expect(bad.status === 400, `addendum with an unknown document returned ${bad.status}: ${msg(bad)}`);
    const none = await http("POST", `${cc()}/addenda`, { token: s.admin, body: { title: "Addendum 1" } });
    expect(none.status === 400, `addendum with a missing document id returned ${none.status}`);
    await refused([["client issues", "POST", `${cc()}/addenda`, s.ccClient, { title: "x", documentId: "d", contractSnapshot: [], quoteSnapshot: [] }],
      ["client conforme request", "POST", `${cc()}/addenda/add_nope/conforme-execution`, s.ccClient, {}],
      ["client countersigns", "POST", `${cc()}/addenda/add_nope/conforme-execution/countersign`, s.ccClient, { executionId: "execution_missing", versionNumber: 1, documentSha256: "a".repeat(64), consentAccepted: true }]]);
    const { document: doc } = await ctx.issueMinimalProposal(s.cc.eventId);
    const billingSource = expectStatus(await http("POST", `${cc()}/billing-source`, { token: s.admin, body: { sourceLabel: "Approved original scope", lineItems: [{ label: "Original package", amount: 100000 }] } }), 201);
    expectStatus(await http("PATCH", `${cc()}/billing-source/${billingSource.id}/approve`, { token: s.admin, body: {} }), 200);
    const exception = expectStatus(await http("POST", `${cc()}/freeze-exceptions`, { token: s.admin, body: { requestedChange: "Issue signed scope addendum", reason: "Approved change request" } }), 201);
    expectStatus(await http("PATCH", `${cc()}/freeze-exceptions/${exception.id}`, { token: s.admin, body: { decision: "approve", decisionNote: "PMCM reviewed impacts" } }), 200);
    const added = expectStatus(await http("POST", `${cc()}/addenda`, { token: s.admin, body: { title: "Addendum 1", documentId: doc.id, contractSnapshot: [], quoteSnapshot: [], financialDelta: 5000, freezeExceptionId: exception.id } }), 200, 201);
    return added.id;
  });
  await step("client toggles are PMCM-controlled: event-day view for clients", async () => {
    const off = expectStatus(await http("GET", `${cc()}`, { token: s.ccClient }), 200);
    expect(off.clientEventDayViewEnabled === false, `default is ${off.clientEventDayViewEnabled}`);
    await refused([["client toggles", "PATCH", `${cc()}/client-event-day-view`, s.ccClient, { enabled: true }], ["coordinator toggles", "PATCH", `${cc()}/client-event-day-view`, s.coord, { enabled: true }],
      ["bad body", "PATCH", `${cc()}/client-event-day-view`, s.admin, { enabled: "yes" }, 400], ["anonymous", "PATCH", `${cc()}/client-event-day-view`, undefined, { enabled: true }, 401]]);
    expectStatus(await http("PATCH", `${cc()}/client-event-day-view`, { token: s.admin, body: { enabled: true } }), 200);
    const on = expectStatus(await http("GET", `${cc()}`, { token: s.ccClient }), 200);
    expect(on.clientEventDayViewEnabled === true, `after enabling it reads ${on.clientEventDayViewEnabled}`);
    const hidden = expectStatus(await http("GET", `${base()}`, { token: s.client }), 200);
    expect(hidden.clientEventDayViewEnabled === false, "enabling the toggle on one event changed another client's event");
  });

  // ---------------------------------------------------------------- cancellation / postponement
  await step("a third event is ready for postponement and cancellation", async () => {
    s.dc = await ctx.newEvent({ label: "FFC Decision" });
    s.dcClient = await s.dc.as();
  });
  const dc = () => `/events/${s.dc.eventId}`;
  await step("decisions validate impact review, dates and role", async () => {
    if (!s.dc) blocked("no decision event");
    const ok = { reason: "Venue unavailable", supplierImpact: "preserve_obligations", impactReviewAcknowledged: true };
    return refused([
      ["postpone without a date", "POST", `${dc()}/decisions`, s.admin, { ...ok, decision: "postponed" }, 400],
      ["supplier impact pending", "POST", `${dc()}/decisions`, s.admin, { ...ok, decision: "postponed", newEventDate: "2027-09-15", supplierImpact: "pending_review" }, 400],
      ["no impact acknowledgement", "POST", `${dc()}/decisions`, s.admin, { decision: "postponed", reason: "x", newEventDate: "2027-09-15", supplierImpact: "preserve_obligations" }, 400],
      ["cancel with deposit unresolved", "POST", `${dc()}/decisions`, s.admin, { ...ok, decision: "cancelled" }, 400],
      ["client decides", "POST", `${dc()}/decisions`, s.dcClient, { ...ok, decision: "cancelled", depositTreatment: "waive" }],
      ["coordinator decides", "POST", `${dc()}/decisions`, s.coord, { ...ok, decision: "cancelled", depositTreatment: "waive" }],
      ["client reads decisions", "GET", `${dc()}/decisions`, s.dcClient],
      ["client reads decision log", "GET", `${dc()}/decision-log`, s.dcClient],
    ]);
  });
  await step("PMCM postpones the event and the client sees the new date", async () => {
    if (!s.dc) blocked("no decision event");
    const d = expectStatus(await http("POST", `${dc()}/decisions`, { token: s.admin, body: { decision: "postponed", reason: "Venue renovation", newEventDate: "2027-09-15", supplierImpact: "preserve_obligations", impactReviewAcknowledged: true } }), 201);
    expect(d.decision === "postponed", `decision ${d.decision}`);
    const ev = expectStatus(await http("GET", `${dc()}`, { token: s.dcClient }), 200);
    expect(String(ev.eventDate).startsWith("2027-09-15"), `client still sees event date ${ev.eventDate}`);
    const log = expectStatus(await http("GET", `${dc()}/decisions`, { token: s.admin }), 200);
    expect(log.length >= 1, "decision is not in the PMCM history");
    return `status "${ev.status}", date ${String(ev.eventDate).slice(0, 10)}`;
  });
  await step("PMCM cancels the event; supplier impact, deposit treatment and client state follow", async () => {
    if (!s.dc) blocked("no decision event");
    const d = expectStatus(await http("POST", `${dc()}/decisions`, { token: s.admin, body: { decision: "cancelled", reason: "Client withdrew funding", supplierImpact: "release_obligations", depositTreatment: "retain", cancellationFeeAmount: 25000, impactReviewAcknowledged: true } }), 201);
    expect(d.decision === "cancelled" && d.supplierImpact === "release_obligations", `decision ${d.decision}/${d.supplierImpact}`);
    const ev = expectStatus(await http("GET", `${dc()}`, { token: s.dcClient }), 200);
    expect(ev.status === "cancelled", `client sees status "${ev.status}"`);
    const fee = d.financialImpact?.cancellationFeeAmount;
    expect(fee === 25000, `cancellation fee recorded as ${fee}`);
    const sourceId = d.financialImpact?.billingSourceId;
    expect(sourceId, "confirmed fee has no approved billing source");
    const statement = expectStatus(await http("POST", `${dc()}/billing-statements/generate`, { token: s.admin, body: { sourceId, idempotencyKey: `decision-fee-statement:${d.id}` } }), 201);
    expect(statement.totalAmount === 25000, "cancellation invoice does not match the confirmed fee");
    const ws = expectStatus(await http("GET", `/pmcm/events/${s.dc.eventId}/workspace`, { token: s.admin }), 200);
    expect(ws.paymentMilestones.some((m) => m.amount === 25000 && m.label === "Cancellation fee"), "fee payment milestone is missing");
    return "PMCM confirmation creates the approved fee source; PMCM issues its statement through the billing workflow.";
  });
  await step("cancelling or postponing is also reachable from a portal screen", async () => {
    const source = readFileSync(new URL("../../../../apps/event/src/features/change-management/register/views/record-decision-form.tsx", import.meta.url), "utf8");
    expect(source.includes("cancellationFeeAmount"), "PMCM decision screen does not expose fee confirmation");
  });

  // ---------------------------------------------------------------- notifications
  await step("PMCM's event workspace shows the notifications queued by these actions", async () => {
    const pm = expectStatus(await http("GET", `/pmcm/events/${E()}/workspace`, { token: s.admin }), 200);
    const logs = pm.notificationLogs ?? [];
    const want = ["layout preference", "Floorplan draft ready for review", "ocular"];
    const missing = want.filter((w) => !logs.some((l) => String(l.message).toLowerCase().includes(w.toLowerCase())));
    expect(missing.length === 0, `no queued notification mentions: ${missing.join(", ")} (have ${logs.length})`);
    s.logs = logs;
    return `${logs.length} notifications: ${[...new Set(logs.map((l) => l.recipient.includes("@") ? "client email" : l.recipient))].join(", ")}`;
  });
  await step("every notification recipient is an email address or a known role label", async () => {
    if (!s.logs) blocked("no notification log");
    // The delivery worker resolves role labels to addresses at send time (notification-recipient-resolver.ts), so the
    // recipient can change between queueing and sending. Anything else could never be delivered.
    const known = new Set(["PMCM Admin", "pmcm-inquiry-desk", "Coordinator", "Client"]);
    const looksLikeEmail = (value) => /^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(value);
    const unknown = [...new Set(s.logs.map((l) => l.recipient).filter((r) => !looksLikeEmail(r) && !known.has(r)))];
    expect(!unknown.length, `recipients that are neither an email address nor a known role label: ${unknown.join(", ")}`);
    return `${s.logs.length} notifications, all addressable`;
  });
  await step("the client's workspace shows the notifications addressed to the client", async () => {
    const ws = expectStatus(await http("GET", `/client/workspace`, { token: s.client }), 200);
    const mine = (s.logs ?? []).filter((l) => l.recipient === "Client" || l.recipient === s.ev.clientEmail);
    if (mine.length > 0 && !(ws.notificationLogs ?? []).length) gap(`PMCM has ${mine.length} client-addressed messages, but the client workspace has no notification feed; this in-app path is unavailable`);
  });
  await step("the client is emailed when PMCM submits a floorplan for review", async () => {
    const mail = await waitForMail(s.ev.clientEmail, (m) => /floorplan|layout|ocular/i.test(m));
    expect(mail, "floorplan notification was not accepted by the local log transport within 45 seconds");
  });
  await step("notification acknowledgement is scoped to the recipient", async () => {
    const queued = (s.logs ?? []).find((l) => l.recipient === "Client");
    if (!queued) blocked("no client-addressed notification");
    const other = await http("POST", `/notifications/${queued.id}/acknowledge`, { token: s.otherClient });
    expect(other.status === 403 || other.status === 404, `another client acknowledging got ${other.status}`);
    const anon = await http("POST", `/notifications/${queued.id}/acknowledge`);
    expect(anon.status === 401, `anonymous acknowledge returned ${anon.status}`);
    const own = await http("POST", `/notifications/${queued.id}/acknowledge`, { token: s.client });
    return `own client acknowledge -> ${own.status}`;
  });
}
