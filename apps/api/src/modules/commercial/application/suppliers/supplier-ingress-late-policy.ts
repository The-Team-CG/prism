export const DEFAULT_SUPPLIER_INGRESS_LATE_GRACE_MINUTES = 15;

const MAX_SUPPLIER_INGRESS_LATE_GRACE_MINUTES = 24 * 60;

export function supplierIngressLateGraceMinutes(
  configuredValue = process.env.PRISM_SUPPLIER_INGRESS_LATE_GRACE_MINUTES,
) {
  if (configuredValue == null || configuredValue.trim() === '') {
    return DEFAULT_SUPPLIER_INGRESS_LATE_GRACE_MINUTES;
  }

  const parsed = Number(configuredValue);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_SUPPLIER_INGRESS_LATE_GRACE_MINUTES
  ) {
    return DEFAULT_SUPPLIER_INGRESS_LATE_GRACE_MINUTES;
  }
  return parsed;
}
