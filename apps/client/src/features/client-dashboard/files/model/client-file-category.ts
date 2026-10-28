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

export type ClientFileFilter = {
  documents: PrismDocument[];
  /** False when the records carry no field that can answer this route's question. */
  filtered: boolean;
};

export function filterClientFiles(documents: PrismDocument[], view: ClientPortalView | undefined): ClientFileFilter {
  const pattern = view ? FILE_VIEW_PATTERNS[view as FileView] : undefined;
  if (!pattern) return { documents, filtered: view === "files-all" || !view?.startsWith("files-") };
  return { documents: documents.filter((document) => pattern.test(document.type) || pattern.test(document.fileName)), filtered: true };
}
