import { renderTextPdf, wrapPdfText } from '@prism/kernel/shared';

const PAGE_LINES = 44;

function formatPhp(amount: number) {
  return `PHP ${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(amount)}`;
}

/** One-page client copy of an issued proposal: title, summary and total only. Estimate lines never reach this file. */
export function renderProposalPdf(input: { eventName: string; versionNumber: number; title: string; summary: string; revisionNote: string; totalAmount: number; issuedAt: Date }) {
  const lines = [
    'P.R.I.S.M PROPOSAL',
    ...wrapPdfText(`${input.eventName} - version ${input.versionNumber}`),
    `Issued ${input.issuedAt.toISOString().slice(0, 10)}`,
    '',
    ...wrapPdfText(input.title),
    '',
    ...(input.summary.trim() ? [...wrapPdfText(input.summary), ''] : []),
    ...(input.revisionNote.trim() ? [...wrapPdfText(`Changed in this version: ${input.revisionNote}`), ''] : []),
    `Total: ${formatPhp(input.totalAmount)}`,
  ];
  const visible = lines.length > PAGE_LINES
    ? [...lines.slice(0, PAGE_LINES - 2), '', 'Continued in your client portal.']
    : lines;
  return renderTextPdf(visible, PAGE_LINES);
}
