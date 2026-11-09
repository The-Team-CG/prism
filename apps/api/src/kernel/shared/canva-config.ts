import type { EnvProblem, EnvReader } from '../mail/mail-config';

/**
 * Canva (FR-59, New-P3) is optional. The four connection variables are all or none; each brand template ID is
 * optional and turns on its own action. Canva Connect autofill needs a Canva Enterprise team.
 */
export const CANVA_CONNECTION_ENV = ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI', 'CANVA_TOKEN_KEY'] as const;
export const CANVA_TEMPLATE_ENV = { proposal: 'CANVA_PROPOSAL_TEMPLATE_ID', testimonial: 'CANVA_TESTIMONIAL_TEMPLATE_ID' } as const;
export type CanvaTemplateKey = keyof typeof CANVA_TEMPLATE_ENV;

export type CanvaConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** 32-byte AES-256-GCM key for stored Canva tokens. */
  tokenKey: Buffer;
  templates: Partial<Record<CanvaTemplateKey, string>>;
};

function tokenKey(value: string) {
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}

export function canvaConfigProblems(read: EnvReader): EnvProblem[] {
  const values = CANVA_CONNECTION_ENV.map((name) => read(name)?.trim() ?? '');
  if (values.every((value) => !value)) return [];
  const problems: EnvProblem[] = CANVA_CONNECTION_ENV.filter((_, index) => !values[index]).map((name) => ({ name, message: 'is required when any Canva connection variable is set' }));
  const [, , redirectUri, key] = values;
  if (redirectUri && !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(redirectUri)) problems.push({ name: 'CANVA_REDIRECT_URI', message: 'must be the https URL of /api/integrations/canva/callback' });
  if (key && !tokenKey(key)) problems.push({ name: 'CANVA_TOKEN_KEY', message: 'must be 32 random bytes in base64' });
  return problems;
}

export function resolveCanvaConfig(read: EnvReader): CanvaConfig | null {
  const problems = canvaConfigProblems(read);
  if (problems.length > 0) throw new Error(problems.map((problem) => `${problem.name} ${problem.message}`).join('; '));
  const [clientId, clientSecret, redirectUri, key] = CANVA_CONNECTION_ENV.map((name) => read(name)?.trim() ?? '');
  if (!clientId || !clientSecret || !redirectUri || !key) return null;
  const templates: CanvaConfig['templates'] = {};
  for (const [template, name] of Object.entries(CANVA_TEMPLATE_ENV) as Array<[CanvaTemplateKey, string]>) {
    const id = read(name)?.trim();
    if (id) templates[template] = id;
  }
  return { clientId, clientSecret, redirectUri, tokenKey: tokenKey(key)!, templates };
}
