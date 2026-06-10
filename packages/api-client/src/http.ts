export const DEFAULT_PRISM_API_BASE_URL = "http://localhost:4000/api";

declare const process: {
  env: Record<string, string | undefined>;
};

export class PrismApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`P.R.I.S.M API request failed: ${status}`);
    this.name = "PrismApiError";
    this.status = status;
    this.body = body;
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

  return responseBody as T;
}
