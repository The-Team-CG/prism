import type { PrismStatementOfAccount } from '@prism/types';
import { documentMethodLine } from './document-method-line';
import { A4, PdfDocument, fit, measure, wrap, type Rgb } from './pdf-writer';

/** P.R.I.S.M brand colours, as in the design tokens. */
const C = {
  magenta: [192, 24, 103] as Rgb,
  magentaSoft: [253, 240, 246] as Rgb,
  ink: [23, 18, 22] as Rgb,
  muted: [98, 83, 92] as Rgb,
  line: [234, 213, 206] as Rgb,
  tint: [250, 245, 247] as Rgb,
  white: [255, 255, 255] as Rgb,
  success: [31, 122, 75] as Rgb,
  successSoft: [232, 245, 238] as Rgb,
  danger: [180, 35, 58] as Rgb,
  dangerSoft: [251, 236, 238] as Rgb,
  attention: [184, 72, 15] as Rgb,
  attentionSoft: [255, 240, 230] as Rgb,
  info: [29, 111, 156] as Rgb,
  infoSoft: [233, 247, 251] as Rgb,
};

const MARGIN = 48;
const CONTENT = A4.width - MARGIN * 2;
const BOTTOM = A4.height - 70;

export const pesos = (amount: number) => `PHP ${Math.round(amount).toLocaleString('en-PH')}`;
export function longDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value) : value;
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date) : '—';
}

/** The magenta band with the wordmark on the left and the document's name and number on the right. */
function header(doc: PdfDocument, title: string, number: string | null) {
  doc.rect(0, 0, A4.width, 92, C.magenta);
  doc.text(MARGIN, 44, 'P.R.I.S.M', { size: 22, bold: true, color: C.white });
  doc.text(MARGIN, 62, 'PMCM Events · Event operations', { size: 9, color: C.magentaSoft });
  doc.text(A4.width - MARGIN, 42, title, { size: 15, bold: true, color: C.white, align: 'right' });
  if (number) doc.text(A4.width - MARGIN, 60, number, { size: 10, color: C.magentaSoft, align: 'right' });
}

function footer(doc: PdfDocument, generatedOn: string) {
  doc.line(MARGIN, A4.height - 46, A4.width - MARGIN, A4.height - 46, C.line);
  doc.text(MARGIN, A4.height - 30, `Prepared by P.R.I.S.M on ${longDate(generatedOn)}. Questions? Message PMCM from your portal.`, { size: 8, color: C.muted });
  doc.text(A4.width - MARGIN, A4.height - 30, `Page ${doc.pageCount}`, { size: 8, color: C.muted, align: 'right' });
}

/** Keeps a block on one page: when it would run past the footer, the page is finished and a new one begun. */
function room(doc: PdfDocument, y: number, needed: number, generatedOn: string): number {
  if (y + needed <= BOTTOM) return y;
  footer(doc, generatedOn);
  doc.newPage();
  return 56;
}

/** A fact for the grid: label, value, and how many columns it spans (a long event name gets two). */
type Fact = [label: string, value: string, span?: number];

/** Labelled facts in a grid: a small grey label over its value, filled left to right. */
function facts(doc: PdfDocument, y: number, items: Fact[], columns = 3): number {
  const width = CONTENT / columns;
  let column = 0;
  let row = 0;
  for (const [label, value, span = 1] of items) {
    if (column + span > columns) { column = 0; row += 1; }
    const x = MARGIN + column * width;
    const top = y + row * 38;
    doc.text(x, top, label.toUpperCase(), { size: 7, bold: true, color: C.muted });
    doc.text(x, top + 14, fit(value, width * span - 12, 10, true), { size: 10, bold: true });
    column += span;
  }
  return y + (row + 1) * 38 + 6;
}

