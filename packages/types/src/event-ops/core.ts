export interface PrismProjectLike {
  objects: unknown[];
  guests: unknown[];
  suppliers: unknown[];
}

export type PrismUserRole = "pmcm-admin" | "client" | "coordinator" | "supplier";

export const PRISM_EVENT_OPS_ACTOR_ROLES = [
  "pmcm-admin",
  "client",
  "coordinator",
  "supplier",
  "guest",
  "system",
  "unknown",
] as const;

export type PrismEventOpsActorRole =
  (typeof PRISM_EVENT_OPS_ACTOR_ROLES)[number];

export interface PrismEventOpsActorContext {
  id?: string;
  actorId?: string;
  role?: PrismEventOpsActorRole | string;
  actorRole?: PrismEventOpsActorRole | string;
  email?: string;
  actorEmail?: string;
  name?: string;
  actorName?: string;
  sessionVersion?: number;
  clientName?: string;
  supplierId?: string;
  coordinatorId?: string;
  eventId?: string;
  accessCode?: string;
}

export const PRISM_DEFAULT_PAGE_LIMIT = 25;

export const PRISM_MAX_PAGE_LIMIT = 100;

export interface PrismCursorPageRequest {
  cursor?: string;
  limit?: number;
}

export interface PrismPageRequest extends PrismCursorPageRequest {
  page?: number;
}

