import { PRISM_PRIVACY_NOTICE } from "./privacy-notice.js";

/** Current notice presented before a personal-data collection request. */
export const PRISM_PRIVACY_NOTICE_VERSION = PRISM_PRIVACY_NOTICE.version;

/** Problem code the API returns (403) when a signed-in account has not acknowledged the current notice. */
export const PRISM_PRIVACY_NOTICE_REQUIRED_CODE = "privacy_notice_required";

/** True when an account's acknowledged notice version is not the current one (missing counts as pending). */
export function privacyNoticeRequired(acknowledgedVersion: string | null | undefined): boolean {
  return acknowledgedVersion !== PRISM_PRIVACY_NOTICE_VERSION;
}
