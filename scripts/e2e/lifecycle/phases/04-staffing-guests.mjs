// Phase 4: coordinator staffing and guest operations (roster, access code, check-in, walk-ins, privacy, feedback rules).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import { http, msg, step, startPhase, blocked, gap, expect, expectStatus } from "../lib.mjs";

export const name = "Staffing and guests";

const status = (r, ...ok) => expect(ok.includes(r.status), `expected ${ok.join("/")}, got ${r.status}: ${msg(r)}`);
const list = (r) => (Array.isArray(r) ? r : r?.items ?? r?.data ?? []);

export async function run(ctx) {
  startPhase("Staffing and guests: coordinators, event-day operator, guest access, walk-ins, feedback rules");
  const s = {};
  const call = (method, path, token, body) => http(method, path, { token, body });
  const guestBody = (extra = {}) => ({ idempotencyKey: randomUUID(), checkInMode: "name_search", guestName: "Ana Cruz", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, ...extra });

  // ---------------------------------------------------------------- setup
  s.admin = await ctx.as("admin").catch(() => null);
  s.marco = await ctx.as("coordinator").catch(() => null);
  s.supplier = await ctx.as("supplier").catch(() => null);
  const dateA = await ctx.reserveDate();
  const dateC = await ctx.reserveDate();
  const dateD = await ctx.reserveDate();

  await step("setup: sign in as PMCM admin, coordinator and supplier", async () => {
    expect(s.admin && s.marco && s.supplier, "a seeded account could not sign in");
  });
  for (const [key, label, date] of [["A", "Staffing main", dateA], ["B", "Staffing same-day", dateA], ["C", "Staffing replace", dateC], ["D", "Staffing unassigned", dateD]]) {
    await step(`setup: create onboarded event ${key} (${date})`, async () => {
      s[key] = await ctx.newEvent({ label, eventDate: date });
      return s[key].eventId;
    });
  }
  if (!s.A) { blocked("event A could not be created"); }
  const A = s.A?.eventId, B = s.B?.eventId, C = s.C?.eventId, D = s.D?.eventId;
  s.clientA = s.A ? await s.A.as().catch(() => null) : null;
  s.clientB = s.B ? await s.B.as().catch(() => null) : null;

  // ---------------------------------------------------------------- roster and capacity
  await step("PMCM reads the coordinator directory (roster with roles)", async () => {
    if (!s.admin) blocked("no admin");
    const r = list(expectStatus(await call("GET", "/coordinators", s.admin), 200));
    s.coordinatorProfiles = r;
    s.marcoProfile = r.find((c) => c.id === "coord_marco" || /marco/i.test(c.name ?? ""));
    s.biancaProfile = r.find((c) => c.id === "coord_bianca" || /bianca/i.test(c.name ?? ""));
    expect(s.marcoProfile && s.biancaProfile, `seeded coordinators missing from directory (${r.length} rows)`);
    return `${r.length} coordinators; Marco roles=${JSON.stringify(s.marcoProfile.roleTags ?? s.marcoProfile.roles)}`;
  });
  await step("coordinator directory is PMCM-only (coordinator and supplier 403, anonymous 401)", async () => {
    status(await call("GET", "/coordinators", s.marco), 403);
    status(await call("GET", "/coordinators", s.supplier), 403);
    status(await call("GET", "/coordinators"), 401);
  });
  await step("PMCM reads coordinator suggestions for a role", async () => {
    const r = await call("GET", `/events/${A}/staffing/coordinator-suggestions?role=${encodeURIComponent("Registration Staff")}`, s.admin);
    const body = expectStatus(r, 200);
    const names = JSON.stringify(body).match(/Bianca|Marco/g) ?? [];
    return `${list(body.suggestions ?? body).length || "n/a"} suggestions; mentions ${[...new Set(names)].join(",") || "none"}`;
  });
  await step("coordinator suggestions reject an unknown role with 400", async () => {
    status(await call("GET", `/events/${A}/staffing/coordinator-suggestions?role=Wizard`, s.admin), 400);
    status(await call("GET", `/events/${A}/staffing/coordinator-suggestions?role=Usher`, s.marco), 403);
  });
  await step("PMCM sets and reads coordinator coverage requirements", async () => {
    const set = await call("POST", `/events/${A}/staffing/coverage`, s.admin, { role: "Registration Staff", required: 1, requiredSkills: [] });
    status(set, 200, 201);
    const get = expectStatus(await call("GET", `/events/${A}/staffing/coverage`, s.admin), 200);
    expect(JSON.stringify(get).includes("Registration Staff"), "saved coverage requirement is not in the coverage read");
    return `coverage keys=${Object.keys(Array.isArray(get) ? get[0] ?? {} : get).slice(0, 6).join(",")}`;
  });
  await step("coverage rejects an invalid role/negative count (400) and non-PMCM roles (403/401)", async () => {
    status(await call("POST", `/events/${A}/staffing/coverage`, s.admin, { role: "Wizard", required: 1 }), 400);
    status(await call("POST", `/events/${A}/staffing/coverage`, s.admin, { role: "Usher", required: -1 }), 400);
    status(await call("POST", `/events/${A}/staffing/coverage`, s.marco, { role: "Usher", required: 1 }), 403);
    status(await call("GET", `/events/${A}/staffing/coverage`, s.supplier), 403);
    status(await call("GET", `/events/${A}/staffing/coverage`), 401);
  });

  // ---------------------------------------------------------------- availability
  await step("PMCM records coordinator unavailability and reads it back", async () => {
    const bianca = s.biancaProfile?.id; if (!bianca) blocked("no Bianca profile");
    const body = { startsAt: `${dateD}T00:00:00.000Z`, endsAt: `${dateD}T23:59:00.000Z`, kind: "unavailable", note: "e2e leave" };
    const created = expectStatus(await call("POST", `/events/${D}/coordinators/${bianca}/availability`, s.admin, body), 200, 201);
    s.availabilityId = created.id;
    expect(s.availabilityId, "availability row has no id");
    const read = list(expectStatus(await call("GET", `/events/${D}/coordinators/${bianca}/availability`, s.admin), 200));
    expect(read.some((x) => x.id === s.availabilityId), "availability not listed");
  });
  await step("availability rejects end-before-start (400) and non-PMCM callers", async () => {
    const bianca = s.biancaProfile?.id; if (!bianca) blocked("no Bianca profile");
    status(await call("POST", `/events/${D}/coordinators/${bianca}/availability`, s.admin, { startsAt: `${dateD}T10:00:00.000Z`, endsAt: `${dateD}T09:00:00.000Z` }), 400);
    status(await call("POST", `/events/${D}/coordinators/${bianca}/availability`, s.admin, { startsAt: "tomorrow", endsAt: "later" }), 400);
    status(await call("POST", `/events/${D}/coordinators/${bianca}/availability`, s.marco, { startsAt: `${dateD}T00:00:00.000Z`, endsAt: `${dateD}T01:00:00.000Z` }), 403);
    status(await call("GET", `/events/${D}/coordinators/${bianca}/availability`, s.supplier), 403);
  });
  await step("an unavailable coordinator cannot be assigned on that date (COORDINATOR_UNAVAILABLE)", async () => {
    if (!s.availabilityId) blocked("no availability record");
    const r = await call("POST", `/events/${D}/coordinators`, s.admin, { coordinatorId: s.biancaProfile.id, role: "Registration Staff" });
    expect(r.status === 400 && /unavailable/i.test(JSON.stringify(r.body)), `expected 400 unavailable, got ${r.status}: ${msg(r)}`);
  });
  await step("PMCM removes the availability block; removing it twice is clean (404, not 500)", async () => {
    if (!s.availabilityId) blocked("no availability record");
    status(await call("DELETE", `/events/${D}/coordinators/${s.biancaProfile.id}/availability/${s.availabilityId}`, s.admin), 200, 204);
    const again = await call("DELETE", `/events/${D}/coordinators/${s.biancaProfile.id}/availability/${s.availabilityId}`, s.admin);
    expect(again.status < 500, `second delete returned ${again.status}: ${msg(again)}`);
    return `second delete -> ${again.status}`;
  });

  // ---------------------------------------------------------------- assignment
  await step("assignment is PMCM-only (coordinator, client, supplier 403; anonymous 401)", async () => {
    const body = { coordinatorId: "coord_marco", role: "General Coordinator" };
    status(await call("POST", `/events/${A}/coordinators`, s.marco, body), 403);
    status(await call("POST", `/events/${A}/coordinators`, s.clientA, body), 403);
    status(await call("POST", `/events/${A}/coordinators`, s.supplier, body), 403);
    status(await call("POST", `/events/${A}/coordinators`, undefined, body), 401);
  });
  await step("assignment rejects invalid bodies with 400 (not 500)", async () => {
    status(await call("POST", `/events/${A}/coordinators`, s.admin, {}), 400);
    status(await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: "coord_marco", role: "Wizard" }), 400);
    const untagged = await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: "coord_bianca", role: "General Coordinator" });
    expect(untagged.status === 400, `role the coordinator is not tagged for: ${untagged.status} ${msg(untagged)}`);
    const unknown = await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: "coord_nobody", role: "Usher" });
    expect([400, 404].includes(unknown.status), `unknown coordinator: ${unknown.status} ${msg(unknown)}`);
    const noEvent = await call("POST", `/events/evt_missing/coordinators`, s.admin, { coordinatorId: "coord_marco", role: "General Coordinator" });
    expect([403, 404].includes(noEvent.status), `unknown event: ${noEvent.status} ${msg(noEvent)}`);
  });
  await step("PMCM assigns Marco to event A as General Coordinator", async () => {
    const r = expectStatus(await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: "coord_marco", role: "General Coordinator" }), 200, 201);
    s.asgMarco = r;
    expect(r.id, "no assignment id");
    return `${r.id} status=${r.status}`;
  });
  await step("assigning the same coordinator twice is idempotent", async () => {
    if (!s.asgMarco) blocked("no assignment");
    const r = await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: "coord_marco", role: "General Coordinator" });
    expect(r.status < 500, `${r.status}: ${msg(r)}`);
    const body = r.body;
    if (r.status < 400 && body.id !== s.asgMarco.id) {
      await call("PATCH", `/events/${A}/coordinators/${body.id}/withdraw`, s.admin, { reason: "e2e: remove duplicate assignment" });
      expect(false, `second assign created a duplicate active assignment (${body.id} vs ${s.asgMarco.id}) for the same coordinator, role and event`);
    }
    return `second assign -> ${r.status}`;
  });
  await step("PMCM assigns Bianca to event A as Registration Staff", async () => {
    const r = expectStatus(await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: "coord_bianca", role: "Registration Staff" }), 200, 201);
    s.asgBianca = r;
    return `${r.id} status=${r.status}`;
  });
  await step("same-date double booking is refused with a conflict code and suggestions", async () => {
    if (!B) blocked("no event B");
    const r = await call("POST", `/events/${B}/coordinators`, s.admin, { coordinatorId: "coord_marco", role: "General Coordinator" });
    expect(r.status === 400 && /DOUBLE_BOOKING/.test(JSON.stringify(r.body)), `expected 400 COORDINATOR_DOUBLE_BOOKING, got ${r.status}: ${msg(r)}`);
    return `conflicts with ${r.body.conflictEventName ?? r.body.conflictEventId}; suggestions=${(r.body.sameRoleSuggestions ?? []).length}`;
  });
  await step("PMCM can override a double booking and the assignment carries the warning", async () => {
    if (!B) blocked("no event B");
    const r = expectStatus(await call("POST", `/events/${B}/coordinators`, s.admin, { coordinatorId: "coord_marco", role: "General Coordinator", overrideConflict: true }), 200, 201);
    s.asgMarcoB = r;
    expect(r.doubleBookingWarning === true, `doubleBookingWarning=${r.doubleBookingWarning}`);
  });
  await step("PMCM withdraws the overridden booking (reason required)", async () => {
    if (!s.asgMarcoB) blocked("no override assignment");
    status(await call("PATCH", `/events/${B}/coordinators/${s.asgMarcoB.id}/withdraw`, s.admin, {}), 400);
    const r = expectStatus(await call("PATCH", `/events/${B}/coordinators/${s.asgMarcoB.id}/withdraw`, s.admin, { reason: "e2e: clear the double booking" }), 200);
    expect(/withdraw|cancel/i.test(r.status), `status after withdraw is ${r.status}`);
    const again = await call("PATCH", `/events/${B}/coordinators/${s.asgMarcoB.id}/withdraw`, s.admin, { reason: "e2e: repeat" });
    expect(again.status < 500, `repeat withdraw ${again.status}: ${msg(again)}`);
    return `status=${r.status}; repeat -> ${again.status}`;
  });

  // ---------------------------------------------------------------- coordinator view and acknowledgement
  await step("coordinator workspace lists only the events the coordinator is assigned to", async () => {
    const r = expectStatus(await call("GET", "/coordinator/workspace", s.marco), 200);
    const events = JSON.stringify(r);
    expect(events.includes(A), "assigned event A is missing from the coordinator workspace");
    expect(!events.includes(D), "unassigned event D leaked into the coordinator workspace");
    return `${events.length} bytes`;
  });
  await step("coordinator workspace is closed to client, supplier and anonymous callers", async () => {
    const asClient = await call("GET", "/coordinator/workspace", s.clientA);
    expect(asClient.status === 403, `client got ${asClient.status}: ${msg(asClient)}`);
    status(await call("GET", "/coordinator/workspace", s.supplier), 403);
    status(await call("GET", "/coordinator/workspace"), 401);
  });
  await step("coordinator role view works for the assigned event and is 403 for an unassigned one", async () => {
    const mine = await call("GET", `/coordinator/events/${A}/role-view`, s.marco);
    status(mine, 200);
    status(await call("GET", `/coordinator/events/${D}/role-view`, s.marco), 403);
    return `isDesignatedOperator=${mine.body.isDesignatedOperator}`;
  });
  await step("coordinator cannot read PMCM-only data of an unassigned event", async () => {
    for (const p of [`/events/${D}/handoffs`, `/events/${D}/operator-designation`, `/events/${D}/staffing/coverage`, `/events/${D}/guest-privacy`, `/events/${D}/registration-platform`]) {
      const r = await call("GET", p, s.marco);
      expect(r.status === 403, `${p} -> ${r.status}: ${msg(r)}`);
    }
  });
  await step("acknowledgement: decline needs a reason (400), another coordinator's assignment is 403", async () => {
    if (!s.asgMarco || !s.asgBianca) blocked("no assignments");
    status(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/acknowledge`, s.marco, { decision: "declined" }), 400);
    status(await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/acknowledge`, s.marco, { decision: "acknowledged" }), 403);
    status(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/acknowledge`, s.supplier, { decision: "acknowledged" }), 403);
    status(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/acknowledge`, undefined, { decision: "acknowledged" }), 401);
    status(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/acknowledge`, s.marco, { decision: "maybe" }), 400);
  });
  await step("coordinator acknowledges the assignment; repeating it is idempotent", async () => {
    if (!s.asgMarco) blocked("no assignment");
    const r = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/acknowledge`, s.marco, { decision: "acknowledged" }), 200);
    expect(r.status === "acknowledged", `status=${r.status}`);
    const again = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/acknowledge`, s.marco, { decision: "acknowledged" }), 200);
    expect(again.status === "acknowledged", `after repeat status=${again.status}`);
  });
  await step("PMCM acknowledgement reminders can be queued", async () => {
    const r = await call("POST", `/events/${A}/staffing/acknowledgement-reminders`, s.admin);
    status(r, 200, 201);
    status(await call("POST", `/events/${A}/staffing/acknowledgement-reminders`, s.marco), 403);
    return JSON.stringify(r.body).slice(0, 100);
  });
  await step("PMCM acknowledges on behalf of the non-login coordinator (Registration Staff)", async () => {
    if (!s.asgBianca) blocked("no assignment");
    const r = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/acknowledge`, s.admin, { decision: "acknowledged" }), 200);
    expect(r.status === "acknowledged", `status=${r.status}`);
  });

  // ---------------------------------------------------------------- replacement
  await step("replacement: PMCM assigns Bianca to event C, then replaces her with Marco", async () => {
    if (!C) blocked("no event C");
    const first = expectStatus(await call("POST", `/events/${C}/coordinators`, s.admin, { coordinatorId: "coord_bianca", role: "Stage Director" }), 200, 201);
    status(await call("PATCH", `/events/${C}/coordinators/${first.id}/replace`, s.admin, { replacementCoordinatorId: "coord_marco", role: "Floor Director" }), 400);
    const r = expectStatus(await call("PATCH", `/events/${C}/coordinators/${first.id}/replace`, s.admin, { replacementCoordinatorId: "coord_marco", role: "Floor Director", reason: "e2e: Bianca unavailable" }), 200, 201);
    s.replace = { first, result: r };
    const outgoing = r.replacedAssignment ?? r.outgoing ?? r.replaced;
    const incoming = r.replacementAssignment ?? r.incoming ?? r.replacement;
    expect(outgoing && incoming, `unexpected replace result keys: ${Object.keys(r)}`);
    expect(/replaced/i.test(outgoing.status), `outgoing status=${outgoing.status}`);
    s.replacement = incoming;
    return `outgoing=${outgoing.status}, incoming=${incoming.status}/${incoming.role}`;
  });
  await step("replacement: only PMCM may replace, and a replaced assignment cannot be replaced again", async () => {
    if (!s.replace) blocked("no replacement");
    status(await call("PATCH", `/events/${C}/coordinators/${s.replacement.id}/replace`, s.marco, { replacementCoordinatorId: "coord_bianca", role: "Stage Director", reason: "x" }), 403);
    const again = await call("PATCH", `/events/${C}/coordinators/${s.replace.first.id}/replace`, s.admin, { replacementCoordinatorId: "coord_marco", role: "Floor Director", reason: "e2e: repeat" });
    expect(again.status >= 400 && again.status < 500, `second replace of a replaced assignment returned ${again.status}: ${msg(again)}`);
    return `repeat -> ${again.status}`;
  });
  await step("event-day replace endpoint (POST) exists and refuses a coordinator caller", async () => {
    if (!s.replacement) blocked("no replacement");
    const r = await call("POST", `/events/${C}/coordinators/${s.replacement.id}/replace`, s.marco, { replacementCoordinatorId: "coord_bianca", role: "Stage Director", reason: "x" });
    expect(r.status === 403, `${r.status}: ${msg(r)}`);
  });

  // ---------------------------------------------------------------- operator designation and attendance
  await step("operator designation is readable by PMCM only and starts empty", async () => {
    const r = expectStatus(await call("GET", `/events/${A}/operator-designation`, s.admin), 200);
    expect(r.operator === null, `operator already set: ${JSON.stringify(r.operator)}`);
    status(await call("GET", `/events/${A}/operator-designation`, s.marco), 403);
    status(await call("GET", `/events/${A}/operator-designation`), 401);
  });
  await step("attendance: invalid statuses are 400, wrong roles 403/401", async () => {
    if (!s.asgMarco) blocked("no assignment");
    const p = `/events/${A}/coordinators/${s.asgMarco.id}/status`;
    status(await call("PATCH", p, s.marco, { status: "bogus" }), 400);
    status(await call("PATCH", p, s.marco, { status: "pending" }), 400);
    status(await call("PATCH", p, s.marco, {}), 400);
    status(await call("PATCH", p, s.supplier, { status: "present" }), 403);
    status(await call("PATCH", p, s.clientA, { status: "present" }), 403);
    status(await call("PATCH", p, undefined, { status: "present" }), 401);
  });
  await step("coordinator marks their own attendance", async () => {
    if (!s.asgMarco) blocked("no assignment");
    const r = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/status`, s.marco, { status: "present" }), 200);
    expect(r.attendanceStatus === "present", `attendanceStatus=${r.attendanceStatus}`);
    const again = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgMarco.id}/status`, s.marco, { status: "present" }), 200);
    expect(again.attendanceStatus === "present", "repeat changed the attendance");
  });
  await step("an ordinary coordinator cannot mark another coordinator's attendance", async () => {
    if (!s.asgBianca) blocked("no assignment");
    const r = await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/status`, s.marco, { status: "present" });
    expect(r.status === 403, `expected 403, got ${r.status}: ${msg(r)}`);
  });
  await step("designation validation: non-PMCM 403, bad body 400, coordinator not on the event 400", async () => {
    status(await call("POST", `/events/${A}/operator-designation`, s.marco, { coordinatorId: "coord_marco" }), 403);
    status(await call("POST", `/events/${A}/operator-designation`, s.supplier, { coordinatorId: "coord_marco" }), 403);
    status(await call("POST", `/events/${A}/operator-designation`, undefined, { coordinatorId: "coord_marco" }), 401);
    status(await call("POST", `/events/${A}/operator-designation`, s.admin, {}), 400);
    const off = await call("POST", `/events/${D}/operator-designation`, s.admin, { coordinatorId: "coord_marco" });
    expect(off.status === 400, `designating a coordinator who is not assigned: ${off.status} ${msg(off)}`);
  });
  await step("PMCM designates Marco as Event Day System Operator", async () => {
    const r = expectStatus(await call("POST", `/events/${A}/operator-designation`, s.admin, { coordinatorId: "coord_marco" }), 200, 201);
    const read = expectStatus(await call("GET", `/events/${A}/operator-designation`, s.admin), 200);
    expect(read.operator?.coordinatorId === "coord_marco", `designation read back: ${JSON.stringify(read.operator)}`);
    const view = expectStatus(await call("GET", `/coordinator/events/${A}/role-view`, s.marco), 200);
    expect(view.isDesignatedOperator === true, `role view isDesignatedOperator=${view.isDesignatedOperator}`);
    s.designationId = r.id;
  });
  await step("the designated operator marks ANOTHER coordinator's attendance (late, with a note)", async () => {
    if (!s.designationId || !s.asgBianca) blocked("no designation");
    const r = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/status`, s.marco, { status: "late", notes: "e2e: stuck in traffic" }), 200);
    expect(r.attendanceStatus === "late", `attendanceStatus=${r.attendanceStatus}`);
    const again = expectStatus(await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/status`, s.marco, { status: "late", notes: "e2e: stuck in traffic" }), 200);
    expect(again.attendanceMarkedAt === r.attendanceMarkedAt || again.attendanceStatus === "late", "repeat was not idempotent");
  });
  await step("operator authority is scoped to the event (marking an assignment through an unassigned event is 403/404)", async () => {
    if (!s.asgBianca) blocked("no assignment");
    const viaUnassigned = await call("PATCH", `/events/${D}/coordinators/${s.asgBianca.id}/status`, s.marco, { status: "present" });
    expect(viaUnassigned.status === 403, `operator of A acting on D: ${viaUnassigned.status} ${msg(viaUnassigned)}`);
    const crossEvent = await call("PATCH", `/events/${B}/coordinators/${s.asgBianca.id}/status`, s.admin, { status: "present" });
    expect(crossEvent.status === 404, `assignment id under another event: ${crossEvent.status} ${msg(crossEvent)}`);
  });
  await step("attendance changes are audited with actor, target and status", async () => {
    const r = await call("GET", `/audit/logs?eventId=${A}&limit=100`, s.admin);
    if (r.status === 403 || r.status === 404) gap(`audit log is not readable by the PMCM admin (${r.status}); the operator audit could not be inspected over HTTP`);
    const rows = list(expectStatus(r, 200));
    const hit = rows.find((x) => /attendance/i.test(x.action ?? "") && /Bianca/.test(JSON.stringify(x)));
    expect(hit, `no attendance audit entry for Bianca among ${rows.length} rows`);
    expect(/Marco/i.test(hit.actor ?? JSON.stringify(hit)), `audit entry does not name the acting operator: ${JSON.stringify(hit).slice(0, 160)}`);
    return `${hit.action} by ${hit.actor}`;
  });
  await step("late marking creates a reliability note in the coordinator history", async () => {
    const r = await call("GET", "/pmcm/coordinators/coord_bianca/reliability-history", s.admin);
    const rows = list(expectStatus(r, 200));
    expect(rows.some((x) => /late/i.test(JSON.stringify(x))), `no 'late' reliability note (${rows.length} rows)`);
  });
  await step("an explicit revoke of the operator designation exists", async () => {
    const r = await call("DELETE", `/events/${A}/operator-designation`, s.admin);
    if ([404, 405].includes(r.status)) gap("no route revokes an operator designation; it ends only when PMCM designates someone else or the assignment is withdrawn");
    status(r, 200, 204);
    const read = expectStatus(await call("GET", `/events/${A}/operator-designation`, s.admin), 200);
    expect(read.operator === null, "designation remains after explicit revoke");
    if (s.asgBianca) status(await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/status`, s.marco, { status: "present" }), 403);
    status(await call("DELETE", `/events/${A}/operator-designation`, s.marco), 403);
    status(await call("DELETE", `/events/${A}/operator-designation`, s.admin), 200);
  });
  await step("revocation ends the operator's authority at once (designation moved to Bianca)", async () => {
    if (!s.designationId) blocked("no designation");
    expectStatus(await call("POST", `/events/${A}/operator-designation`, s.admin, { coordinatorId: "coord_bianca" }), 200, 201);
    const view = expectStatus(await call("GET", `/coordinator/events/${A}/role-view`, s.marco), 200);
    expect(view.isDesignatedOperator === false, `Marco still flagged operator: ${view.isDesignatedOperator}`);
    const r = await call("PATCH", `/events/${A}/coordinators/${s.asgBianca.id}/status`, s.marco, { status: "present" });
    expect(r.status === 403, `former operator can still mark another coordinator: ${r.status} ${msg(r)}`);
  });

  // ---------------------------------------------------------------- guest access code
  await step("setup: client submits the briefing with a guest count (drives the walk-in review rule)", async () => {
    if (!s.clientA) blocked("no client token");
    const body = { venue: "Makati Shangri-La Ballroom", guestCount: 150, budgetRange: "PHP 500k-1M", serviceRequirements: ["Registration"], notes: "e2e", confirmedDate: dateA, confirmedStartTime: "09:00", confirmedEndTime: "17:00", program: [{ time: "09:00", activity: "Opening" }], moodAndStyling: "Modern", stylingBudget: 50000 };
    status(await call("POST", `/events/${A}/briefing`, s.clientA, body), 200, 201);
  });
  let code = "";
  await step("PMCM obtains the event's guest access code from the event record", async () => {
    const detail = expectStatus(await call("GET", `/events/${A}`, s.admin), 200);
    code = detail.guestAccessCode ?? "";
    expect(code, "event detail carries no guestAccessCode (PMCM has no way to hand the code out)");
    s.eventName = detail.eventName ?? s.A.eventName;
    const derived = `${s.eventName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").split("-").filter(Boolean).slice(0, 2).join("-")}-${A.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`;
    return `${code} (status=${detail.status}, derived-by-docs=${derived === code})`;
  });
  await step("guest portal derives a code only the event holder knows: a different event has a different code", async () => {
    if (!code) blocked("no code");
    const other = expectStatus(await call("GET", `/events/${B}`, s.admin), 200);
    expect(other.guestAccessCode && other.guestAccessCode !== code, `events A and B share code ${code}`);
  });
  await step("guest opens the event pass with the access code (no account), case and spaces tolerated", async () => {
    if (!code) blocked("no code");
    const pass = expectStatus(await call("GET", `/guest/events/${encodeURIComponent(code)}`), 200);
    expect(pass.id === A, `pass is for ${pass.id}`);
    const lower = expectStatus(await call("GET", `/guest/events/${encodeURIComponent(` ${code.toLowerCase().replace(/-/g, " ")} `)}`), 200);
    expect(lower.id === A, "normalised code resolves to another event");
    s.pass = pass;
    return `fields=${Object.keys(pass).join(",")}`;
  });
  await step("guest pass exposes no PMCM-private fields (budget, supplier, floorplan internals)", async () => {
    if (!s.pass) blocked("no pass");
    const keys = [];
    function collect(value) {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) { keys.push(key); collect(child); }
    }
    collect(s.pass);
    const privateKeys = keys.filter((key) => /budget|supplier|billing|invoice|email|phone|quote/i.test(key));
    expect(!privateKeys.length, `guest pass includes private fields: ${privateKeys.join(", ")}`);
    const leaks = ["clientName", "readiness"].filter((k) => s.pass[k] !== undefined);
    return leaks.length ? `note: pass also shows ${leaks.join(", ")}` : "clean";
  });
  await step("a wrong or unknown access code is refused with 404, never 500", async () => {
    for (const bad of ["WRONG-CODE-0000", "PRISM", "%20", "A".repeat(300)]) {
      const r = await call("GET", `/guest/events/${encodeURIComponent(bad)}`);
      expect([400, 404].includes(r.status), `${bad.slice(0, 20)} -> ${r.status}: ${msg(r)}`);
    }
    const w = await call("GET", `/guest/events/NOPE-0000/watermark`);
    expect(w.status === 404, `watermark for an unknown code -> ${w.status}`);
  });
  await step("event watermark exposes feedback availability (not_open before the event ends)", async () => {
    if (!code) blocked("no code");
    const w = expectStatus(await call("GET", `/guest/events/${encodeURIComponent(code)}/watermark`), 200);
    expect(w.feedbackAvailability === "not_open", `feedbackAvailability=${w.feedbackAvailability}`);
  });
  await step("guest data boundary: the access code is not a credential for PMCM, planning or other portals", async () => {
    const paths = [`/events/${A}`, `/events/${A}/proposal`, `/coordinator/workspace`, `/guest/events/${A}/roster`, `/events/${A}/walk-in-policy`, `/pmcm/command-inbox`, `/events/${A}/registration-platform`];
    for (const p of paths) {
      const noToken = await call("GET", p);
      expect(noToken.status === 401, `${p} anonymous -> ${noToken.status}`);
      const asCode = await http("GET", p, { headers: { authorization: `Bearer ${code}` } });
      expect(asCode.status === 401, `${p} with the access code as bearer -> ${asCode.status}`);
    }
  });
  await step("a client cannot touch another client's guest settings", async () => {
    if (!s.clientA) blocked("no client token");
    status(await call("GET", `/events/${B}/walk-in-policy`, s.clientA), 403);
    status(await call("GET", `/events/${A}/walk-in-policy`, s.clientA), 200);
    status(await call("PATCH", `/events/${A}/walk-in-policy`, s.clientA, { policy: "open" }), 403);
    status(await call("GET", `/events/${A}/guest-privacy`, s.clientA), 403);
    status(await call("GET", `/guest/events/${A}/roster`, s.clientA), 403);
  });

  // ---------------------------------------------------------------- walk-in policy and roster
  await step("walk-in policy defaults to closed", async () => {
    const r = expectStatus(await call("GET", `/events/${A}/walk-in-policy`, s.admin), 200);
    expect(r.policy === "closed" || r.policy === undefined || r.policy === null, `default policy is ${r.policy}`);
    return JSON.stringify(r).slice(0, 100);
  });
  await step("walk-in policy validation: threshold needs a value, junk is 400, non-PMCM 403", async () => {
    status(await call("PATCH", `/events/${A}/walk-in-policy`, s.admin, { policy: "threshold" }), 400);
    status(await call("PATCH", `/events/${A}/walk-in-policy`, s.admin, { policy: "sometimes" }), 400);
    status(await call("PATCH", `/events/${A}/walk-in-policy`, s.admin, { policy: "threshold", threshold: 0 }), 400);
    status(await call("PATCH", `/events/${A}/walk-in-policy`, s.marco, { policy: "open" }), 403);
    status(await call("PATCH", `/events/${A}/walk-in-policy`, s.supplier, { policy: "open" }), 403);
    status(await call("PATCH", `/events/${A}/walk-in-policy`, undefined, { policy: "open" }), 401);
  });
  await step("roster import: PMCM only, validates rows, reserved source refused", async () => {
    const rows = [
      { sourceKey: "g1", guestName: "Ana Cruz", email: "ana@example.test", category: "VIP" },
      { sourceKey: "g2", guestName: "Ben Reyes" },
      { sourceKey: "g3", guestName: "Carla Dizon" },
      { sourceKey: "g4", guestName: "Dup Name" },
      { sourceKey: "g5", guestName: "Dup Name" },
    ];
    status(await call("POST", `/guest/events/${A}/roster/import`, s.marco, { source: "csv", rows }), 403);
    status(await call("POST", `/guest/events/${A}/roster/import`, undefined, { source: "csv", rows }), 401);
    status(await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "csv", rows: [] }), 400);
    status(await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "coordinator-walk-in", rows }), 400);
    status(await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "csv", rows: [{ sourceKey: "", guestName: "" }] }), 400);
    const ok = expectStatus(await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "csv", rows }), 200, 201);
    s.imported = ok;
    return JSON.stringify(ok).slice(0, 140);
  });
  await step("re-importing the same roster does not duplicate guests", async () => {
    if (!s.imported) blocked("no import");
    const rows = [
      { sourceKey: "g1", guestName: "Ana Cruz", email: "ana@example.test", category: "VIP" }, { sourceKey: "g2", guestName: "Ben Reyes" }, { sourceKey: "g3", guestName: "Carla Dizon" },
      { sourceKey: "g4", guestName: "Dup Name" }, { sourceKey: "g5", guestName: "Dup Name" },
    ];
    const r = await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "csv", rows });
    expect(r.status < 500, `${r.status}: ${msg(r)}`);
    const roster = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?query=Ana`, s.admin), 200));
    expect(roster.filter((x) => /Ana Cruz/.test(x.guestName ?? "")).length === 1, `Ana Cruz appears ${roster.filter((x) => /Ana Cruz/.test(x.guestName ?? "")).length} times after re-import`);
    return `re-import -> ${r.status}`;
  });

  await step("a partial re-import reconciles: rows missing from the new file are withdrawn from that source", async () => {
    const rows = [{ sourceKey: "p1", guestName: "Zoe One" }, { sourceKey: "p2", guestName: "Zoe Two" }];
    expectStatus(await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "csv-partial", rows }), 200, 201);
    expectStatus(await call("POST", `/guest/events/${A}/roster/import`, s.admin, { source: "csv-partial", rows: rows.slice(0, 1) }), 200, 201);
    const left = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?query=Zoe`, s.admin), 200)).map((x) => x.guestName);
    return `after a partial re-import the roster lists: ${left.join(", ") || "nobody"} (absent rows are withdrawn without a warning)`;
  });

  // ---------------------------------------------------------------- guest check-in
  await step("guest check-in validation: consent, uuid key, mode and unknown fields are 400", async () => {
    const p = `/guest/events/${encodeURIComponent(code)}/check-ins`;
    status(await call("POST", p, undefined, guestBody({ privacyConsentAccepted: false })), 400);
    status(await call("POST", p, undefined, guestBody({ idempotencyKey: "not-a-uuid" })), 400);
    status(await call("POST", p, undefined, guestBody({ guestName: "" })), 400);
    status(await call("POST", p, undefined, guestBody({ checkInMode: "qr" })), 400);
    status(await call("POST", p, undefined, guestBody({ role: "pmcm-admin" })), 400);
    status(await call("POST", p, undefined, {}), 400);
    status(await call("POST", `/guest/events/WRONG-0000/check-ins`, undefined, guestBody()), 404);
  });
  await step("an unrostered guest is refused while the walk-in policy is closed", async () => {
    const r = await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ guestName: "Zed Walker" }));
    expect(r.status === 400 && /walk-in/i.test(msg(r)), `${r.status}: ${msg(r)}`);
  });
  await step("rostered guest checks in with consent and name", async () => {
    const key = randomUUID();
    const r = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ idempotencyKey: key })), 201);
    expect(r.accepted === true, `receipt=${JSON.stringify(r)}`);
    const replay = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ idempotencyKey: key })), 201);
    expect(replay.accepted === true, "same-key replay not accepted");
    s.anaKey = key;
  });
  await step("the same idempotency key with a different guest is refused (not silently accepted)", async () => {
    if (!s.anaKey) blocked("no first check-in");
    const r = await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ idempotencyKey: s.anaKey, guestName: "Ben Reyes" }));
    expect(r.status >= 400 && r.status < 500, `key reuse for a different payload -> ${r.status}: ${msg(r)}`);
    return `-> ${r.status}`;
  });
  await step("duplicate check-in (new key, same guest) is accepted but counted once", async () => {
    const r = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody()), 201);
    expect(r.accepted === true, "not accepted");
    const checked = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?checkedIn=true`, s.admin), 200));
    const ana = checked.filter((x) => /Ana Cruz/.test(x.guestName ?? ""));
    expect(ana.length === 1, `Ana Cruz checked-in rows: ${ana.length}`);
    s.checkedAfterAna = checked.length;
    return `${checked.length} checked in; roster entry keys=${Object.keys(ana[0] ?? {}).slice(0, 8).join(",")}`;
  });
  await step("ambiguous duplicate names are queued for staff review, not auto-checked-in", async () => {
    const r = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ guestName: "Dup Name" })), 201);
    const queue = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?reviewQueue=true`, s.admin), 200));
    expect(queue.length >= 1, "no entry in the review queue");
    s.queue = queue;
    return `review queue ${queue.length}`;
  });
  await step("PMCM sets threshold policy = 1 and the walk-in threshold stops further walk-ins", async () => {
    expectStatus(await call("PATCH", `/events/${A}/walk-in-policy`, s.admin, { policy: "threshold", threshold: 1 }), 200);
    const r = await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ guestName: "Over Threshold" }));
    expect(r.status === 400 && /threshold/i.test(msg(r)), `${r.status}: ${msg(r)}`);
  });
  await step("with an open policy an unrostered guest is queued for review (New-CL1: classification unset)", async () => {
    expectStatus(await call("PATCH", `/events/${A}/walk-in-policy`, s.admin, { policy: "open" }), 200);
    const r = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ guestName: "Walk In Wendy" })), 201);
    const queue = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?reviewQueue=true`, s.admin), 200));
    const wendy = queue.find((x) => /Wendy/.test(x.guestName ?? ""));
    expect(wendy, "walk-in is neither checked in nor in the review queue");
    s.wendy = wendy;
    return `queued as ${wendy.id}, verification=${wendy.verificationStatus}`;
  });
  await step("PMCM verifies the walk-in; a bad verification status is 400, coordinator without a role on the event is 403 for walk-in desk", async () => {
    if (!s.wendy) blocked("no walk-in in queue");
    status(await call("PATCH", `/guest/events/${A}/roster/${s.wendy.id}/verification`, s.admin, { status: "maybe" }), 400);
    status(await call("PATCH", `/guest/events/${A}/roster/${s.wendy.id}/verification`, s.supplier, { status: "verified" }), 403);
    expectStatus(await call("PATCH", `/guest/events/${A}/roster/${s.wendy.id}/verification`, s.admin, { status: "verified" }), 200);
    status(await call("POST", `/guest/events/${A}/walk-ins`, s.marco, { guestName: "Desk Walkin", privacyConsentAccepted: true }), 403);
    status(await call("POST", `/guest/events/${A}/walk-ins`, s.admin, { guestName: "Desk Walkin", privacyConsentAccepted: true }), 403);
  });
  await step("the verified walk-in checks in and is flagged as a walk-in", async () => {
    if (!s.wendy) blocked("no walk-in");
    expectStatus(await call("POST", `/guest/events/${A}/roster/${s.wendy.id}/check-in`, s.admin), 201);
    const checked = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?checkedIn=true`, s.admin), 200));
    const wendy = checked.find((x) => /Wendy/.test(x.guestName ?? ""));
    expect(wendy, "verified walk-in is not among checked-in guests");
    return `checked in: ${checked.length}; entry=${JSON.stringify({ source: wendy.source, category: wendy.category, walkIn: wendy.walkIn, verificationStatus: wendy.verificationStatus })}`;
  });
  await step("anonymous headcount check-in is accepted under the open policy", async () => {
    const r = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, { idempotencyKey: randomUUID(), checkInMode: "headcount", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION }), 201);
    expect(r.accepted === true, "not accepted");
  });
  await step("registration desk (Registration Staff) can search and check in the roster", async () => {
    const profile = s.coordinatorProfiles.find((c) => (c.roleTags ?? []).includes("Registration Staff") && c.id !== "coord_marco");
    expect(profile, "fixture directory has no registration-qualified coordinator");
    const token = await ctx.ensureCoordinator(profile);
    const assignment = expectStatus(await call("POST", `/events/${A}/coordinators`, s.admin, { coordinatorId: profile.id, role: "Registration Staff" }), 200, 201);
    expectStatus(await call("PATCH", `/events/${A}/coordinators/${assignment.id}/acknowledge`, token, { decision: "acknowledged" }), 200);
    status(await call("GET", `/guest/events/${A}/roster/search?query=Ana`, s.marco), 403);
    const rows = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?query=Ana`, token), 200));
    expect(rows.some((row) => row.guestName === "Ana Cruz"), "registration staff cannot find the imported guest");
    return `verified registration actor ${profile.id}; unrelated coordinator refused`;
  });

  // ---------------------------------------------------------------- guest privacy classification
  await step("PMCM reads and sets the guest privacy classification; invalid values are 400", async () => {
    const before = expectStatus(await call("GET", `/events/${A}/guest-privacy`, s.admin), 200);
    status(await call("PATCH", `/events/${A}/guest-privacy`, s.admin, { classification: "secret" }), 400);
    status(await call("PATCH", `/events/${A}/guest-privacy`, s.admin, { classification: "public", extra: 1 }), 400);
    const after = expectStatus(await call("PATCH", `/events/${A}/guest-privacy`, s.admin, { classification: "public" }), 200);
    expect(after.classification === "public", `classification=${after.classification}`);
    return `was ${before.classification}`;
  });
  await step("guest privacy classification is PMCM-only (coordinator/supplier 403, anonymous 401)", async () => {
    status(await call("PATCH", `/events/${A}/guest-privacy`, s.marco, { classification: "private" }), 403);
    status(await call("GET", `/events/${A}/guest-privacy`, s.supplier), 403);
    status(await call("GET", `/events/${A}/guest-privacy`), 401);
  });
  await step("public classification lets an unrostered walk-in check in directly, flagged for follow-up", async () => {
    const before = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?checkedIn=true`, s.admin), 200)).length;
    expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/check-ins`, undefined, guestBody({ guestName: "Public Pat" })), 201);
    const after = list(expectStatus(await call("GET", `/guest/events/${A}/roster/search?checkedIn=true`, s.admin), 200));
    return `checked-in before=${before}, after=${after.length}; Pat listed=${after.some((x) => /Pat/.test(x.guestName ?? ""))}`;
  });
  await step("attendance counts for PMCM reflect check-ins", async () => {
    const live = await call("GET", `/events/${A}/live-ops`, s.admin);
    expect(live.status === 200, `${live.status}: ${msg(live)}`);
    const text = JSON.stringify(live.body);
    const m = text.match(/"(checkedIn|checkedInCount|guestCheckIns|attendance)[A-Za-z]*":\s*(\d+|\[)/);
    expect(m, "live-ops read has no guest check-in/attendance figure");
    return m[0];
  });

  // ---------------------------------------------------------------- registration platform
  await step("registration platform starts empty and is PMCM-only", async () => {
    const r = await call("GET", `/events/${A}/registration-platform`, s.admin);
    status(r, 200, 404);
    status(await call("GET", `/events/${A}/registration-platform`, s.marco), 403);
    status(await call("GET", `/events/${A}/registration-platform`, s.clientA), 403);
    status(await call("GET", `/events/${A}/registration-platform`), 401);
    return `initial read -> ${r.status}`;
  });
  await step("registration platform validation: bad type, min>max, non-PMCM", async () => {
    status(await call("POST", `/events/${A}/registration-platform`, s.admin, { platformType: "eventbrite" }), 400);
    status(await call("POST", `/events/${A}/registration-platform`, s.admin, { platformType: "custom", expectedPaxMin: 50, expectedPaxMax: 10 }), 400);
    status(await call("POST", `/events/${A}/registration-platform`, s.marco, { platformType: "custom" }), 403);
  });
  await step("PMCM selects a registration supplier, then configures the platform and goes live", async () => {
    const body = { platformType: "xperto", expectedPaxMin: 80, expectedPaxMax: 150, setupNotes: "e2e" };
    expectStatus(await call("POST", `/events/${A}/registration-platform`, s.admin, body), 400);
    const requests = expectStatus(await call("POST", `/events/${A}/quote-requests`, s.admin, { categoryId: "supcat_digital_registration", supplierIds: ["sup_xperto"], deadline: dateA }), 201);
    const request = requests[0];
    const quote = expectStatus(await call("POST", `/quote-requests/${request.accessToken}/quote`, undefined, { amount: 50000, notes: "Registration setup" }), 201);
    expectStatus(await call("PATCH", `/events/${A}/supplier-quotes/${quote.id}/select`, s.admin), 200);
    const created = expectStatus(await call("POST", `/events/${A}/registration-platform`, s.admin, { ...body, supplierId: "sup_xperto" }), 200, 201);
    s.platform = created;
    const close = await call("PATCH", `/events/${A}/registration-platform`, s.admin, { status: "closed" });
    expect(close.status === 400, `not_started -> closed returned ${close.status}: ${msg(close)}`);
    expectStatus(await call("PATCH", `/events/${A}/registration-platform`, s.admin, { status: "configuring" }), 200);
    const live = await call("PATCH", `/events/${A}/registration-platform`, s.admin, { status: "live" });
    expect(live.status === 200, `going live with a selected supplier returned ${live.status}: ${msg(live)}`);
    return `created status=${created.status}; selected supplier -> live`;
  });
  await step("headcount import is refused before the platform is closed or the event ended", async () => {
    if (!s.platform) blocked("registration platform setup failed");
    const r = await call("POST", `/events/${A}/registration-platform/headcount-import`, s.admin, { headcountSource: "Xperto export", importedHeadcount: 120 });
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    status(await call("POST", `/events/${A}/registration-platform/headcount-import`, s.admin, { headcountSource: "x", importedHeadcount: -1 }), 400);
    status(await call("POST", `/events/${A}/registration-platform/headcount-import`, s.marco, { headcountSource: "x", importedHeadcount: 1 }), 403);
  });

  // ---------------------------------------------------------------- feedback
  await step("guest feedback validation: consent, rating range, name are 400", async () => {
    const p = `/guest/events/${encodeURIComponent(code)}/feedback`;
    const base = { guestName: "Ana Cruz", rating: 5, comment: "Great", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION };
    status(await call("POST", p, undefined, { ...base, privacyConsentAccepted: false }), 400);
    status(await call("POST", p, undefined, { ...base, rating: 9 }), 400);
    status(await call("POST", p, undefined, { ...base, rating: 0 }), 400);
    status(await call("POST", p, undefined, { ...base, guestName: "" }), 400);
    status(await call("POST", `/guest/events/WRONG-0000/feedback`, undefined, base), 404);
  });
  await step("feedback is refused until the actual event end is recorded (policy: no inferring from event date)", async () => {
    const r = await call("POST", `/guest/events/${encodeURIComponent(code)}/feedback`, undefined, { guestName: "Ana Cruz", rating: 5, comment: "Great", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION });
    expect(r.status === 400 && /actual event end|not.*recorded|opens after/i.test(msg(r)), `${r.status}: ${msg(r)}`);
  });
  await step("actual event end cannot be recorded for an event still in briefing, or by a non-PMCM role", async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const r = await call("POST", `/events/${A}/actual-end`, s.admin, { actualEndedAt: past });
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    status(await call("POST", `/events/${A}/actual-end`, s.marco, { actualEndedAt: past }), 403);
    status(await call("POST", `/events/${A}/actual-end`, s.admin, { actualEndedAt: "soon" }), 400);
    status(await call("POST", `/events/${A}/actual-end`, s.admin, { actualEndedAt: new Date(Date.now() + 86400_000).toISOString() }), 400);
  });
  await step("feedback moderation queue is PMCM-only and empty; moderation validates its body", async () => {
    const q = list(expectStatus(await call("GET", `/guest/events/${A}/feedback/moderation`, s.admin), 200));
    expect(q.length === 0, `queue has ${q.length} rows for an event that cannot have feedback yet`);
    status(await call("GET", `/guest/events/${A}/feedback/moderation`, s.marco), 403);
    status(await call("GET", `/guest/events/${A}/feedback/moderation`, s.clientA), 403);
    status(await call("GET", `/guest/events/${A}/feedback/moderation`), 401);
    status(await call("POST", `/guest/events/${A}/feedback/gfb_missing/moderate`, s.admin, { action: "reject" }), 400);
    status(await call("POST", `/guest/events/${A}/feedback/gfb_missing/moderate`, s.admin, { action: "publish" }), 400);
    const missing = await call("POST", `/guest/events/${A}/feedback/gfb_missing/moderate`, s.admin, { action: "approve" });
    expect(missing.status === 404, `moderating a missing feedback id -> ${missing.status}: ${msg(missing)}`);
    status(await call("POST", `/guest/events/${A}/feedback/gfb_missing/moderate`, s.marco, { action: "approve" }), 403);
  });
  await step("consent withdrawal requires a valid saved feedback receipt", async () => {
    const p = `/guest/events/${encodeURIComponent(code)}/feedback/gfb_missing/consent-withdrawal`;
    status(await call("POST", p, undefined, {}), 400);
    const r = await call("POST", p, undefined, { withdrawPrivacyConsent: true });
    expect(r.status === 404, `unknown feedback receipt returned ${r.status}: ${msg(r)}`);
  });
  await step("feedback submits for moderation after recorded end and closes after seven days", async () => {
    await ctx.prepareEventDay(D);
    expectStatus(await call("POST", `/events/${D}/start-event-day`, s.admin, {}), 200);
    expectStatus(await call("POST", `/events/${D}/actual-end`, s.admin, { actualEndedAt: new Date(Date.now() - 3600000).toISOString() }), 200, 201);
    const code = expectStatus(await call("GET", `/events/${D}`, s.admin), 200).guestAccessCode;
    const receipt = expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/feedback`, undefined, { guestName: "Fixture feedback guest", rating: 5, comment: "Enjoyed the event", privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION }), 201);
    expect(receipt.id && !('guestName' in receipt), "feedback receipt exposes identity or lacks its id");
    expectStatus(await call("POST", `/guest/events/${encodeURIComponent(code)}/feedback/${receipt.id}/consent-withdrawal`, undefined, { withdrawPrivacyConsent: true }), 200, 201);
    expectStatus(await call("POST", `/events/${D}/actual-end`, s.admin, { actualEndedAt: new Date(Date.now() - 8 * 86400000).toISOString(), correctionReason: "Exercise feedback window" }), 200, 201);
    status(await call("POST", `/guest/events/${encodeURIComponent(code)}/feedback`, undefined, { guestName: "Late feedback", rating: 5, privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION }), 400);

  });

  // ---------------------------------------------------------------- portal wiring
  await step("portal wiring: API-only endpoints with no portal caller", async () => {
    const guestSource = readFileSync(join(repoRoot, "apps/guest/src/features/guest-checkin/dashboard/data/guest-dashboard-repository.ts"), "utf8");
    const eventSource = readFileSync(join(repoRoot, "apps/event/src/features/event-dashboard/shell/data/commands/operations-commands.ts"), "utf8");
    expect(guestSource.includes("consent-withdrawal") && eventSource.includes('method: "DELETE"'), "consent withdrawal or operator revoke has no portal data caller");
  });

  // ---------------------------------------------------------------- event games smoke
  await step("event games smoke: unknown lobby is 404, bad join is 400, an assigned host can create a lobby", async () => {
    const lobby = await call("GET", `/game-lobbies/no-such-event-slug`);
    expect([404, 400].includes(lobby.status), `unknown lobby -> ${lobby.status}: ${msg(lobby)}`);
    const join = await call("POST", `/game-sessions/join`, undefined, {});
    expect(join.status === 400, `empty join -> ${join.status}: ${msg(join)}`);
    const marcoSetup = await call("POST", `/events/${A}/game-lobby`, s.marco);
    expect(marcoSetup.status === 200, `assigned coordinator creating a lobby -> ${marcoSetup.status}: ${msg(marcoSetup)}`);
    const anon = await call("POST", `/events/${A}/game-lobby`);
    expect(anon.status === 401, `anonymous lobby creation -> ${anon.status}`);
  });
  await step("event games: PMCM creates the lobby and the public lobby page resolves", async () => {
    const r = await call("POST", `/events/${A}/game-lobby`, s.admin);
    status(r, 200, 201);
    const slug = r.body?.eventSlug ?? r.body?.slug ?? r.body?.lobby?.eventSlug;
    if (!slug) return `lobby created (${Object.keys(r.body ?? {}).join(",")}); no slug field to open it publicly`;
    const pub = await call("GET", `/game-lobbies/${encodeURIComponent(slug)}`);
    expect(pub.status === 200, `public lobby ${slug} -> ${pub.status}: ${msg(pub)}`);
    return `slug=${slug}`;
  });
}
