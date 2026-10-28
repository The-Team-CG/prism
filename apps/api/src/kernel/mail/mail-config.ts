/**
 * Pure mail configuration rules, shared by startup validation (runtime-env) and the Nest provider.
 * Nothing here has a default: each transport needs its own variables, and a missing one is a problem
 * that names the variable.
 */
export const MAIL_TRANSPORT_ENV = 'PRISM_MAIL_TRANSPORT';
export const RESEND_API_KEY_ENV = 'RESEND_API_KEY';
export const MAIL_FROM_ENV = 'PRISM_MAIL_FROM';
export const MAILPIT_URL_ENV = 'PRISM_MAILPIT_URL';

export type EnvReader = (name: string) => string | undefined;
export interface EnvProblem {
  name: string;
  message: string;
}

export type MailTransportConfig =
  | { kind: 'resend'; apiKey: string; from: string }
  | { kind: 'mailpit'; url: string }
  | { kind: 'log' };

// "P.R.I.S.M <no-reply@example.com>" or a bare "no-reply@example.com".
const SENDER_PATTERN = /^(?:.+<[^<>\s@]+@[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+)$/;

export function mailTransportProblems(read: EnvReader): EnvProblem[] {
  const transport = read(MAIL_TRANSPORT_ENV)?.trim() ?? '';
  if (transport !== 'resend' && transport !== 'log' && transport !== 'mailpit') {
    const received = transport ? `; received "${transport}"` : '';
    return [{ name: MAIL_TRANSPORT_ENV, message: `is required and must be resend, log or mailpit${received}` }];
  }
  if (transport === 'mailpit') return mailpitProblems(read);
  if (transport === 'log') {
    return read('NODE_ENV')?.trim() === 'production'
      ? [{ name: MAIL_TRANSPORT_ENV, message: 'log writes mail to the API log and cannot run with NODE_ENV=production' }]
      : [];
  }

  const problems: EnvProblem[] = [];
  if (!read(RESEND_API_KEY_ENV)?.trim()) {
    problems.push({ name: RESEND_API_KEY_ENV, message: 'is required when PRISM_MAIL_TRANSPORT=resend' });
  }
  const from = read(MAIL_FROM_ENV)?.trim() ?? '';
  if (!SENDER_PATTERN.test(from)) {
    problems.push({
      name: MAIL_FROM_ENV,
      message: 'is required when PRISM_MAIL_TRANSPORT=resend and must be an address such as P.R.I.S.M <no-reply@yourdomain>',
    });
  }
  return problems;
}

export function resolveMailTransportConfig(read: EnvReader): MailTransportConfig {
  const problems = mailTransportProblems(read);
  if (problems.length > 0) {
    throw new Error(problems.map((problem) => `${problem.name} ${problem.message}`).join('; '));
  }
  if (read(MAIL_TRANSPORT_ENV)?.trim() === 'log') return { kind: 'log' };
  if (read(MAIL_TRANSPORT_ENV)?.trim() === 'mailpit') return { kind: 'mailpit', url: new URL(read(MAILPIT_URL_ENV)!.trim()).origin };
  return {
    kind: 'resend',
    apiKey: read(RESEND_API_KEY_ENV)!.trim(),
    from: read(MAIL_FROM_ENV)!.trim(),
  };
}

function mailpitProblems(read: EnvReader): EnvProblem[] {
  if (read('NODE_ENV')?.trim() === 'production') return [{ name: MAIL_TRANSPORT_ENV, message: 'mailpit captures test mail and cannot run with NODE_ENV=production' }];
  try {
    const url = new URL(read(MAILPIT_URL_ENV)?.trim() ?? '');
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(url.hostname)
      && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return [];
  } catch { /* Report the variable, without echoing its value. */ }
  return [{ name: MAILPIT_URL_ENV, message: 'must be a local HTTP origin (loopback or host.docker.internal) without credentials, path or query' }];
}
