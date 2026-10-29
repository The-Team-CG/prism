import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';
import {api,origins} from './helpers.mjs';

async function choose(page, label) {
  await page.getByText(label, { exact: true }).click();
  await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
}

export async function chooseInquiryCity(page) {
  const venue = page.getByRole('combobox', { name: 'Venue or city (optional)', exact: true });
  const suggestions = page.getByRole('listbox', { name: 'City suggestions' });
  await venue.click();
  await expect(suggestions).toBeVisible();
  const field = await venue.boundingBox();
  const menu = await suggestions.boundingBox();
  expect(Math.abs(menu.x - field.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(menu.width - field.width)).toBeLessThanOrEqual(1);
  expect(menu.y).toBeGreaterThanOrEqual(field.y + field.height);
  expect(menu.y).toBeLessThanOrEqual(field.y + field.height + 8);
  expect(menu.height).toBeLessThanOrEqual(260);
  await venue.press('ArrowUp');
  await expect(suggestions.getByRole('option', { name: 'Davao City', exact: true })).toBeInViewport();
  await venue.press('Enter');
  await expect(venue).toHaveValue('Davao City');
  await venue.fill('cebu');
  await expect(suggestions.getByRole('option')).toHaveText(['Cebu City']);
  await suggestions.getByRole('option', { name: 'Cebu City', exact: true }).click();
  await expect(venue).toHaveValue('Cebu City');
  await expect(suggestions).toBeHidden();
  await venue.fill('');
  await page.getByRole('heading', { name: 'Where, and on what budget?', exact: true }).click();
  await expect(suggestions).toBeHidden();
  await venue.fill('Custom venue, Batangas');
  await expect(suggestions).toBeHidden();
  await venue.press('Tab');
  await expect(venue).toHaveValue('Custom venue, Batangas');
  await venue.fill('maka');
  await venue.press('Escape');
  await expect(suggestions).toBeHidden();
  await venue.press('ArrowDown');
  await venue.press('Enter');
  await expect(venue).toHaveValue('Makati');
  await expect(suggestions).toBeHidden();
}

export async function checkInquiryConsent(page) {
  await page.getByRole('button', { name: 'Send inquiry', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('Please confirm that PMCM may use your details before sending your inquiry.');
  await expect(page.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Check it, then send it' })).toBeVisible();
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
  await chooseInquiryCity(page);
  await choose(page, 'PHP 150k-500k');
  await choose(page, 'Standard');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Browser Inquiry Client');
  await page.getByLabel('Email', { exact: true }).fill(`inquiry-${randomUUID()}@example.test`);
  await page.getByLabel('Mobile number', { exact: true }).fill('09171234567');
  await choose(page, 'Corporate');
  await choose(page, 'P.R.I.S.M Website');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await checkInquiryConsent(page);
  await page.getByRole('checkbox').check();
  await expect(page.locator('form').getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: 'Send inquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inquiry sent' })).toBeVisible();
  const persisted = await api('GET', `/inquiries?query=${encodeURIComponent(title)}`);
  const inquiry = persisted.find(item => item.eventName === title);
  expect(inquiry?.eventDate).toBeTruthy();
  return inquiry;
}
