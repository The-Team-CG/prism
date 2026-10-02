export const DEFAULT_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS = 7;

const MAX_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS = 365;

export function coordinatorAcknowledgementLeadTimeDays(
  configuredValue = process.env.PRISM_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS,
) {
  if (configuredValue == null || configuredValue.trim() === "") {
    return DEFAULT_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS;
  }

  const parsed = Number(configuredValue);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS
  ) {
    return DEFAULT_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS;
  }
  return parsed;
}
