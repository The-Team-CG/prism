import type { EnvProblem, EnvReader } from '../mail/mail-config';

/**
 * Viber (FR-13, FR-25, FR-34, FR-64, FR-75) is optional: with neither variable set, Viber is off and Viber outbox rows
 * are skipped ("Viber is not configured"); the email row still reaches everyone. Setting only one of them is a startup problem.
 */
export const VIBER_AUTH_TOKEN_ENV = 'VIBER_AUTH_TOKEN';
export const VIBER_BOT_URI_ENV = 'VIBER_BOT_URI';

export type ViberConfig = { authToken: string; botUri: string; senderName: string };

const BOT_URI_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

export function viberConfigProblems(read: EnvReader): EnvProblem[] {
  const token = read(VIBER_AUTH_TOKEN_ENV)?.trim() ?? '';
  const uri = read(VIBER_BOT_URI_ENV)?.trim() ?? '';
  if (!token && !uri) return [];
  const problems: EnvProblem[] = [];
  if (!token) problems.push({ name: VIBER_AUTH_TOKEN_ENV, message: `is required when ${VIBER_BOT_URI_ENV} is set` });
  if (!BOT_URI_PATTERN.test(uri)) problems.push({ name: VIBER_BOT_URI_ENV, message: `is required when ${VIBER_AUTH_TOKEN_ENV} is set and must be the bot's URI (letters, digits, dot, dash or underscore)` });
  return problems;
}

export function resolveViberConfig(read: EnvReader): ViberConfig | null {
  const problems = viberConfigProblems(read);
  if (problems.length > 0) throw new Error(problems.map((problem) => `${problem.name} ${problem.message}`).join('; '));
  const authToken = read(VIBER_AUTH_TOKEN_ENV)?.trim();
  const botUri = read(VIBER_BOT_URI_ENV)?.trim();
  return authToken && botUri ? { authToken, botUri, senderName: 'P.R.I.S.M' } : null;
}
