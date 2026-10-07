import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const app = process.argv[2];
const ports = { client: '3001', supplier: '3002', guest: '3003', event: '3004' };
if (app !== 'api' && !ports[app]) throw new Error('Select api, client, supplier, guest or event.');
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
function run(args, cwd = process.cwd()) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code ?? 1); });
}
// Each container keeps its own compiled package output; no cross-container write races.
run([require.resolve('typescript/bin/tsc'), '--watch', '-p', 'packages/types/tsconfig.build.json']);
// Spawn the API directly: shell grandchildren otherwise survive reload on slim images.
if (app === 'api') run([require.resolve('@nestjs/cli/bin/nest.js'), 'start', 'api', '--watch', '--no-shell'], resolve('apps/api'));
else run([require.resolve('next/dist/bin/next'), 'dev', `apps/${app}`, '-p', ports[app], '--hostname', '0.0.0.0']);
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
