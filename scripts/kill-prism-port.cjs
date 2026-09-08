const { execFileSync, execSync } = require('node:child_process');
const { hasWorktreeSegment, isOwnedByThisCheckout } = require('./port-ownership.cjs');

const presets = {
  api: [
    'api',
    'dist\\apps\\api\\main',
    'dist/apps/api/main',
    'dist\\apps\\api\\src\\main',
    'dist/apps/api/src/main',
    'prism-api\\dist\\apps\\api\\main',
    'prism-api/dist/apps/api/main',
    'prism-api\\dist\\apps\\api\\src\\main',
    'prism-api/dist/apps/api/src/main',
    'apps\\api',
    'apps/api',
    'kill-prism-port.cjs',
    'kill-prism-api-port.cjs',
    'nest start api',
  ],
  event: ['apps\\event', 'apps/event', 'next dev --port 3004', 'next start --port 3004', 'next-server'],
  client: ['apps\\client', 'apps/client', 'next dev --port 3001', 'next start --port 3001', 'next-server'],
  supplier: ['apps\\supplier', 'apps/supplier', 'next dev --port 3002', 'next start --port 3002', 'next-server'],
  guest: ['apps\\guest', 'apps/guest', 'next dev --port 3003', 'next start --port 3003', 'next-server'],
};

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const app = readArg('--app', process.env.PRISM_PORT_APP || 'api');
const defaultPort = app === 'api' ? 4000 : 0;
const port = Number(readArg('--port', process.env.PORT || defaultPort));
/** Checkout that owns this invocation; used to refuse killing another worktree's stack. */
const ownerRoot = readArg('--root', process.cwd());
const markers = presets[app];
if (!markers || !Number.isFinite(port) || port <= 0) {
  console.error('[port-guard] Usage: node scripts/kill-prism-port.cjs --app <api|event|client|supplier|guest> --port <n>');
  process.exit(1);
}

const mode = String(process.env.PORT_GUARD_MODE || 'lenient').toLowerCase();

function log(...args) {
  console.log('[port-guard]', ...args);
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function runPowerShell(command) {
  return execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim();
}

function getPortPids() {
  try {
    const stdout = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: 'utf8' });
    const lines = stdout.split(/\r?\n/);
    const pids = new Set();

    for (const line of lines) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 5) continue;

      const [, localAddress, , state, pidText] = columns;
      if (state !== 'LISTENING') continue;
      if (!localAddress.endsWith(`:${port}`)) continue;

      const pid = Number(pidText);
      if (Number.isFinite(pid) && pid > 0) {
        pids.add(pid);
      }
    }

    return [...pids];
  } catch {
    return [];
  }
}

function getProcInfo(pid) {
  try {
    const json = runPowerShell(
      `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object ProcessId,Name,CommandLine,ExecutablePath,ParentProcessId | ConvertTo-Json`,
    );

    if (!json) return null;

    const row = JSON.parse(json);
    if (!row || !row.ProcessId) return null;

    return {
      pid: Number(row.ProcessId),
      name: normalize(row.Name),
      commandLine: normalize(row.CommandLine),
      executablePath: normalize(row.ExecutablePath),
      parentPid: Number(row.ParentProcessId) || 0,
    };
  } catch {
    try {
      const json = runPowerShell(
        `Get-Process -Id ${pid} | Select-Object Id,ProcessName,Path,StartTime | ConvertTo-Json`,
      );
      if (!json) return null;

      const row = JSON.parse(json);
      if (!row || row.Id === undefined) return null;

      return {
        pid: Number(row.Id),
        name: normalize(row.ProcessName),
        commandLine: '',
        executablePath: normalize(row.Path),
        parentPid: 0,
      };
    } catch {
      return {
        pid,
        name: '',
        commandLine: '',
        executablePath: '',
        parentPid: 0,
      };
    }
  }
}

function isPrismCandidate(procInfo) {
  if (!procInfo || procInfo.name !== 'node') return false;

  const combined = [procInfo.commandLine, procInfo.executablePath, procInfo.name].join(' ');
  return markers.some((marker) => combined.includes(normalize(marker)));
}

