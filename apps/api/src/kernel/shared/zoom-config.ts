import type { EnvProblem, EnvReader } from '../mail/mail-config';

/**
 * Zoom (FR-61) is optional: a Server-to-Server OAuth app's account ID, client ID and secret, all three or none.
 * Without them PMCM pastes its own meeting link; asking P.R.I.S.M to create the Zoom meeting is refused.
 */
export const ZOOM_ENV = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'] as const;

export type ZoomConfig = { accountId: string; clientId: string; clientSecret: string };

export function zoomConfigProblems(read: EnvReader): EnvProblem[] {
  const values = ZOOM_ENV.map((name) => read(name)?.trim() ?? '');
  if (values.every((value) => !value) || values.every(Boolean)) return [];
  return ZOOM_ENV.filter((_, index) => !values[index]).map((name) => ({ name, message: 'is required when any Zoom variable is set' }));
}

export function resolveZoomConfig(read: EnvReader): ZoomConfig | null {
  const problems = zoomConfigProblems(read);
  if (problems.length > 0) throw new Error(problems.map((problem) => `${problem.name} ${problem.message}`).join('; '));
  const [accountId, clientId, clientSecret] = ZOOM_ENV.map((name) => read(name)?.trim() ?? '');
  return accountId && clientId && clientSecret ? { accountId, clientId, clientSecret } : null;
}
