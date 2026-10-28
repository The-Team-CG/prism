import { spawnSync } from 'node:child_process';

export const MAILPIT_IMAGE = 'axllent/mailpit:v1.32.0';
const label = 'com.prism.local-mailpit';
function docker(args, { allowMissing = false } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error || (result.status !== 0 && !allowMissing)) throw new Error(`Local Mailpit Docker command failed (${args[0]}). Check Docker Desktop.`);
  return result;
}
function assertIdentity(name) {
  if (!/^prism-mailpit-[a-z0-9-]+$/.test(name)) throw new Error('Invalid local Mailpit container identity.');
}
function owned(name) {
  const existing = docker(['inspect', '--format', `{{index .Config.Labels "${label}"}}`, name], { allowMissing: true });
  if (existing.status !== 0) return false;
  if (existing.stdout.trim() !== name) throw new Error('Mailpit container name belongs to another process.');
  return true;
}
export async function startMailpit({ name, port }) {
  assertIdentity(name);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local Mailpit port.');
  if (owned(name)) docker(['start', name]);
  else docker(['run', '-d', '--name', name, '--label', `${label}=${name}`, '-p', `127.0.0.1:${port}:8025`,
    '-e', 'MP_DISABLE_VERSION_CHECK=true', '-e', 'MP_SMTP_DISABLE_RDNS=true', MAILPIT_IMAGE]);
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await fetch(`${url}/api/v1/info`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false)) return url;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Local Mailpit did not become healthy.');
}
export function stopMailpit(name, { remove = false } = {}) {
  assertIdentity(name);
  if (owned(name)) docker(remove ? ['rm', '-f', name] : ['stop', name]);
}
