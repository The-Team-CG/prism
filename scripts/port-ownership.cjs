const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LEASE_VERSION = 1;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function normalizeCheckoutRoot(value) {
  return normalizePath(path.resolve(String(value || '.')));
}

function hasWorktreeSegment(value) {
  return /(^|\/)\.worktrees(?:\/|$)/i.test(normalizePath(value));
}

function containsPathAtBoundary(haystack, candidate) {
  const normalizedHaystack = normalizePath(haystack);
  const normalizedCandidate = normalizePath(candidate);
  return Boolean(normalizedCandidate) && normalizedHaystack.includes(`${normalizedCandidate}/`);
}

function commonGitDir(ownerRoot) {
  return execFileSync('git', ['-C', ownerRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
}

function leaseDirectory(ownerRoot) {
  return path.join(commonGitDir(ownerRoot), 'prism-port-leases');
}

function leaseName(ownerRoot, app) {
  return `${crypto.createHash('sha256').update(`${normalizeCheckoutRoot(ownerRoot)}\0${app}`).digest('hex')}.json`;
}

function leasePath(ownerRoot, app) {
  return path.join(leaseDirectory(ownerRoot), leaseName(ownerRoot, app));
}

function atomicWrite(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function processIdentity({ pid, startTime, executablePath, parentPid, parentStartTime }) {
  return { pid: Number(pid), startTime: Number(startTime), executablePath: normalizePath(executablePath), parentPid: Number(parentPid) || 0, parentStartTime: Number(parentStartTime) || 0 };
}

function readProcessIdentity(pid) {
  const json = execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(pid)}" | Select-Object ProcessId,ExecutablePath,ParentProcessId,@{Name='StartTime';Expression={$_.CreationDate.ToFileTimeUtc()}} | ConvertTo-Json`], { encoding: 'utf8' }).trim();
  const row = JSON.parse(json);
  return processIdentity({ pid: row.ProcessId, startTime: row.StartTime, executablePath: row.ExecutablePath, parentPid: row.ParentProcessId });
}

function writeCheckoutLease({ ownerRoot, app, identity }) {
  const filePath = leasePath(ownerRoot, app);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lease = {
    version: LEASE_VERSION,
    leaseToken: crypto.randomUUID(),
    ownerRoot: normalizeCheckoutRoot(ownerRoot),
    app,
    ...processIdentity(identity),
    writtenAt: Date.now(),
  };
  atomicWrite(filePath, lease);
  return lease;
}

function removeCheckoutLease({ ownerRoot, app, lease, identity, leaseToken }) {
  if (!lease && !identity && !leaseToken) return false;
  try {
    const filePath = leasePath(ownerRoot, app);
    const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const expected = lease || identity || {};
    if (current.ownerRoot !== normalizeCheckoutRoot(ownerRoot) || current.app !== app) return false;
    if (leaseToken && current.leaseToken !== leaseToken) return false;
    if (expected.leaseToken && current.leaseToken !== expected.leaseToken) return false;
    if (expected.pid !== undefined && Number(current.pid) !== Number(expected.pid)) return false;
    if (expected.startTime !== undefined && Number(current.startTime) !== Number(expected.startTime)) return false;
    fs.rmSync(filePath, { force: true });
  } catch {
    return false;
  }
  return true;
}

function readCheckoutLeases(ownerRoot) {
  const directory = leaseDirectory(ownerRoot);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      try {
        const lease = JSON.parse(fs.readFileSync(path.join(directory, entry.name), 'utf8'));
        return lease && lease.version === LEASE_VERSION && lease.ownerRoot && lease.app ? lease : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function leaseMatchesProcess(lease, procInfo) {
  return Number(lease.pid) === Number(procInfo.pid)
    && Number(lease.startTime) > 0
    && Number(lease.startTime) === Number(procInfo.startTime);
}

function leaseForProcessChain(chain, leases, app) {
  for (const procInfo of chain) {
    const lease = leases.find((candidate) => candidate.app === app && leaseMatchesProcess(candidate, procInfo));
    if (lease) return { lease, process: procInfo };
  }
  return null;
}

function ownershipFromLeases(procInfo, ownerRoot, leases, app) {
  const lease = leases.find((candidate) => (!app || candidate.app === app) && leaseMatchesProcess(candidate, procInfo));
  if (!lease) return 'unknown';
  return normalizeCheckoutRoot(lease.ownerRoot) === normalizeCheckoutRoot(ownerRoot) ? 'owned' : 'foreign';
}

module.exports = {
  commonGitDir,
  containsPathAtBoundary,
  hasWorktreeSegment,
  // Diagnostic compatibility helper only. Kill authorization uses leases below.
  isOwnedByThisCheckout: ({ commandLine, executablePath } = {}, ownerRoot) => {
    const owner = normalizeCheckoutRoot(ownerRoot);
    const combined = normalizePath([commandLine, executablePath].filter(Boolean).join(' '));
    if (!owner || !combined) return false;
    if (!hasWorktreeSegment(owner) && hasWorktreeSegment(combined)) return false;
    return containsPathAtBoundary(combined, owner);
  },
  leaseMatchesProcess,
  leaseForProcessChain,
  leasePath,
  normalizeCheckoutRoot,
  normalizePath,
  ownershipFromLeases,
  readProcessIdentity,
  readCheckoutLeases,
  removeCheckoutLease,
  writeCheckoutLease,
};
