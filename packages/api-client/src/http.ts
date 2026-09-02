import type { PrismApiProblem, PrismEmptyReason } from "@prism/types";

export const DEFAULT_PRISM_API_BASE_URL = "http://localhost:4000/api";

declare const process: {
  env: Record<string, string | undefined>;
};

const PRISM_EMPTY_REASONS = new Set<PrismEmptyReason>([
  "no_data",
  "not_ready",
  "permission_denied",
  "not_configured",
  "blocked_by_gate",
  "filtered_out",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPrismEmptyReason(value: unknown): value is PrismEmptyReason {
  return typeof value === "string" && PRISM_EMPTY_REASONS.has(value as PrismEmptyReason);
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function mapFieldError(fieldError: Record<string, unknown>) {
  return {
    field: typeof fieldError.field === "string" ? fieldError.field : "unknown",
    message: typeof fieldError.message === "string" ? fieldError.message : "Invalid field value.",
    code: typeof fieldError.code === "string" ? fieldError.code : undefined,
  };
}

function mapFieldErrors(value: unknown): PrismApiProblem["fieldErrors"] {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map(mapFieldError);
}

function problemFromRecord(status: number, body: unknown): PrismApiProblem | null {
  if (!isRecord(body)) return null;
  if (typeof body.code !== "string") return null;
  if (typeof body.message !== "string") return null;
  return {
    code: body.code,
    message: body.message,
    status,
    retryable: typeof body.retryable === "boolean" ? body.retryable : status >= 500,
    emptyReason: isPrismEmptyReason(body.emptyReason) ? body.emptyReason : undefined,
    fieldErrors: mapFieldErrors(body.fieldErrors),
    auditReference: readOptionalString(body, "auditReference"),
  };
}

function fallbackProblemMessage(status: number, body: unknown): string {
  if (isRecord(body)) {
    const message = readOptionalString(body, "message");
    if (message) return message;
  }
  if (typeof body === "string") return body;
  return `P.R.I.S.M API request failed: ${status}`;
}

export function normalizePrismApiProblem(status: number, body: unknown): PrismApiProblem {
  const fromRecord = problemFromRecord(status, body);
  if (fromRecord) return fromRecord;
  return {
    code: status >= 500 ? "api_unavailable" : "api_error",
    message: fallbackProblemMessage(status, body),
    status,
    retryable: status >= 500,
  };
}

export class PrismApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly problem: PrismApiProblem;

  constructor(status: number, body: unknown) {
    const problem = normalizePrismApiProblem(status, body);
    super(problem.message);
    this.name = "PrismApiError";
    this.status = status;
    this.body = body;
    this.problem = problem;
  }
}

export interface PrismRequestInit extends Omit<RequestInit, "body"> {
  authToken?: string | null;
  baseUrl?: string;
  body?: unknown;
}

export function resolvePrismApiBaseUrl(explicitBaseUrl?: string): string {
  return explicitBaseUrl ?? process.env.NEXT_PUBLIC_PRISM_API_BASE_URL ?? DEFAULT_PRISM_API_BASE_URL;
}

export function toQueryString<T extends object>(
  values: { [K in keyof T]?: string | number | boolean | null | undefined },
): string {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function prismRequest<T>(path: string, init: PrismRequestInit = {}): Promise<T> {
  const { authToken, baseUrl, body, headers, ...requestInit } = init;
  const request: RequestInit = {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(headers ?? {}),
    },
  };

  if (body !== undefined) {
    request.body = JSON.stringify(body);
  }

  const response = await fetch(`${resolvePrismApiBaseUrl(baseUrl)}${path}`, request);
  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new PrismApiError(response.status, responseBody);
  }

  if (responseBody && typeof responseBody === "object" && "data" in responseBody) {
    return (responseBody as { data: T }).data;
  }

  return responseBody as T;
}
