import type { PrismPrivacyExportBundle } from "@prism/types";

/** Serializes a privacy access/export bundle into a JSON file for the PMCM operator who executed the request. */
export function privacyExportFileName(bundle: PrismPrivacyExportBundle) {
  return `privacy-export-${bundle.requestId}.json`;
}

export function privacyExportJson(bundle: PrismPrivacyExportBundle) {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function downloadPrivacyExportBundle(bundle: PrismPrivacyExportBundle) {
  const url = URL.createObjectURL(new Blob([privacyExportJson(bundle)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = privacyExportFileName(bundle);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
