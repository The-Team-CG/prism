import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ownership from './port-ownership.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = join(root, '.local-dev/compose-watch.json');
const { readProcessIdentity } = ownership;
function current() {
  if (!existsSync(stateFile)) return null;
  const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
  try {
    const live = readProcessIdentity(saved.pid);
    return live.startTime === saved.startTime && live.executablePath === saved.executablePath ? live : null;
  } catch { return null; }
}
if (process.argv[2] === 'stop') {
  const live = current();
  if (live) {
    const stopped = spawnSync('taskkill', ['/PID', String(live.pid), '/T', '/F'], { stdio: 'inherit', windowsHide: true });
    if (stopped.status !== 0) throw new Error('Could not stop owned Compose Watch process.');
  }
  rmSync(stateFile, { force: true });
} else if (!current()) {
  mkdirSync(dirname(stateFile), { recursive: true });
  const log = openSync(join(root, '.local-dev/compose-watch.log'), 'a');
  const child = spawn('docker', ['compose', '-f', 'compose.dev.yml', 'watch', '--no-up'], { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  try {
    await new Promise((resolveReady, reject) => {
      child.once('spawn', resolveReady);
      child.once('error', reject);
    });
    writeFileSync(stateFile, JSON.stringify(readProcessIdentity(child.pid)));
    child.unref();
  } catch (error) {
    child.kill();
    throw error;
  } finally { closeSync(log); }
}
