

/** For reads a screen may cancel when the user moves on or asks again. */
export interface EventOpsReadInit {
  signal?: AbortSignal;
}

export interface EventOpsClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null | undefined;
  /**
   * "include" sends the portal's HttpOnly API session cookie with every call (sign-in redesign). Client, supplier and
   * PMCM portals set it; the guest portal signs in with access codes and does not.
   */
  credentials?: RequestCredentials;
  /** Called when a request that carried a bearer token is answered 401. */
  onUnauthorized?: () => void;
  /** Called when a request that carried a bearer token is refused 403 privacy_notice_required. */
  onPrivacyNoticeRequired?: () => void;
}
