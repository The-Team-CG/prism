import type { PrismDocument } from "@prism/types";
import type { ClientPortalView } from "../../workspace/model/client-dashboard-types";

type FileView = Extract<ClientPortalView, `files-${string}`>;

/** Document types are free text from the API; each file route matches on the words its records use. */
const FILE_VIEW_PATTERNS: Partial<Record<FileView, RegExp>> = {
  "files-contracts": /contract|conforme|moa|nda|agreement/i,
  "files-quotations": /quot|proposal|estimate/i,
  "files-invoices-receipts": /invoice|receipt|billing|statement|payment/i,
  "files-event-layouts": /layout|floor/i,
};

/** All files, or only the records a named file route is about. */
export function filterClientFiles(documents: PrismDocument[], view: ClientPortalView | undefined): { documents: PrismDocument[] } {
  const pattern = view ? FILE_VIEW_PATTERNS[view as FileView] : undefined;
  if (!pattern) return { documents };
  return { documents: documents.filter((document) => pattern.test(document.type) || pattern.test(document.fileName)) };
}
