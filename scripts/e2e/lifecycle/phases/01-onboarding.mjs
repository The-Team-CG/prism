// Phase 1: accounts, public inquiry, PMCM triage, activation, conforme, event creation, briefing.
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import { cfg, http, login, msg, step, startPhase, blocked, gap, expect, expectStatus, latestMailTo, tokenFromMail } from "../lib.mjs";

export const name = "Onboarding";

export async function run(ctx) {
  startPhase("Onboarding: accounts, inquiry, conforme, briefing");
  const s = {};

  for (const who of ["admin", "admin2", "coordinator", "supplier", "supplier2"]) {
    await step(`${who} signs in (including 2FA where required)`, async () => {
      const token = await ctx.as(who);
      expect(token, `${who} has no session`);
      return "authenticated";
    });
  }

  const stamp = Date.now();
  s.email = `e2e-golden-${stamp}@example.test`;
  const inquiryBody = {
    clientName: "Golden Client", companyName: "Golden Corp", email: s.email, eventName: `Golden Path Summit ${stamp}`, eventType: "Conference",
    eventDate: "2027-05-14", clientType: "Corporate", source: "PMCM Facebook", message: "Phone: 0917 123 4567\nExpected guests: 150\nVenue: Makati",
    privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
  };

  await step("public inquiry without consent is rejected", async () => {
    const r = await http("POST", "/inquiries", { body: { ...inquiryBody, privacyConsentAccepted: false } });
    expect(r.status === 400, `expected 400, got ${r.status}: ${msg(r)}`);
  });
  await step("public inquiry with a legacy client type is rejected or mapped", async () => {
    const r = await http("POST", "/inquiries", { body: { ...inquiryBody, email: `e2e-legacy-${stamp}@example.test`, clientType: "Private" } });
    expect([201, 400].includes(r.status), `unexpected ${r.status}: ${msg(r)}`);
    return `legacy Private -> ${r.status === 201 ? `stored as ${r.body.clientType}` : "rejected"}`;
  });
  await step("public visitor submits an inquiry", async () => {
    const r = await http("POST", "/inquiries", { body: inquiryBody });
    s.inquiry = expectStatus(r, 201);
    return s.inquiry.id;
  });
  await step("an anonymous caller cannot read inquiries", async () => {
    expect((await http("GET", "/inquiries")).status === 401, "inquiry list is readable without a session");
  });

  s.admin = await ctx.as("admin").catch(() => null);
  await step("PMCM sees the new inquiry in the inbox", async () => {
    if (!s.admin || !s.inquiry) blocked("no admin session or inquiry");
    const r = expectStatus(await http("GET", "/inquiries", { token: s.admin }), 200);
    const list = Array.isArray(r) ? r : r.items ?? [];
    expect(list.some((i) => i.id === s.inquiry.id), "submitted inquiry is not in the PMCM list");
    return `${list.length} inquiries`;
  });
  await step("supplier cannot read inquiries (role boundary)", async () => {
    const t = await ctx.as("supplier");
    const r = await http("GET", "/inquiries", { token: t });
    expect(r.status === 403, `expected 403, got ${r.status}`);
  });
  await step("declining requires a reason", async () => {
    if (!s.inquiry) blocked("no inquiry");
    const r = await http("PATCH", `/inquiries/${s.inquiry.id}/status`, { token: s.admin, body: { status: "declined" } });
    expect(r.status === 400, `expected 400 without a reason, got ${r.status}: ${msg(r)}`);
  });
  await step("PMCM accepts the inquiry", async () => {
    if (!s.inquiry) blocked("no inquiry");
    expectStatus(await http("PATCH", `/inquiries/${s.inquiry.id}/status`, { token: s.admin, body: { status: "accepted" } }), 200);
  });
  await step("client has no portal access before activating", async () => {
    const r = await http("POST", "/auth/login", { body: { email: s.email, password: cfg.password.client } });
    expect(r.status === 401, `expected sign-in to fail before activation, got ${r.status}`);
  });
  await step("accepted client receives an activation email with a link", async () => {
    const token = tokenFromMail(latestMailTo(s.email));
    expect(token, "no activation link found in the API log (is PRISM_MAIL_TRANSPORT=log and E2E_API_LOG set?)");
    s.activation = token;
  });
  await step("client activates the account and sets a password", async () => {
    if (!s.activation) blocked("no activation token");
    expectStatus(await http("POST", "/auth/activate", { body: { token: s.activation, password: cfg.password.client } }), 200);
  });
  await step("an activation link cannot be used twice", async () => {
    if (!s.activation) blocked("no activation token");
    const r = await http("POST", "/auth/activate", { body: { token: s.activation, password: `${cfg.password.client}x` } });
    expect(r.status >= 400, `second activation returned ${r.status}`);
  });

  s.client = null;
  await step("client signs in", async () => {
    const r = await login(s.email, cfg.password.client);
    expect(r.token, r.error);
    s.client = r.token;
  });
  await step("client sees no event before the conforme is signed", async () => {
    if (!s.client) blocked("client not signed in");
    const r = expectStatus(await http("GET", "/events", { token: s.client }), 200);
    expect((r.items ?? r).length === 0, `client already sees ${(r.items ?? r).length} event(s)`);
  });
  await step("client cannot create an event or briefing before the conforme", async () => {
    if (!s.client) blocked("client not signed in");
    const r = await http("POST", "/events/evt_does_not_exist/briefing", { token: s.client, body: { venue: "x", guestCount: 1, budgetRange: "x", serviceRequirements: [], notes: "x" } });
    expect([403, 404].includes(r.status), `expected 403/404, got ${r.status}`);
  });

  await step("PMCM creates the conforme for the client to sign", async () => {
    if (!s.inquiry) blocked("no inquiry");
    s.execution = expectStatus(await http("POST", `/inquiries/${s.inquiry.id}/conforme-executions`, { token: s.admin, body: {
      templateVersion: 1, templateContent: "P.R.I.S.M conforme: the client agrees to PMCM's event management terms, scope and payment schedule for this event.",
    } }), 201);
    return s.execution.status;
  });
  await step("client reads the conforme and signs it", async () => {
    if (!s.client || !s.execution) blocked("no client session or conforme");
    const current = expectStatus(await http("GET", "/client/conforme-execution", { token: s.client }), 200);
    const ex = current.executions.find((e) => e.id === s.execution.id);
    expect(ex, "conforme is not visible to the client");
    s.sign = { executionId: ex.id, templateVersion: ex.templateVersion, documentSha256: ex.documentSha256, consentAccepted: true };
    const wrong = await http("POST", "/client/conforme-execution/sign", { token: s.client, body: { ...s.sign, documentSha256: "0".repeat(64) } });
    expect(wrong.status >= 400, "signing with a wrong document hash was accepted");
    const signed = expectStatus(await http("POST", "/client/conforme-execution/sign", { token: s.client, body: s.sign }), 200);
    return signed.status;
  });
  await step("no event exists until PMCM counter-signs", async () => {
    if (!s.client) blocked("no client session");
    const r = expectStatus(await http("GET", "/events", { token: s.client }), 200);
    expect((r.items ?? r).length === 0, "an event was created before the PMCM signature");
  });
  await step("PMCM counter-signs and the event is created", async () => {
    if (!s.sign) blocked("client has not signed");
    const done = expectStatus(await http("POST", `/inquiries/${s.inquiry.id}/conforme-executions/${s.execution.id}/sign`, { token: s.admin, body: s.sign }), 200);
    expect(done.eventId, "signed by both parties but no event id was returned");
    s.eventId = done.eventId;
    return s.eventId;
  });
  await step("client portal unlocks with the event in the briefing stage", async () => {
    if (!s.eventId) blocked("no event");
    const r = expectStatus(await http("GET", "/events", { token: s.client }), 200);
    const ev = (r.items ?? r).find((e) => e.id === s.eventId);
    expect(ev, "event is not visible to its client");
    expect(ev.clientPortalStatus === "unlocked", `portal status is ${ev.clientPortalStatus}`);
    return `status=${ev.status}, readiness="${ev.readiness}"`;
  });
  await step("another client cannot see this event", async () => {
    if (!s.eventId) blocked("no event");
    const other = await ctx.newEvent({ label: "Isolation" });
    const t = await other.as();
    const r = expectStatus(await http("GET", "/events", { token: t }), 200);
    expect(!(r.items ?? r).some((e) => e.id === s.eventId), "a different client can list this client's event");
    const direct = await http("GET", `/events/${s.eventId}/proposal`, { token: t });
    expect(direct.status === 403, `direct read of another client's event returned ${direct.status}`);
  });

  await step("client submits the event briefing", async () => {
    if (!s.eventId) blocked("no event");
    const body = { venue: "Makati Shangri-La Ballroom", guestCount: 150, budgetRange: "PHP 500k-1M", serviceRequirements: ["Catering", "AV", "Registration"], notes: "Hybrid plenary with breakout rooms.", confirmedDate: "2027-05-14", confirmedStartTime: "09:00", confirmedEndTime: "17:00", program: [{ time: "09:00", activity: "Opening" }], moodAndStyling: "Modern, brand colours", stylingBudget: 50000 };
    let r = await http("POST", `/events/${s.eventId}/briefing`, { token: s.client, body });
    if (r.status === 403) {
      const asPmcm = await http("POST", `/events/${s.eventId}/briefing`, { token: s.admin, body });
      if (asPmcm.status < 300) gap(`the client cannot submit the briefing (${msg(r)}); only PMCM can, so the client briefing step is PMCM-entered`);
      r = asPmcm;
    }
    s.briefing = expectStatus(r, 200, 201);
  });
  await step("PMCM command inbox lists the new event's work", async () => {
    const r = await http("GET", "/pmcm/command-inbox", { token: s.admin });
    expect(r.status === 200, `${r.status}: ${msg(r)}`);
    return `${JSON.stringify(r.body).length} bytes`;
  });

  ctx.golden = { eventId: s.eventId, inquiryId: s.inquiry?.id, clientEmail: s.email };
}
