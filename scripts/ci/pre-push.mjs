import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependencyClosure, git, ownerOf, selectTasks, workspaces } from './task-plan.mjs';
import { runTasks } from './run-tasks.mjs';

const zeroObject = /^0{40}(?:0{24})?$/;
const objectId = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i;

export function parsePushUpdates(input) {
  return input.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4 || !objectId.test(fields[1]) || !objectId.test(fields[3])) throw new Error('Invalid Git pre-push input.');
    const [localRef, localSha, remoteRef, remoteSha] = fields;
    return { localRef, localSha, remoteRef, remoteSha };
  });
}

function defaultBase(repo) {
  try {
    git(repo, ['rev-parse', '--verify', 'refs/remotes/origin/staging^{commit}']);
    return 'refs/remotes/origin/staging';
  } catch {
    return undefined;
  }
}

export function pushSelection(repo, input) {
  const updates = parsePushUpdates(input).filter((update) => !zeroObject.test(update.localSha));
  if (!updates.length && input.trim()) return { mode: 'skip', reason: 'Only remote ref deletions are being pushed.', files: [], packages: [] };
  const head = git(repo, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const selections = (updates.length ? updates : [{ localSha: head, remoteSha: '0'.repeat(40) }]).map((update) => {
    if (git(repo, ['rev-parse', '--verify', `${update.localSha}^{commit}`]) !== head) {
      throw new Error('Push checks require the pushed commit to be checked out. Check out that branch before pushing it.');
    }
    return selectTasks(repo, { baseRef: zeroObject.test(update.remoteSha) ? defaultBase(repo) : update.remoteSha,
      headRef: update.localSha, tasks: ['lint', 'typecheck'] });
  });
  const full = selections.find((selection) => selection.mode === 'full');
  return full ?? { mode: 'affected', reason: 'Union of pushed workspace changes and their dependents.',
    packages: [...new Set(selections.flatMap((selection) => selection.packages))].sort(),
    files: [...new Set(selections.flatMap((selection) => selection.files))].sort() };
}

export function dirtyCheckInputs(repo, selection) {
  const graph = workspaces(repo);
  const checked = new Set(selection.mode === 'full' ? graph.map((item) => item.name) : dependencyClosure(selection.packages, graph, 'dependencies'));
  const dirty = [...git(repo, ['diff', '--name-only', '-z', 'HEAD', '--']).split('\0'),
    ...git(repo, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0')].filter(Boolean);
  return [...new Set(dirty)].filter((file) => {
    const owner = ownerOf(file, graph);
    if (owner) return checked.has(owner.name) && !/\.md$/i.test(file);
    return /^(?:package(?:-lock)?\.json|turbo\.json|tsconfig[^/]*\.json|eslint[^/]*|\.?oxlint[^/]*|\.npmrc|\.nvmrc|scripts\/|\.github\/workflows\/)/.test(file);
  });
}

export function runPrePush({ repo, input, execute = runTasks }) {
  const selection = pushSelection(repo, input);
  if (selection.mode === 'skip') {
    console.log(selection.reason);
    return 0;
  }
  const dirty = dirtyCheckInputs(repo, selection);
  if (dirty.length) throw new Error(`Push checks must read the committed inputs. Commit or set aside these changed check inputs first:\n${dirty.join('\n')}`);
  return execute({ repo, tasks: ['lint', 'typecheck'], plan: selection });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runPrePush({ repo: git(process.cwd(), ['rev-parse', '--show-toplevel']), input: process.stdin.isTTY ? '' : readFileSync(0, 'utf8') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
