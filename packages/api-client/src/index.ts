export const DEFAULT_PRISM_API_BASE_URL = "http://localhost:4000/api";

declare const process: {
  env: Record<string, string | undefined>;
};

export function resolvePrismApiBaseUrl(explicitBaseUrl?: string): string {
  return explicitBaseUrl ?? process.env.NEXT_PUBLIC_PRISM_API_BASE_URL ?? DEFAULT_PRISM_API_BASE_URL;
}

export async function prismJson<T>(path: string, init?: RequestInit & { baseUrl?: string }): Promise<T> {
  const baseUrl = resolvePrismApiBaseUrl(init?.baseUrl);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`P.R.I.S.M API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