/** Figure cards in a row; the last can be highlighted. */
function figures(doc: PdfDocument, y: number, items: Array<{ label: string; value: string; tone?: 'magenta' | 'success' | 'danger' }>): number {
  const gap = 10;
  const width = (CONTENT - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const x = MARGIN + index * (width + gap);
    const fill = item.tone === 'success' ? C.successSoft : item.tone === 'danger' ? C.dangerSoft : item.tone === 'magenta' ? C.magentaSoft : C.tint;
    const ink = item.tone === 'success' ? C.success : item.tone === 'danger' ? C.danger : item.tone === 'magenta' ? C.magenta : C.ink;
    doc.rect(x, y, width, 52, fill);
    doc.text(x + 12, y + 18, item.label, { size: 8, color: C.muted });
    doc.text(x + 12, y + 38, item.value, { size: 14, bold: true, color: ink });
  });
  return y + 66;
}

function sectionTitle(doc: PdfDocument, y: number, title: string): number {
  doc.text(MARGIN, y, title, { size: 11, bold: true });
  doc.line(MARGIN, y + 7, A4.width - MARGIN, y + 7, C.line);
  return y + 22;
}

export type Column = { label: string; width: number; align?: 'left' | 'right' };
export type Cell = string | { text: string; chip?: 'success' | 'danger' | 'attention' | 'info' | 'muted'; muted?: boolean; bold?: boolean };

const CHIP: Record<'success' | 'danger' | 'attention' | 'info' | 'muted', [Rgb, Rgb]> = {
  success: [C.successSoft, C.success],
  danger: [C.dangerSoft, C.danger],
  attention: [C.attentionSoft, C.attention],
  info: [C.infoSoft, C.info],
  muted: [C.tint, C.muted],
};

function drawCell(doc: PdfDocument, x: number, y: number, column: Column, cell: Cell) {
  const value = typeof cell === 'string' ? { text: cell } : cell;
  const right = column.align === 'right';
  if ('chip' in value && value.chip) {
    const [fill, ink] = CHIP[value.chip];
    const width = measure(value.text, 7.5, true) + 12;
    const left = right ? x + column.width - width - 6 : x + 6;
    doc.rect(left, y - 10, width, 14, fill);
    doc.text(left + 6, y, value.text, { size: 7.5, bold: true, color: ink });
    return;
  }
  const text = fit(value.text, column.width - 12, 9.5, value.bold);
  doc.text(right ? x + column.width - 6 : x + 6, y, text, { size: 9.5, bold: value.bold, color: value.muted ? C.muted : C.ink, align: right ? 'right' : 'left' });
}

/** A table with a tinted header row and zebra rows; it continues on a new page, header and all, when it runs out of room. */
export function table(doc: PdfDocument, y: number, columns: Column[], rows: Cell[][], generatedOn: string): number {
  const drawHeader = (top: number) => {
    doc.rect(MARGIN, top, CONTENT, 20, C.tint);
    let x = MARGIN;
    for (const column of columns) {
      doc.text(column.align === 'right' ? x + column.width - 6 : x + 6, top + 13.5, column.label.toUpperCase(), { size: 7, bold: true, color: C.muted, align: column.align === 'right' ? 'right' : 'left' });
      x += column.width;
    }
    return top + 20;
  };
  let top = drawHeader(room(doc, y, 44, generatedOn));
  rows.forEach((row, index) => {
    const next = room(doc, top, 22, generatedOn);
    if (next !== top) top = drawHeader(next);
    if (index % 2 === 1) doc.rect(MARGIN, top, CONTENT, 22, [253, 251, 252]);
    let x = MARGIN;
    row.forEach((cell, column) => {
      drawCell(doc, x, top + 14.5, columns[column], cell);
      x += columns[column].width;
    });
    doc.line(MARGIN, top + 22, A4.width - MARGIN, top + 22, C.line, 0.5);
    top += 22;
  });
  return top + 14;
}

/** Where to send the money, with the reference to use. */
function howToPay(doc: PdfDocument, y: number, methods: Array<{ label: string; details: string }>, reference: string | null, generatedOn: string): number {
  if (methods.length === 0) return y;
  const lines = methods.flatMap((method) => wrap(`${method.label}${method.details ? ` — ${method.details}` : ''}`, CONTENT - 32, 9.5));
  const height = 34 + lines.length * 14 + (reference ? 18 : 0);
  y = room(doc, y, height + 8, generatedOn);
  doc.rect(MARGIN, y, CONTENT, height, C.magentaSoft, C.line);
  doc.text(MARGIN + 16, y + 20, 'How to pay', { size: 10, bold: true, color: C.magenta });
  lines.forEach((line, index) => doc.text(MARGIN + 16, y + 38 + index * 14, line, { size: 9.5 }));
  if (reference) doc.text(MARGIN + 16, y + 38 + lines.length * 14 + 4, `Write ${reference} as the payment reference so PMCM can match it.`, { size: 8.5, color: C.muted });
  return y + height + 16;
}

