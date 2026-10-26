import { z } from 'zod';
import { resolveDatabaseUrl } from '@prism/kernel/database';
import {
  isSessionTtlText,
  MIN_SESSION_SECRET_LENGTH,
  PRISM_SESSION_SECRET_ENV,
  PRISM_SESSION_TTL_ENV,
  PRISM_SESSION_TTL_ROLE_ENV_PREFIX,
} from '../event-session/session-config';
import { mailTransportProblems } from '../mail/mail-config';
import { portalUrlProblems } from './portal-urls';

/**
 * prism-api process configuration. App-internal runtime config, not a shared
 * contract, so it stays in the API kernel instead of `@prism/types`.
 *
 * Only `NODE_ENV=test` may start without a database URL, session secret or session TTL;
 * every other environment fails during bootstrap with the full list of
 * problems instead of failing later on the first request.
 */
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
    PRISM_SESSION_TTL_SECONDS: optionalText,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'test') return;
    addSessionIssues(env, context);
    addDatabaseIssue(env, context);
    addMailAndPortalIssues(env, context);
  });

type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

function addSessionIssues(env: RuntimeEnv, context: z.RefinementCtx) {
  const secret = env[PRISM_SESSION_SECRET_ENV];
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    context.addIssue({
      code: 'custom',
      path: [PRISM_SESSION_SECRET_ENV],
      message: `${PRISM_SESSION_SECRET_ENV} must be set to at least ${MIN_SESSION_SECRET_LENGTH} characters`,
    });
  }

  const ttl = env[PRISM_SESSION_TTL_ENV];
  if (!ttl || !isSessionTtlText(ttl)) {
    context.addIssue({
      code: 'custom',
      path: [PRISM_SESSION_TTL_ENV],
      message: `${PRISM_SESSION_TTL_ENV} must be set to a positive whole number of seconds (8 hours is 28800)`,
    });
  }
  addSessionTtlRoleIssues(env, context);
}

function addSessionTtlRoleIssues(env: RuntimeEnv, context: z.RefinementCtx) {
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(PRISM_SESSION_TTL_ROLE_ENV_PREFIX) || !value) continue;
    if (!isSessionTtlText(String(value))) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} must be a positive whole number of seconds when set`,
      });
    }
  }
}

function addDatabaseIssue(env: RuntimeEnv, context: z.RefinementCtx) {
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
}

function addMailAndPortalIssues(env: RuntimeEnv, context: z.RefinementCtx) {
  const read = (name: string) => {
    const value = env[name];
    return typeof value === 'string' ? value : undefined;
  };
  for (const problem of [...mailTransportProblems(read), ...portalUrlProblems(read)]) {
    context.addIssue({ code: 'custom', path: [problem.name], message: problem.message });
  }
}

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
