import { renderTextPdf, wrapPdfText } from '@prism/kernel/shared';

/** Printable copy of the conforme document PMCM sends for physical signing. The hash lets the scan be matched to this version. */
export function renderConformePdf(input: { documentContent: string; documentSha256: string; templateVersion: number }) {
  return renderTextPdf([
    ...wrapPdfText(input.documentContent),
    '',
    `Template version ${input.templateVersion}`,
    `Document SHA-256: ${input.documentSha256}`,
  ]);
}
