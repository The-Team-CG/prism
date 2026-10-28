import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';
import {api,origins} from './helpers.mjs';

async function choose(page, label) {
  await page.getByText(label, { exact: true }).click();
  await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
}

export async function submitPublicInquiry(page,label='Browser inquiry',date='12/15/2030') {
  const title = `${label} ${randomUUID()}`;
  await page.goto(`${origins.client}/inquiry`);
  await choose(page, 'Conference');
  await page.getByLabel('Event name', { exact: true }).fill(title);
  await page.getByLabel('Preferred date', { exact: true }).fill(date);
  await page.getByRole('button', { name: 'Open calendar', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Expected guests', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Venue or city', { exact: false }).fill('Makati');
  await choose(page, 'PHP 150k-500k');
  await choose(page, 'Standard');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Browser Inquiry Client');
  await page.getByLabel('Email', { exact: true }).fill(`inquiry-${randomUUID()}@example.test`);
  await page.getByLabel('Mobile number', { exact: true }).fill('09171234567');
  await choose(page, 'Corporate');
  await choose(page, 'P.R.I.S.M Website');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send inquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inquiry sent' })).toBeVisible();
  const persisted = await api('GET', `/inquiries?query=${encodeURIComponent(title)}`);
  const inquiry = persisted.find(item => item.eventName === title);
  expect(inquiry?.eventDate).toBeTruthy();
  return inquiry;
}