export interface BillingStatementDocument {
  number: string;
  issuedOn: string;
  clientName: string;
  clientContact: string;
  eventName: string;
  eventDate: string | null;
  lineItems: Array<{ label: string; amount: number }>;
  schedule: Array<{ label: string; percentage: number; amount: number; dueDate?: string }>;
  methods: Array<{ label: string; details: string }>;
  total: number;
}

/** The billing statement PMCM issues: who it is for, what is billed, when each payment is due, and how to pay. */
export function renderBillingStatementPdf(input: BillingStatementDocument): Buffer {
  const doc = new PdfDocument();
  header(doc, 'BILLING STATEMENT', input.number);
  let y = facts(doc, 124, [
    ['Billed to', input.clientName || '—'], ['Contact', input.clientContact || '—'], ['Issued', longDate(input.issuedOn)],
    ['Event', input.eventName, 2], ['Event date', longDate(input.eventDate)],
  ]);
  y = sectionTitle(doc, y + 6, 'What is billed');
  y = table(doc, y, [{ label: 'Description', width: CONTENT - 150 }, { label: 'Amount', width: 150, align: 'right' }],
    [...input.lineItems.map((item) => [item.label, pesos(item.amount)]), [{ text: 'Total', bold: true }, { text: pesos(input.total), bold: true }]], input.issuedOn);
  y = sectionTitle(doc, room(doc, y, 60, input.issuedOn), 'Payment schedule');
  y = table(doc, y, [{ label: 'Payment', width: CONTENT - 300 }, { label: 'Share', width: 80, align: 'right' }, { label: 'Due', width: 100, align: 'right' }, { label: 'Amount', width: 120, align: 'right' }],
    input.schedule.map((item) => [item.label, `${item.percentage}%`, longDate(item.dueDate ?? null), pesos(item.amount)]), input.issuedOn);
  howToPay(doc, y, input.methods, input.number, input.issuedOn);
  footer(doc, input.issuedOn);
  return doc.toBuffer();
}

type Milestone = PrismStatementOfAccount['milestones'][number];

function milestoneChip(milestone: Milestone, today: string): Cell {
  if (milestone.remaining <= 0) return milestone.checking > 0 ? { text: 'BEING CHECKED', chip: 'info' } : { text: `PAID ${longDate(milestone.settledOn).toUpperCase()}`, chip: 'success' };
  if (milestone.disputed > 0 && milestone.remaining <= milestone.disputed) return { text: 'UNDER REVIEW', chip: 'attention' };
  if (milestone.dueDate < today) return { text: 'OVERDUE', chip: 'danger' };
  return milestone.paid > 0 ? { text: 'PART PAID', chip: 'info' } : { text: 'DUE', chip: 'muted' };
}

export interface StatementOfAccountDocument {
  statement: PrismStatementOfAccount;
  clientName: string;
  eventDate: string | null;
  /** Today's Philippine calendar date, YYYY-MM-DD. */
  today: string;
}

