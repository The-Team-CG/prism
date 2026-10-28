// Phase 3: suppliers = application, procurement, assignment, contract, readiness, payables, PMCM directory.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import { cfg, http, login, msg, step, startPhase, blocked, gap, review, expect, mailsTo } from "../lib.mjs";

export const name = "Suppliers";

const CAT = "supcat_digital_registration";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const ip = () => `10.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
const need = (...xs) => { if (xs.some((x) => !x)) blocked("an earlier step left nothing to continue with"); };
const is = (r, ...codes) => { if (!codes.includes(r.status)) throw new Error(`expected ${codes.join("/")}, got ${r.status}: ${msg(r)}`); return r.body; };
const text = (v) => JSON.stringify(v ?? null);
const quoteLinkOf = (email) => {
  const mail = mailsTo(email).filter((m) => /Quote request link/.test(m)).pop() ?? "";
  const m = mail.match(/\/quote-requests\/([A-Za-z0-9_-]{32,})/);
  return { mail, token: m?.[1] ?? "" };
};
const inviteTokenOf = (email) => {
  const mail = mailsTo(email).filter((m) => /token=|activate/i.test(m)).pop() ?? "";
  const m = mail.match(/[?&]token=([A-Za-z0-9_\-.~%]{32,})/);
  return { mail, token: m ? decodeURIComponent(m[1]) : "" };
};

/** Real upload flow the supplier portal uses: request, send bytes, confirm. Returns the confirmed stored object. */
async function uploadSupplierDocument(token, { eventId, supplierId, target, fileName = "contract.pdf", contentType = "application/pdf" }) {
  const data = Buffer.from(`%PDF-1.4\n% e2e ${randomUUID()}\n%%EOF\n`);
  const checksum = createHash("sha256").update(data).digest("hex");
  const req = await http("POST", "/storage/objects/upload-request", { token, body: { eventId, ownerRecordType: "supplier", ownerRecordId: supplierId, logicalTarget: target, usage: "supplier_document", fileName, contentType, declaredByteSize: data.length, checksumSha256: checksum, idempotencyKey: randomUUID() } });
  if (req.status >= 300) return { status: req.status, error: msg(req) };
  if (req.body.status === "failed") return { status: 400, error: req.body.reason };
  const put = await fetch(`${cfg.api}/storage/objects/${req.body.object.id}/content`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream", "x-prism-storage-authorization": req.body.location.uploadUrl, "x-forwarded-for": ip() }, body: data });
  if (!put.ok) return { status: put.status, error: `content upload ${put.status}: ${(await put.text()).slice(0, 160)}` };
  const conf = await http("POST", `/storage/objects/${req.body.object.id}/confirm`, { token, body: { checksumSha256: checksum, byteSize: data.length } });
  if (conf.status >= 300) return { status: conf.status, error: `confirm ${conf.status}: ${msg(conf)}` };
  return { status: 200, object: conf.body, checksum };
}

function sourceCorpus(dir) {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push({ path: p, text: readFileSync(p, "utf8") });
    }
  };
  walk(join(ROOT, dir));
  return out;
}
const routeFilesOf = (dir) => {
  const out = [];
  const walk = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const p = join(d, e); out.push(p); if (statSync(p).isDirectory()) walk(p); } };
  walk(join(ROOT, dir));
  return out;
};

export async function run(ctx) {
  startPhase("Suppliers: application, procurement, assignment, contract, readiness, payables");
  const s = {};
  const stamp = Date.now();
  const pw = cfg.password.supplier;
  const call = (method, path, token, body) => http(method, path, { token, body });
  const admin = await ctx.as("admin").catch(() => null);
  const coordinator = await ctx.as("coordinator").catch(() => null);
  const seededSupplier = await ctx.as("supplier").catch(() => null);

  // ------------------------------------------------------------------ 1. supplier application
  const applyBody = (tag, extra = {}) => ({
    companyName: `E2E ${tag} ${stamp}`, contactName: `${tag} Contact`, email: `e2e-sup-${tag.toLowerCase()}-${stamp}@example.test`, phone: "0917 555 0101",
    categoryId: CAT, pastEvents: "Corporate registration desks, 40 events", serviceInclusions: "Kiosks, badge printing, onsite staff", priceRange: "PHP 50k-150k",
    privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, ...extra,
  });
  const apps = {};

  await step("public applicant can load supplier categories", async () => {
    const r = await call("GET", "/supplier-applications/categories");
    const list = is(r, 200);
    expect(Array.isArray(list) && list.some((c) => c.id === CAT), "digital registration category is not offered to applicants");
    return `${list.length} categories`;
  });
  await step("application without privacy consent or with a bad email is rejected with 400", async () => {
    const a = await call("POST", "/supplier-applications", undefined, { ...applyBody("X"), privacyConsentAccepted: false });
    const b = await call("POST", "/supplier-applications", undefined, { ...applyBody("X"), email: "not-an-email" });
    const c = await call("POST", "/supplier-applications", undefined, { companyName: "" });
    expect(a.status === 400 && b.status === 400 && c.status === 400, `statuses ${a.status}/${b.status}/${c.status}`);
  });
  for (const tag of ["A", "B", "C", "D"]) {
    await step(`applicant ${tag} submits a supplier application${tag === "D" ? " without a category" : ""}`, async () => {
      const body = applyBody(tag, tag === "D" ? { categoryId: undefined } : {});
      const r = await call("POST", "/supplier-applications", undefined, body);
      apps[tag] = { ...is(r, 201), email: body.email, company: body.companyName };
      return `${apps[tag].id} status=${apps[tag].status}`;
    });
  }
  await step("applicant receives a confirmation email naming the application id", async () => {
    need(apps.A);
    const mail = mailsTo(apps.A.email).find((m) => m.includes(apps.A.id));
    if (!mail) gap("submission confirmation was not delivered to the local mail log; notification-outbox delivery is gated in this environment");
    expect(/status|track|check/i.test(mail), "confirmation does not tell the applicant how to check status");
  });
  await step("a second application from the same email within 14 days is refused", async () => {
    need(apps.A);
    const r = await call("POST", "/supplier-applications", undefined, applyBody("A"));
    expect(r.status === 400 && /already|days/i.test(msg(r)), `${r.status}: ${msg(r)}`);
  });
  await step("applicant checks status with id and email; wrong email or missing params are refused", async () => {
    need(apps.A);
    const ok = is(await call("GET", `/supplier-applications/status?applicationId=${apps.A.id}&email=${encodeURIComponent(apps.A.email)}`), 200);
    const wrong = await call("GET", `/supplier-applications/status?applicationId=${apps.A.id}&email=${encodeURIComponent("someone@else.test")}`);
    const missing = await call("GET", "/supplier-applications/status");
    expect(wrong.status === 404, `wrong email returned ${wrong.status}`);
    expect(missing.status === 400, `missing params returned ${missing.status}`);
    expect(!/convertedSupplier|declineReason|normalizedEmail|phone/i.test(text(ok)), `status leaks internal fields: ${text(ok).slice(0, 160)}`);
    return `status=${ok.status}`;
  });
  await step("inbox is PMCM-only (anonymous 401, supplier 403, coordinator 403) and lists the applications", async () => {
    need(admin, apps.A);
    expect((await call("GET", "/supplier-applications/inbox")).status === 401, "anonymous inbox read was not 401");
    expect((await call("GET", "/supplier-applications/inbox", seededSupplier)).status === 403, "supplier can read the application inbox");
    expect((await call("GET", "/supplier-applications/inbox", coordinator)).status === 403, "coordinator can read the application inbox");
    const list = is(await call("GET", "/supplier-applications/inbox", admin), 200);
    expect(["A", "B", "C", "D"].every((t) => list.some((a) => a.id === apps[t]?.id)), "not every new application is in the PMCM inbox");
    return `${list.length} applications`;
  });
  await step("review is PMCM-only and validates its body", async () => {
    need(admin, apps.C);
    const path = `/supplier-applications/${apps.C.id}/review`;
    expect((await call("PATCH", path, undefined, { action: "approve" })).status === 401, "anonymous review was not 401");
    expect((await call("PATCH", path, seededSupplier, { action: "approve" })).status === 403, "supplier could review an application");
    expect((await call("PATCH", path, admin, { action: "decline" })).status === 400, "decline without a reason was not 400");
    expect((await call("PATCH", path, admin, { action: "explode" })).status === 400, "unknown action was not 400");
    expect((await call("PATCH", "/supplier-applications/sap_missing/review", admin, { action: "approve" })).status === 404, "unknown application was not 404");
  });
  await step("PMCM requests a proposal from applicant A (in-progress status)", async () => {
    need(admin, apps.A);
    const r = is(await call("PATCH", `/supplier-applications/${apps.A.id}/review`, admin, { action: "request_proposal", notes: "Please send a proposal" }), 200);
    return `status=${r.status}`;
  });
  await step("PMCM schedules a call with applicant B as an alternative triage path", async () => {
    need(admin, apps.B);
    const r = is(await call("PATCH", `/supplier-applications/${apps.B.id}/review`, admin, { action: "schedule" }), 200);
    return `status=${r.status}`;
  });
  await step("going back to request_proposal after scheduling is refused with a clear message", async () => {
    need(admin, apps.B);
    const r = await call("PATCH", `/supplier-applications/${apps.B.id}/review`, admin, { action: "request_proposal" });
    expect(r.status === 400 && msg(r).length > 10, `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  await step("PMCM declines applicant C with a reason; applicant sees declined and a later approve is refused", async () => {
    need(admin, apps.C);
    const d = is(await call("PATCH", `/supplier-applications/${apps.C.id}/review`, admin, { action: "decline", declineReason: "Outside our service area" }), 200);
    expect(d.status === "declined", `status after decline: ${d.status}`);
    const st = is(await call("GET", `/supplier-applications/status?applicationId=${apps.C.id}&email=${encodeURIComponent(apps.C.email)}`), 200);
    const again = await call("PATCH", `/supplier-applications/${apps.C.id}/review`, admin, { action: "approve" });
    expect(again.status === 400, `approve after decline returned ${again.status}`);
    expect(!inviteTokenOf(apps.C.email).token, "a declined applicant received an account invitation");
    return `applicant status=${st.status}`;
  });
  await step("approval without a category is refused", async () => {
    need(admin, apps.D);
    const r = await call("PATCH", `/supplier-applications/${apps.D.id}/review`, admin, { action: "approve" });
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
    return msg(r);
  });
  for (const tag of ["A", "B"]) {
    await step(`PMCM approves applicant ${tag}; a supplier record is created`, async () => {
      need(admin, apps[tag]);
      const r = is(await call("PATCH", `/supplier-applications/${apps[tag].id}/review`, admin, { action: "approve" }), 200);
      apps[tag].supplierId = r.convertedSupplierId ?? `sup_application_${apps[tag].id}`;
      expect(r.status === "approved", `status ${r.status}`);
      const directory = is(await call("GET", "/suppliers", admin), 200);
      const row = (Array.isArray(directory) ? directory : directory.items ?? []).find((x) => x.id === apps[tag].supplierId);
      expect(row, "approved applicant did not become a supplier in the directory");
      return `${apps[tag].supplierId} tier=${row.tier}`;
    });
  }
  await step("approving A again is an idempotent replay and sends no second login", async () => {
    need(admin, apps.A?.supplierId);
    const before = mailsTo(apps.A.email).length;
    const r = is(await call("PATCH", `/supplier-applications/${apps.A.id}/review`, admin, { action: "approve" }), 200);
    expect(r.status === "approved", `replay changed status to ${r.status}`);
    expect(mailsTo(apps.A.email).length === before, "a replayed approval sent another email");
  });
  for (const tag of ["A", "B"]) {
    await step(`applicant ${tag} receives an account invitation, activates it and signs in to the supplier portal`, async () => {
      need(apps[tag]?.supplierId);
      const { token, mail } = inviteTokenOf(apps[tag].email);
      expect(token, `no invitation link in the API log (mails: ${mailsTo(apps[tag].email).map((m) => m.slice(0, 60).replace(/\s+/g, " ")).join(" | ")})`);
      const weak = await call("POST", "/auth/activate", undefined, { token, password: "short" });
      expect(weak.status === 400, `activation accepted a weak password (${weak.status})`);
      is(await call("POST", "/auth/activate", undefined, { token, password: pw }), 200);
      const reuse = await call("POST", "/auth/activate", undefined, { token, password: `${pw}x` });
      expect(reuse.status >= 400 && reuse.status < 500, `reused invitation returned ${reuse.status}`);
      const r = await login(apps[tag].email, pw);
      expect(r.token, r.error);
      expect(r.user?.role === "supplier", `signed in as role ${r.user?.role}`);
      apps[tag].token = r.token;
      return /https?:\/\//.test(mail) ? "link is an absolute URL" : "link has no host";
    });
  }
  await step("account invitation resend is PMCM-only and refused for declined or unknown applications", async () => {
    need(admin, apps.C, apps.A.token);
    const p = (id) => `/supplier-applications/${id}/account-invitation/resend`;
    expect((await call("POST", p(apps.A.id))).status === 401, "anonymous resend was not 401");
    expect((await call("POST", p(apps.A.id), apps.A.token)).status === 403, "supplier could resend an invitation");
    const declined = await call("POST", p(apps.C.id), admin);
    expect(declined.status === 409, `resend for a declined application returned ${declined.status}: ${msg(declined)}`);
    expect((await call("POST", p("sap_missing"), admin)).status === 404, "resend for an unknown application was not 404");
    const approved = await call("POST", p(apps.A.id), admin);
    return `resend for an already-activated approved applicant -> ${approved.status}: ${msg(approved)}`;
  });
  await step("approved applicant sees approved status and an empty supplier workspace", async () => {
    need(apps.A.token);
    const st = is(await call("GET", `/supplier-applications/status?applicationId=${apps.A.id}&email=${encodeURIComponent(apps.A.email)}`), 200);
    expect(st.status === "approved", `status ${st.status}`);
    is(await call("GET", "/supplier/workspace", apps.A.token), 200);
    is(await call("GET", "/supplier/workflows", apps.A.token), 200);
  });

  // ------------------------------------------------------------------ 2. procurement
  await step("a fresh onboarded event is available for procurement", async () => {
    s.ev = await ctx.newEvent({ label: "Suppliers" });
    s.client = await s.ev.as();
    return s.ev.eventId;
  });
  const E = () => s.ev.eventId;
  const quoteBody = () => ({ categoryId: CAT, supplierIds: [apps.A.supplierId, apps.B.supplierId], deadline: "2027-05-01", confidentialBid: true });

  await step("quote request refused for supplier, coordinator, client and anonymous callers", async () => {
    need(s.ev, apps.A.supplierId, apps.A.token);
    const out = [];
    for (const [who, t, want] of [["anon", undefined, 401], ["supplier", apps.A.token, 403], ["coordinator", coordinator, 403], ["client", s.client, 403]]) {
      const r = await call("POST", `/events/${E()}/quote-requests`, t, quoteBody());
      if (r.status !== want) out.push(`${who}=${r.status}`);
    }
    expect(!out.length, `unexpected statuses: ${out.join(", ")}`);
  });
  await step("quote request validates category, suppliers, deadline and event", async () => {
    need(s.ev, admin, apps.A.supplierId);
    const bad = [];
    const check = async (label, r, ...ok) => { if (!ok.includes(r.status)) bad.push(`${label}=${r.status}`); };
    await check("no category", await call("POST", `/events/${E()}/quote-requests`, admin, {}), 400);
    await check("unknown category", await call("POST", `/events/${E()}/quote-requests`, admin, { categoryId: "supcat_nope" }), 404);
    await check("unknown event", await call("POST", "/events/evt_nope/quote-requests", admin, { categoryId: CAT, supplierIds: [apps.A.supplierId] }), 404);
    await check("supplier of another category", await call("POST", `/events/${E()}/quote-requests`, admin, { categoryId: CAT, supplierIds: ["sup_bloom"] }), 400);
    await check("bad deadline", await call("POST", `/events/${E()}/quote-requests`, admin, { categoryId: CAT, supplierIds: [apps.A.supplierId], deadline: "next tuesday" }), 400);
    await check("supplierIds not an array", await call("POST", `/events/${E()}/quote-requests`, admin, { categoryId: CAT, supplierIds: "sup_a" }), 400);
    expect(!bad.length, bad.join(", "));
  });
  await step("PMCM requests quotes from applicants A and B", async () => {
    need(s.ev, admin, apps.A.supplierId, apps.B.supplierId);
    const r = is(await call("POST", `/events/${E()}/quote-requests`, admin, quoteBody()), 201);
    s.reqA = r.find((x) => x.supplierId === apps.A.supplierId);
    s.reqB = r.find((x) => x.supplierId === apps.B.supplierId);
    expect(s.reqA && s.reqB, `requests returned for ${r.map((x) => x.supplierId).join(",")}`);
    s.tokA = s.reqA.accessToken;
    s.tokB = s.reqB.accessToken;
    expect(s.tokA && s.tokB, "PMCM quote request response omitted access tokens");
    return `${r.length} requests, confidentialBid=${s.reqA.confidentialBid}`;
  });
  await step("asking the same suppliers again for the same category is refused", async () => {
    need(s.reqA);
    const r = await call("POST", `/events/${E()}/quote-requests`, admin, quoteBody());
    expect(r.status === 400, `${r.status}: ${msg(r)}`);
  });
  await step("each supplier receives an emailed quote link that matches its own request", async () => {
    need(s.reqA, s.reqB);
    const a = quoteLinkOf(apps.A.email), b = quoteLinkOf(apps.B.email);
    if (!a.token || !b.token) gap("quote-link delivery was not observed locally; the suite uses the API-returned tokens to test quoting independently");
    expect(a.token === s.reqA.accessToken, `A's emailed token ${a.token ? "differs from" : "is missing for"} its request`);
    expect(b.token === s.reqB.accessToken, "B's emailed token differs from its request");
    expect(a.token !== b.token, "both suppliers got the same token");
    s.tokA = a.token; s.tokB = b.token;
    const link = a.mail.match(/Quote request link: (\S+)/)?.[1] ?? "";
    expect(/^https?:\/\//.test(link), `the emailed link is "${link.slice(0, 40)}..." with no host; the supplier portal has no page for it, so a supplier cannot open it from the email`);
  });
  await step("supplier portal has a page that opens the emailed quote link", async () => {
    const hit = routeFilesOf("apps/supplier/src/app").find((p) => /quote/i.test(p.replace(ROOT, "")));
    if (!hit) gap("API only, no UI: GET /quote-requests/:token has no supplier-portal route (the link in the email is a bare /quote-requests/<token> path)");
  });
  await step("supplier reads the request through its token; confidential bids hide client and event details", async () => {
    need(s.tokA);
    const r = is(await call("GET", `/quote-requests/${s.tokA}`), 200);
    expect(r.request?.id === s.reqA.id, "token resolved to another request");
    expect(r.clientName === null && r.eventName === "Confidential event" && r.eventDate === null, `confidential details leaked: ${text({ n: r.eventName, c: r.clientName, d: r.eventDate })}`);
    const privateKeys = ["eventDayVerificationNotes", "eventDayVerifiedBy"].filter((key) => key in r.request);
    expect(!privateKeys.length, `PMCM verification fields are exposed: ${privateKeys.join(", ")}`);
  });
  await step("unknown, truncated and malformed tokens return 404 not 500", async () => {
    need(s.tokA);
    const bad = [];
    for (const t of ["x", "A".repeat(43), s.tokA.slice(0, -2), encodeURIComponent("' OR 1=1 --"), "%00"]) {
      const r = await call("GET", `/quote-requests/${t}`);
      if (r.status !== 404) bad.push(`${t.slice(0, 12)}=${r.status}`);
      const w = await call("POST", `/quote-requests/${t}/quote`, undefined, { amount: 1 });
      if (w.status !== 404) bad.push(`POST ${t.slice(0, 12)}=${w.status}`);
    }
    expect(!bad.length, bad.join(", "));
  });
  await step("quote body is validated: missing, negative, text, fractional and out-of-range amounts give 400", async () => {
    need(s.tokA);
    const validationEvent = await ctx.newEvent({ label: "Supplier validation probe" });
    const requests = is(await call("POST", `/events/${validationEvent.eventId}/quote-requests`, admin, { categoryId: CAT, supplierIds: [apps.A.supplierId], deadline: "2027-06-01" }), 201);
    const invalidToken = requests[0].accessToken;
    const bad = [];
    for (const [label, body] of [["missing amount", {}], ["negative", { amount: -5 }], ["text", { amount: "lots" }], ["fractional", { amount: 1000.5 }], ["beyond 32-bit", { amount: 5_000_000_000 }], ["inclusions not array", { amount: 10, inclusions: "all" }], ["null body", null]]) {
      const r = await http("POST", `/quote-requests/${invalidToken}/quote`, { body });
      if (r.status !== 400) bad.push(`${label}=${r.status}`);
    }
    expect(!bad.length, `expected 400 for: ${bad.join(", ")}`);
  });
  await step("supplier A submits a quote through its token", async () => {
    need(s.tokA);
    const r = is(await http("POST", `/quote-requests/${s.tokA}/quote`, { body: { amount: 80500, inclusions: ["4 kiosks", "badge printing"], paymentTerms: "50% down payment", notes: "A first offer" } }), 201);
    s.quoteA = r;
    expect(r.amount === 80500, `stored amount ${r.amount}`);
    expect(!("outsideAcceptableRange" in r) && !("acceptableMax" in r), "supplier response exposes PMCM acceptable-range data");
    return `${r.id} rev=${r.revisionNumber}`;
  });
  await step("supplier B submits a quote; retrying the identical request does not burn its single revision", async () => {
    need(s.tokB);
    const body = { amount: 91234, inclusions: ["6 kiosks"], paymentTerms: "30% down", notes: "B first offer" };
    const first = is(await http("POST", `/quote-requests/${s.tokB}/quote`, { body }), 201);
    s.quoteB = first;
    const retry = await http("POST", `/quote-requests/${s.tokB}/quote`, { body });
    expect(retry.status < 500, `retry returned ${retry.status}`);
    if (retry.status < 300 && retry.body?.revisionNumber > first.revisionNumber) review(`identical POST consumes revision ${retry.body.revisionNumber}; clarify retry idempotency versus submit-as-revision behavior`);
    return `retry -> ${retry.status}`;
  });
  await step("supplier A revises its quote once, a second revision is refused clearly", async () => {
    need(s.tokA);
    const r = is(await http("PATCH", `/quote-requests/${s.tokA}/quote`, { body: { amount: 78500, notes: "A revised offer" } }), 200);
    expect(r.revisionNumber === 2 && r.amount === 78500, `rev=${r.revisionNumber} amount=${r.amount}`);
    s.quoteA = r;
    const again = await http("PATCH", `/quote-requests/${s.tokA}/quote`, { body: { amount: 70000 } });
    expect(again.status === 400 && /revised/i.test(msg(again)), `${again.status}: ${msg(again)}`);
  });
  await step("a supplier can submit or revise only through its own request, and revision before any quote is 404", async () => {
    need(s.tokA, s.reqA);
    const r = await http("PATCH", `/quote-requests/${"Z".repeat(43)}/quote`, { body: { amount: 1 } });
    expect(r.status === 404, `revise on unknown token returned ${r.status}`);
  });
  await step("supplier A's workspace shows only A's own request and bid (never B's)", async () => {
    need(apps.A.token, s.reqA, s.reqB, s.quoteB);
    for (const path of ["/supplier/workspace", "/supplier/workflows", "/supplier/readiness-board"]) {
      const body = text(await call("GET", path, apps.A.token).then((r) => (r.status === 200 ? r.body : { error: r.status })));
      expect(!body.includes('"error"'), `${path} did not return 200`);
      const leaks = [apps.B.company, "91234", s.reqB.id, s.reqB.accessToken, apps.B.supplierId, s.quoteB.id].filter((x) => body.includes(x));
      expect(!leaks.length, `${path} exposes supplier B data: ${leaks.join(", ")}`);
      if (path === "/supplier/workspace") expect(body.includes(s.reqA.id), "A's own request is missing from its workspace");
      if (path === "/supplier/workspace") s.ownWorkspaceHasToken = body.includes(s.reqA.accessToken);
    }
  });
  await step("a logged-in supplier gets its quote link from the workspace (no emailed link needed)", async () => {
    need(apps.A.token, s.quoteA);
    if (!s.ownWorkspaceHasToken) gap("the supplier workspace does not expose the request access token, so a signed-in supplier can only quote through the emailed link");
  });
  await step("PMCM event workspace lists both bids and exposes the quote round", async () => {
    need(admin, s.quoteA, s.quoteB);
    const body = text(is(await call("GET", `/pmcm/events/${E()}/workspace`, admin), 200));
    expect(body.includes(s.quoteA.id) && body.includes(s.quoteB.id), "PMCM workspace does not list both submitted bids");
    s.roundId = body.match(/round_[0-9a-f-]{36}/)?.[0];
    if (!s.roundId) gap("no PMCM read model returns the quote round id, so the comparison route (GET /events/:id/quote-rounds/:roundId/comparison) cannot be reached from the UI");
  });
  await step("PMCM compares the round: both bids with amounts; others cannot", async () => {
    need(admin, s.reqA);
    if (!s.roundId) blocked("round id unavailable");
    const r = is(await call("GET", `/events/${E()}/quote-rounds/${s.roundId}/comparison`, admin), 200);
    expect(r.bids?.length === 2 && r.bids.some((b) => b.amount === 78500) && r.bids.some((b) => b.amount === 91234), `bids: ${text(r.bids?.map((b) => b.amount))}`);
    for (const [who, t, want] of [["anon", undefined, 401], ["supplier", apps.B.token, 403], ["client", s.client, 403]]) {
      const x = await call("GET", `/events/${E()}/quote-rounds/${s.roundId}/comparison`, t);
      expect(x.status === want, `${who} comparison returned ${x.status}`);
    }
    return `round ${r.roundNumber}, ${r.bids.length} bids`;
  });
  await step("selecting a quote is PMCM-only and validates the quote", async () => {
    need(s.quoteA);
    const path = `/events/${E()}/supplier-quotes/${s.quoteA.id}/select`;
    expect((await call("PATCH", path)).status === 401, "anonymous select was not 401");
    expect((await call("PATCH", path, apps.A.token)).status === 403, "supplier could select its own quote");
    expect((await call("PATCH", path, s.client)).status === 403, "client could select a quote");
    expect((await call("PATCH", `/events/${E()}/supplier-quotes/quote_missing/select`, admin)).status === 404, "unknown quote was not 404");
    const other = await ctx.newEvent({ label: "SuppliersX" });
    expect((await call("PATCH", `/events/${other.eventId}/supplier-quotes/${s.quoteA.id}/select`, admin)).status === 404, "selecting a quote through another event was not 404");
  });
  await step("PMCM selects A's quote; the selection is idempotent", async () => {
    need(admin, s.quoteA);
    const path = `/events/${E()}/supplier-quotes/${s.quoteA.id}/select`;
    const r = is(await call("PATCH", path, admin), 200);
    expect(r.status === "selected" && r.lockedAt, `status ${r.status}`);
    const again = is(await call("PATCH", path, admin), 200);
    expect(again.status === "selected", `replay status ${again.status}`);
    s.selected = true;
  });
  await step("the other supplier's request is released: closed, bid not selected, no further quoting", async () => {
    need(s.tokB, s.quoteB);
    const d = is(await call("GET", `/quote-requests/${s.tokB}`), 200);
    expect(d.request.status === "closed", `B's request status is ${d.request.status}`);
    expect(d.quote?.status === "not_selected", `B's bid status is ${d.quote?.status}`);
    const rev = await http("PATCH", `/quote-requests/${s.tokB}/quote`, { body: { amount: 1 } });
    expect(rev.status === 400, `B revising after release returned ${rev.status}`);
  });
  await step("selecting the released bid afterwards is refused with a clear message", async () => {
    need(s.quoteB);
    const probe = await ctx.newEvent({ label: "Supplier reselection probe" });
    const requests = is(await call("POST", `/events/${probe.eventId}/quote-requests`, admin, { categoryId: CAT, supplierIds: [apps.A.supplierId, apps.B.supplierId], deadline: "2027-06-01" }), 201);
    const quotes = [];
    for (const request of requests) quotes.push(is(await call("POST", `/quote-requests/${request.accessToken}/quote`, undefined, { amount: 50000 }), 201));
    is(await call("PATCH", `/events/${probe.eventId}/supplier-quotes/${quotes[0].id}/select`, admin), 200);
    const r = await call("PATCH", `/events/${probe.eventId}/supplier-quotes/${quotes[1].id}/select`, admin);
    if (r.status < 400) review("PMCM can select a previously released bid, replacing the winner; clarify whether this is an intentional reselection workflow");
    expect(r.status < 500, `${r.status}: ${msg(r)}`);
  });
  await step("the unsuccessful supplier is told it was not selected", async () => {
    need(s.reqB, s.quoteB, s.selected);
    const mails = mailsTo(apps.B.email);
    const told = mails.some((m) => /not selected|unsuccessful|released|closed|regret/i.test(m) && !/Quote request link/.test(m));
    if (!told) gap("no notification reaches the unsuccessful supplier when another bid is selected (only the winner is notified)");
  });
  await step("the selected supplier is notified of its selection", async () => {
    need(s.reqA, s.selected);
    if (!mailsTo(apps.A.email).some((m) => /selected/i.test(m))) gap("selection email was not delivered locally; outbox/provider delivery needs separate verification");
  });

  // ------------------------------------------------------------------ 3. assignment, contract, schedule, readiness
  const A = () => apps.A.token;
  await step("before the assignment is confirmed, contract, schedule, readiness and event-day updates are refused", async () => {
    need(s.reqA, A());
    const bad = [];
    const expectNot2xx = (label, r) => { if (r.status < 400 || r.status >= 500) bad.push(`${label}=${r.status}`); };
    expectNot2xx("upload request", await call("POST", "/storage/objects/upload-request", A(), { eventId: E(), ownerRecordType: "supplier", ownerRecordId: apps.A.supplierId, logicalTarget: `supplier-contract:${s.reqA.id}:${randomUUID()}`, usage: "supplier_document", fileName: "c.pdf", contentType: "application/pdf", declaredByteSize: 10, checksumSha256: "a".repeat(64) }));
    expectNot2xx("bind contract", await call("POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: "obj_nope", checksumSha256: "a".repeat(64) }));
    expectNot2xx("schedule", await call("POST", `/events/${E()}/supplier-schedules`, admin, { requestId: s.reqA.id, ingressAt: "2027-06-15T06:00:00+08:00", egressAt: "2027-06-15T22:00:00+08:00" }));
    expectNot2xx("readiness", await call("PATCH", `/supplier/quote-requests/${s.reqA.id}/readiness/confirm`, A(), { notes: "ready" }));
    expectNot2xx("event status", await call("PATCH", `/supplier/quote-requests/${s.reqA.id}/event-status`, A(), { status: "arrived" }));
    expect(!bad.length, `not refused with a 4xx: ${bad.join(", ")}`);
  });
  await step("only the selected supplier may confirm the assignment (other supplier 403, PMCM 403, anonymous 401)", async () => {
    need(s.reqA, apps.B.token);
    const p = `/supplier/quote-requests/${s.reqA.id}/assignment/confirm`;
    expect((await call("PATCH", p)).status === 401, "anonymous confirm was not 401");
    expect((await call("PATCH", p, apps.B.token)).status === 403, "another supplier could confirm A's assignment");
    expect((await call("PATCH", p, admin)).status === 403, "PMCM could confirm on the supplier's behalf");
    expect((await call("PATCH", p, seededSupplier)).status === 403, "an unrelated seeded supplier could confirm");
    const own = await call("PATCH", `/supplier/quote-requests/${s.reqB.id}/assignment/confirm`, apps.B.token);
    expect(own.status === 400, `B confirming a released request returned ${own.status}: ${msg(own)}`);
  });
  await step("supplier A confirms the assignment; a retry is refused clearly, not 500", async () => {
    need(s.selected);
    need(s.reqA);
    const p = `/supplier/quote-requests/${s.reqA.id}/assignment/confirm`;
    const r = is(await call("PATCH", p, A()), 200);
    expect(r.assignmentStatus === "confirmed", `assignment ${r.assignmentStatus}`);
    const again = await call("PATCH", p, A());
    expect(again.status < 500, `retry returned ${again.status}`);
    s.assigned = true;
    return `retry -> ${again.status} ${again.status >= 400 ? msg(again) : "(idempotent)"}`;
  });
  await step("another supplier's request id is refused (403/404) on every supplier-side action", async () => {
    need(s.assigned, apps.B.token);
    const id = s.reqA.id, bad = [];
    const tries = [
      ["readiness", "PATCH", `/supplier/quote-requests/${id}/readiness/confirm`, {}],
      ["event status", "PATCH", `/supplier/quote-requests/${id}/event-status`, { status: "arrived" }],
      ["bind contract", "POST", `/supplier/quote-requests/${id}/contracts`, { storedObjectId: "obj_x", checksumSha256: "a".repeat(64) }],
      ["metadata contract", "POST", `/supplier/quote-requests/${id}/contract`, { fileName: "c.pdf", idempotencyKey: "k1" }],
      ["ack schedule", "POST", `/supplier/quote-requests/${id}/schedule/acknowledgement`, { expectedRevision: 1 }],
      ["change request", "POST", `/supplier/quote-requests/${id}/schedule/change-request`, { expectedRevision: 1, reason: "x" }],
    ];
    for (const [label, m, p, b] of tries) {
      const r = await call(m, p, apps.B.token, b);
      if (![403, 404].includes(r.status)) bad.push(`${label}=${r.status}`);
    }
    expect(!bad.length, bad.join(", "));
  });
  let contractV1, contractV2;
  await step("supplier uploads a contract file (request, bytes, confirm) and binds it as version 1", async () => {
    need(s.assigned);
    const up = await uploadSupplierDocument(A(), { eventId: E(), supplierId: apps.A.supplierId, target: `supplier-contract:${s.reqA.id}:${randomUUID()}` });
    expect(up.object, `upload failed (${up.status}): ${up.error}`);
    const bad = await call("POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: up.object.id, checksumSha256: "b".repeat(64) });
    expect(bad.status === 400, `bind with a wrong checksum returned ${bad.status}`);
    const extra = await call("POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: up.object.id, checksumSha256: up.checksum, extra: 1 });
    expect(extra.status === 400, `bind with an unknown field returned ${extra.status}`);
    const r = is(await call("POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: up.object.id, checksumSha256: up.checksum }), 200, 201);
    contractV1 = r.contract ?? r;
    s.contractObj1 = up;
    return `${text(Object.keys(r)).slice(0, 80)}`;
  });
  await step("binding the same file twice returns the same version", async () => {
    need(contractV1, s.contractObj1);
    const r = is(await call("POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: s.contractObj1.object.id, checksumSha256: s.contractObj1.checksum }), 200, 201);
    const again = r.contract ?? r;
    expect(again.id === contractV1.id || again.version === contractV1.version, `second bind created ${again.id} v${again.version}`);
  });
  await step("PMCM sees the contract in the event's supplier workflow; it is read-only for others", async () => {
    need(contractV1);
    const w = is(await call("GET", `/events/${E()}/supplier-workflows`, admin), 200);
    const row = w.find((x) => x.requestId === s.reqA.id);
    expect(row?.contracts?.length >= 1, "PMCM workflow does not list the supplier's contract");
    contractV1 = row.contracts[0];
    expect(contractV1.reviewStatus === "submitted", `review status ${contractV1.reviewStatus}`);
    expect(!w.some((x) => x.requestId === s.reqB.id), "the released supplier appears in the assigned-supplier workflow");
    expect((await call("GET", `/events/${E()}/supplier-workflows`, A())).status === 403, "supplier can read the PMCM workflow of the event");
  });
  await step("PMCM requests changes on contract v1 (reason required), supplier uploads v2, v1 can no longer be reviewed", async () => {
    need(contractV1);
    const rv = (id) => `/supplier/contracts/${id}/review`;
    expect((await call("PATCH", rv(contractV1.id), A(), { decision: "accepted", reason: "" })).status === 403, "supplier could review its own contract");
    expect((await call("PATCH", rv(contractV1.id), admin, { decision: "changes_requested", reason: "" })).status === 400, "changes_requested without reason was not 400");
    expect((await call("PATCH", rv(contractV1.id), admin, { decision: "maybe", reason: "x" })).status === 400, "unknown decision was not 400");
    is(await call("PATCH", rv(contractV1.id), admin, { decision: "changes_requested", reason: "Payment terms clause is missing" }), 200);
    const up = await uploadSupplierDocument(A(), { eventId: E(), supplierId: apps.A.supplierId, target: `supplier-contract:${s.reqA.id}:${randomUUID()}`, fileName: "contract-v2.pdf" });
    expect(up.object, `v2 upload failed (${up.status}): ${up.error}`);
    const r = is(await call("POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: up.object.id, checksumSha256: up.checksum }), 200, 201);
    contractV2 = r.contract ?? r;
    expect(contractV2.version === 2, `second upload is version ${contractV2.version}`);
    const stale = await call("PATCH", rv(contractV1.id), admin, { decision: "accepted", reason: "" });
    expect(stale.status === 400, `reviewing the replaced version returned ${stale.status}`);
  });
  await step("PMCM accepts contract v2; a second decision is refused", async () => {
    need(contractV2);
    const p = `/supplier/contracts/${contractV2.id}/review`;
    const r = is(await call("PATCH", p, admin, { decision: "accepted", reason: "Looks good" }), 200);
    expect(text(r).includes("accepted"), `review result ${text(r).slice(0, 120)}`);
    const again = await call("PATCH", p, admin, { decision: "accepted", reason: "Looks good" });
    expect(again.status === 400, `second review returned ${again.status}`);
    expect((await call("PATCH", "/supplier/contracts/ctv_missing/review", admin, { decision: "accepted", reason: "" })).status === 404, "unknown contract version was not 404");
  });
  await step("the older metadata-only contract route registers a contract without any file bytes", async () => {
    need(s.assigned);
    const path = `/supplier/quote-requests/${s.reqA.id}/contract`;
    const trav = await call("POST", path, A(), { fileName: "../../etc/passwd", idempotencyKey: randomUUID() });
    const r = await call("POST", path, A(), { fileName: "meta-only.pdf", mimeType: "application/pdf", sizeBytes: 1234, idempotencyKey: randomUUID() });
    expect(trav.status < 500 && r.status < 500, `server error ${trav.status}/${r.status}`);
    if (r.status < 300) throw new Error(`POST /supplier/quote-requests/:id/contract accepts bare metadata (fileName/size) and records a contract document with no uploaded bytes, bypassing the checksum-verified upload and PMCM review path; path traversal name -> ${trav.status}`);
  });
  const sched = { requestId: undefined, ingressAt: "2027-06-15T06:00:00+08:00", egressAt: "2027-06-15T22:00:00+08:00", location: "Loading dock B", notes: "Use the service lift" };
  await step("ingress/egress schedule is PMCM-only and validated", async () => {
    need(s.assigned);
    sched.requestId = s.reqA.id;
    const p = `/events/${E()}/supplier-schedules`;
    expect((await call("POST", p, A(), sched)).status === 403, "supplier could create a schedule");
    expect((await call("POST", p, s.client, sched)).status === 403, "client could create a schedule");
    expect((await call("POST", p, undefined, sched)).status === 401, "anonymous schedule create was not 401");
    expect((await call("POST", p, admin, { ...sched, egressAt: sched.ingressAt })).status === 400, "egress == ingress was not 400");
    expect((await call("POST", p, admin, { ...sched, ingressAt: "tomorrow" })).status === 400, "bad datetime was not 400");
    expect((await call("POST", p, admin, { ...sched, requestId: s.reqB.id })).status === 400, "schedule for a released supplier was not 400");
    expect((await call("POST", p, admin, { ...sched, requestId: undefined })).status === 400, "missing request id was not 400");
  });
  await step("PMCM schedules A's ingress and egress; an identical resubmit does not bump the revision", async () => {
    need(s.assigned);
    const p = `/events/${E()}/supplier-schedules`;
    is(await call("POST", p, admin, sched), 201);
    is(await call("POST", p, admin, sched), 200, 201);
    const mine = is(await call("GET", "/supplier/workflows", A()), 200);
    const sc = mine.schedules.find((x) => x.requestId === s.reqA.id);
    expect(sc, "supplier cannot see its schedule");
    expect(sc.revision === 1, `revision is ${sc.revision} after an identical resubmit`);
    const list = is(await call("GET", p, admin), 200);
    expect(text(list).includes(s.reqA.id), "PMCM schedule list does not include the schedule");
    expect((await call("GET", p, A())).status === 403, "supplier can list every supplier's schedule");
  });
  await step("supplier acknowledges the schedule: stale revision refused, other supplier refused", async () => {
    need(s.assigned);
    const ack = `/supplier/quote-requests/${s.reqA.id}/schedule/acknowledgement`;
    expect((await call("POST", ack, A(), { expectedRevision: 99 })).status === 400, "stale revision was not refused");
    expect((await call("POST", ack, A(), { expectedRevision: "one" })).status === 400, "non-numeric revision was not 400");
    expect((await call("POST", ack, apps.B.token, { expectedRevision: 1 })).status === 403, "other supplier could acknowledge");
    const r = is(await call("POST", ack, A(), { expectedRevision: 1 }), 200, 201);
    const again = await call("POST", ack, A(), { expectedRevision: 1 });
    expect(again.status < 500, `acknowledgement retry returned ${again.status}`);
    return `retry -> ${again.status}`;
  });
  await step("supplier requests a schedule change; PMCM reissues the times and the old revision goes stale", async () => {
    need(s.assigned);
    const chg = `/supplier/quote-requests/${s.reqA.id}/schedule/change-request`;
    expect((await call("POST", chg, A(), { expectedRevision: 1, reason: "" })).status === 400, "empty reason was not 400");
    is(await call("POST", chg, A(), { expectedRevision: 1, reason: "Truck cannot arrive before 8am" }), 200, 201);
    is(await call("POST", `/events/${E()}/supplier-schedules`, admin, { ...sched, ingressAt: "2027-06-15T08:00:00+08:00" }), 201, 200);
    const stale = await call("POST", `/supplier/quote-requests/${s.reqA.id}/schedule/acknowledgement`, A(), { expectedRevision: 1 });
    expect(stale.status === 400, `acknowledging the superseded revision returned ${stale.status}`);
    is(await call("POST", `/supplier/quote-requests/${s.reqA.id}/schedule/acknowledgement`, A(), { expectedRevision: 2 }), 200, 201);
  });
  await step("readiness confirmation: only the supplier, body validated", async () => {
    need(s.assigned);
    const p = `/supplier/quote-requests/${s.reqA.id}/readiness/confirm`;
    expect((await call("PATCH", p, admin, {})).status === 403, "PMCM could confirm readiness for the supplier");
    expect((await call("PATCH", p, apps.B.token, {})).status === 403, "other supplier could confirm readiness");
    expect((await call("PATCH", p, A(), { notes: 42 })).status === 400, "numeric notes were not 400");
    const r = is(await call("PATCH", p, A(), { notes: "Crew of 6, kiosks tested" }), 200);
    expect(r.readinessStatus === "confirmed", `readiness ${r.readinessStatus}`);
    s.ready = true;
  });
  await step("PMCM supplier-readiness read model shows A as ready; supplier and client cannot read it", async () => {
    need(s.ready);
    const p = `/pmcm/events/${E()}/supplier-readiness`;
    const r = is(await call("GET", p, admin), 200);
    expect(text(r).includes(s.reqA.id) || text(r).includes(apps.A.company), "supplier is not in the PMCM readiness view");
    expect((await call("GET", p, A())).status === 403, "supplier can read the PMCM readiness view");
    expect((await call("GET", p, s.client)).status === 403, "client can read the PMCM supplier readiness view");
  });
  await step("creative sub-task creation is PMCM-only, validated and idempotent", async () => {
    need(s.assigned);
    const p = `/events/${E()}/supplier-creative-tasks`;
    s.taskKey = randomUUID();
    const body = { requestId: s.reqA.id, idempotencyKey: s.taskKey, title: "Welcome banner artwork", brief: "Print-ready banner, 3x1m, brand colours", dueAt: "2027-06-01T00:00:00.000Z" };
    expect((await call("POST", p, A(), body)).status === 403, "supplier could create a creative task");
    expect((await call("POST", p, admin, { ...body, idempotencyKey: "not-a-uuid" })).status === 400, "non-uuid idempotency key was not 400");
    expect((await call("POST", p, admin, { ...body, title: "" })).status === 400, "empty title was not 400");
    expect((await call("POST", p, admin, { ...body, requestId: s.reqB.id, idempotencyKey: randomUUID() })).status === 400, "task for a released supplier was not 400");
    const t = is(await call("POST", p, admin, body), 201, 200);
    const replay = is(await call("POST", p, admin, body), 201, 200);
    expect(replay.id === t.id, "replaying the same idempotency key created a second task");
    const reuse = await call("POST", p, admin, { ...body, title: "Different title" });
    expect(reuse.status === 400, `key reuse with different content returned ${reuse.status}`);
    s.task = t;
    return `${t.id} status=${t.status}`;
  });
  await step("supplier progresses and submits the creative task; other suppliers cannot touch it", async () => {
    need(s.task);
    const t = s.task.id;
    expect((await call("PATCH", `/supplier/creative-tasks/${t}/progress`, apps.B.token, { note: "x" })).status === 403, "other supplier could update progress");
    expect((await call("POST", `/supplier/creative-tasks/${t}/submissions`, apps.B.token, { note: "x" })).status === 403, "other supplier could submit");
    expect((await call("PATCH", `/supplier/creative-tasks/${t}/progress`, admin, { note: "x" })).status === 403, "PMCM could post supplier progress");
    expect((await call("POST", `/supplier/creative-tasks/${t}/submissions`, A(), { note: "" })).status === 400, "empty submission was not 400");
    const p = is(await call("PATCH", `/supplier/creative-tasks/${t}/progress`, A(), { note: "Drafting layout" }), 200);
    expect(p.status === "in_progress", `status after progress ${p.status}`);
    const sub = is(await call("POST", `/supplier/creative-tasks/${t}/submissions`, A(), { note: "First draft attached" }), 200, 201);
    expect(sub.status === "submitted", `status after submit ${sub.status}`);
    const progressLate = await call("PATCH", `/supplier/creative-tasks/${t}/progress`, A(), { note: "more" });
    expect(progressLate.status === 400, `progress on a submitted task returned ${progressLate.status}`);
  });
  await step("PMCM returns the draft with a note, supplier resubmits with a file, PMCM accepts", async () => {
    need(s.task);
    const t = s.task.id, rv = `/supplier/creative-tasks/${t}/review`;
    expect((await call("PATCH", rv, A(), { status: "accepted", reviewNote: "self" })).status === 403, "supplier could accept its own deliverable");
    expect((await call("PATCH", rv, admin, { status: "accepted" })).status === 400, "accept without a note was not 400");
    expect((await call("PATCH", rv, admin, { status: "open", reviewNote: "x" })).status === 400, "unsupported review status was not 400");
    const back = is(await call("PATCH", rv, admin, { status: "changes_requested", reviewNote: "Logo is too small" }), 200);
    expect(back.status === "changes_requested", `status ${back.status}`);
    const up = await uploadSupplierDocument(A(), { eventId: E(), supplierId: apps.A.supplierId, target: `supplier-creative:${s.reqA.id}:${randomUUID()}`, fileName: "banner-v2.pdf" });
    expect(up.object, `creative upload failed (${up.status}): ${up.error}`);
    is(await call("POST", `/supplier/creative-tasks/${t}/submissions`, A(), { storedObjectId: up.object.id, note: "Revised banner" }), 200, 201);
    const ok = is(await call("PATCH", rv, admin, { status: "accepted", reviewNote: "Approved for print" }), 200);
    expect(ok.status === "accepted", `status ${ok.status}`);
    const again = await call("PATCH", rv, admin, { status: "accepted", reviewNote: "again" });
    expect(again.status === 400, `second accept returned ${again.status}`);
  });
  await step("event-day: reporting 'done leaving' before 'arrived' is refused", async () => {
    need(s.ready);
    const r = await call("PATCH", `/supplier/quote-requests/${s.reqA.id}/event-status`, A(), { status: "done_leaving" });
    if (r.status < 400) review(`supplier can report done_leaving as its first status (${r.status}); clarify status correction versus strict ordering`);
    expect(r.status < 500, `${r.status}: ${msg(r)}`);
  });
  await step("event-day status updates: invalid status 400, other roles 403, valid sequence accepted", async () => {
    need(s.ready);
    const p = `/supplier/quote-requests/${s.reqA.id}/event-status`;
    expect((await call("PATCH", p, A(), { status: "teleported" })).status === 400, "unknown status was not 400");
    expect((await call("PATCH", p, apps.B.token, { status: "arrived" })).status === 403, "other supplier could report status");
    expect((await call("PATCH", p, admin, { status: "arrived" })).status === 403, "PMCM could report status as the supplier");
    expect((await call("PATCH", p, undefined, { status: "arrived" })).status === 401, "anonymous status update was not 401");
    for (const st of ["arrived", "set_up_ready", "done_leaving"]) {
      const r = is(await call("PATCH", p, A(), { status: st, notes: `status ${st}` }), 200);
      expect(r.eventDayStatus === st, `status is ${r.eventDayStatus}, expected ${st}`);
    }
  });
  await step("PMCM verifies the supplier's status with a private note; supplier cannot", async () => {
    need(s.ready);
    const p = `/events/${E()}/supplier-status/${s.reqA.id}/verify`;
    s.verifyNote = `PRIVVER-${stamp}`;
    expect((await call("PATCH", p, A(), { verificationStatus: "verified", notes: s.verifyNote })).status === 403, "supplier could verify its own status");
    expect((await call("PATCH", p, admin, { verificationStatus: "maybe" })).status === 400, "unknown verification status was not 400");
    const r = is(await call("PATCH", p, admin, { verificationStatus: "verified", notes: s.verifyNote }), 200);
    expect(text(r).includes("verified"), "verification result does not show verified");
  });

  // ------------------------------------------------------------------ payables
  await step("payable milestones are PMCM-only, validated, idempotent and capped by the locked quote", async () => {
    need(s.assigned, s.quoteA);
    const p = `/events/${E()}/supplier-payable-milestones`;
    const mk = (label, amount, key) => ({ requestId: s.reqA.id, quoteId: s.quoteA.id, label, amount, dueDate: "2027-06-01T00:00:00.000Z", idempotencyKey: key });
    expect((await call("POST", p, A(), mk("Deposit", 100, "k"))).status === 403, "supplier could create a payable");
    expect((await call("POST", p, s.client, mk("Deposit", 100, "k"))).status === 403, "client could create a payable");
    expect((await call("POST", p, admin, mk("Deposit", -5, "k"))).status === 400, "negative amount was not 400");
    expect((await call("POST", p, admin, mk("Deposit", 10.5, "k"))).status === 400, "fractional amount was not 400");
    expect((await call("POST", p, admin, { ...mk("Deposit", 100, "k"), quoteId: s.quoteB.id })).status === 400, "payable against the released quote was not 400");
    expect((await call("POST", p, admin, mk("Too much", 78501, `over-${stamp}`))).status === 400, "payable above the quote total was not 400");
    const m1 = is(await call("POST", p, admin, mk("Deposit 50%", 39250, `pay1-${stamp}`)), 201, 200);
    const replay = is(await call("POST", p, admin, mk("Deposit 50%", 39250, `pay1-${stamp}`)), 201, 200);
    expect(replay.id === m1.id, "same idempotency key created a second milestone");
    expect((await call("POST", p, admin, mk("Different", 1000, `pay1-${stamp}`))).status === 400, "key reuse with different content was not 400");
    s.m1 = m1;
    s.m2 = is(await call("POST", p, admin, mk("Balance 50%", 39250, `pay2-${stamp}`)), 201, 200);
    expect((await call("POST", p, admin, mk("Beyond", 1, `pay3-${stamp}`))).status === 400, "milestones beyond the quote total were accepted");
    return `${m1.id} status=${m1.status}`;
  });
  await step("payout release: PMCM-only, partial then full, capped by balance, idempotent", async () => {
    need(s.m1);
    const p = `/supplier-payable-milestones/${s.m1.id}/releases`;
    const paymentDate = new Date().toISOString();
    const body = (amount, key, extra = {}) => ({ amount, paymentDate, method: "Bank Transfer", referenceNumber: `REF-${key}`, idempotencyKey: key, notes: `PRIVNOTE-${stamp}`, ...extra });
    expect((await call("POST", p, A(), body(100, "rk"))).status === 403, "supplier could release its own payout");
    expect((await call("POST", p, s.client, body(100, "rk"))).status === 403, "client could release a supplier payout");
    expect((await call("POST", p, admin, body(0, "rk"))).status === 400, "zero amount was not 400");
    expect((await call("POST", p, admin, body(100, "rk", { paymentDate: "yesterday" }))).status === 400, "bad payment date was not 400");
    expect((await call("POST", p, admin, body(39251, `over-${stamp}`))).status === 400, "over-release was not 400");
    const part = is(await call("POST", p, admin, body(10000, `rel1-${stamp}`)), 200, 201);
    expect(part.status === "partially_released" && part.amountReleased === 10000, `after partial: ${part.status} ${part.amountReleased}`);
    const replay = is(await call("POST", p, admin, body(10000, `rel1-${stamp}`)), 200, 201);
    expect(replay.amountReleased === 10000, `replay released ${replay.amountReleased}; the same key paid twice`);
    expect((await call("POST", p, admin, body(5000, `rel1-${stamp}`))).status === 400, "key reuse with another amount was not 400");
    const rest = is(await call("POST", p, admin, body(29250, `rel2-${stamp}`)), 200, 201);
    expect(rest.status === "released" && rest.remainingBalance === 0, `after full: ${rest.status} remaining ${rest.remainingBalance}`);
    expect((await call("POST", p, admin, body(1, `rel3-${stamp}`))).status === 400, "release on a fully paid milestone was accepted");
    s.m1 = rest;
    s.release = rest.history.find((h) => h.kind === "release" && h.amount === 10000);
  });
  await step("payout reversal: PMCM-only, restores the balance, replay is harmless, reversals cannot be reversed", async () => {
    need(s.release);
    const p = `/supplier-payout-records/${s.release.id}/reversal`;
    const body = { paymentDate: new Date().toISOString(), reason: `Wrong account PRIVREASON-${stamp}`, idempotencyKey: `rev1-${stamp}` };
    expect((await call("POST", p, A(), body)).status === 403, "supplier could reverse a payout");
    expect((await call("POST", p, admin, { ...body, reason: "" })).status === 400, "reversal without a reason was not 400");
    const r = is(await call("POST", p, admin, body), 200, 201);
    expect(r.status === "partially_released" && r.amountReleased === 29250, `after reversal: ${r.status} released ${r.amountReleased}`);
    const replay = is(await call("POST", p, admin, body), 200, 201);
    expect(replay.amountReleased === 29250, `replay changed released to ${replay.amountReleased}`);
    const rev = r.history.find((h) => h.kind === "reversal");
    expect((await call("POST", `/supplier-payout-records/${rev.id}/reversal`, admin, { ...body, idempotencyKey: `rev2-${stamp}` })).status === 404, "a reversal record could itself be reversed");
    s.m1 = r;
  });
  await step("supplier sees only its own payables; PMCM-only data stays out of its view", async () => {
    need(s.m1, apps.B.token);
    const mine = is(await call("GET", "/supplier/workflows", A()), 200);
    expect(mine.payables.length === 2 && mine.payables.every((x) => x.requestId === s.reqA.id), `supplier sees ${mine.payables.length} payables`);
    const other = is(await call("GET", "/supplier/workflows", apps.B.token), 200);
    expect(other.payables.length === 0 && other.schedules.length === 0 && other.contracts.length === 0 && other.creativeTasks.length === 0, "supplier B sees A's workflow records");
    const raw = text(mine);
    const scheduled = mine.payables.filter((x) => x.status === "scheduled").length;
    const notes = [`PRIVNOTE-${stamp}`, `PRIVREASON-${stamp}`].filter((x) => raw.includes(x));
    return `${scheduled} unreleased payable(s) visible; PMCM-written strings visible to supplier: ${notes.length ? "release notes/reversal reason" : "none"}`;
  });

  // ------------------------------------------------------------------ 4. PMCM directory
  await step("PMCM directory, profile, reviews, certifications, records and engagements load for admin only", async () => {
    need(admin, apps.A.supplierId, A());
    const id = apps.A.supplierId;
    const paths = ["/suppliers/directory?q=E2E", `/suppliers/${id}/profile`, `/suppliers/${id}/reviews`, `/suppliers/${id}/certifications`, `/suppliers/${id}/records`, `/pmcm/suppliers/${id}/engagements`, "/suppliers"];
    const bad = [];
    for (const p of paths) {
      const a = await call("GET", p, admin);
      if (a.status !== 200) bad.push(`admin ${p}=${a.status} ${msg(a)}`);
      for (const [who, t] of [["supplier", A()], ["other supplier", seededSupplier], ["client", s.client], ["coordinator", coordinator]]) {
        const r = await call("GET", p, t);
        if (r.status !== 403) bad.push(`${who} ${p}=${r.status}`);
      }
      if ((await call("GET", p)).status !== 401) bad.push(`anon ${p}`);
    }
    expect(!bad.length, bad.slice(0, 5).join("; "));
    const eng = await call("GET", `/pmcm/suppliers/${id}/engagements`, admin);
    expect(text(eng.body).includes(E()), "A's engagement history does not list the event it was assigned to");
  });
  await step("a new supplier cannot bypass completed-event promotion through a direct tier change", async () => {
    need(admin, apps.A.supplierId);
    const p = `/suppliers/${apps.A.supplierId}/tier`;
    expect((await call("PATCH", p, admin, { tier: "tier_9", reason: "x" })).status === 400, "unknown tier was not 400");
    expect((await call("PATCH", p, admin, { tier: "tier_2" })).status === 400, "tier change without a reason was not 400");
    const r = await call("PATCH", p, admin, { tier: "tier_2", reason: "Delivered the first event well" });
    expect(r.status === 400 && /completed event/i.test(msg(r)), `${r.status}: ${msg(r)}`);
  });
  await step("reviews require completion; PMCM records reliability notes and certification metadata", async () => {
    need(admin, apps.A.supplierId);
    const id = apps.A.supplierId;
    s.reviewNote = `PRIVREV-${stamp}`; s.relNote = `PRIVREL-${stamp}`;
    expect((await call("POST", `/suppliers/${id}/reviews`, admin, { eventId: E(), rating: 9, notes: "x" })).status === 400, "rating 9 was not 400");
    expect((await call("POST", `/suppliers/${id}/reviews`, admin, { eventId: E(), rating: 5 })).status === 400, "review without notes was not 400");
    const premature = await call("POST", `/suppliers/${id}/reviews`, admin, { eventId: E(), rating: 5, notes: s.reviewNote });
    expect(premature.status === 400 && /completion/i.test(msg(premature)), `${premature.status}: ${msg(premature)}`);
    const earlyNote = await call("POST", `/suppliers/${id}/reliability-notes`, admin, { eventId: E(), note: s.relNote });
    expect(earlyNote.status === 400 && /completion/i.test(msg(earlyNote)), `${earlyNote.status}: ${msg(earlyNote)}`);
    expect((await call("POST", `/suppliers/${id}/certifications`, admin, { fileName: "dti.pdf", documentType: "DTI", expiresAt: "not-a-date" })).status === 400, "bad certification expiry was not 400");
    is(await call("POST", `/suppliers/${id}/certifications`, admin, { fileName: "dti.pdf", documentType: "DTI permit", issuer: "DTI", expiresAt: "2027-12-31", status: "verified" }), 200, 201);
    const reviews = is(await call("GET", `/suppliers/${id}/reviews`, admin), 200);
    expect(!text(reviews).includes(s.reviewNote), "the rejected review was persisted");
  });
  await step("promotion requires a reason and a real event", async () => {
    need(admin, apps.A.supplierId);
    const p = `/suppliers/${apps.A.supplierId}/promote`;
    expect((await call("POST", p, admin, { eventId: E(), tier: "tier_9", reason: "x" })).status === 400, "unknown promotion tier was not 400");
    expect((await call("POST", p, admin, { tier: "tier_1", reason: "x" })).status === 400, "promotion without an event was not 400");
    const r = await call("POST", p, admin, { eventId: E(), tier: "tier_1", reason: "Strong first event" });
    expect(r.status < 500, `${r.status}: ${msg(r)}`);
    return `-> ${r.status}${r.status >= 400 ? " " + msg(r) : ""}`;
  });
  await step("PMCM creates and updates a supplier directly; supplier cannot", async () => {
    need(admin, A());
    const body = { categoryId: CAT, name: `E2E Direct ${stamp}`, contactName: "Direct Contact", email: `e2e-direct-${stamp}@example.test`, phone: "0917 555 0199" };
    expect((await call("POST", "/suppliers", A(), body)).status === 403, "supplier could create suppliers");
    expect((await call("POST", "/suppliers", admin, { ...body, email: "nope" })).status === 400, "bad supplier email was not 400");
    expect((await call("POST", "/suppliers", admin, { ...body, categoryId: "supcat_nope" })).status < 500, "unknown category caused a server error");
    const r = is(await call("POST", "/suppliers", admin, body), 201);
    s.direct = r;
    expect((await call("PATCH", `/suppliers/${r.id}`, A(), { name: "Hijacked" })).status === 403, "supplier could update another supplier");
    expect((await call("PATCH", `/suppliers/${r.id}`, admin, { tier: "tier_1" })).status === 400, "profile update accepted a tier field (tier must go through the audited tier route)");
    const up = is(await call("PATCH", `/suppliers/${r.id}`, admin, { phone: "0917 000 0000" }), 200);
    expect(up.phone === "0917 000 0000", `phone ${up.phone}`);
  });
  await step("supplier availability: PMCM sets it, supplier cannot, invalid capacity is 400", async () => {
    need(s.direct);
    const p = `/suppliers/${s.direct.id}/availability`;
    expect((await call("POST", p, A(), { availableOn: "2027-07-20", capacity: 1 })).status === 403, "supplier could set availability");
    expect((await call("POST", p, admin, { availableOn: "2027-07-20", capacity: -1 })).status === 400, "negative capacity was not 400");
    expect((await call("POST", p, admin, { availableOn: "someday", capacity: 1 })).status === 400, "bad date was not 400");
    is(await call("POST", p, admin, { availableOn: "2027-07-20", capacity: 1, notes: "e2e" }), 200, 201);
  });
  await step("a supplier never sees PMCM-private reviews, reliability notes, verification notes or other bids", async () => {
    need(s.reviewNote, A());
    const marks = [s.reviewNote, s.relNote, s.verifyNote, "dimensionRatings", "reliabilityNote", "performanceNotes", apps.B.company, "91234"];
    const bad = [];
    for (const path of ["/supplier/workspace", "/supplier/workflows", "/supplier/readiness-board"]) {
      const r = await call("GET", path, A());
      if (r.status !== 200) { bad.push(`${path}=${r.status}`); continue; }
      const raw = text(r.body);
      for (const m of marks) if (raw.includes(m)) bad.push(`${path} contains ${m}`);
    }
    const tokenView = text((await call("GET", `/quote-requests/${s.tokA}`)).body);
    for (const m of marks) if (tokenView.includes(m)) bad.push(`token view contains ${m}`);
    expect(!bad.length, bad.join("; "));
  });
  await step("a seeded supplier from another company cannot see A's request, contract or payables", async () => {
    need(seededSupplier, s.reqA);
    const raw = text((await call("GET", "/supplier/workflows", seededSupplier)).body) + text((await call("GET", "/supplier/workspace", seededSupplier)).body);
    expect(![s.reqA.id, contractV1?.id, s.m1?.id, apps.A.company].some((x) => x && raw.includes(x)), "another company's supplier sees A's records");
  });

  // ------------------------------------------------------------------ 5. expired deadline and withdrawal on a second event
  await step("second event: a quote request with a deadline in the past is rejected or expires immediately", async () => {
    need(s.direct, admin);
    s.ev2 = await ctx.newEvent({ label: "SuppliersB", eventDate: "2027-07-20" });
    const r = await call("POST", `/events/${s.ev2.eventId}/quote-requests`, admin, { categoryId: CAT, supplierIds: [s.direct.id], deadline: "2020-01-01" });
    if (r.status === 400) return "refused at creation";
    expect(r.status === 201, `${r.status}: ${msg(r)}`);
    s.reqZ = r.body[0];
    const tok = s.reqZ.accessToken;
    const view = await call("GET", `/quote-requests/${tok}`);
    const post = await http("POST", `/quote-requests/${tok}/quote`, { body: { amount: 5000 } });
    const patch = await http("PATCH", `/quote-requests/${tok}/quote`, { body: { amount: 5000 } });
    expect(post.status === 400 && /closed|expired/i.test(msg(post)), `submitting after the deadline returned ${post.status}: ${msg(post)}`);
    expect(patch.status === 404 || patch.status === 400, `revising a never-submitted quote returned ${patch.status}`);
    review(`a past-deadline request is accepted but immediately ${view.body?.request?.status}; quoting is refused. Decide whether creation should be rejected instead`);
  });
  await step("withdrawing a selected supplier is PMCM-only, needs an assignment, and frees the request", async () => {
    need(s.ev2, apps.A.supplierId);
    const e2 = s.ev2.eventId;
    const rq = is(await call("POST", `/events/${e2}/quote-requests`, admin, { categoryId: CAT, supplierIds: [apps.A.supplierId], deadline: "2027-06-30" }), 201);
    const tok = quoteLinkOf(apps.A.email);
    const reqW = rq[0];
    const submitted = is(await http("POST", `/quote-requests/${reqW.accessToken}/quote`, { body: { amount: 60000, notes: "second event offer" } }), 201);
    is(await call("PATCH", `/events/${e2}/supplier-quotes/${submitted.id}/select`, admin), 200);
    const p = `/events/${e2}/quote-requests/${reqW.id}/withdraw`;
    expect((await call("PATCH", p, A(), { reason: "I quit" })).status === 403, "supplier could withdraw itself through the PMCM route");
    expect((await call("PATCH", p, s.client, { reason: "x" })).status === 403, "client could withdraw a supplier");
    expect((await call("PATCH", p, admin, { reason: "" })).status === 400, "empty withdrawal reason was not 400");
    is(await call("PATCH", p, admin, { reason: "Supplier double-booked" }), 200);
    const again = await call("PATCH", p, admin, { reason: "again" });
    expect(again.status === 400, `second withdrawal returned ${again.status}`);
    const confirm = await call("PATCH", `/supplier/quote-requests/${reqW.id}/assignment/confirm`, A());
    expect(confirm.status === 400, `confirming a withdrawn assignment returned ${confirm.status}`);
    return tok.token ? "ok" : "ok";
  });
  await step("tokens stay valid only while the request is open (TTL expiry itself cannot be driven through the API)", async () => {
    need(s.reqA);
    const viaOld = await http("POST", `/quote-requests/${s.tokA}/quote`, { body: { amount: 1 } });
    expect(viaOld.status === 400, `submitting through a token whose request is now selected returned ${viaOld.status}`);
  });

  // ------------------------------------------------------------------ 6. broad negative matrix
  await step("every PMCM supplier mutation refuses anonymous (401) and supplier/client/coordinator (403)", async () => {
    need(s.m1, s.task, contractV2, s.release, apps.A.supplierId, s.reqA);
    const e = E(), req = s.reqA.id;
    const matrix = [
      ["POST", `/events/${e}/quote-requests`, quoteBody()],
      ["PATCH", `/events/${e}/supplier-quotes/${s.quoteA.id}/select`],
      ["POST", `/events/${e}/supplier-quotes`, { supplierName: "X", category: "Y", amount: 1 }],
      ["POST", `/events/${e}/supplier-schedules`, sched],
      ["GET", `/events/${e}/supplier-schedules`],
      ["GET", `/events/${e}/supplier-workflows`],
      ["PATCH", `/events/${e}/quote-requests/${req}/withdraw`, { reason: "x" }],
      ["PATCH", `/supplier/contracts/${contractV2.id}/review`, { decision: "accepted", reason: "" }],
      ["POST", `/events/${e}/supplier-creative-tasks`, { requestId: req, idempotencyKey: randomUUID(), title: "t", brief: "b" }],
      ["PATCH", `/supplier/creative-tasks/${s.task.id}/review`, { status: "accepted", reviewNote: "n" }],
      ["POST", `/events/${e}/supplier-payable-milestones`, { requestId: req, quoteId: s.quoteA.id, label: "l", amount: 1, idempotencyKey: `m-${randomUUID()}` }],
      ["POST", `/supplier-payable-milestones/${s.m1.id}/releases`, { amount: 1, paymentDate: new Date().toISOString(), method: "Cash", idempotencyKey: `r-${randomUUID()}` }],
      ["POST", `/supplier-payout-records/${s.release.id}/reversal`, { paymentDate: new Date().toISOString(), reason: "r", idempotencyKey: `v-${randomUUID()}` }],
      ["POST", "/suppliers", { categoryId: CAT, name: "N" }],
      ["PATCH", `/suppliers/${apps.A.supplierId}`, { name: "N" }],
      ["PATCH", `/suppliers/${apps.A.supplierId}/tier`, { tier: "tier_2", reason: "r" }],
      ["POST", `/suppliers/${apps.A.supplierId}/reviews`, { eventId: e, rating: 3, notes: "n" }],
      ["POST", `/suppliers/${apps.A.supplierId}/reliability-notes`, { eventId: e, note: "n" }],
      ["POST", `/suppliers/${apps.A.supplierId}/promote`, { eventId: e, tier: "tier_1", reason: "r" }],
      ["POST", `/suppliers/${apps.A.supplierId}/certifications`, { fileName: "f", documentType: "d" }],
      ["POST", `/suppliers/${apps.A.supplierId}/availability`, { availableOn: "2027-01-01", capacity: 1 }],
      ["PATCH", `/supplier-applications/${apps.B.id}/review`, { action: "approve" }],
      ["POST", `/supplier-applications/${apps.B.id}/account-invitation/resend`],
    ];
    const bad = [];
    for (const [m, p, b] of matrix) {
      for (const [who, t, want] of [["anon", undefined, 401], ["supplier", A(), 403], ["client", s.client, 403], ["coordinator", coordinator, 403]]) {
        const r = await call(m, p, t, b);
        if (r.status !== want) bad.push(`${who} ${m} ${p.replace(/[a-z]+_[0-9a-f-]{20,}/g, ":id").replace(/evt_[A-Za-z0-9_-]+/, ":event")} -> ${r.status}`);
      }
    }
    expect(!bad.length, `${bad.length} wrong status(es): ${bad.slice(0, 4).join("; ")}`);
    return `${matrix.length} routes x 4 callers`;
  });
  await step("malformed bodies on supplier routes return 400, never 500", async () => {
    need(s.m1, s.task, A());
    const tries = [
      ["POST", `/supplier/quote-requests/${s.reqA.id}/contracts`, A(), { storedObjectId: 5, checksumSha256: "zz" }],
      ["POST", `/supplier/quote-requests/${s.reqA.id}/contract`, A(), { fileName: 5, idempotencyKey: {} }],
      ["POST", `/supplier/quote-requests/${s.reqA.id}/schedule/acknowledgement`, A(), { expectedRevision: -1 }],
      ["POST", `/supplier/quote-requests/${s.reqA.id}/schedule/change-request`, A(), { expectedRevision: 1, reason: "x".repeat(2001) }],
      ["PATCH", `/supplier/creative-tasks/${s.task.id}/progress`, A(), { note: "x".repeat(2001) }],
      ["POST", `/supplier/creative-tasks/${s.task.id}/submissions`, A(), { storedObjectId: 12, note: "n" }],
      ["PATCH", `/supplier/quote-requests/${s.reqA.id}/event-status`, A(), { status: ["arrived"] }],
      ["PATCH", `/supplier/quote-requests/${s.reqA.id}/event-status`, A(), { status: "arrived", photo: { fileName: "" } }],
      ["PATCH", `/supplier/quote-requests/${s.reqA.id}/readiness/confirm`, A(), []],
      ["POST", `/events/${E()}/supplier-payable-milestones`, admin, { requestId: s.reqA.id, quoteId: s.quoteA.id, label: "x".repeat(121), amount: 1, idempotencyKey: "k" }],
      ["POST", `/events/${E()}/supplier-payable-milestones`, admin, { requestId: s.reqA.id, quoteId: s.quoteA.id, label: "x", amount: 3_000_000_000, idempotencyKey: "k" }],
      ["POST", `/supplier-payable-milestones/${s.m1.id}/releases`, admin, { amount: 1, paymentDate: new Date().toISOString(), idempotencyKey: "k" }],
      ["POST", `/events/${E()}/supplier-schedules`, admin, { requestId: s.reqA.id, ingressAt: 5, egressAt: 6 }],
      ["POST", `/events/${E()}/quote-requests`, admin, { categoryId: 5 }],
      ["POST", `/events/${E()}/supplier-quotes`, admin, { amount: "x" }],
      ["POST", `/suppliers/${apps.A.supplierId}/reviews`, admin, { rating: "five", notes: "n" }],
      ["PATCH", `/suppliers/${apps.A.supplierId}/tier`, admin, { tier: 3, reason: "x" }],
      ["POST", "/supplier-applications", undefined, { companyName: ["x"], contactName: 1, email: 2, privacyConsentAccepted: "yes" }],
      ["GET", "/suppliers/directory?pageSize=7&page=-1", admin],
      ["GET", "/suppliers/directory?sort=hacked", admin],
      ["GET", `/suppliers/${apps.A.supplierId}/records?period=forever`, admin],
    ];
    const bad = [];
    for (const [m, p, t, b] of tries) {
      const r = await http(m, p, { token: t, body: b });
      if (r.status !== 400) bad.push(`${m} ${p.replace(/\/[a-z]+_[0-9a-f-]{20,}/g, "/:id").replace(/\/evt_[A-Za-z0-9_-]+/, "/:event")} ${JSON.stringify(b ?? "").slice(0, 40)} -> ${r.status}`);
    }
    expect(!bad.length, `${bad.length}/${tries.length} not 400: ${bad.slice(0, 4).join("; ")}`);
  });

  // ------------------------------------------------------------------ 7. portal wiring (static)
  const supplierSrc = sourceCorpus("apps/supplier/src"), eventSrc = sourceCorpus("apps/event/src");
  const wiredIn = (corpus, re) => corpus.some((f) => re.test(f.text));
  const wiring = [
    ["quote round comparison (GET /events/:id/quote-rounds/:roundId/comparison)", () => wiredIn(eventSrc, /quote-rounds|quoteRound/i)],
    ["PMCM manual quote entry (POST /events/:id/supplier-quotes)", () => wiredIn(eventSrc, /supplier-quotes[`"']/)],
    ["resend supplier account invitation (POST /supplier-applications/:id/account-invitation/resend)", () => wiredIn(eventSrc, /account-invitation\/resend|resendAccountInvitation/)],
    ["supplier availability (POST /suppliers/:id/availability)", () => wiredIn(eventSrc, /suppliers\/\$\{[^}]+\}\/availability|supplierPath\([^)]*["']\/?availability["']/)],
    ["list supplier schedules (GET /events/:id/supplier-schedules)", () => wiredIn(eventSrc, /listSupplierSchedules|supplierWorkflows\.listSchedules/)],
    ["metadata-only contract upload (POST /supplier/quote-requests/:id/contract)", () => wiredIn(supplierSrc, /supplierWorkspace\.uploadContract|quote-requests\/\$\{[^}]+\}\/contract[`"']/)],
    ["supplier reads request by token (GET /quote-requests/:token)", () => routeFilesOf("apps/supplier/src/app").some((p) => /quote/i.test(p.replace(ROOT, ""))) || wiredIn(supplierSrc, /quote-requests\/\$\{[^}]+\}[`"']/)],
  ];
  const wiredNames = [];
  for (const [label, check] of wiring) {
    const ok = check();
    if (ok) { wiredNames.push(label.split(" (")[0]); continue; }
    await step(`portal screen calls ${label.split(" (")[0]}`, async () => gap(`API only, no UI: ${label}; no call found under apps/supplier/src or apps/event/src`));
  }
  const must = [
    ["supplier", /supplierWorkspace\.confirmAssignment/, "assignment confirm"], ["supplier", /supplierWorkspace\.confirmReadiness/, "readiness confirm"],
    ["supplier", /supplierWorkspace\.updateEventStatus/, "event-day status"], ["supplier", /supplierWorkflows\.(bindContract|acknowledgeSchedule|requestScheduleChange|updateCreativeProgress|submitCreativeTask)/, "contract, schedule and creative actions"],
    ["supplier", /quote-requests\/\$\{token\}\/quote/, "quote submit/revise"], ["supplier", /supplier-applications/, "public application and status"],
    ["event", /supplierWorkflows\.(reviewContract|createCreativeTask|reviewCreativeTask|createPayable|releasePayout|reversePayout|createSchedule)/, "PMCM contract/creative/payable/schedule actions"],
    ["event", /supplierApplications\.review|supplierApplications\.listInbox/, "application inbox review"], ["event", /quote-requests`/, "request quotes"],
    ["event", /supplier-quotes\/\$\{quoteId\}\/select/, "select quote"], ["event", /\/withdraw/, "withdraw supplier"],
    ["event", /suppliers\/directory/, "directory"], ["event", /reliability-notes/, "reliability notes"], ["event", /\/tier/, "tier change"], ["event", /\/promote/, "promotion"],
    ["event", /\/certifications/, "certifications"], ["event", /supplier-status/, "verify event-day status"],
  ];
  await step("every other supplier capability has a portal data call", async () => {
    const missing = must.filter(([app, re]) => !wiredIn(app === "supplier" ? supplierSrc : eventSrc, re)).map(([, , label]) => label);
    expect(!missing.length, `no portal call for: ${missing.join(", ")}`);
    return `${must.length} capabilities wired (${wiredNames.length} extra wired)`;
  });
}
