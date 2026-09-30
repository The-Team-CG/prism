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
}

export interface PrismAuthenticatedSession extends PrismUser {
  accessToken: string;
  expiresAt: string;
  signedInAt: string;
  tokenType?: "Bearer";
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

export type PrismAuthResponse =
  | PrismAuthenticatedSession
  | PrismTwoFactorSetupRequired
  | PrismTwoFactorRequired;

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
}
