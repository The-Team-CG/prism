export const CLIENT_PORTAL_STATEMENT = "Your event, planned with PMCM.";

export const CLIENT_PORTAL_POINTS = [
  "Follow your event status",
  "Submit floorplan layout preferences",
  "See approved official layouts, read-only",
] as const;

/** The shared "Sign in to P.R.I.S.M." page, for every account with a portal. */
export const FRONT_DOOR_STATEMENT = "Sign in once. We take you to the right place.";

export const FRONT_DOOR_POINTS = [
  "Clients and suppliers get a 6-digit code by email; nothing to remember.",
  "PMCM staff and coordinators use their password and authenticator.",
  "Guests keep their event code or QR pass.",
] as const;
