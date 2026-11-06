import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './task-plan.mjs';

export function installHooks(repo, { ci = process.env.CI } = {}) {
  if (ci) return 'skipped';
  git(repo, ['rev-parse', '--git-dir']);
  let existing;
  try { existing = git(repo, ['config', '--get', 'core.hooksPath']); } catch { /* Unconfigured Git uses its default hooks directory. */ }
  if (existing && existing !== '.githooks') {
    console.log(`Preserved existing Git hooks at ${existing}. Run npm run check:push manually or integrate .githooks/pre-push there.`);
    return 'preserved';
  }
  git(repo, ['config', '--local', 'core.hooksPath', '.githooks']);
  console.log('Git pre-push checks installed from .githooks.');
  return 'installed';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    installHooks(resolve(fileURLToPath(new URL('../../', import.meta.url))));
  } catch (error) {
    console.error(`Git hooks were not installed: ${error.message}`);
    process.exitCode = 1;
  }
}
