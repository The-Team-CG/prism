import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, origins, persona } from './helpers.mjs';

test('staff check in a guest using the code shown on their personal QR pass', async ({ browser }, info) => {
  const eventId = 'evt_uat_live_261024';
  const guestName = `QR guest ${randomUUID()}`;
  await api('POST', `/guest/events/${eventId}/roster/import`, { source: 'csv', rows: [{ sourceKey: randomUUID(), guestName, email: `qr-${randomUUID()}@example.test` }] });
  const passes = await api('POST', `/guest/events/${eventId}/qr-passes`);
  const pass = passes.find(item => item.guestName === guestName);
  expect(pass?.token).toBeTruthy();
  const device = projectDevice(info.project.name);
  const guestContext = await browser.newContext(device);
  const guest = await guestContext.newPage();
  const pmcm = await persona(browser, 'pmcm', device);
  try {
    await guest.goto(`${origins.guest}/pass/${encodeURIComponent(pass.token)}`);
    await guest.getByText('Scanner not working? Show the code').click();
    const groupedCode = pass.token.match(/.{1,4}/g).join(' ');
    await expect(guest.getByText(groupedCode, { exact: true })).toBeVisible();
    await pmcm.page.goto(`${origins.event}/dashboard/events/${eventId}/registration`);
    await pmcm.page.getByLabel('Pass code').fill(groupedCode);
    await pmcm.page.getByRole('button', { name: 'Check in pass' }).click();
    await expect(pmcm.page.getByRole('status').filter({ hasText: `${guestName} is checked in.` })).toBeVisible();
  } finally {
    await guestContext.close();
    await pmcm.context.close();
  }
});

test('registration checks in a pass through the camera flow', async ({ browser }, info) => {
  const eventId = 'evt_uat_live_261024';
  const guestName = `Camera guest ${randomUUID()}`;
  await api('POST', `/guest/events/${eventId}/roster/import`, { source: 'csv', rows: [{ sourceKey: randomUUID(), guestName, email: `camera-${randomUUID()}@example.test` }] });
  const passes = await api('POST', `/guest/events/${eventId}/qr-passes`);
  const pass = passes.find(item => item.guestName === guestName);
  expect(pass?.token).toBeTruthy();
  const pmcm = await persona(browser, 'pmcm', projectDevice(info.project.name));
  try {
    // Supply a camera stream and decoded value so the browser can exercise the scanner without physical hardware.
    await pmcm.page.addInitScript((token) => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => canvas.captureStream(10) });
      globalThis.BarcodeDetector = class {
        async detect() { return [{ rawValue: `prism-pass:${token}` }]; }
      };
    }, pass.token);
    await pmcm.page.goto(`${origins.event}/dashboard/events/${eventId}/registration`);
    await pmcm.page.getByRole('button', { name: 'Scan a pass' }).click();
    await expect(pmcm.page.getByRole('status').filter({ hasText: `${guestName} is checked in.` })).toBeVisible();
  } finally { await pmcm.context.close(); }
});
