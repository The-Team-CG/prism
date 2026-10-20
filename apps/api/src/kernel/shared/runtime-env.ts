import { z } from 'zod';
import { resolveDatabaseUrl } from '@prism/kernel/database';

/**
 * prism-api process configuration. App-internal runtime config, not a shared
 * contract, so it stays in the API kernel instead of `@prism/types`.
 *
 * Only `NODE_ENV=test` may start without a database URL or session secret;
 * every other environment fails during bootstrap with the full list of
 * problems instead of failing later on the first request.
 */
export const MIN_SESSION_SECRET_LENGTH = 32;

const optionalText = z.string().trim().optional();

const runtimeEnvSchema = z
  .looseObject({
    NODE_ENV: optionalText,
    PORT: z
      .string()
      .trim()
      .regex(/^\d+$/, 'PORT must be a whole number')
      .refine((value) => Number(value) > 0 && Number(value) <= 65535, 'PORT must be between 1 and 65535')
      .optional()
      .or(z.literal('')),
    PRISM_SESSION_SECRET: optionalText,
    JWT_SECRET: optionalText,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'test') return;

    const secret = env.PRISM_SESSION_SECRET || env.JWT_SECRET;
    if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
      context.addIssue({
        code: 'custom',
        path: ['PRISM_SESSION_SECRET'],
        message: `PRISM_SESSION_SECRET (or JWT_SECRET) must be set to at least ${MIN_SESSION_SECRET_LENGTH} characters`,
      });
    }

    try {
      if (!resolveDatabaseUrl(env as Record<string, string | undefined>)) {
        context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'DATABASE_URL must be set' });
      }
    } catch (error) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: error instanceof Error ? error.message : 'DATABASE_URL is invalid',
      });
    }
  });

/** `ConfigModule.forRoot({ validate })` hook: returns the env unchanged or throws a readable startup error. */
export function validateRuntimeEnv(env: Record<string, unknown>): Record<string, unknown> {
  const result = runtimeEnvSchema.safeParse(env);
  if (result.success) return env;

  const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
  throw new Error(
    [
      'prism-api environment is invalid:',
      ...problems,
      'Local development: start through start-prism (it generates .local-dev/api.env). Deployments: see apps/api/.env.example.',
    ].join('\n'),
  );
}
