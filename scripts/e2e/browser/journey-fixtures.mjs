// API preparation for the cross-portal journeys. Each helper brings an event to the state a journey starts from, so
// the journey itself exercises only the handoff between portals through rendered controls.
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
import { api, freshEvent, origins, password, fillStable, usePasswordSignIn, privacyIfNeeded } from './helpers.mjs';
import { oneTableScene } from '../floorplan-fixture.mjs';

export const supplierAccount = { email: 'ops@xperto.test', supplierId: 'sup_xperto', category: 'supcat_digital_registration' };

export async function tokenFor(email, secret) {
  const session = await api('POST', '/auth/login', { email, password: secret }, null);
  if (session.privacyNoticeRequired) await api('POST', '/auth/privacy-notice/acknowledge', { version: PRISM_PRIVACY_NOTICE_VERSION }, session.accessToken);
  return session.accessToken;
}

/** Signs a client, supplier or PMCM account into its portal in a new browser context. */
export async function signedIn(browser, device, origin, email, secret) {
  const context = await browser.newContext(device);
  const page = await context.newPage();
  await page.goto(`${origin}/sign-in`);
  await page.waitForLoadState('networkidle');
  await fillStable(page.getByLabel('Email address'), email);
  await usePasswordSignIn(page);
  await fillStable(page.getByLabel('Password', { exact: true }), secret);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await privacyIfNeeded(page);
  return { context, page };
}

export const signedInClient = (browser, device, event) => signedIn(browser, device, origins.client, event.email, password);

/** The event's approved proposal: fresh events already have one (the conforme follows it); otherwise PMCM issues one and the client approves it. */
export async function approvedProposal(event) {
  const existing = (await api('GET', `/pmcm/events/${event.eventId}/workspace`)).documents.find(item => item.type === 'proposal' && item.status === 'issued');
  if (existing) return existing;
  const estimate = await api('POST', `/events/${event.eventId}/cost-estimates`, { budgetAmount: 100000, lines: [{ category: 'Venue', description: 'Event scope', quantity: 1, unitAmount: 100000 }], notes: '' });
  await api('POST', `/events/${event.eventId}/proposal/versions`, { costEstimateId: estimate.id, title: 'Event scope proposal', summary: 'Agreed event scope', revisionNote: '' });
  await api('PATCH', `/events/${event.eventId}/proposal/review`, { action: 'approve' }, event.clientToken);
  const workspace = await api('GET', `/pmcm/events/${event.eventId}/workspace`);
  return workspace.documents.find(item => item.type === 'proposal' && item.status === 'issued');
}

/** Statements need a payment method PMCM has turned on; a fresh database has none. */
export async function ensurePaymentDetails() {
  const details = await api('GET', '/payment-details');
  if ((details.methods ?? []).some(method => method.enabled)) return;
  await api('PUT', '/payment-details', { expectedRevision: details.revision ?? 0, methods: [
    { kind: 'bank', id: randomUUID(), label: 'Browser acceptance bank account', accountName: 'PMCM Events', accountNumber: '0000-1111-2222', instructions: '', qrImageId: null, enabled: true },
  ] });
}

/** A signed-up client whose approved proposal became a sent statement with a downpayment and a balance. */
export async function billedEvent(label) {
  const event = await freshEvent(label);
  const document = await approvedProposal(event);
  await ensurePaymentDetails();
  const due = offsetDate(30);
  const source = await api('POST', `/events/${event.eventId}/billing-source`, { sourceLabel: 'Event scope proposal', sourceType: 'ce_proposal', sourceDocumentId: document.id,
    lineItems: [{ label: 'Event scope', amount: 100000 }], paymentSchedule: [{ label: 'Downpayment', percentage: 50, dueDate: due }, { label: 'Balance', percentage: 50, dueDate: offsetDate(60) }], idempotencyKey: randomUUID() });
  await api('PATCH', `/events/${event.eventId}/billing-source/${source.id}/approve`, { approvalNotes: 'Matches the approved proposal' });
  const statement = await api('POST', `/events/${event.eventId}/billing-statements/generate`, { sourceId: source.id, idempotencyKey: randomUUID() });
  await api('POST', `/events/${event.eventId}/billing-statements/${statement.id}/send`);
  return { ...event, statement };
}

