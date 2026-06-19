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

export function normalizePrismApiProblem(status: number, body: unknown): PrismApiProblem {
  if (isRecord(body) && typeof body.code === "string" && typeof body.message === "string") {
    return {
      code: body.code,
      message: body.message,
      status,
      retryable: typeof body.retryable === "boolean" ? body.retryable : status >= 500,
      emptyReason: isPrismEmptyReason(body.emptyReason) ? body.emptyReason : undefined,
      fieldErrors: Array.isArray(body.fieldErrors)
        ? body.fieldErrors.filter(isRecord).map((fieldError) => ({
            field: typeof fieldError.field === "string" ? fieldError.field : "unknown",
            message: typeof fieldError.message === "string" ? fieldError.message : "Invalid field value.",
            code: typeof fieldError.code === "string" ? fieldError.code : undefined,
          }))
        : undefined,
      auditReference: typeof body.auditReference === "string" ? body.auditReference : undefined,
    };
  }

  const fallbackMessage = isRecord(body) && typeof body.message === "string" ? body.message : undefined;

  return {
    code: status >= 500 ? "api_unavailable" : "api_error",
    message: fallbackMessage ?? (typeof body === "string" ? body : `P.R.I.S.M API request failed: ${status}`),
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
  const { baseUrl, body, headers, ...requestInit } = init;
  const request: RequestInit = {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
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