function getChildrenMap(processes) {
  const map = new Map();

  for (const proc of processes) {
    if (!proc) continue;
    if (!map.has(proc.pid)) map.set(proc.pid, []);

    if (proc.parentPid > 0 && processes.some((entry) => entry && entry.pid === proc.parentPid)) {
      if (!map.has(proc.parentPid)) map.set(proc.parentPid, []);
      map.get(proc.parentPid).push(proc.pid);
    }
  }

  return map;
}

function collectDescendants(seedPids, childrenMap) {
  const out = new Set();
  const queue = [...seedPids];

  while (queue.length) {
    const current = queue.shift();
    if (!current || out.has(current)) continue;
    out.add(current);

    const children = childrenMap.get(current) || [];
    for (const child of children) queue.push(child);
  }

  return out;
}

function stopPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
    log(`Stopped PID ${pid}`);
    return true;
  } catch {
    return false;
  }
}

function describeProcess(proc) {
  if (!proc) return 'unknown process';
  return `PID=${proc.pid}, Name=${proc.name || 'unknown'}, Path=${proc.executablePath || 'n/a'}, CommandLine=${proc.commandLine || 'n/a'}`;
}

function printManualCleanup(blockers) {
  log(`Unable to safely clear port ${port}. Active blocker(s):`);
  for (const proc of blockers) {
    log(`  ${describeProcess(proc)}`);
  }

  const ids = blockers.map((proc) => proc.pid).join(', ');
  log('Manual fallback:');
  log(`  taskkill /PID ${ids} /F /T`);
}

const rawPids = getPortPids().filter((pid) => pid > 0);
if (rawPids.length === 0) {
  process.exit(0);
}

const blockers = rawPids.map(getProcInfo).filter(Boolean);
log(`Detected ${rawPids.length} process(es) on port ${port}.`);
for (const proc of blockers) {
  log(describeProcess(proc));
}

const childrenMap = getChildrenMap(blockers);
const mayUseLenientFallback = (proc) => !proc.commandLine && !hasWorktreeSegment([proc.commandLine, proc.executablePath].join(' '));
const foreignPids = new Set(
  blockers
    .filter((proc) => !isOwnedByThisCheckout(proc, ownerRoot) && !mayUseLenientFallback(proc))
    .map((proc) => proc.pid),
);
const confirmedRoots = blockers.filter((proc) => isPrismCandidate(proc) && !foreignPids.has(proc.pid));
const confirmedSet = new Set(confirmedRoots.map((proc) => proc.pid));
const confirmedWithDescendants = collectDescendants([...confirmedSet], childrenMap);

let toKill = new Set(confirmedWithDescendants);
const nodeWithoutCommandLine = blockers.filter((proc) => proc.name === 'node' && !proc.commandLine);
const hasUnverifiedNode = nodeWithoutCommandLine.some((proc) => !confirmedSet.has(proc.pid));

if (mode === 'force') {
  if (confirmedSet.size === 0) {
    log(`PORT_GUARD_MODE=force: no confirmed ${app} processes identified.`);
    printManualCleanup(blockers);
    process.exit(1);
  }

  log(`PORT_GUARD_MODE=force: only confirmed ${app} process chain will be stopped.`);
} else {
  if (hasUnverifiedNode && confirmedSet.size === 0) {
    log('Lenient fallback: command-line unavailable for one or more node blockers; clearing node processes on this port.');
    for (const proc of nodeWithoutCommandLine) {
      toKill.add(proc.pid);
    }
  }
}

if (foreignPids.size > 0) {
  log(`Refusing to stop ${foreignPids.size} process(es) owned by another checkout on port ${port}.`);
}

const killList = [...toKill].filter((pid) => pid > 0 && !foreignPids.has(pid));
if (killList.length === 0) {
  printManualCleanup(blockers);
  process.exit(1);
}

let killedAny = false;
for (const pid of killList) {
  if (stopPid(pid)) killedAny = true;
}

if (!killedAny) {
  log('Failed to stop identified blockers.');
  printManualCleanup(blockers);
  process.exit(1);
}

if (mode === 'lenient' && hasUnverifiedNode && confirmedSet.size === 0) {
  log('Warning: lenient fallback killed node process(es) without strong app marker due command-line access issues.');
}

setTimeout(() => process.exit(0), 600);
