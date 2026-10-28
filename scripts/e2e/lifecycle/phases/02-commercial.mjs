// Phase 2: commercial = proposal, billing and payments, driven as PMCM admin (two admins), client, supplier and coordinator.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { http, msg, step, startPhase, blocked, gap, review, expect, expectStatus } from "../lib.mjs";

export const name = "Commercial";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { if (entry !== "node_modules" && entry !== ".next") sourceFiles(path, out); }
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(path);
  }
  return out;
}
const portalFiles = { event: sourceFiles(join(repoRoot, "apps", "event", "src")), client: sourceFiles(join(repoRoot, "apps", "client", "src")) };
const callers = (app, pattern) => portalFiles[app].filter((file) => pattern.test(readFileSync(file, "utf8"))).map((file) => file.slice(repoRoot.length + 1).replace(/\\/g, "/"));

const asList = (body) => (Array.isArray(body) ? body : body?.items ?? []);
const idem = (label) => `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export async function run(ctx) {
  startPhase("Commercial: proposal, billing and payments");
  const s = { stamp: Date.now() };
  const ESTIMATE_NOTE = `INTERNAL-MARGIN-NOTE-${s.stamp}`;
  const LINE_MARK = `LINE-DESC-${s.stamp}`;
  const T = {};

  // ---------- setup ----------
  await step("setup: PMCM, supplier, coordinator sign in and two onboarded events exist", async () => {
    T.admin = await ctx.as("admin"); T.admin2 = await ctx.as("admin2"); T.supplier = await ctx.as("supplier"); T.coordinator = await ctx.as("coordinator");
    s.ev = await ctx.newEvent({ label: "Commercial Golden" });
    s.other = await ctx.newEvent({ label: "Commercial Other" });
    T.client = await s.ev.as(); T.otherClient = await s.other.as();
    return `golden ${s.ev.eventId}`;
  });
  const E = () => s.ev?.eventId;
  const pmcm = (method, path, body, token = T.admin) => http(method, path, { token, body });
  const clientCall = (method, path, body) => http(method, path, { token: T.client, body });
  const workspace = async () => expectStatus(await pmcm("GET", `/pmcm/events/${E()}/workspace`), 200);
  const clientBilling = async () => expectStatus(await clientCall("GET", "/billing"), 200);
  const need = (...keys) => { for (const key of keys) if (!s[key]) blocked(`earlier step left no ${key}`); };
  const clientWorkspace = async () => expectStatus(await clientCall("GET", "/client/workspace"), 200);
  /** Two-step download as the portals must do it: ask for an authorization, then present it with the content request. */
  const downloadFile = async (token, objectId) => {
    const auth = await http("GET", `/storage/objects/${objectId}/download-authorization`, { token });
    if (auth.status !== 200) return { status: auth.status, bytes: Buffer.alloc(0) };
    return http("GET", `/storage/objects/${objectId}/content`, { token, raw: true, headers: { "x-prism-storage-authorization": auth.body.downloadUrl } });
  };
  const estimateBody = (unit, extra = {}) => ({ budgetAmount: 800000, notes: ESTIMATE_NOTE, lines: [{ category: "Venue", description: LINE_MARK, quantity: 1, unitAmount: unit }], ...extra });

  // ---------- access and validation: proposal ----------
  await step("anonymous callers get 401 on proposal, estimate and billing routes", async () => {
    need("ev");
    const bad = [];
    for (const [method, path, body] of [["GET", `/events/${E()}/proposal`], ["POST", `/events/${E()}/cost-estimates`, estimateBody(1)], ["PATCH", `/events/${E()}/proposal/review`, { action: "approve" }], ["POST", `/events/${E()}/billing-source`, { sourceLabel: "x", lineItems: [{ label: "x", amount: 1 }] }], ["GET", "/billing"], ["GET", `/events/${E()}/client-review-items`]]) {
      const r = await http(method, path, { body });
      if (r.status !== 401) bad.push(`${method} ${path.replace(E(), ":id")} -> ${r.status}`);
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("client, supplier and coordinator get 403 creating estimates and issuing proposals", async () => {
    need("ev");
    const bad = [];
    for (const [role, token] of [["client", T.client], ["supplier", T.supplier], ["coordinator", T.coordinator]]) {
      for (const [label, path, body] of [["cost-estimates", `/events/${E()}/cost-estimates`, estimateBody(1000)], ["proposal/versions", `/events/${E()}/proposal/versions`, { title: "x", costEstimateId: "ce_x" }]]) {
        const r = await pmcm("POST", path, body, token);
        if (r.status !== 403) bad.push(`${role} ${label} -> ${r.status}`);
      }
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("invalid cost estimates are rejected with 400, never 500", async () => {
    need("ev");
    const cases = { "no lines": estimateBody(1, { lines: [] }), "zero quantity": estimateBody(1, { lines: [{ category: "a", description: "b", quantity: 0, unitAmount: 5 }] }), "fractional unit amount": estimateBody(1.5), "negative unit amount": estimateBody(-5), "zero budget": estimateBody(5, { budgetAmount: 0 }), "empty body": {} };
    const bad = [];
    for (const [label, body] of Object.entries(cases)) { const r = await pmcm("POST", `/events/${E()}/cost-estimates`, body); if (r.status !== 400) bad.push(`${label} -> ${r.status}`); }
    expect(!bad.length, bad.join("; "));
  });
  await step("PMCM builds a cost estimate; an over-budget estimate is flagged", async () => {
    need("ev");
    const over = expectStatus(await pmcm("POST", `/events/${E()}/cost-estimates`, estimateBody(900000)), 201);
    expect(over.alignment === "over_budget", `900000 against an 800000 budget was ${over.alignment}`);
    s.estimate = expectStatus(await pmcm("POST", `/events/${E()}/cost-estimates`, estimateBody(600000)), 201);
    expect(s.estimate.totalAmount === 600000, `total ${s.estimate.totalAmount}`);
    return `estimate ${s.estimate.id}, alignment ${s.estimate.alignment}`;
  });
  await step("an estimate from another event cannot back a proposal; empty titles are rejected", async () => {
    need("ev", "estimate");
    const foreign = expectStatus(await pmcm("POST", `/events/${s.other.eventId}/cost-estimates`, estimateBody(1000)), 201);
    const r1 = await pmcm("POST", `/events/${E()}/proposal/versions`, { title: "Cross event", costEstimateId: foreign.id });
    expect(r1.status === 400, `foreign estimate -> ${r1.status}: ${msg(r1)}`);
    const r2 = await pmcm("POST", `/events/${E()}/proposal/versions`, { title: "", costEstimateId: s.estimate.id });
    expect(r2.status === 400, `empty title -> ${r2.status}`);
    const r3 = await pmcm("POST", `/events/${E()}/proposal/versions`, { title: "x" });
    expect(r3.status === 400, `missing estimate -> ${r3.status}`);
  });
  await step("client sees no proposal and cannot approve one before PMCM issues it", async () => {
    need("ev");
    const read = expectStatus(await clientCall("GET", `/events/${E()}/proposal`), 200);
    expect(read.proposal === null, "client sees a proposal that was never issued");
    const review = await clientCall("PATCH", `/events/${E()}/proposal/review`, { action: "approve" });
    expect(review.status === 400, `approving a missing proposal -> ${review.status}: ${msg(review)}`);
    return msg(review);
  });

  // ---------- golden path: proposal ----------
  await step("PMCM issues proposal version 1", async () => {
    need("ev", "estimate");
    s.v1 = expectStatus(await pmcm("POST", `/events/${E()}/proposal/versions`, { title: "Golden Summit Proposal", summary: "Venue, AV and registration for 150 guests.", costEstimateId: s.estimate.id }), 201);
    expect(s.v1.versionNumber === 1 && s.v1.status === "issued", `version ${s.v1.versionNumber} ${s.v1.status}`);
    return `${s.v1.id}, total ${s.v1.totalAmount}`;
  });
  await step("client reads the proposal: title, summary and total only, never estimate lines or internal notes", async () => {
    need("v1");
    const read = expectStatus(await clientCall("GET", `/events/${E()}/proposal`), 200);
    expect(read.proposal?.title === "Golden Summit Proposal" && read.proposal.totalAmount === 600000, `unexpected proposal ${JSON.stringify(read.proposal)}`);
    const surfaces = { "GET proposal": JSON.stringify(read), "GET /client/workspace": JSON.stringify((await clientCall("GET", "/client/workspace")).body), "GET /billing": JSON.stringify((await clientCall("GET", "/billing")).body), "GET event": JSON.stringify((await clientCall("GET", `/events/${E()}`)).body) };
    const leaks = Object.entries(surfaces).filter(([, text]) => text.includes(ESTIMATE_NOTE) || text.includes(LINE_MARK) || /"lines"\s*:/.test(text)).map(([k]) => k);
    expect(!leaks.length, `estimate notes or lines reach the client via ${leaks.join(", ")}`);
    return `clientStatus=${read.proposal.clientStatus}`;
  });
  await step("client downloads the issued proposal PDF and it holds no internal estimate data", async () => {
    need("v1");
    const objects = expectStatus(await clientCall("GET", `/storage/objects/events/${E()}`), 200);
    const proposalObject = asList(objects).find((o) => o.ownerRecordType === "proposal_version" && o.ownerRecordId === s.v1.id);
    expect(proposalObject, "the issued proposal has no stored file visible to the client");
    expect(proposalObject.lifecycleState === "stored", `file state ${proposalObject.lifecycleState}`);
    const file = await downloadFile(T.client, proposalObject.id);
    expect(file.status === 200 && file.bytes.subarray(0, 4).toString() === "%PDF", `download -> ${file.status}`);
    const text = file.bytes.toString("latin1");
    expect(!text.includes(ESTIMATE_NOTE) && !text.includes(LINE_MARK), "the client PDF contains estimate notes or lines");
    s.proposalObjectId = proposalObject.id;
    return `${file.bytes.length} bytes`;
  });
  await step("client storage listing hides internal storage keys and uploader identities", async () => {
    need("v1");
    const objects = asList(expectStatus(await clientCall("GET", `/storage/objects/events/${E()}`), 200));
    const leaky = ["providerObjectKey", "uploaderActorId", "providerName"].filter((key) => objects.some((o) => key in o));
    expect(!leaky.length, `client-visible storage objects expose ${leaky.join(", ")}`);
  });
  await step("another client cannot read, download or review this proposal", async () => {
    need("v1", "proposalObjectId");
    const bad = [];
    const checks = [["GET proposal", http("GET", `/events/${E()}/proposal`, { token: T.otherClient })], ["PATCH review", http("PATCH", `/events/${E()}/proposal/review`, { token: T.otherClient, body: { action: "approve" } })], ["GET storage list", http("GET", `/storage/objects/events/${E()}`, { token: T.otherClient })], ["GET pdf authorization", http("GET", `/storage/objects/${s.proposalObjectId}/download-authorization`, { token: T.otherClient })], ["GET review items", http("GET", `/events/${E()}/client-review-items`, { token: T.otherClient })], ["GET /billing contains event", http("GET", "/billing", { token: T.otherClient })]];
    for (const [label, pending] of checks) {
      const r = await pending;
      if (label === "GET /billing contains event") { if (JSON.stringify(r.body).includes(E())) bad.push(label); }
      else if (r.status !== 403) bad.push(`${label} -> ${r.status}`);
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("PMCM cannot approve or revise on the client's behalf (403)", async () => {
    need("v1");
    for (const [who, token] of [["admin", T.admin], ["supplier", T.supplier], ["coordinator", T.coordinator]]) {
      const r = await pmcm("PATCH", `/events/${E()}/proposal/review`, { action: "approve" }, token);
      expect(r.status === 403, `${who} proposal review -> ${r.status}: ${msg(r)}`);
    }
  });
  await step("a retried issue request is recognised instead of creating a duplicate version", async () => {
    need("v1", "estimate");
    const body = { title: "Golden Summit Proposal", summary: "Venue, AV and registration for 150 guests.", costEstimateId: s.estimate.id };
    const again = expectStatus(await pmcm("POST", `/events/${E()}/proposal/versions`, body), 201);
    s.v1 = again.versionNumber > 1 ? again : s.v1;
    if (again.versionNumber > 1) review(`identical proposal issuance creates version ${again.versionNumber}; decide whether this version-creation command should support an idempotency key`);
  });
  await step("revision request without a reason is rejected", async () => {
    need("v1");
    const r = await clientCall("PATCH", `/events/${E()}/proposal/review`, { action: "request_revision", revisionNote: "   " });
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
  });
  await step("client requests a revision with a reason; the same key replays, a reused key with another action is refused", async () => {
    need("v1");
    s.reviewKey = idem("revise");
    const body = { action: "request_revision", revisionNote: `Please lower the venue cost ${s.stamp}`, idempotencyKey: s.reviewKey };
    const first = expectStatus(await clientCall("PATCH", `/events/${E()}/proposal/review`, body), 200);
    expect(first.proposalClientStatus === "revision_requested", `status ${first.proposalClientStatus}`);
    const replay = await clientCall("PATCH", `/events/${E()}/proposal/review`, body);
    expect(replay.status === 200 && replay.body.proposalRevisionCount === first.proposalRevisionCount, `replay -> ${replay.status} count ${replay.body?.proposalRevisionCount} vs ${first.proposalRevisionCount}`);
    const reused = await clientCall("PATCH", `/events/${E()}/proposal/review`, { action: "approve", idempotencyKey: s.reviewKey });
    expect(reused.status === 400, `key reuse with another action -> ${reused.status}: ${msg(reused)}`);
    s.revisionRequested = true;
    return `revision count ${first.proposalRevisionCount}`;
  });
  await step("client cannot decide twice on the same issued version", async () => {
    need("revisionRequested");
    const r = await clientCall("PATCH", `/events/${E()}/proposal/review`, { action: "approve" });
    expect(r.status === 400 && /newer issued proposal/i.test(msg(r)), `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("PMCM can see why the client asked for a revision", async () => {
    need("revisionRequested");
    const note = `Please lower the venue cost ${s.stamp}`;
    const ws = JSON.stringify(await workspace());
    const log = JSON.stringify((await pmcm("GET", `/events/${E()}/decision-log`)).body ?? "");
    const inbox = JSON.stringify((await pmcm("GET", "/pmcm/command-inbox")).body ?? "");
    const where = [["workspace", ws], ["decision log", log], ["command inbox", inbox]].filter(([, text]) => text.includes(note)).map(([k]) => k);
    expect(where.length > 0, "the client's revision reason is not shown in the PMCM workspace, decision log or command inbox (only in the audit trail)");
    return `visible in ${where.join(", ")}`;
  });
  await step("PMCM issues the revised proposal version from a lower estimate", async () => {
    need("revisionRequested");
    const est2 = expectStatus(await pmcm("POST", `/events/${E()}/cost-estimates`, estimateBody(500000)), 201);
    s.v2 = expectStatus(await pmcm("POST", `/events/${E()}/proposal/versions`, { title: "Golden Summit Proposal (revised)", summary: "Lower venue cost.", costEstimateId: est2.id, revisionNote: "Venue cost lowered as requested" }), 201);
    expect(s.v2.versionNumber > s.v1.versionNumber && s.v2.totalAmount === 500000, `v${s.v2.versionNumber} total ${s.v2.totalAmount}`);
    return `version ${s.v2.versionNumber}`;
  });
  await step("the freshly issued version shows as awaiting the client's review, not as revision requested", async () => {
    need("v2");
    const read = expectStatus(await clientCall("GET", `/events/${E()}/proposal`), 200);
    expect(read.proposal?.versionNumber === s.v2.versionNumber, `client sees version ${read.proposal?.versionNumber}`);
    expect(read.proposal.clientStatus === "pending", `new version ${s.v2.versionNumber} shows clientStatus "${read.proposal.clientStatus}" (the status of the previous version carries over)`);
  });
  await step("client approves the revised proposal (idempotency key replays safely)", async () => {
    need("v2");
    const key = idem("approve");
    const first = expectStatus(await clientCall("PATCH", `/events/${E()}/proposal/review`, { action: "approve", idempotencyKey: key }), 200);
    expect(first.proposalClientStatus === "approved", `status ${first.proposalClientStatus}`);
    const replay = await clientCall("PATCH", `/events/${E()}/proposal/review`, { action: "approve", idempotencyKey: key });
    expect(replay.status === 200 && replay.body.proposalClientStatus === "approved", `replay -> ${replay.status}: ${msg(replay)}`);
    s.approved = true;
  });
  await step("issuing a new version after approval is refused with a pointer to scope change", async () => {
    need("approved", "estimate");
    const r = await pmcm("POST", `/events/${E()}/proposal/versions`, { title: "Too late", costEstimateId: s.estimate.id });
    expect(r.status === 400 && /scope change/i.test(msg(r)), `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("a fourth revision request is refused once the cap of 3 is reached, with a clear message", async () => {
    need("ev");
    const cap = await ctx.newEvent({ label: "Commercial Cap" });
    const capClient = await cap.as();
    const est = expectStatus(await pmcm("POST", `/events/${cap.eventId}/cost-estimates`, estimateBody(400000)), 201);
    let last;
    for (let round = 1; round <= 4; round++) {
      expectStatus(await pmcm("POST", `/events/${cap.eventId}/proposal/versions`, { title: `Cap v${round}`, costEstimateId: est.id }), 201);
      last = await http("PATCH", `/events/${cap.eventId}/proposal/review`, { token: capClient, body: { action: "request_revision", revisionNote: `round ${round}` } });
      if (round < 4) expectStatus(last, 200);
    }
    expect(last.status === 400 && /cap/i.test(msg(last)), `4th revision -> ${last.status}: ${msg(last)}`);
    return msg(last);
  });

  // ---------- venue and styling review items ----------
  await step("only PMCM can issue venue or styling options (client, supplier, coordinator get 403)", async () => {
    need("ev");
    const bad = [];
    for (const [role, token] of [["client", T.client], ["supplier", T.supplier], ["coordinator", T.coordinator]]) {
      const r = await pmcm("POST", `/events/${E()}/client-review-items`, { kind: "venue", title: "x", summary: "y", idempotencyKey: idem("rv") }, token);
      if (r.status !== 403) bad.push(`${role} -> ${r.status}`);
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("invalid review items (unknown kind, missing key, empty title) are 400", async () => {
    need("ev");
    const bad = [];
    for (const [label, body] of Object.entries({ "unknown kind": { kind: "catering", title: "x", summary: "y", idempotencyKey: "k1" }, "missing key": { kind: "venue", title: "x", summary: "y" }, "empty title": { kind: "venue", title: "", summary: "y", idempotencyKey: "k2" } })) {
      const r = await pmcm("POST", `/events/${E()}/client-review-items`, body);
      if (r.status !== 400) bad.push(`${label} -> ${r.status}`);
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("PMCM issues a venue option; an identical retry replays and a reused key with other content is refused", async () => {
    need("ev");
    const key = idem("venue");
    const body = { kind: "venue", title: "Makati Ballroom", summary: "Main plenary venue, 200 capacity.", budgetRange: "PHP 400-500k", idempotencyKey: key };
    s.venue = expectStatus(await pmcm("POST", `/events/${E()}/client-review-items`, body), 201, 200);
    const replay = expectStatus(await pmcm("POST", `/events/${E()}/client-review-items`, body), 201, 200);
    expect(replay.id === s.venue.id, "a retry with the same key created another option");
    const reused = await pmcm("POST", `/events/${E()}/client-review-items`, { ...body, title: "Different venue" });
    expect(reused.status === 400, `key reuse with other content -> ${reused.status}: ${msg(reused)}`);
    return `version ${s.venue.version}`;
  });
  await step("client sees the option; supplier and another client cannot", async () => {
    need("venue");
    const mine = asList(expectStatus(await clientCall("GET", `/events/${E()}/client-review-items`), 200));
    expect(mine.some((i) => i.id === s.venue.id), "published option is not visible to its client");
    for (const [who, token] of [["supplier", T.supplier], ["other client", T.otherClient]]) {
      const r = await pmcm("GET", `/events/${E()}/client-review-items`, undefined, token);
      expect(r.status === 403, `${who} -> ${r.status}`);
    }
  });
  await step("client decision rules: reason needed for revisions, stale version refused, PMCM cannot decide for the client", async () => {
    need("venue");
    const path = `/events/${E()}/client-review-items/${s.venue.id}/decisions`;
    const noComment = await clientCall("POST", path, { itemVersion: s.venue.version, action: "request_revision", comment: "" });
    expect(noComment.status === 400, `revision without comment -> ${noComment.status}`);
    const stale = await clientCall("POST", path, { itemVersion: s.venue.version + 5, action: "approve" });
    expect(stale.status === 400, `stale version -> ${stale.status}: ${msg(stale)}`);
    const byPmcm = await pmcm("POST", path, { itemVersion: s.venue.version, action: "approve" });
    expect(byPmcm.status === 403, `PMCM deciding -> ${byPmcm.status}`);
  });
  await step("client approves the venue option once; a second decision on the same version is refused and PMCM sees the decision", async () => {
    need("venue");
    const path = `/events/${E()}/client-review-items/${s.venue.id}/decisions`;
    expectStatus(await clientCall("POST", path, { itemVersion: s.venue.version, action: "approve", comment: "Looks good" }), 200, 201);
    const again = await clientCall("POST", path, { itemVersion: s.venue.version, action: "request_revision", comment: "changed my mind" });
    expect(again.status === 400, `second decision -> ${again.status}: ${msg(again)}`);
    const seen = asList(expectStatus(await pmcm("GET", `/events/${E()}/client-review-items`), 200)).find((i) => i.id === s.venue.id);
    expect(seen?.clientDecision?.action === "approve", `PMCM sees decision ${JSON.stringify(seen?.clientDecision)}`);
  });
  await step("PMCM issues a styling option and the client only sees published options", async () => {
    need("venue");
    const styling = expectStatus(await pmcm("POST", `/events/${E()}/client-review-items`, { kind: "styling", title: "Modern palette", summary: "Brand colours, 50k styling budget.", idempotencyKey: idem("styling") }), 201, 200);
    expect(styling.version === 1, `styling version ${styling.version}`);
    const mine = asList(expectStatus(await clientCall("GET", `/events/${E()}/client-review-items`), 200));
    expect(mine.every((i) => i.status === "published"), "client sees a non-published option");
  });

  // ---------- billing: access and validation ----------
  await step("every PMCM billing mutation returns 403 for client, supplier and coordinator and 401 when anonymous", async () => {
    need("ev");
    const e = E(); const bad = [];
    const calls = [
      ["POST billing-source", "POST", `/events/${e}/billing-source`, { sourceLabel: "x", lineItems: [{ label: "x", amount: 100 }] }],
      ["PATCH approve source", "PATCH", `/events/${e}/billing-source/bsrc_x/approve`, {}],
      ["POST generate statement", "POST", `/events/${e}/billing-statements/generate`, {}],
      ["POST send statement", "POST", `/events/${e}/billing-statements/bill_x/send`, undefined],
      ["PATCH mark payment", "PATCH", `/events/${e}/payments/pay_x`, { status: "paid" }],
      ["POST record payment", "POST", `/events/${e}/payments/pay_x/records`, { amountReceived: 1, paymentDate: "2026-10-28", paymentMethod: "GCash" }],
      ["POST correction", "POST", `/events/${e}/billing-corrections`, { statementId: "bill_x", reason: "x", idempotencyKey: "k" }],
      ["PATCH correction", "PATCH", `/events/${e}/billing-corrections/corr_x`, { action: "approve" }],
      ["POST dispute", "POST", `/events/${e}/billing-disputes`, { statementId: "bill_x", amount: 1, reason: "x", idempotencyKey: "k" }],
      ["PATCH dispute", "PATCH", `/events/${e}/billing-disputes/dispute_x`, { action: "resolve", resolutionNotes: "x" }],
      ["POST additional billing", "POST", `/events/${e}/additional-billing`, { urgentIssueId: "u", billingSourceId: "b", description: "x", amount: 1, idempotencyKey: "k" }],
      ["PATCH waive", "PATCH", `/events/${e}/additional-billing/addbill_x/waive`, { reason: "x" }],
    ];
    for (const [label, method, path, body] of calls) {
      for (const [role, token] of [["client", T.client], ["supplier", T.supplier], ["coordinator", T.coordinator]]) {
        const r = await http(method, path, { token, body });
        if (r.status !== 403) bad.push(`${role} ${label} -> ${r.status}`);
      }
      const anon = await http(method, path, { body });
      if (anon.status !== 401) bad.push(`anon ${label} -> ${anon.status}`);
    }
    expect(!bad.length, bad.join("; "));
    return `${calls.length} routes x 4 callers`;
  });
  await step("invalid billing source bodies are 400, never 500", async () => {
    need("ev");
    const base = { sourceLabel: "Invalid", lineItems: [{ label: "Venue", amount: 100000 }] };
    const cases = {
      "no line items": { ...base, lineItems: [] },
      "only a negative line": { ...base, lineItems: [{ label: "Credit", amount: -500 }] },
      "empty label": { ...base, lineItems: [{ label: "", amount: 500 }] },
      "schedule not 100%": { ...base, paymentSchedule: [{ label: "Down", percentage: 50 }, { label: "Balance", percentage: 40 }] },
      "five milestones": { ...base, paymentSchedule: [20, 20, 20, 20, 20].map((p, i) => ({ label: `M${i}`, percentage: p })) },
      "30% downpayment without override": { ...base, paymentSchedule: [{ label: "Down", percentage: 30 }, { label: "Balance", percentage: 70 }] },
      "override without reason": { ...base, paymentTermsPolicy: "repeat_client_override" },
      "unknown evidence document": { ...base, sourceDocumentId: "doc_does_not_exist" },
    };
    const bad = [];
    for (const [label, body] of Object.entries(cases)) {
      const r = await pmcm("POST", `/events/${E()}/billing-source`, body);
      if (r.status !== 400 && !(label === "unknown evidence document" && r.status === 404)) bad.push(`${label} -> ${r.status}`);
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("a mixed list with a negative line is rejected instead of silently dropping the line", async () => {
    need("ev");
    const r = await pmcm("POST", `/events/${E()}/billing-source`, { sourceLabel: "Mixed lines", lineItems: [{ label: "Venue", amount: 500000 }, { label: "Discount", amount: -100000 }] });
    if (r.status < 300) {
      const kept = r.body.lineItems?.length;
      expect(false, `accepted (${r.status}) and silently dropped the negative line: ${kept} line(s) kept, total ${r.body.totalAmount} instead of 400000`);
    }
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
  });

  // ---------- billing: source, statement, send ----------
  await step("PMCM creates a billing source citing the issued proposal document as evidence", async () => {
    need("v2", "approved");
    const docs = (await workspace()).documents ?? [];
    s.doc1 = docs.find((d) => /Proposal v1 /.test(d.fileName));
    s.docLatest = docs.filter((d) => d.type === "proposal").sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
    expect(s.docLatest, `no proposal document in the PMCM workspace (${docs.length} documents)`);
    s.sourceKey = idem("source");
    s.sourceBody = { sourceLabel: "Golden Summit Proposal (revised)", sourceType: "ce_proposal", sourceDocumentId: s.docLatest.id, lineItems: [{ label: "Venue", amount: 300000 }, { label: "AV and registration", amount: 200000 }], paymentSchedule: [{ label: "Downpayment", percentage: 50, dueDate: "2026-11-15" }, { label: "Balance", percentage: 50, dueDate: "2027-06-08" }], idempotencyKey: s.sourceKey };
    s.source = expectStatus(await pmcm("POST", `/events/${E()}/billing-source`, s.sourceBody), 201);
    expect(s.source.status === "draft" && s.source.totalAmount === 500000, `${s.source.status} total ${s.source.totalAmount}`);
    return `${s.source.id}, document ${s.docLatest.fileName}`;
  });
  await step("billing source idempotency: same key replays, same key with other content is refused", async () => {
    need("source");
    const replay = expectStatus(await pmcm("POST", `/events/${E()}/billing-source`, s.sourceBody), 201);
    expect(replay.id === s.source.id, "a retry created a second source");
    const other = await pmcm("POST", `/events/${E()}/billing-source`, { ...s.sourceBody, sourceLabel: "Changed" });
    expect(other.status === 400, `key reuse -> ${other.status}: ${msg(other)}`);
  });
  await step("a billing source cannot cite a superseded proposal version as evidence", async () => {
    need("source", "doc1");
    const r = await pmcm("POST", `/events/${E()}/billing-source`, { ...s.sourceBody, idempotencyKey: idem("stale-evidence"), sourceDocumentId: s.doc1.id });
    if (r.status < 400) review(`source citing superseded v1 was accepted (${r.status}); decide whether source evidence must match the latest approved version`);
  });
  await step("a billing source whose total differs from the approved proposal total is refused", async () => {
    need("source");
    const r = await pmcm("POST", `/events/${E()}/billing-source`, { ...s.sourceBody, idempotencyKey: idem("mismatch"), lineItems: [{ label: "Venue", amount: 999000 }] });
    if (r.status < 400) review(`source totalling 999000 citing an approved 500000 proposal was accepted (${r.status}); clarify allowed adjustments and approval controls`);
  });
  await step("a statement cannot be generated from an unapproved source", async () => {
    need("source");
    const r = await pmcm("POST", `/events/${E()}/billing-statements/generate`, { sourceId: s.source.id });
    expect(r.status === 400 && /approved/i.test(msg(r)), `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("sending a statement that does not exist is a 404", async () => {
    need("ev");
    const r = await pmcm("POST", `/events/${E()}/billing-statements/bill_nope/send`);
    expect(r.status === 404, `${r.status}: ${msg(r)}`);
  });
  await step("approving a source: the creator approves it (separation of duties is not required here)", async () => {
    need("source");
    const approved = expectStatus(await pmcm("PATCH", `/events/${E()}/billing-source/${s.source.id}/approve`, { approvalNotes: "Matches approved proposal" }), 200);
    expect(approved.status === "approved" && approved.approvedBy, `status ${approved.status}`);
    s.firstApprover = approved.approvedBy; s.firstApprovedAt = approved.approvedAt;
    return `approved by ${approved.approvedBy}; the creator can approve their own source (only corrections need a second person)`;
  });
  await step("a second admin cannot silently re-approve an approved source and replace the approver on record", async () => {
    need("source", "firstApprover");
    const again = await pmcm("PATCH", `/events/${E()}/billing-source/${s.source.id}/approve`, { approvalNotes: "re-approve" }, T.admin2);
    if (again.status >= 400) return `refused: ${msg(again)}`;
    expect(again.body.approvedBy === s.firstApprover && again.body.approvedAt === s.firstApprovedAt, `re-approval returned ${again.status} and replaced the approver "${s.firstApprover}" with "${again.body.approvedBy}"`);
  });
  await step("PMCM generates the billing statement; PDF stored, numbered, milestones created", async () => {
    need("source");
    s.genKey = idem("generate");
    s.statement = expectStatus(await pmcm("POST", `/events/${E()}/billing-statements/generate`, { sourceId: s.source.id, idempotencyKey: s.genKey }), 201);
    expect(/^BS-\d{4}-\d{4}$/.test(s.statement.number), `number ${s.statement.number}`);
    expect(s.statement.storageState === "stored" && s.statement.storageKey, `storage state ${s.statement.storageState}`);
    s.milestones = (await workspace()).paymentMilestones ?? [];
    s.initialMilestoneIds = s.milestones.map((milestone) => milestone.id);
    expect(s.milestones.length === 2 && s.milestones.reduce((sum, m) => sum + m.amount, 0) === 500000, `${s.milestones.length} milestones totalling ${s.milestones.reduce((sum, m) => sum + m.amount, 0)}`);
    s.down = s.milestones.find((m) => m.label === "Downpayment"); s.balance = s.milestones.find((m) => m.label === "Balance");
    return `${s.statement.number}, ${s.milestones.length} milestones`;
  });
  await step("statement generation replays with the same key; without a key a second statement for the same source is refused clearly", async () => {
    need("statement");
    const replay = expectStatus(await pmcm("POST", `/events/${E()}/billing-statements/generate`, { sourceId: s.source.id, idempotencyKey: s.genKey }), 201);
    expect(replay.id === s.statement.id, "a keyed retry created another statement");
    const second = await pmcm("POST", `/events/${E()}/billing-statements/generate`, { sourceId: s.source.id });
    expect(second.status === 400 || second.status === 409, `second statement -> ${second.status}`);
    if (/storage|logical target/i.test(msg(second))) review(`duplicate generation is refused with ${second.status} "${msg(second)}"; a billing-domain response would explain this better`);
  });
  await step("the client does not see a statement before PMCM sends it", async () => {
    need("statement");
    const seen = [...(await clientBilling()).billingStatements, ...(await clientWorkspace()).billingStatements].filter((b) => b.id === s.statement.id);
    if (seen.length) review(`client sees ${s.statement.number} with status "${seen[0]?.status}" and sentAt ${seen[0]?.sentAt}; clarify whether issuing or sending publishes the statement`);
  });
  await step("PMCM sends the statement; the client now sees it with its milestones", async () => {
    need("statement");
    const sent = expectStatus(await pmcm("POST", `/events/${E()}/billing-statements/${s.statement.id}/send`), 200);
    expect(sent.status === "sent" && sent.sentAt, `status ${sent.status}`);
    s.sentAt = sent.sentAt;
    const billing = await clientBilling();
    expect(billing.billingStatements.some((b) => b.id === s.statement.id), "client cannot see the sent statement");
    expect(billing.paymentMilestones.filter((m) => m.eventId === E()).length === 2, "client does not see the 2 milestones");
  });
  await step("sending the same statement again is refused or leaves the original sent time and notifications alone", async () => {
    need("sentAt");
    const again = await pmcm("POST", `/events/${E()}/billing-statements/${s.statement.id}/send`);
    if (again.status >= 400) return `refused: ${msg(again)}`;
    if (again.body.sentAt !== s.sentAt) review(`send is repeatable: sentAt changed from ${s.sentAt} to ${again.body.sentAt}; clarify resend/idempotency behavior`);
  });
  await step("client downloads the statement PDF; another client cannot", async () => {
    need("statement");
    const objects = asList(expectStatus(await clientCall("GET", `/storage/objects/events/${E()}`), 200));
    const object = objects.find((o) => o.ownerRecordType === "billing_statement");
    expect(object, "the client cannot see the statement file in its storage listing");
    const file = await downloadFile(T.client, object.id);
    expect(file.status === 200 && file.bytes.subarray(0, 4).toString() === "%PDF" && file.bytes.toString("latin1").includes(s.statement.number), `download -> ${file.status}`);
    const other = await downloadFile(T.otherClient, object.id);
    expect(other.status === 403, `another client downloading -> ${other.status}`);
    s.statementObjectId = object.id;
    return `${file.bytes.length} bytes`;
  });
  await step("fetching file content without the download authorization header is refused with a 4xx, not a 500", async () => {
    need("statementObjectId");
    const r = await http("GET", `/storage/objects/${s.statementObjectId}/content`, { token: T.client });
    expect(r.status >= 400 && r.status < 500, `content without authorization -> ${r.status}: ${msg(r)}`);
  });
  await step("the client billing payload carries no internal storage keys or object ids", async () => {
    need("statement");
    const statement = (await clientBilling()).billingStatements.find((b) => b.id === s.statement.id);
    expect(statement, "statement not visible to the client");
    const leaky = ["storageKey"].filter((key) => statement[key]);
    expect(!leaky.length, `client-visible statement exposes ${leaky.join(", ")}`);
  });

  // ---------- payments ----------
  await step("a rejected statement regeneration preserves existing milestone identities", async () => {
    s.milestones = (await workspace()).paymentMilestones ?? [];
    s.down = s.milestones.find((m) => m.label === "Downpayment");
    s.balance = s.milestones.find((m) => m.label === "Balance");
    expect(s.initialMilestoneIds?.every((id) => s.milestones.some((milestone) => milestone.id === id)), "statement regeneration failed but replaced payment milestone IDs, invalidating previously read payment links");
  });
  await step("invalid payment bodies are 400, never 500", async () => {
    need("down");
    const path = `/events/${E()}/payments/${s.down.id}/records`;
    const good = { amountReceived: 1000, paymentDate: "2026-10-28", paymentMethod: "GCash" };
    const cases = { "zero amount": { ...good, amountReceived: 0 }, "negative amount": { ...good, amountReceived: -5 }, "fractional amount": { ...good, amountReceived: 10.5 }, "unknown method": { ...good, paymentMethod: "Bitcoin" }, "bad date": { ...good, paymentDate: "not-a-date" }, "missing date": { amountReceived: 5, paymentMethod: "GCash" } };
    const bad = [];
    for (const [label, body] of Object.entries(cases)) { const r = await pmcm("POST", path, body); if (r.status !== 400) bad.push(`${label} -> ${r.status}`); }
    const badStatus = await pmcm("PATCH", `/events/${E()}/payments/${s.down.id}`, { status: "overdue" });
    if (badStatus.status !== 400) bad.push(`status overdue -> ${badStatus.status}`);
    expect(!bad.length, bad.join("; "));
  });
  await step("partial payment: milestone becomes partially paid; the same key replays without double-crediting", async () => {
    need("down");
    const path = `/events/${E()}/payments/${s.down.id}/records`;
    s.payKey = idem("pay");
    const body = { amountReceived: 100000, paymentDate: "2026-10-28", paymentMethod: "Bank Transfer", referenceNumber: `REF-A-${s.stamp}`, idempotencyKey: s.payKey };
    const first = expectStatus(await pmcm("POST", path, body), 201);
    s.paymentWorks = true;
    expect(first.status === "partially_paid" && first.amountPaid === 100000 && first.remainingBalance === s.down.amount - 100000, `${first.status} paid ${first.amountPaid} remaining ${first.remainingBalance}`);
    const replay = expectStatus(await pmcm("POST", path, body), 201);
    expect(replay.amountPaid === 100000, `replay credited again: amountPaid ${replay.amountPaid}`);
    const reused = await pmcm("POST", path, { ...body, amountReceived: 50000 });
    expect(reused.status === 400, `same key with another amount -> ${reused.status}: ${msg(reused)}`);
  });
  await step("a milestone cannot be marked paid when nothing was received", async () => {
    need("balance");
    const early = await pmcm("PATCH", `/events/${E()}/payments/${s.balance.id}`, { status: "paid" });
    expect(early.status === 400, `mark paid with nothing received -> ${early.status}: ${msg(early)}`);
  });
  await step("payment rules: overpayment refused, cannot reset to pending after a payment", async () => {
    need("down", "paymentWorks");
    const over = await pmcm("POST", `/events/${E()}/payments/${s.down.id}/records`, { amountReceived: 250000, paymentDate: "2026-10-28", paymentMethod: "GCash" });
    expect(over.status === 400, `overpayment -> ${over.status}: ${msg(over)}`);
    const reset = await pmcm("PATCH", `/events/${E()}/payments/${s.down.id}`, { status: "pending" });
    expect(reset.status === 400, `back to pending after a payment -> ${reset.status}: ${msg(reset)}`);
  });
  await step("final payment settles the milestone; a repeated reference is not counted twice; a paid milestone cannot become at risk", async () => {
    need("down", "paymentWorks");
    const path = `/events/${E()}/payments/${s.down.id}/records`;
    const body = { amountReceived: s.down.amount - 100000, paymentDate: "2026-10-29", paymentMethod: "GCash", referenceNumber: `REF-B-${s.stamp}` };
    const settled = expectStatus(await pmcm("POST", path, body), 201);
    expect(settled.status === "paid" && settled.amountPaid === s.down.amount, `${settled.status} paid ${settled.amountPaid}`);
    const dup = expectStatus(await pmcm("POST", path, body), 201);
    expect(dup.amountPaid === s.down.amount && dup.history.length === 2, `duplicate reference changed history to ${dup.history.length} records / ${dup.amountPaid}`);
    const risk = await pmcm("PATCH", `/events/${E()}/payments/${s.down.id}`, { status: "at_risk" });
    expect(risk.status === 400, `paid -> at_risk returned ${risk.status}`);
  });
  await step("PMCM flags the balance milestone at risk; the client sees the updated status", async () => {
    need("balance");
    const marked = expectStatus(await pmcm("PATCH", `/events/${E()}/payments/${s.balance.id}`, { status: "at_risk" }), 200);
    expect(marked.status === "at_risk", `status ${marked.status}`);
    const seen = (await clientWorkspace()).paymentMilestones.find((m) => m.id === s.balance.id);
    expect(seen?.status === "at_risk", `client sees status ${seen?.status}`);
  });
  await step("client sees payments and remaining balances reconcile with the statement", async () => {
    need("down", "balance", "paymentWorks");
    const billing = await clientWorkspace();
    const mine = billing.paymentMilestones.filter((m) => m.eventId === E());
    const paid = mine.reduce((sum, m) => sum + m.amountPaid, 0);
    const remaining = mine.reduce((sum, m) => sum + m.remainingBalance, 0);
    expect(paid === s.down.amount && remaining === s.balance.amount, `paid ${paid}, remaining ${remaining} (expected ${s.down.amount} / ${s.balance.amount})`);
    expect(mine.flatMap((m) => m.history).length === 2, `client sees ${mine.flatMap((m) => m.history).length} payment records (expected 2)`);
    return `paid ${paid}, remaining ${remaining}`;
  });
  await step("client can obtain a payment receipt for a recorded payment", async () => {
    need("down");
    const objects = asList(expectStatus(await clientCall("GET", `/storage/objects/events/${E()}`), 200));
    const receipt = objects.find((o) => /receipt/i.test(`${o.ownerRecordType} ${o.originalFileName} ${o.usage}`));
    if (!receipt) gap("no payment receipt is generated or stored after a payment is recorded; the client only sees payment records (amount, method, reference)");
  });
  await step("a past-due milestone is flagged overdue to PMCM and the client", async () => {
    need("ev");
    const od = await ctx.newEvent({ label: "Commercial Overdue" });
    const source = expectStatus(await pmcm("POST", `/events/${od.eventId}/billing-source`, { sourceLabel: "Overdue test", lineItems: [{ label: "Venue", amount: 100000 }], paymentSchedule: [{ label: "Downpayment", percentage: 50, dueDate: "2026-09-01" }, { label: "Balance", percentage: 50, dueDate: "2027-06-08" }] }), 201);
    expectStatus(await pmcm("PATCH", `/events/${od.eventId}/billing-source/${source.id}/approve`, {}), 200);
    expectStatus(await pmcm("POST", `/events/${od.eventId}/billing-statements/generate`, { sourceId: source.id }), 201);
    const ws = expectStatus(await pmcm("GET", `/pmcm/events/${od.eventId}/workspace`), 200);
    const late = ws.paymentMilestones.find((m) => m.label === "Downpayment");
    expect(late, "no downpayment milestone");
    const flagged = late.status === "overdue" || "overdue" in late || "isOverdue" in late;
    if (!flagged) gap(`milestone due ${late.dueDate} is past due but stays "${late.status}" with no overdue status or flag in the API; only a queued reminder exists (no overdue indicator for PMCM or the client)`);
  });

  // ---------- corrections, disputes, additional billing ----------
  await step("correction requests validate input and stay inside the event", async () => {
    need("statement");
    const bad = [];
    const cases = [["missing key", { statementId: s.statement.id, reason: "x" }, 400], ["empty reason", { statementId: s.statement.id, reason: "", idempotencyKey: "k" }, 400], ["negative amount", { statementId: s.statement.id, reason: "x", correctedTotalAmount: -1, idempotencyKey: "k" }, 400], ["unknown statement", { statementId: "bill_nope", reason: "x", idempotencyKey: idem("c") }, 404], ["statement from another event", { statementId: s.statement.id, reason: "x", idempotencyKey: idem("c") }, 404]];
    for (const [label, body, want] of cases) {
      const path = label === "statement from another event" ? `/events/${s.other.eventId}/billing-corrections` : `/events/${E()}/billing-corrections`;
      const r = await pmcm("POST", path, body);
      if (r.status !== want) bad.push(`${label} -> ${r.status} (wanted ${want})`);
    }
    expect(!bad.length, bad.join("; "));
  });
  await step("admin requests a correction; the same key replays, other content is refused", async () => {
    need("statement");
    s.corrKey = idem("corr");
    const body = { statementId: s.statement.id, reason: "Venue line double counted", correctedTotalAmount: 450000, idempotencyKey: s.corrKey };
    s.correction = expectStatus(await pmcm("POST", `/events/${E()}/billing-corrections`, body), 201);
    expect(s.correction.status === "pending", `status ${s.correction.status}`);
    const replay = expectStatus(await pmcm("POST", `/events/${E()}/billing-corrections`, body), 201);
    expect(replay.id === s.correction.id, "a retry created a second correction");
    const other = await pmcm("POST", `/events/${E()}/billing-corrections`, { ...body, reason: "different" });
    expect(other.status === 400, `key reuse -> ${other.status}`);
  });
  await step("the requester cannot approve their own correction (403); a rejection needs a reason", async () => {
    need("correction");
    const self = await pmcm("PATCH", `/events/${E()}/billing-corrections/${s.correction.id}`, { action: "approve" });
    expect(self.status === 403, `self-approval -> ${self.status}: ${msg(self)}`);
    const noReason = await pmcm("PATCH", `/events/${E()}/billing-corrections/${s.correction.id}`, { action: "reject" });
    expect(noReason.status === 400, `reject without reason -> ${noReason.status}`);
    return msg(self);
  });
  await step("a different admin approves the correction; resolving it twice is refused", async () => {
    need("correction");
    const approved = expectStatus(await pmcm("PATCH", `/events/${E()}/billing-corrections/${s.correction.id}`, { action: "approve", resolutionNotes: "Confirmed with finance" }, T.admin2), 200);
    expect(approved.status === "approved", `status ${approved.status}`);
    const again = await pmcm("PATCH", `/events/${E()}/billing-corrections/${s.correction.id}`, { action: "reject", resolutionNotes: "no" }, T.admin2);
    expect(again.status === 400 && /already/i.test(msg(again)), `second resolution -> ${again.status}: ${msg(again)}`);
    s.correctionApproved = true;
  });
  await step("an approved correction changes the billed total or milestones", async () => {
    need("correctionApproved");
    const ws = await workspace();
    const statement = ws.billingStatements.find((b) => b.id === s.statement.id);
    const total = ws.paymentMilestones.reduce((sum, m) => sum + m.amount, 0);
    if (statement.totalAmount !== 450000 && total !== 450000) gap(`approving a correction (corrected total 450000) records the decision only: statement total stays ${statement.totalAmount} and milestones still total ${total}; there is no route to issue a corrected statement`);
  });
  await step("dispute input is validated and PMCM can raise one against a statement milestone", async () => {
    need("statement", "balance");
    const bad = [];
    for (const [label, body, want] of [["amount over the statement total", { statementId: s.statement.id, amount: 99999999, reason: "x", idempotencyKey: idem("d") }, 400], ["negative amount", { statementId: s.statement.id, amount: -1, reason: "x", idempotencyKey: idem("d") }, 400], ["unknown milestone", { statementId: s.statement.id, milestoneId: "pay_nope", amount: 10, reason: "x", idempotencyKey: idem("d") }, 404], ["missing reason", { statementId: s.statement.id, amount: 10, idempotencyKey: idem("d") }, 400]]) {
      const r = await pmcm("POST", `/events/${E()}/billing-disputes`, body);
      if (r.status !== want) bad.push(`${label} -> ${r.status} (wanted ${want})`);
    }
    expect(!bad.length, bad.join("; "));
    const key = idem("dispute");
    const body = { statementId: s.statement.id, milestoneId: s.balance.id, amount: 50000, reason: "Client disputes the AV charge", idempotencyKey: key };
    s.dispute = expectStatus(await pmcm("POST", `/events/${E()}/billing-disputes`, body), 201);
    const replay = expectStatus(await pmcm("POST", `/events/${E()}/billing-disputes`, body), 201);
    expect(replay.id === s.dispute.id, "a retry opened a second dispute");
  });
  await step("the client sees the dispute status and amount but not corrections or internal notes", async () => {
    need("dispute");
    const billing = await clientWorkspace();
    expect((billing.billingDisputes ?? []).some((d) => d.id === s.dispute.id), "client does not see the dispute in its workspace");
    expect(!("billingCorrections" in billing) && ((await clientBilling()).billingCorrections ?? []).length === 0, "client sees PMCM-internal billing corrections");
    const text = JSON.stringify(billing.billingDisputes);
    expect(!/resolutionNotes|raisedBy/.test(text), "client-visible dispute carries resolution notes or the PMCM raiser");
  });
  await step("resolving a dispute needs notes; it can be resolved once", async () => {
    need("dispute");
    const path = `/events/${E()}/billing-disputes/${s.dispute.id}`;
    const noNotes = await pmcm("PATCH", path, { action: "resolve" });
    expect(noNotes.status === 400, `resolve without notes -> ${noNotes.status}`);
    const badAction = await pmcm("PATCH", path, { action: "escalate", resolutionNotes: "x" });
    expect(badAction.status === 400, `unknown action -> ${badAction.status}`);
    expectStatus(await pmcm("PATCH", path, { action: "resolve", resolutionNotes: "Credit note agreed" }), 200);
    const again = await pmcm("PATCH", path, { action: "reject", resolutionNotes: "x" });
    expect(again.status === 400 && /already/i.test(msg(again)), `second resolution -> ${again.status}: ${msg(again)}`);
  });
  await step("the client can raise a billing dispute themselves", async () => {
    need("statement");
    const r = await clientCall("POST", `/events/${E()}/billing-disputes`, { statementId: s.statement.id, amount: 1000, reason: "I disagree with this charge", idempotencyKey: idem("cd") });
    if (r.status === 403) gap("only a PMCM admin can open a billing dispute (403 for the client); the client has no route to dispute a statement, PMCM must record it on their behalf");
    expect(r.status < 300, `${r.status}: ${msg(r)}`);
  });
  await step("additional billing is refused before the event end is recorded; waiving an unknown item is 404", async () => {
    need("source");
    const r = await pmcm("POST", `/events/${E()}/additional-billing`, { urgentIssueId: "urgent_nope", billingSourceId: s.source.id, description: "Overtime", amount: 5000, idempotencyKey: idem("ab") });
    expect(r.status === 400 && /event end/i.test(msg(r)), `${r.status}: ${msg(r)}`);
    const waive = await pmcm("PATCH", `/events/${E()}/additional-billing/addbill_nope/waive`, { reason: "goodwill" });
    expect(waive.status === 404, `waive unknown -> ${waive.status}`);
    const noReason = await pmcm("PATCH", `/events/${E()}/additional-billing/addbill_nope/waive`, { reason: "" });
    expect(noReason.status === 400, `waive without reason -> ${noReason.status}`);
    return msg(r);
  });
  await step("a second approved source cannot double-bill the event by generating another statement", async () => {
    need("statement", "docLatest");
    const second = expectStatus(await pmcm("POST", `/events/${E()}/billing-source`, { ...s.sourceBody, idempotencyKey: idem("second-source"), sourceLabel: "Second source" }), 201);
    expectStatus(await pmcm("PATCH", `/events/${E()}/billing-source/${second.id}/approve`, {}), 200);
    const r = await pmcm("POST", `/events/${E()}/billing-statements/generate`, { sourceId: second.id });
    if (r.status < 300) {
      const total = ((await workspace()).paymentMilestones ?? []).reduce((sum, m) => sum + m.amount, 0);
      review(`second approved source generated statement ${r.body.number}; milestones total ${total} against an approved proposal of 500000. Clarify event-level billing caps and revisions`);
    }
    expect(r.status === 400 || r.status === 409, `${r.status}: ${msg(r)}`);
  });

  // ---------- portal wiring ----------
  const wiring = [
    ["PMCM builds cost estimates and issues proposal versions", "event", /cost-estimates/, "POST /events/:id/cost-estimates, /proposal/versions"],
    ["client reads the proposal and reviews it (approve or request a revision)", "client", /reviewProposal/, "PATCH /events/:id/proposal/review"],
    ["PMCM issues venue and styling options", "event", /client-review-items/, "POST /events/:id/client-review-items"],
    ["client decides venue and styling options", "client", /client-review-items\/\$\{[^}]+\}\/decisions/, "POST .../client-review-items/:id/decisions"],
    ["PMCM creates a billing source", "event", /\.createBillingSource\(|commands\.createBillingSource|createBillingSource\(/, "POST /events/:id/billing-source"],
    ["PMCM picks the proposal document as billing source evidence", "event", /sourceDocumentId/, "sourceDocumentId on POST /events/:id/billing-source"],
    ["PMCM approves a billing source", "event", /approveBillingSource/, "PATCH .../billing-source/:id/approve"],
    ["PMCM generates and sends statements", "event", /generateBillingStatement/, "POST .../billing-statements/generate and /send"],
    ["PMCM records payments", "event", /recordPayment/, "POST .../payments/:id/records"],
    ["PMCM marks a milestone at risk or pending (PATCH payments)", "event", /markPayment|\/payments\/\$\{[^}]+\}`,\s*\{\s*method:\s*"PATCH"/, "PATCH /events/:id/payments/:milestoneId"],
    ["PMCM requests and resolves billing corrections", "event", /billing-corrections/, "POST/PATCH .../billing-corrections"],
    ["PMCM opens and resolves billing disputes", "event", /billing-disputes/, "POST/PATCH .../billing-disputes"],
    ["PMCM issues and waives additional billing", "event", /additional-billing/, "POST .../additional-billing, PATCH .../waive"],
    ["client downloads proposal and statement PDFs", "client", /download-authorization|downloadAuthorization|downloadContent|storage\/objects\/\$\{[^}]+\}\/content/, "GET /storage/objects/:id/content or download-authorization"],
    ["client raises a billing dispute", "client", /billing-disputes/, "POST .../billing-disputes (client)"],
  ];
  for (const [label, app, pattern, endpoint] of wiring) {
    await step(`portal wiring: ${label}`, async () => {
      const files = callers(app, pattern);
      if (!files.length) gap(`API only, no UI: ${endpoint} is not called from apps/${app}/src`);
      return `apps/${app}: ${files.slice(0, 2).join(", ")}`;
    });
  }
}