export interface PrismCursorPage<TItem> {
  items: TItem[];
  page?: number;
  limit: number;
  total?: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export function normalizePrismPageLimit(limit: unknown): number {
  const numericLimit =
    typeof limit === "number"
      ? limit
      : typeof limit === "string"
        ? Number(limit)
        : NaN;
  if (!Number.isFinite(numericLimit) || numericLimit < 1)
    return PRISM_DEFAULT_PAGE_LIMIT;
  return Math.min(Math.trunc(numericLimit), PRISM_MAX_PAGE_LIMIT);
}

export type PrismSortDirection = "asc" | "desc";

export interface PrismSortClause<TField extends string = string> {
  field: TField;
  direction: PrismSortDirection;
}

export type PrismFilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "in"
  | "before"
  | "after"
  | "between";

export interface PrismFilterClause<TField extends string = string> {
  field: TField;
  operator: PrismFilterOperator;
  value: string | number | boolean | Array<string | number | boolean>;
}

export interface PrismListQuery<TField extends string = string>
  extends PrismPageRequest {
  filters?: PrismFilterClause<TField>[];
  sort?: PrismSortClause<TField>[];
}

export interface PrismFieldError {
  field: string;
  message: string;
  code?: string;
}

export type PrismEmptyReason =
  | "no_data"
  | "not_ready"
  | "permission_denied"
  | "not_configured"
  | "blocked_by_gate"
  | "filtered_out";

export interface PrismApiProblem {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  emptyReason?: PrismEmptyReason;
  fieldErrors?: PrismFieldError[];
  auditReference?: string;
}

export type PrismActionResultStatus =
  | "success"
  | "partial_success"
  | "denied"
  | "retryable_failure"
  | "failed";

export interface PrismActionResult<TData = unknown> {
  status: PrismActionResultStatus;
  message: string;
  data?: TData;
  problem?: PrismApiProblem;
  auditReference?: string;
  notificationReference?: string;
}

export interface PrismUser {
  id: string;
  name: string;
  role: PrismUserRole;
  email: string;
  organization: string;
  approvalStatus: "approved" | "pending" | string;
  lastLoginAt?: string | null;
  lockedUntil?: string | null;
  permanentLockout?: boolean;
  sessionVersion?: number;
  /** Whether two-step sign-in is on; PMCM's account list shows it so an admin can reset it for a lost phone. */
  twoFactorEnabled?: boolean;
}

export interface PrismAuthenticatedSession extends PrismUser {
  accessToken: string;
  expiresAt: string;
  signedInAt: string;
  tokenType?: "Bearer";
}

/** Session returned when sign-in or two-factor completes. */
export interface PrismSignInSession extends PrismAuthenticatedSession {
  /** True until the person acknowledges the current privacy notice version. */
  privacyNoticeRequired: boolean;
}

export interface PrismTwoFactorSetupRequired {
  kind: "two_factor_setup_required";
  token: string;
}

export interface PrismTwoFactorRequired {
  kind: "two_factor_required";
  token: string;
}

export interface PrismTwoFactorSetup {
  kind: "two_factor_setup";
  token: string;
  secret: string;
  otpauthUri: string;
}

/** What the authenticator app needs to add this account; two-step sign-in is on once a code from it is confirmed. */
export interface PrismOwnTwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

export interface PrismTwoFactorQr {
  otpauthUri: string;
}

export type PrismAuthResponse =
  | PrismSignInSession
  | PrismTwoFactorSetupRequired
  | PrismTwoFactorRequired;

/** Same body for every approval request, so the response never reveals whether an account exists. */
export interface PrismApprovalRequestReceipt {
  message: string;
}

/** Same body whether or not the token matched, so an activation response never reveals token state. */
export interface PrismAccountActivationReceipt {
  message: string;
}

/** Result of provisioning an account login. `invited` means the activation email was accepted by the mail provider. */
export type PrismAccountInvitationOutcome =
  | { outcome: "invited"; sentAt: string; expiresAt: string }
  | { outcome: "existing_account" }
  | { outcome: "account_not_active" }
  | { outcome: "role_conflict" }
  | { outcome: "delivery_failed" };

export interface PrismCurrentUser {
  id: string;
  name: string;
  email: string;
  role: PrismUser["role"];
  organization: string;
  twoFactorEnabled: boolean;
  privacyNoticeRequired: boolean;
  /** The privacy notice version this person accepted and when; nulls until they first accept one. */
  privacyNotice: { version: string | null; acknowledgedAt: string | null };
  /** When this person last signed in, which for the signed-in person is this sign-in. */
  lastSignInAt: string | null;
  /** A change of sign-in email waiting for the link sent to the new address; null when there is none. */
  pendingEmail: PrismPendingEmailChange | null;
  expiresAt: string;
}

/** A requested sign-in email, waiting until the link sent to it is opened. */
export interface PrismPendingEmailChange {
  email: string;
  expiresAt: string;
}

/** The result of opening the confirmation link: the email to sign in with from now on. */
export interface PrismEmailChangeConfirmed {
  email: string;
}

/** One of the signed-in person's own recent sign-ins: when, whether it worked, and the browser it came from. */
export interface PrismOwnSignIn {
  id: string;
  at: string;
  succeeded: boolean;
  /** "Chrome on Windows", or "Unknown device" for older entries. */
  device: string;
}

/** A browser the signed-in person is signed in on now. */
export interface PrismOwnSession {
  id: string;
  /** "Chrome on Windows", or "Unknown device". */
  device: string;
  signedInAt: string;
  /** Last request from this browser, to within a few minutes. */
  lastActiveAt: string;
  /** The browser asking. It signs out with Sign out, not from this list. */
  current: boolean;
}

/** How many other browsers "Sign out everywhere else" signed out. */
export interface PrismOwnSessionsSignedOut {
  signedOut: number;
}

/** Identity administration result; carries no secrets or password material. */
export interface PrismIdentityAccountSummary {
  id: string;
  email: string;
  role: PrismUser["role"];
  approvalStatus: string;
  lockedUntil: string | null;
  permanentLockout: boolean;
  failedLoginCount: number;
  lockoutCount: number;
  twoFactorEnabled: boolean;
  sessionVersion: number;
}

export interface PrismVerifiedEventActor extends PrismEventOpsActorContext {
  id: string;
  actorId: string;
  role: PrismEventOpsActorRole;
  actorRole: PrismEventOpsActorRole;
  email: string;
  actorEmail: string;
  name: string;
  actorName: string;
  expiresAt: string;
  /** The signed-in browser's session row, which can be signed out on its own. */
  sessionId: string;
}
