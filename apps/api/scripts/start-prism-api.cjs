const { execFileSync, spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const { createRequire } = require('node:module');
const {
  readProcessIdentity,
  removeCheckoutLease,
  writeCheckoutLease,
} = require(path.join(__dirname, '..', '..', '..', 'scripts', 'port-ownership.cjs'));

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..', '..');
const ownerRoot = readArg('--root', process.env.PRISM_CHECKOUT_ROOT || repoRoot);
const mode = readArg('--mode', process.argv[2] || 'dev');
const app = 'api';
const port = String(process.env.PORT || 4000);
const guard = spawnSync(process.execPath, [
  path.join(repoRoot, 'scripts', 'kill-prism-port.cjs'),
  '--app', app,
  '--port', port,
  '--root', ownerRoot,
], { stdio: 'inherit' });
if (guard.status !== 0) process.exit(guard.status ?? 1);

let childArgs;
if (mode === 'dev') {
  const require = createRequire(path.join(apiRoot, 'package.json'));
  childArgs = [require.resolve('@nestjs/cli/bin/nest.js'), 'start', 'api', '--watch'];
} else if (mode === 'start') {
  childArgs = [path.join(apiRoot, 'dist', 'apps', 'api', 'src', 'main.js')];
} else {
  console.error(`[api] Unknown mode: ${mode}`);
  process.exit(1);
}

const child = spawn(process.execPath, childArgs, {
  cwd: apiRoot,
  stdio: 'inherit',
  env: { ...process.env, PRISM_CHECKOUT_ROOT: ownerRoot },
});

let leaseWritten = false;
try {
  const identity = readProcessIdentity(child.pid);
  if (!identity.startTime) throw new Error('process start identity was unavailable');
  writeCheckoutLease({ ownerRoot, app, identity });
  leaseWritten = true;
} catch (error) {
  console.error(`[api] Refusing to run without a durable checkout lease: ${error.message}`);
  try { child.kill(); } catch {}
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  process.exit(1);
}

let shuttingDown = false;
let shutdownTimer;
const signalHandlers = {};
const removeSignalHandlers = () => {
  for (const [signal, handler] of Object.entries(signalHandlers)) process.removeListener(signal, handler);
};
const forwardSignal = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  try { child.kill(signal); } catch {}
  shutdownTimer = setTimeout(() => {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }, 5000);
  shutdownTimer.unref();
};
signalHandlers.SIGINT = () => forwardSignal('SIGINT');
signalHandlers.SIGTERM = () => forwardSignal('SIGTERM');
process.on('SIGINT', signalHandlers.SIGINT);
process.on('SIGTERM', signalHandlers.SIGTERM);

child.on('exit', (code, signal) => {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  if (leaseWritten) removeCheckoutLease({ ownerRoot, app });
  if (signal) {
    removeSignalHandlers();
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 0;
});
