export function wrongEventPortalCopy(role: string) {
  if (role === "client") return "Client accounts belong in the client portal at http://localhost:3001.";
  return "Supplier accounts belong in the supplier portal at http://localhost:3002.";
}

export function isUnsupportedEventPortalRole(role: string) {
  return role !== "pmcm-admin" && role !== "coordinator";
}
