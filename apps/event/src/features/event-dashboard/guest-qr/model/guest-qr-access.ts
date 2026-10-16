export function canManageGuestQrPasses(role: string): boolean {
  return role === "pmcm-admin" || role === "system";
}
