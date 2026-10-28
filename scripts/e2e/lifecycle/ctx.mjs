// Run context: signed-in actors and the helper that creates a fresh, onboarded event for any phase to build on.
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import { cfg, http, login, latestMailTo, tokenFromMail, msg, expect, expectStatus } from "./lib.mjs";

const ACCOUNTS = {
  admin: { email: "mys@pmcm.test", password: () => cfg.password.admin },
  admin2: { email: "approver@pmcm.test", password: () => cfg.password.admin },
  coordinator: { email: "marco@pmcm.test", password: () => cfg.password.coordinator },
  coordinator2: { email: "bianca@pmcm.test", password: () => cfg.password.coordinator },
  supplier: { email: "ops@xperto.test", password: () => cfg.password.supplier },
  supplier2: { email: "flowers@bloom.test", password: () => cfg.password.supplier },
};

export function createContext() {
  const tokens = new Map();
  const clientPasswords = new Map();
  let occupiedDates;

  async function reserveDate() {
    if (!occupiedDates) {
      occupiedDates = new Set();
      let cursor;
      do {
        const page = expectStatus(await http("GET", `/events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { token: await as("admin") }), 200);
        for (const event of page.items) occupiedDates.add(event.eventDate.slice(0, 10));
        cursor = page.pagination.hasMore ? page.pagination.nextCursor : undefined;
      } while (cursor);
    }
    let day = Date.UTC(2030, 0, 1);
    while (occupiedDates.has(new Date(day).toISOString().slice(0, 10))) day += 86400000;
    const date = new Date(day).toISOString().slice(0, 10);
    occupiedDates.add(date);
    return date;
  }

  /** Token for a seeded role ("admin", "coordinator", "supplier", "supplier2") or an e2e client created by newEvent. */
  async function as(who) {
    if (tokens.has(who)) return tokens.get(who);
    const seeded = ACCOUNTS[who];
    const email = seeded?.email ?? who;
    const password = seeded ? seeded.password() : clientPasswords.get(who);
    if (!password) throw new Error(`No known password for ${who}`);
    const result = await login(email, password);
    if (!result.token) throw new Error(`Cannot sign in as ${who}: ${result.error}`);
    tokens.set(who, result.token);
    return result.token;
  }

  /**
   * Creates an event the way a real client would: public inquiry, PMCM accepts, activation email, client
   * activates, conforme created, signed by the client and then PMCM. Returns the ids the next steps need.
   */
  async function newEvent({ label = "E2E", eventDate = "2027-06-15", guests = 120 } = {}) {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const clientEmail = `e2e-client-${stamp}@example.test`;
    const admin = await as("admin");
    const inquiry = expectStatus(await http("POST", "/inquiries", { body: {
      clientName: `${label} Client`, companyName: `${label} Corp`, email: clientEmail, eventName: `${label} ${stamp}`,
      eventType: "Conference", eventDate, clientType: "Corporate", source: "PMCM Facebook",
      message: `Phone: 0917 123 4567\nExpected guests: ${guests}`,
      privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
    } }), 201);
    expectStatus(await http("PATCH", `/inquiries/${inquiry.id}/status`, { token: admin, body: { status: "accepted" } }), 200);
    const activation = tokenFromMail(latestMailTo(clientEmail));
    expect(activation, "no activation email reached the API log (set E2E_API_LOG to the API's log file)");
    clientPasswords.set(clientEmail, cfg.password.client);
    expectStatus(await http("POST", "/auth/activate", { body: { token: activation, password: cfg.password.client } }), 200);
    const execution = expectStatus(await http("POST", `/inquiries/${inquiry.id}/conforme-executions`, { token: admin, body: {
      templateVersion: 1, templateContent: "P.R.I.S.M conforme: the client agrees to PMCM's event management terms, scope and payment schedule for this event.",
    } }), 201);
    const sign = { executionId: execution.id, templateVersion: execution.templateVersion, documentSha256: execution.documentSha256, consentAccepted: true };
    const client = await as(clientEmail);
    expectStatus(await http("POST", "/client/conforme-execution/sign", { token: client, body: sign }), 200);
    const signed = expectStatus(await http("POST", `/inquiries/${inquiry.id}/conforme-executions/${execution.id}/sign`, { token: admin, body: sign }), 200);
    expect(signed.eventId, "conforme was signed by both parties but no event was created");
    return { inquiryId: inquiry.id, eventId: signed.eventId, clientEmail, eventDate, eventName: inquiry.eventName, as: () => as(clientEmail) };
  }

  async function prepareEventDay(eventId) {
    const admin = await as("admin");
    const base = `/events/${eventId}`;
    expectStatus(await http("POST", `${base}/ocular-visit/waive`, { token: admin, body: { reason: "Synthetic lifecycle verification" } }), 200, 201);
    const template = expectStatus(await http("POST", "/templates", { token: admin, body: {
      name: `Lifecycle venue ${eventId}`, venue: "Verification venue", width: 1200, height: 800, gridSize: 20, pax: 120,
      objects: [{ id: "table-1", kind: "table", position: { x: 100, y: 100 }, size: { width: 80, height: 80 }, rotation: 0, zIndex: 1 }],
    } }), 201);
    const draft = expectStatus(await http("POST", `${base}/floorplans`, { token: admin, body: { name: "Official lifecycle layout", sourceType: "template", venueTemplateId: template.id } }), 201);
    expectStatus(await http("POST", `${base}/floorplans/${draft.id}/submit`, { token: admin }), 200);
    expectStatus(await http("POST", `${base}/floorplans/${draft.id}/approve`, { token: admin }), 200);
  }

  return { as, newEvent, prepareEventDay, reserveDate, accounts: ACCOUNTS };
}