/** The seeded XPERTO supplier is selected and has confirmed its booking for the event. */
export async function bookedSupplier(event) {
  const [request] = await api('POST', `/events/${event.eventId}/quote-requests`, { categoryId: supplierAccount.category, supplierIds: [supplierAccount.supplierId], deadline: offsetDate(20) });
  const quote = await api('POST', `/quote-requests/${request.accessToken}/quote`, { amount: 60000, inclusions: ['Registration kiosks', 'On-site support'], paymentTerms: '50% down payment', notes: 'Browser acceptance quote' }, null);
  await api('PATCH', `/events/${event.eventId}/supplier-quotes/${quote.id}/select`);
  const supplierToken = await tokenFor(supplierAccount.email, process.env.PRISM_SEED_PASSWORD_SUPPLIER);
  await api('PATCH', `/supplier/quote-requests/${request.id}/assignment/confirm`, undefined, supplierToken);
  return { request, quote, supplierToken };
}

/** PMCM's official layout submitted for the client's review, after a waived ocular visit. */
export async function submittedOfficialPlan(event) {
  await api('POST', `/events/${event.eventId}/ocular-visit/waive`, { reason: 'Synthetic browser acceptance venue' });
  const template = await api('POST', '/templates', { name: `Browser venue ${event.eventId}`, venue: 'Browser acceptance venue', pax: 120, scene: oneTableScene(`Browser venue ${event.eventId}`) });
  const draft = await api('POST', `/events/${event.eventId}/floorplans`, { name: 'Official browser layout', sourceType: 'template', venueTemplateId: template.id });
  await api('POST', `/events/${event.eventId}/floorplans/${draft.id}/submit`);
  return draft;
}

/** Event-day prerequisites: waived ocular visit and an approved official plan. */
export async function approvedOfficialPlan(event) {
  const draft = await submittedOfficialPlan(event);
  await api('POST', `/events/${event.eventId}/floorplans/${draft.id}/approve`);
  return draft;
}

/** Chooses a day and a time in the shared date-and-time picker opened by `trigger`, moving forward a month when needed. */
export async function pickDateTime(page, trigger, date, time = '10:00 AM') {
  await trigger.click();
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'Asia/Manila' }).format(date);
  const day = Number(new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'Asia/Manila' }).format(date));
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
  const dayButton = page.getByRole('grid').getByRole('button', { name: new RegExp(`${month} ${day}(?:st|nd|rd|th)?, ${year}`) });
  for (let step = 0; step < 12 && !(await dayButton.count()); step += 1) await page.getByRole('button', { name: /next month/i }).click();
  await dayButton.click();
  await page.getByRole('listbox', { name: 'Time', exact: true }).getByRole('option', { name: time, exact: true }).click();
}

export function offsetDate(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** A tiny valid PNG for upload controls that accept images as proof or evidence. */
export const proofPng = {
  name: 'transfer-proof.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
};

/** A one-page PDF for document upload controls. */
export const samplePdf = {
  name: 'browser-acceptance.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'),
};

/** Each supplier booking is a card; its title opens the booking's checklist in a side panel named after the event. */
export async function openBooking(page, eventName) {
  const panel = page.getByRole('dialog', { name: eventName });
  const title = page.getByRole('link', { name: eventName, exact: true }).first();
  // After a reload the page reopens the booking its address names; while that panel is open the cards behind it are
  // hidden from the accessibility tree, so wait for whichever appears and open the card only when the panel did not.
  await expect(panel.or(title)).toBeVisible();
  await panel.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
  if (!(await panel.isVisible())) await title.click();
  await expect(panel).toBeVisible();
  return panel;
}

/** PMCM opens a conversation on the event with the participant whose email is given. */
export async function startConversation(page, eventId, subject, email) {
  await page.goto(`${origins.event}/dashboard/events/${eventId}/messages`);
  await page.getByRole('button', { name: 'New conversation' }).first().click();
  await page.getByLabel('Topic', { exact: true }).fill(subject);
  await page.getByRole('checkbox', { name: email }).check({ force: true });
  await page.getByRole('button', { name: 'Start conversation', exact: true }).click();
  // A new conversation has no message list until its first message.
  await expect(page.getByText('Say hello to start the conversation.')).toBeVisible();
}

/** Opens a conversation by its topic; on a phone the list is its own screen, on a desktop the first one is preselected. */
export async function openConversation(page, subject) {
  await page.getByRole('button', { name: new RegExp(subject) }).first().click();
  await expect(page.getByRole('list', { name: `Messages in ${subject}` })).toBeVisible();
}

/** A message row reads "Sender · Role" then the text, so the thread is checked for the text it contains. */
export const conversationShows = (page, subject, text) => expect(page.getByRole('list', { name: `Messages in ${subject}` })).toContainText(text);

export async function sendMessage(page, subject, text) {
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await conversationShows(page, subject, text);
}

export async function closeAll(contexts) {
  for (const context of contexts.reverse()) await context.close().catch(() => undefined);
}

export { expect };
