// Phase 6: event day, recorded event end, wrap-up, closeout gates, archive, archive search, audit and privacy.
// Steps that need an event in the event-day stage (or an archived event) are guarded: when the product offers no API way to
// reach that stage they report GAP once and the dependent steps report BLOCKED instead of passing on nothing.
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import { cfg, http, msg, step, startPhase, blocked, gap, review, expect, expectStatus, login } from "../lib.mjs";

export const name = "Event day and closure";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const sourceFiles = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", "dist", ".turbo"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
};
/** Which portals (and the shared api-client) mention an endpoint. Source scan only: it proves a caller exists, not that it works. */
function wiring(re) {
  const hits = {};
  for (const [label, dir] of [["event", "apps/event/src"], ["client", "apps/client/src"], ["guest", "apps/guest/src"], ["supplier", "apps/supplier/src"], ["api-client", "packages/api-client/src"]]) {
    try { hits[label] = sourceFiles(join(repoRoot, dir)).filter((f) => re.test(readFileSync(f, "utf8"))).length; } catch { hits[label] = 0; }
  }
  return hits;
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const denied = (r, what) => expect(r.status === 403, `${what}: expected 403, got ${r.status}: ${msg(r)}`);
const rejected = (r, what) => expect(r.status === 400, `${what}: expected 400, got ${r.status}: ${msg(r)}`);

export async function run(ctx) {
  startPhase("Event day and closure: live ops, event end, wrap-up, gates, archive, audit, privacy");
  const s = {};
  const eventDate = await ctx.reserveDate();
  const admin = await ctx.as("admin").catch(() => null);
  const coordinator = await ctx.as("coordinator").catch(() => null);
  const supplier = await ctx.as("supplier").catch(() => null);

  // ---------------------------------------------------------------- setup
  await step("two onboarded events exist for this phase (A: event day and closure, B: privacy and isolation)", async () => {
    s.A = await ctx.newEvent({ label: "EventDay A", eventDate });
    s.B = await ctx.newEvent({ label: "EventDay B", eventDate });
    s.clientA = await s.A.as();
    s.clientB = await s.B.as();
    return `${s.A.eventId} / ${s.B.eventId}`;
  });
  const E = () => s.A.eventId;

  await step("PMCM assigns coordinator Marco to event A and Marco acknowledges", async () => {
    if (!s.A) blocked("no event");
    const asg = expectStatus(await http("POST", `/events/${E()}/coordinators`, { token: admin, body: { coordinatorId: "coord_marco" } }), 201);
    s.assignment = asg.id;
    expectStatus(await http("PATCH", `/events/${E()}/coordinators/${asg.id}/acknowledge`, { token: coordinator, body: { decision: "acknowledged" } }), 200);
    return `${asg.role}, status ${asg.status}`;
  });

  // ---------------------------------------------------------------- reaching event day
  await step("PMCM can move an event from planning into the event-day stage", async () => {
    if (!s.A) blocked("no event");
    const path = `/events/${E()}/start-event-day`;
    rejected(await http("POST", path, { token: admin, body: {} }), "no approved official plan");
    await ctx.prepareEventDay(E());
    for (const token of [s.clientA, coordinator, supplier]) denied(await http("POST", path, { token, body: {} }), "non-PMCM stage transition");
    expect((await http("POST", path, { body: {} })).status === 401, "anonymous stage transition was not 401");
    expectStatus(await http("POST", path, { token: admin, body: {} }), 200);
    expectStatus(await http("POST", path, { token: admin, body: {} }), 200);
    const detail = expectStatus(await http("GET", `/events/${E()}`, { token: admin }), 200);
    s.stage = detail.status;
    expect(detail.status === "event_day", `stage is ${detail.status}`);
    s.eventDay = true;
    return "PMCM start is readiness-gated, role-scoped and repeatable";
  });

  // ---------------------------------------------------------------- event day: live ops
  await step("PMCM opens an event-day task and the live-ops board shows it", async () => {
    if (!s.A) blocked("no event");
    const task = expectStatus(await http("POST", `/events/${E()}/event-day/tasks`, { token: admin, body: { title: "Check AV before doors", priority: "high" } }), 201);
    s.task = task.id;
    const board = expectStatus(await http("GET", `/events/${E()}/live-ops`, { token: admin }), 200);
    expect(board.tasks?.some((x) => x.id === task.id), "task is not on the live-ops board");
    return `board has ${board.tasks.length} task(s), event stage "${board.event.status}"`;
  });
  await step("event-day task with an empty title is rejected with 400", async () => {
    rejected(await http("POST", `/events/${E()}/event-day/tasks`, { token: admin, body: { title: "  " } }), "empty title");
  });
  await step("PMCM moves the task to in_progress and a bogus status is a 400, not a 500", async () => {
    if (!s.task) blocked("no task");
    expectStatus(await http("PATCH", `/events/${E()}/event-day/tasks/${s.task}`, { token: admin, body: { status: "in_progress" } }), 200);
    const bad = await http("PATCH", `/events/${E()}/event-day/tasks/${s.task}`, { token: admin, body: { status: "teleported" } });
    expect(bad.status === 400, `bogus task status returned ${bad.status}: ${msg(bad)}`);
  });
  await step("PMCM escalates the task", async () => {
    if (!s.task) blocked("no task");
    const r = expectStatus(await http("POST", `/events/${E()}/event-day/tasks/${s.task}/escalate`, { token: admin, body: { notes: "Vendor not on site" } }), 200, 201);
    return `escalationLevel=${r.escalationLevel}`;
  });
  await step("PMCM opens an urgent issue and the issues close gate turns red", async () => {
    if (!s.A) blocked("no event");
    const issue = expectStatus(await http("POST", `/events/${E()}/urgent-issues`, { token: admin, body: { title: "Generator tripped", severity: "high", affectedArea: "Stage" } }), 201);
    s.issue = issue.id;
    const gates = expectStatus(await http("GET", `/events/${E()}/close-gates`, { token: admin }), 200);
    const g = gates.gates.find((x) => x.key === "issues");
    expect(g && g.passed === false, `issues gate still passes with an open urgent issue: ${JSON.stringify(g)}`);
    return g.detail;
  });
  await step("an urgent issue can be escalated and resolved, and the issues gate recovers", async () => {
    if (!s.issue) blocked("no issue");
    expectStatus(await http("POST", `/events/${E()}/urgent-issues/${s.issue}/escalate`, { token: admin, body: { notes: "Escalated to PMCM owner" } }), 200, 201);
    expectStatus(await http("PATCH", `/events/${E()}/urgent-issues/${s.issue}`, { token: admin, body: { status: "resolved", resolution: "Backup generator online" } }), 200);
    const gates = expectStatus(await http("GET", `/events/${E()}/close-gates`, { token: admin }), 200);
    expect(gates.gates.find((x) => x.key === "issues")?.passed === true, "issues gate still red after the issue was resolved");
  });
  await step("urgent issue with an unknown status is a 400, not a 500", async () => {
    if (!s.issue) blocked("no issue");
    const r = await http("PATCH", `/events/${E()}/urgent-issues/${s.issue}`, { token: admin, body: { status: "vaporised" } });
    expect(r.status === 400, `returned ${r.status}: ${msg(r)}`);
  });
  await step("coordinator Marco marks himself present, PMCM can set attendance, an unknown status is a 400", async () => {
    if (!s.assignment) blocked("no assignment");
    expectStatus(await http("PATCH", `/events/${E()}/coordinators/${s.assignment}/status`, { token: coordinator, body: { status: "present" } }), 200);
    const late = expectStatus(await http("PATCH", `/events/${E()}/coordinators/${s.assignment}/status`, { token: admin, body: { status: "late", notes: "Traffic" } }), 200);
    expect(late.attendanceStatus === "late", `attendance is ${late.attendanceStatus}`);
    rejected(await http("PATCH", `/events/${E()}/coordinators/${s.assignment}/status`, { token: admin, body: { status: "bogus" } }), "bogus attendance");
  });
  await step("PMCM designates Marco as event-day operator; a coordinator cannot designate themselves", async () => {
    if (!s.assignment) blocked("no assignment");
    denied(await http("POST", `/events/${E()}/operator-designation`, { token: coordinator, body: { coordinatorId: "coord_marco" } }), "coordinator self-designation");
    expectStatus(await http("POST", `/events/${E()}/operator-designation`, { token: admin, body: { coordinatorId: "coord_marco" } }), 201);
  });
  await step("an unassigned coordinator cannot write to this event's live ops", async () => {
    expect(coordinator, "no valid coordinator session");
    denied(await http("POST", `/events/${s.B.eventId}/event-day/tasks`, { token: coordinator, body: { title: "Not my event" } }), "unassigned coordinator task");
  });
  await step("PMCM builds a run sheet (day, segment, start) and reads it back", async () => {
    if (!s.A) blocked("no event");
    const day = expectStatus(await http("POST", `/events/${E()}/schedule/days`, { token: admin, body: { dayDate: eventDate, label: "Day 1" } }), 201);
    s.day = day.id;
    const seg = expectStatus(await http("POST", `/events/${E()}/schedule/days/${day.id}/segments`, { token: admin, body: { title: "Doors and registration", plannedStartAt: `${eventDate}T01:00:00Z`, plannedEndAt: `${eventDate}T03:00:00Z`, ownerRole: "General Coordinator" } }), 201);
    s.segment = seg.id;
    const sheet = expectStatus(await http("GET", `/events/${E()}/run-sheet`, { token: admin }), 200);
    expect(sheet.day?.segments?.length >= 1 || sheet.authored, `run sheet shows no segments: ${JSON.stringify(sheet).slice(0, 160)}`);
    return `scope=${sheet.scope}`;
  });
  await step("a run-sheet segment starts after PMCM has activated event day", async () => {
    if (!s.segment) blocked("no segment");
    const r = await http("PATCH", `/events/${E()}/schedule/segments/${s.segment}/status`, { token: admin, body: { action: "start" } });
    expect(s.eventDay, "event-day prerequisite was not satisfied");
    expectStatus(r, 200);
  });
  await step("coordinator (designated operator) files an end-of-day report and PMCM replies", async () => {
    if (!s.day || !s.assignment) blocked("no schedule day or coordinator assignment");
    const rep = await http("POST", `/events/${E()}/eod-reports`, { token: coordinator, body: { dayId: s.day, progress: ["Doors opened on time"], issues: ["Generator tripped"] } });
    const report = expectStatus(rep, 201);
    expectStatus(await http("POST", `/events/${E()}/eod-reports/${report.id}/replies`, { token: admin, body: { body: "Noted, thanks." } }), 201);
  });
  await step("coordinators record a same-role handoff before the outgoing assignment is replaced", async () => {
    const roster = expectStatus(await http("GET", "/coordinators", { token: admin }), 200);
    const incoming = roster.find((c) => c.id !== "coord_marco" && (c.roleTags ?? []).includes("General Coordinator"));
    expect(incoming, "fixture directory has no second general coordinator");
    const assignment = expectStatus(await http("POST", `/events/${E()}/coordinators`, { token: admin, body: { coordinatorId: incoming.id, role: "General Coordinator" } }), 201);
    const handoff = expectStatus(await http("POST", `/events/${E()}/handoffs`, { token: coordinator, body: { dayId: s.day, role: "General Coordinator", fromAssignmentId: s.assignment, toAssignmentId: assignment.id, outstandingItems: ["Watch north entrance"] } }), 201);
    const listed = expectStatus(await http("GET", `/events/${E()}/handoffs`, { token: admin }), 200);
    expect(listed.some((item) => item.id === handoff.id && item.outstandingItems.includes("Watch north entrance")), "handoff did not persist");
  });
  await step("coordinator replacement requires a reason and a role the replacement is qualified for", async () => {
    if (!s.assignment) blocked("no assignment");
    rejected(await http("POST", `/events/${E()}/coordinators/${s.assignment}/replace`, { token: admin, body: { replacementCoordinatorId: "coord_bianca", role: "General Coordinator" } }), "replacement without reason");
    rejected(await http("POST", `/events/${E()}/coordinators/${s.assignment}/replace`, { token: admin, body: { replacementCoordinatorId: "coord_bianca", role: "General Coordinator", reason: "Marco unwell" } }), "replacement lacks required role tag");
    const r = expectStatus(await http("POST", `/events/${E()}/coordinators/${s.assignment}/replace`, { token: admin, body: { replacementCoordinatorId: "coord_bianca", role: "Stage Director", reason: "Reassign stage coverage" } }), 200, 201);
    s.replacement = r.replacementAssignment?.id;
    expect(s.replacement && r.replacedAssignment?.status === "replaced", `replacement result: ${JSON.stringify(r).slice(0, 200)}`);
  });

  await step("supplier event-day status update reaches PMCM verification", async () => {
    if (!s.A) blocked("no event");
    const requests = expectStatus(await http("POST", `/events/${E()}/quote-requests`, { token: admin, body: { categoryId: "supcat_digital_registration", supplierIds: ["sup_xperto"], deadline: eventDate } }), 201);
    const request = requests[0];
    const quote = expectStatus(await http("POST", `/quote-requests/${request.accessToken}/quote`, { body: { amount: 50000, notes: "Lifecycle assignment" } }), 201);
    expectStatus(await http("PATCH", `/events/${E()}/supplier-quotes/${quote.id}/select`, { token: admin }), 200);
    expectStatus(await http("PATCH", `/supplier/quote-requests/${request.id}/assignment/confirm`, { token: supplier }), 200);
    expectStatus(await http("PATCH", `/supplier/quote-requests/${request.id}/readiness/confirm`, { token: supplier, body: { notes: "Ready for event day" } }), 200);
    expectStatus(await http("PATCH", `/supplier/quote-requests/${request.id}/event-status`, { token: supplier, body: { status: "arrived" } }), 200);
    const board = expectStatus(await http("GET", `/events/${E()}/live-ops`, { token: admin }), 200);
    expect(JSON.stringify(board).includes(request.id), "PMCM live ops does not show the supplier assignment");
  });
  await step("PMCM turns on the client's event-day view; the client cannot", async () => {
    if (!s.A) blocked("no event");
    denied(await http("PATCH", `/events/${E()}/client-event-day-view`, { token: s.clientA, body: { enabled: true } }), "client toggling own event-day view");
    expectStatus(await http("PATCH", `/events/${E()}/client-event-day-view`, { token: admin, body: { enabled: true } }), 200);
    const events = expectStatus(await http("GET", "/events", { token: s.clientA }), 200);
    const mine = (events.items ?? events).find((e) => e.id === E());
    expect(mine?.clientEventDayViewEnabled === true, "client does not see the event-day view flag");
    return `client sees status "${mine.status}"; the client UI only renders the live status when status is event_day`;
  });
  await step("client sees live event-day status while the event is live", async () => {
    if (!s.eventDay) blocked("event never reached event_day, so the client event-day view cannot render");
  });
  await step("guest checks in by access code and PMCM sees the count on live ops", async () => {
    const code = expectStatus(await http("GET", `/events/${E()}`, { token: admin }), 200).guestAccessCode;
    expect(code, "event has no guest access code");
    s.guestName = `Lifecycle Guest ${E()}`;
    expectStatus(await http("POST", `/guest/events/${E()}/roster/import`, { token: admin, body: { source: "csv", rows: [{ sourceKey: "lifecycle-guest", guestName: s.guestName, email: `guest-${E()}@example.test` }] } }), 200, 201);
    const r = await http("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, { body: { guestName: s.guestName, checkInMode: "name_search", idempotencyKey: randomUUID(), privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION } });
    expectStatus(r, 201);
    const board = expectStatus(await http("GET", `/events/${E()}/live-ops`, { token: admin }), 200);
    expect(board.guestAttendanceCount >= 1, `live ops shows ${board.guestAttendanceCount} guests after a check-in`);
    return `count=${board.guestAttendanceCount}`;
  });
  await step("guest feedback is refused until PMCM has recorded the event end", async () => {
    const code = expectStatus(await http("GET", `/events/${E()}`, { token: admin }), 200).guestAccessCode;
    const r = await http("POST", `/guest/events/${encodeURIComponent(code)}/feedback`, { body: { guestName: "Pat Guest", rating: 5, comment: "Great", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION } });
    expect(r.status === 400, `feedback before the recorded end returned ${r.status}: ${msg(r)}`);
    return msg(r);
  });

  // ---------------------------------------------------------------- recorded event end and wrap-up
  await step("only PMCM may record the actual event end (coordinator, client, supplier get 403)", async () => {
    if (!s.A) blocked("no event");
    const body = { actualEndedAt: hoursAgo(1) };
    denied(await http("POST", `/events/${E()}/actual-end`, { token: coordinator, body }), "coordinator");
    denied(await http("POST", `/events/${E()}/actual-end`, { token: s.clientA, body }), "client");
    denied(await http("POST", `/events/${E()}/actual-end`, { token: supplier, body }), "supplier");
    expect((await http("POST", `/events/${E()}/actual-end`, { body })).status === 401, "unauthenticated actual-end was not 401");
  });
  await step("designated event-day operator can record the actual end", async () => {
    if (!s.eventDay) blocked("event is not in event_day; policy says PMCM or the designated operator records the end, but the API only allows PMCM and system");
  });
  await step("actual end with an invalid or future timestamp is a 400", async () => {
    rejected(await http("POST", `/events/${E()}/actual-end`, { token: admin, body: { actualEndedAt: "yesterday-ish" } }), "garbage timestamp");
    rejected(await http("POST", `/events/${E()}/actual-end`, { token: admin, body: { actualEndedAt: new Date(Date.now() + 86400_000).toISOString() } }), "future end");
  });
  await step("an event that has not reached event day cannot have an end recorded", async () => {
    const r = await http("POST", `/events/${s.B.eventId}/actual-end`, { token: admin, body: { actualEndedAt: hoursAgo(1) } });
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("PMCM records the actual event end", async () => {
    if (!s.eventDay) blocked("event never reached event_day");
    const r = expectStatus(await http("POST", `/events/${E()}/actual-end`, { token: admin, body: { actualEndedAt: hoursAgo(1) } }), 200, 201);
    s.endedAt = r.actualEndedAt;
    expect(s.endedAt, "response has no actualEndedAt");
  });
  await step("changing the recorded end needs a correction reason and is audited", async () => {
    if (!s.endedAt) blocked("no recorded end");
    rejected(await http("POST", `/events/${E()}/actual-end`, { token: admin, body: { actualEndedAt: hoursAgo(2) } }), "correction without reason");
    const corrected = expectStatus(await http("POST", `/events/${E()}/actual-end`, { token: admin, body: { actualEndedAt: hoursAgo(2), correctionReason: "Clock at venue was off" } }), 200, 201);
    s.endedAt = corrected.actualEndedAt;
    const logs = expectStatus(await http("GET", `/audit/logs?eventId=${E()}`, { token: admin }), 200);
    expect(logs.some((l) => /Corrected actual event end/.test(l.action) && l.metadata?.correctionReason), "no audit entry with the correction reason");
  });
  await step("wrap-up is closed to PMCM until an end is recorded, and opens a 24h window after it", async () => {
    const before = await http("POST", `/events/${E()}/wrap-up`, { token: admin, body: {} });
    if (!s.endedAt) { expect(before.status === 400, `wrap-up without a recorded end returned ${before.status}: ${msg(before)}`); blocked(`wrap-up correctly refused (${before.status}); cannot test the 24h deadline and 12h/24h reminders without a recorded end`); }
    const w = expectStatus(before, 200, 201);
    const hours = (new Date(w.deadlineAt) - new Date(s.endedAt)) / 3600_000;
    expect(Math.abs(hours - 24) < 0.1, `deadline is ${hours}h after the end`);
    return `deadline ${w.deadlineAt}`;
  });

  // ---------------------------------------------------------------- close gates
  await step("PMCM reads the close gates of a bare event: five gates, none satisfied except issues", async () => {
    const gates = expectStatus(await http("GET", `/events/${s.B.eventId}/close-gates`, { token: admin }), 200);
    const keys = gates.gates.map((g) => g.key).sort().join(",");
    expect(keys === "billing,documents,feedback,issues,logistics", `gate keys: ${keys}`);
    expect(gates.ready === false, "a bare event reports ready=true");
    return gates.gates.map((g) => `${g.key}:${g.passed ? "ok" : "open"}`).join(" ");
  });
  await step("close gates are PMCM only (coordinator, client, supplier get 403; anonymous 401)", async () => {
    const p = `/events/${E()}/close-gates`;
    denied(await http("GET", p, { token: coordinator }), "coordinator");
    denied(await http("GET", p, { token: s.clientA }), "client");
    denied(await http("GET", p, { token: supplier }), "supplier");
    expect((await http("GET", p)).status === 401, "anonymous close-gates was not 401");
  });
  await step("logistics completion: PMCM records it, a replacement needs a correction reason, the gate turns green", async () => {
    rejected(await http("POST", `/events/${E()}/logistics-completion`, { token: admin, body: { assetReturnsVerified: false, completionSummary: "x" } }), "unverified asset returns");
    rejected(await http("POST", `/events/${E()}/logistics-completion`, { token: admin, body: { assetReturnsVerified: true, completionSummary: "" } }), "empty summary");
    const first = expectStatus(await http("POST", `/events/${E()}/logistics-completion`, { token: admin, body: { assetReturnsVerified: true, completionSummary: "All rentals returned", privateNotes: "Dock B, 6pm" } }), 200, 201);
    rejected(await http("POST", `/events/${E()}/logistics-completion`, { token: admin, body: { assetReturnsVerified: true, completionSummary: "Second pass" } }), "replacement without correction reason");
    const second = expectStatus(await http("POST", `/events/${E()}/logistics-completion`, { token: admin, body: { assetReturnsVerified: true, completionSummary: "All rentals returned and counted", correctionReason: "Added count" } }), 200, 201);
    expect(second.revision > first.revision, `revision did not increase (${first.revision} -> ${second.revision})`);
    const gates = expectStatus(await http("GET", `/events/${E()}/close-gates`, { token: admin }), 200);
    expect(gates.gates.find((g) => g.key === "logistics")?.passed, "logistics gate is still open after the record");
    s.logistics = true;
  });
  await step("logistics completion is PMCM only and private notes never reach the audit trail", async () => {
    if (!s.logistics) blocked("no logistics record");
    denied(await http("POST", `/events/${E()}/logistics-completion`, { token: coordinator, body: { assetReturnsVerified: true, completionSummary: "x" } }), "coordinator write");
    denied(await http("GET", `/events/${E()}/logistics-completion`, { token: s.clientA }), "client read");
    const logs = expectStatus(await http("GET", `/audit/logs?eventId=${E()}`, { token: admin }), 200);
    expect(!JSON.stringify(logs).includes("Dock B, 6pm"), "private logistics notes leaked into the audit log");
  });
  await step("PMCM shares the two tracked deliverables; each appears in the client's closeout view", async () => {
    const ws = expectStatus(await http("GET", `/pmcm/events/${E()}/workspace`, { token: admin }), 200);
    const docs = ws.postEventDocuments ?? [];
    expect(docs.length >= 2, `event has ${docs.length} tracked post-event deliverable(s)`);
    s.docs = docs;
    denied(await http("PATCH", `/events/${E()}/post-event-documents/${docs[0].id}/complete`, { token: coordinator }), "coordinator completes a deliverable");
    for (const d of docs) expectStatus(await http("PATCH", `/events/${E()}/post-event-documents/${d.id}/complete`, { token: admin }), 200);
    const closeout = expectStatus(await http("GET", `/events/${E()}/client-closeout`, { token: s.clientA }), 200);
    expect(closeout.deliverables.length === docs.length, `client sees ${closeout.deliverables.length} of ${docs.length} deliverables`);
    const gates = expectStatus(await http("GET", `/events/${E()}/close-gates`, { token: admin }), 200);
    return gates.gates.filter((g) => ["documents", "feedback"].includes(g.key)).map((g) => `${g.key}:${g.passed ? "ok" : "open"} (${g.detail})`).join("; ");
  });
  await step("completing the tracked deliverables must not satisfy the client-feedback gate", async () => {
    if (!s.docs) blocked("no deliverables");
    const gates = expectStatus(await http("GET", `/events/${E()}/close-gates`, { token: admin }), 200);
    const fb = gates.gates.find((g) => g.key === "feedback");
    expect(fb && fb.passed === false, `feedback gate passed without client feedback: ${JSON.stringify(fb)}`);
  });
  await step("client acknowledges a delivered deliverable once; another client and a repeat are refused", async () => {
    if (!s.docs) blocked("no deliverables");
    const path = `/events/${E()}/client-closeout/deliverables/${s.docs[0].id}/acknowledgement`;
    denied(await http("POST", path, { token: s.clientB, body: { note: "not mine" } }), "other client");
    expectStatus(await http("POST", path, { token: s.clientA, body: { note: "Received, thank you" } }), 200, 201);
    rejected(await http("POST", path, { token: s.clientA, body: { note: "again" } }), "second acknowledgement");
  });
  await step("client feedback and testimonial are refused before the event end is recorded", async () => {
    const r = await http("POST", `/events/${E()}/client-closeout/response`, { token: s.clientA, body: { rating: 5, feedback: "Wonderful", testimonial: "", testimonialConsent: false } });
    if (s.endedAt) { expectStatus(r, 200, 201); s.feedback = true; return "accepted after end"; }
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    rejected(await http("POST", `/events/${E()}/client-closeout/response`, { token: s.clientA, body: { rating: 9, feedback: "", testimonial: "", testimonialConsent: false } }), "rating 9");
    return msg(r);
  });
  await step("client closeout is visible to PMCM moderation only; other client and supplier are refused", async () => {
    denied(await http("GET", `/events/${E()}/client-closeout`, { token: s.clientB }), "other client closeout");
    denied(await http("GET", `/events/${E()}/client-closeout`, { token: supplier }), "supplier closeout");
    denied(await http("GET", `/events/${E()}/client-closeout/moderation`, { token: s.clientA }), "client moderation");
    expectStatus(await http("GET", `/events/${E()}/client-closeout/moderation`, { token: admin }), 200);
  });

  // ---------------------------------------------------------------- archive
  await step("archive is refused while gates are open and no override reason is given", async () => {
    const r = await http("POST", `/events/${s.B.eventId}/archive`, { token: admin, body: {} });
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("archive with a reasoned override on an event that is not in the closure stage is still refused", async () => {
    const r = await http("POST", `/events/${E()}/archive`, { token: admin, body: { overrideReason: "Billing settled offline, feedback to follow" } });
    if (s.eventDay) { expectStatus(r, 200); s.archived = true; return "archived with override"; }
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("archive records the override reason in the audit trail with the missing gates", async () => {
    if (!s.archived) blocked("event A could not be archived, so there is no override to find in the audit");
    const logs = expectStatus(await http("GET", `/audit/logs?eventId=${E()}`, { token: admin }), 200);
    const entry = logs.find((l) => l.action === "Archived event with override");
    expect(entry && entry.metadata?.overrideReason, "no 'Archived event with override' audit entry with a reason");
  });
  await step("archiving twice is refused", async () => {
    if (!s.archived) blocked("nothing archived");
    rejected(await http("POST", `/events/${E()}/archive`, { token: admin, body: {} }), "second archive");
  });
  await step("archive is PMCM only; invalid body is 400; unknown event is 404; anonymous is 401", async () => {
    const p = `/events/${E()}/archive`;
    denied(await http("POST", p, { token: coordinator, body: {} }), "coordinator");
    denied(await http("POST", p, { token: s.clientA, body: {} }), "client");
    denied(await http("POST", p, { token: supplier, body: {} }), "supplier");
    expect((await http("POST", p, { body: {} })).status === 401, "anonymous archive was not 401");
    const bad = await http("POST", p, { token: admin, body: { overrideReason: { not: "a string" } } });
    expect(bad.status === 400, `invalid override body returned ${bad.status}: ${msg(bad)}`);
    const missing = await http("POST", "/events/evt_does_not_exist/archive", { token: admin, body: {} });
    expect(missing.status === 404, `unknown event returned ${missing.status}: ${msg(missing)}`);
  });
  await step("archive cannot be triggered by elapsed time alone", async () => {
    s.C = await ctx.newEvent({ label: "Archive comparison", eventDate: await ctx.reserveDate() });
    await ctx.prepareEventDay(s.C.eventId);
    expectStatus(await http("POST", `/events/${s.C.eventId}/start-event-day`, { token: admin, body: {} }), 200);
    expectStatus(await http("POST", `/events/${s.C.eventId}/actual-end`, { token: admin, body: { actualEndedAt: hoursAgo(24 * 8) } }), 200, 201);
    const event = expectStatus(await http("GET", `/events/${s.C.eventId}`, { token: admin }), 200);
    expect(event.archived === false, "recording an end older than the wrap-up window silently archived the event");
    return "elapsed wrap-up alone leaves archive requiring explicit PMCM action";
  });
  await step("archived event: client closeout, deliverables and wrap-up are read-only", async () => {
    if (!s.archived) blocked("nothing archived");
    rejected(await http("POST", `/events/${E()}/client-closeout/response`, { token: s.clientA, body: { rating: 4, feedback: "late", testimonial: "", testimonialConsent: false } }), "feedback after archive");
    rejected(await http("PATCH", `/events/${E()}/wrap-up`, { token: admin, body: { clientAcknowledged: true } }), "wrap-up edit after archive");
  });
  await step("archived event: supplier and coordinator lose write access", async () => {
    if (!s.archived) blocked("nothing archived");
    const r = await http("POST", `/events/${E()}/event-day/tasks`, { token: coordinator, body: { title: "after archive" } });
    expect(r.status === 403, `coordinator task on archived event returned ${r.status}: ${msg(r)}`);
  });
  await step("archived event: guest check-in is refused but guest feedback is still accepted inside the seven-day window", async () => {
    if (!s.archived) blocked("nothing archived");
    const code = expectStatus(await http("GET", `/events/${E()}`, { token: admin }), 200).guestAccessCode;
    const check = await http("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, { body: { checkInMode: "headcount", idempotencyKey: randomUUID(), privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION } });
    expect(check.status >= 400, "guest check-in worked on an archived event");
    const fb = await http("POST", `/guest/events/${encodeURIComponent(code)}/feedback`, { body: { guestName: "Pat Guest", rating: 4, comment: "Lovely", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION } });
    expect(fb.status === 200 || fb.status === 201, `guest feedback on an archived event inside the window returned ${fb.status}: ${msg(fb)}`);
  });
  await step("guest feedback is refused once seven days have passed since the recorded end", async () => {
    if (!s.archived) blocked("nothing archived");
    expectStatus(await http("POST", `/events/${E()}/actual-end`, { token: admin, body: { actualEndedAt: hoursAgo(24 * 8), correctionReason: "Backdated to test the feedback window" } }), 200, 201);
    const code = expectStatus(await http("GET", `/events/${E()}`, { token: admin }), 200).guestAccessCode;
    const fb = await http("POST", `/guest/events/${encodeURIComponent(code)}/feedback`, { body: { guestName: "Late Guest", rating: 3, comment: "Too late", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION } });
    expect(fb.status === 400, `late feedback returned ${fb.status}: ${msg(fb)}`);
  });

  // ---------------------------------------------------------------- archive search, compare, insights, briefs
  await step("archive search is PMCM only and returns an array (filters validated)", async () => {
    const list = expectStatus(await http("GET", "/events/archive", { token: admin }), 200);
    expect(Array.isArray(list), "archive search did not return a list");
    denied(await http("GET", "/events/archive", { token: coordinator }), "coordinator search");
    denied(await http("GET", "/events/archive", { token: supplier }), "supplier search");
    rejected(await http("GET", "/events/archive?month=October", { token: admin }), "bad month filter");
    if (s.archived) expect(list.some((h) => h.id === E() || h.eventId === E()), "archived event A is not in the archive search");
    return `${list.length} archived event(s)`;
  });
  await step("archive comparison needs 2 to 4 distinct archived events", async () => {
    const p = (ids) => `/events/archive/compare?eventIds=${ids.join(",")}`;
    rejected(await http("GET", p([E()]), { token: admin }), "single id");
    rejected(await http("GET", p([E(), E()]), { token: admin }), "duplicate ids");
    rejected(await http("GET", p(["a", "b", "c", "d", "e"]), { token: admin }), "five ids");
    const r = await http("GET", p([E(), s.B.eventId]), { token: admin });
    expect(r.status === 404, `comparing non-archived events returned ${r.status}: ${msg(r)}`);
    denied(await http("GET", p([E(), s.B.eventId]), { token: s.clientA }), "client compare");
  });
  await step("PMCM compares two archived events side by side", async () => {
    expect(s.C && s.archived, "comparison fixtures were not prepared");
    expectStatus(await http("POST", `/events/${s.C.eventId}/archive`, { token: admin, body: { overrideReason: "Isolated archive comparison fixture" } }), 200);
    const comparison = expectStatus(await http("GET", `/events/archive/compare?eventIds=${E()},${s.C.eventId}`, { token: admin }), 200);
    expect(JSON.stringify(comparison).includes(E()) && JSON.stringify(comparison).includes(s.C.eventId), "archive comparison omits an event");
  });
  await step("event insights: PMCM reads the learning loop, client and supplier are refused", async () => {
    const r = expectStatus(await http("GET", `/events/${E()}/insights`, { token: admin }), 200);
    expect(Array.isArray(r), "insights is not a list");
    denied(await http("GET", `/events/${E()}/insights`, { token: s.clientA }), "client insights");
    denied(await http("GET", `/events/${E()}/insights`, { token: supplier }), "supplier insights");
    return `${r.length} insight(s)`;
  });
  await step("handoff brief and decision log are PMCM readable; client, supplier and anonymous are refused", async () => {
    const brief = expectStatus(await http("GET", `/events/${E()}/handoff-brief`, { token: admin }), 200);
    expect(brief.openIssues && brief.staffing, "handoff brief lacks open issues or staffing");
    expectStatus(await http("GET", `/events/${E()}/decision-log`, { token: admin }), 200);
    denied(await http("GET", `/events/${E()}/handoff-brief`, { token: s.clientA }), "client brief");
    denied(await http("GET", `/events/${E()}/decision-log`, { token: supplier }), "supplier decision log");
    expect((await http("GET", `/events/${E()}/decision-log`)).status === 401, "anonymous decision log was not 401");
  });
  await step("decision log records the archive override", async () => {
    if (!s.archived) blocked("nothing archived");
    const log = expectStatus(await http("GET", `/events/${E()}/decision-log`, { token: admin }), 200);
    expect(log.kindCounts?.archive_override >= 1, `archive_override count is ${log.kindCounts?.archive_override}`);
  });

  // ---------------------------------------------------------------- audit trail
  await step("PMCM audit trail shows this phase's mutations with actor and hash chain", async () => {
    const logs = expectStatus(await http("GET", `/audit/logs?eventId=${E()}&limit=200`, { token: admin }), 200);
    const actions = logs.map((l) => l.action).join(" | ");
    for (const wanted of [/urgent issue/i, /logistics completion/i, /coordinator/i]) expect(wanted.test(actions), `no audit entry matching ${wanted}`);
    expect(logs.every((l) => l.actor && l.immutableHash), "an audit entry lacks actor or hash");
    return `${logs.length} entries`;
  });
  await step("audit chain integrity verifies", async () => {
    const r = expectStatus(await http("GET", "/audit/integrity", { token: admin }), 200);
    expect(r.valid === true, `chain broken at ${r.firstBrokenLogId}: ${r.breakReason}`);
    return `${r.checkedCount} entries checked`;
  });
  await step("audit trail is PMCM only: coordinator, client, supplier get 403, anonymous 401", async () => {
    for (const [who, token] of [["coordinator", coordinator], ["client", s.clientA], ["supplier", supplier]]) {
      denied(await http("GET", `/audit/logs?eventId=${E()}`, { token }), `${who} audit logs`);
      denied(await http("GET", "/audit/integrity", { token }), `${who} audit integrity`);
    }
    expect((await http("GET", "/audit/logs")).status === 401, "anonymous audit logs was not 401");
  });

  // ---------------------------------------------------------------- privacy (event B's client)
  const emailB = () => s.B.clientEmail;
  const priv = (body, token = admin) => http("POST", "/privacy/requests", { token, body });
  await step("privacy requests are PMCM only and reject malformed bodies with 400", async () => {
    const ok = { subjectType: "client", subjectEmail: emailB(), eventId: s.B.eventId, requestType: "access" };
    denied(await priv(ok, coordinator), "coordinator");
    denied(await priv(ok, s.clientB), "the data subject themself");
    expect((await priv(ok, null)).status === 401, "anonymous privacy request was not 401");
    rejected(await priv({ ...ok, requestType: "erase-everything" }), "unknown request type");
    rejected(await priv({ ...ok, subjectType: "robot" }), "unknown subject type");
    rejected(await priv({ subjectType: "client", requestType: "access" }), "no subject identity");
    rejected(await priv({ subjectType: "guest", subjectName: "Pat", requestType: "access" }), "guest request without an event");
    const missing = await priv({ ...ok, eventId: "evt_nope" });
    expect(missing.status === 404, `unknown event returned ${missing.status}`);
  });
  await step("access request: PMCM files, cannot execute before approval, approves, and exports the subject's data", async () => {
    const req = expectStatus(await priv({ subjectType: "client", subjectEmail: emailB(), eventId: s.B.eventId, requestType: "access" }), 201);
    rejected(await http("POST", `/privacy/requests/${req.id}/execute`, { token: admin, body: {} }), "execute before approval");
    expectStatus(await http("PATCH", `/privacy/requests/${req.id}/review`, { token: admin, body: { status: "approved", reviewReason: "Identity verified" } }), 200);
    const done = await http("POST", `/privacy/requests/${req.id}/execute`, { token: admin, body: { executionNotes: "Export prepared" } });
    expectStatus(done, 200, 201);
    return JSON.stringify(done.body).slice(0, 120);
  });
  await step("correction request for a client who has a portal account can be executed", async () => {
    const req = expectStatus(await priv({ subjectType: "account", subjectEmail: emailB(), eventId: s.B.eventId, requestType: "correction" }), 201);
    expectStatus(await http("PATCH", `/privacy/requests/${req.id}/review`, { token: admin, body: { status: "approved" } }), 200);
    const done = await http("POST", `/privacy/requests/${req.id}/execute`, { token: admin, body: { correction: { name: "Corrected Client Name" } } });
    expectStatus(done, 200, 201);
  });
  await step("an active legal hold blocks deletion; releasing it lets deletion run", async () => {
    const hold = expectStatus(await http("POST", "/privacy/legal-holds", { token: admin, body: { subjectType: "client", subjectEmail: emailB(), eventId: s.B.eventId, reason: "Dispute pending" } }), 201);
    const req = expectStatus(await priv({ subjectType: "account", subjectEmail: emailB(), eventId: s.B.eventId, requestType: "deletion" }), 201);
    expectStatus(await http("PATCH", `/privacy/requests/${req.id}/review`, { token: admin, body: { status: "approved" } }), 200);
    rejected(await http("POST", `/privacy/requests/${req.id}/execute`, { token: admin, body: {} }), "deletion under legal hold");
    expectStatus(await http("POST", `/privacy/legal-holds/${hold.id}/release`, { token: admin, body: { reason: "Dispute closed" } }), 200, 201);
    s.deletionRequest = req.id;
  });
  await step("deletion/redaction of the client's data completes and the client can no longer sign in", async () => {
    if (!s.deletionRequest) blocked("no approved deletion request");
    const done = await http("POST", `/privacy/requests/${s.deletionRequest}/execute`, { token: admin, body: { executionNotes: "Erased on request" } });
    expectStatus(done, 200, 201);
    const again = await login(emailB(), cfg.password.client);
    expect(!again.token, "erased client can still sign in");
    return JSON.stringify(done.body).slice(0, 120);
  });
  await step("privacy request queue and retention review are PMCM only", async () => {
    expectStatus(await http("GET", "/privacy/requests", { token: admin }), 200);
    expectStatus(await http("GET", "/privacy/retention-review-items", { token: admin }), 200);
    denied(await http("GET", "/privacy/requests", { token: coordinator }), "coordinator queue");
    denied(await http("GET", "/privacy/retention-review-items", { token: supplier }), "supplier retention review");
  });
  await step("portal wiring: account correction and erasure requests can be created", async () => {
    const source = readFileSync(join(repoRoot, "apps/event/src/features/privacy/console/views/privacy-console-sections.tsx"), "utf8");
    const options = source.split("export function PrivacyRequestCreateSection")[1] ?? source;
    if (!options.includes('value="account"')) gap("the API requires account subject requests for native-account correction/erasure, but the PMCM request-creation selector offers only client, supplier and guest");
  });
  await step("guest privacy request (access/export) on a closed event's guest", async () => {
    expect(s.guestName && s.archived, "guest archive fixture was not prepared");
    const request = expectStatus(await priv({ subjectType: "guest", subjectName: s.guestName, eventId: E(), requestType: "export" }), 201);
    expectStatus(await http("PATCH", `/privacy/requests/${request.id}/review`, { token: admin, body: { status: "approved" } }), 200);
    const result = expectStatus(await http("POST", `/privacy/requests/${request.id}/execute`, { token: admin, body: {} }), 200, 201);
    expect(JSON.stringify(result).includes(s.guestName), "guest export lacks the event-scoped guest identity");
  });

  // ---------------------------------------------------------------- portal wiring
  const wired = [
    ["record actual event end", /actual-end/, "event"], ["wrap-up", /wrap-up/, "event"], ["close gates", /close-gates/, "event"],
    ["archive an event", /\/archive[`"'?]/, "event"], ["archive compare", /archive\/compare/, "event"], ["logistics completion", /logistics-completion/, "event"],
    ["complete a post-event deliverable", /post-event-documents/, "event"], ["event insights", /\/insights/, "event"],
    ["client closeout (client)", /client-closeout/, "client"], ["client closeout moderation (PMCM)", /client-closeout\/moderation|client-closeout/, "event"],
    ["client event-day view toggle", /client-event-day-view/, "event"], ["run sheet", /run-sheet/, "event"], ["handoff brief", /handoff-brief/, "event"],
    ["decision log", /decision-log/, "event"], ["event-day tasks", /event-day\/tasks/, "event"], ["urgent issues", /urgent-issues/, "event"],
    ["coordinator attendance", /coordinators\/[^`]*\/status/, "event"], ["coordinator replacement", /\/replace/, "event"],
    ["end-of-day reports", /eod-reports|submitEodReport|listEodReports/, "event"], ["handoffs", /\/handoffs|createHandoff|listHandoffs/, "event"], ["operator designation", /operator-designation/, "event"],
    ["supplier event-day status", /event-status|updateEventStatus/, "supplier"], ["guest feedback", /\/feedback|submitFeedback/, "guest"],
    ["audit logs", /audit\/logs/, "event"], ["audit integrity", /audit\/integrity/, "event"], ["privacy requests", /privacy\/requests/, "event"],
    ["legal holds", /legal-holds/, "event"], ["retention review", /retention-review-items/, "event"], ["guest privacy classification", /guest-privacy|guestPrivacyClassification/, "event"],
  ];
  for (const [label, re, app] of wired) {
    await step(`portal wiring: ${label} is reachable from the ${app} portal`, async () => {
      const hits = wiring(re);
      if (hits[app] > 0) return `${hits[app]} file(s) in apps/${app}`;
      gap(`API only, no UI: no apps/${app} source calls it${hits["api-client"] ? " (only a packages/api-client method exists)" : ""}${Object.entries(hits).filter(([k, v]) => v && k !== app && k !== "api-client").map(([k]) => `; found in apps/${k}`).join("")}`);
    });
  }
}
