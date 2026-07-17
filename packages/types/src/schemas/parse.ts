import { z } from "zod";

export type PrismContractIssue = {
  path: string;
  message: string;
};

export class PrismContractError extends Error {
  readonly issues: PrismContractIssue[];

  constructor(message: string, issues: PrismContractIssue[]) {
    super(message);
    this.name = "PrismContractError";
    this.issues = issues;
  }
}

function formatIssues(error: z.ZodError): PrismContractIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

/**
 * Parse untrusted input at a boundary. Throws {@link PrismContractError} on failure.
 * Prefer this (or `schema.safeParse`) over trusting raw form/API payloads.
 */
export function parseContract<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
  label = "Request",
): z.infer<TSchema> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issues = formatIssues(result.error);
  const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
  throw new PrismContractError(`${label} failed validation: ${detail}`, issues);
}

/** SafeParse helper that returns a user-facing first error message. */
export function contractErrorMessage(
  error: z.ZodError,
  fallback = "Invalid input",
): string {
  const first = error.issues[0];
  if (!first) return fallback;
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}