/** Everything billed, paid and owed for one event, with a stamp once it is paid in full. */
export function renderStatementOfAccountPdf({ statement, clientName, eventDate, today }: StatementOfAccountDocument): Buffer {
  const doc = new PdfDocument();
  header(doc, 'STATEMENT OF ACCOUNT', statement.statementNumber);
  let y = facts(doc, 124, [['Client', clientName || '—'], ['Event', statement.eventName, 2], ['Event date', longDate(eventDate)]], 4);
  const paidInFull = statement.balance <= 0;
  y = figures(doc, y + 4, [
    { label: 'Billed', value: pesos(statement.billed) },
    { label: 'Received', value: pesos(statement.received) },
    ...(statement.creditHeld > 0 ? [{ label: 'Credit held for you', value: pesos(statement.creditHeld) }] : []),
    { label: paidInFull ? 'Balance' : 'Balance due', value: pesos(statement.balance), tone: paidInFull ? 'success' as const : 'magenta' as const },
  ]);
  y = sectionTitle(doc, y, 'Payment schedule');
  y = table(doc, y, [{ label: 'Payment', width: CONTENT - 360 }, { label: 'Due', width: 90, align: 'right' }, { label: 'Amount', width: 90, align: 'right' }, { label: 'Paid', width: 80, align: 'right' }, { label: 'Status', width: 100, align: 'right' }],
    statement.milestones.map((milestone) => [milestone.label, longDate(milestone.dueDate), pesos(milestone.amount), pesos(milestone.paid), milestoneChip(milestone, today)]), today);
  y = sectionTitle(doc, room(doc, y, 60, today), 'Payments and refunds');
  const lines = statement.lines.length === 0
    ? [[{ text: 'Nothing has been received yet.', muted: true }, '', '', '']]
    : statement.lines.map((line): Cell[] => [
      { text: line.reversed ? 'Undone by PMCM (not counted)' : line.description, muted: line.reversed },
      { text: longDate(line.date), muted: line.reversed },
      { text: [line.method, line.reference].filter(Boolean).join(' · ') || '—', muted: line.reversed },
      // An undone payment carries no sign: it is listed, not counted.
      { text: `${line.reversed ? '' : line.kind === 'refund' ? '-' : '+'}${pesos(line.amount)}`, muted: line.reversed, bold: !line.reversed },
    ]);
  y = table(doc, y, [{ label: 'Entry', width: CONTENT - 345 }, { label: 'Date', width: 80, align: 'right' }, { label: 'Method · reference', width: 165, align: 'right' }, { label: 'Amount', width: 100, align: 'right' }], lines, today);
  if (paidInFull) doc.stamp(A4.width / 2, room(doc, y, 90, today) + 40, 'PAID IN FULL', C.success, 34, 10);
  else howToPay(doc, y, statement.payTo.map(documentMethodLine), statement.statementNumber, today);
  footer(doc, today);
  return doc.toBuffer();
}

export interface PaymentReceiptDocument {
  receiptNumber: string;
  clientName: string;
  eventName: string;
  statementNumber: string | null;
  paymentLabel: string;
  amount: number;
  paidOn: string;
  method: string;
  reference: string;
  recordedOn: string;
}

/** A receipt for one payment PMCM applied: who paid, how much, for what, and how it arrived. */
export function renderPaymentReceiptPdf(input: PaymentReceiptDocument): Buffer {
  const doc = new PdfDocument();
  header(doc, 'PAYMENT RECEIPT', input.receiptNumber);
  doc.text(MARGIN, 136, 'Received from', { size: 9, color: C.muted });
  doc.text(MARGIN, 158, input.clientName || 'The client', { size: 16, bold: true });
  doc.rect(MARGIN, 178, CONTENT, 70, C.magentaSoft);
  doc.text(MARGIN + 18, 202, 'Amount received', { size: 9, color: C.muted });
  doc.text(MARGIN + 18, 232, pesos(input.amount), { size: 26, bold: true, color: C.magenta });
  doc.text(A4.width - MARGIN - 18, 202, 'For', { size: 9, color: C.muted, align: 'right' });
  doc.text(A4.width - MARGIN - 18, 224, fit(input.paymentLabel, 220, 13, true), { size: 13, bold: true, align: 'right' });
  doc.text(A4.width - MARGIN - 18, 240, fit(input.eventName, 220, 9.5), { size: 9.5, color: C.muted, align: 'right' });
  facts(doc, 280, [
    ['Date paid', longDate(input.paidOn)], ['Method', input.method], ['Reference', input.reference || '—'],
    ['Event', input.eventName], ['Billing statement', input.statementNumber ?? '—'], ['Recorded', longDate(input.recordedOn)],
  ]);
  doc.stamp(A4.width - 140, 150, 'RECEIVED', C.success, 30, 14);
  doc.text(MARGIN, 380, 'This receipt confirms the payment PMCM recorded against your billing statement.', { size: 9, color: C.muted });
  footer(doc, input.recordedOn);
  return doc.toBuffer();
}
