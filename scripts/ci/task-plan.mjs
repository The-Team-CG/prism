import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dependencyKinds = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

export function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function workspaces(repo) {
  const root = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  if (JSON.stringify(root.workspaces) !== JSON.stringify(['apps/*', 'packages/*'])) {
    throw new Error('Workspace layout changed; use the full task graph until selection supports it.');
  }
  const entries = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of readdirSync(join(repo, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = `${parent}/${entry.name}`;
      const manifest = JSON.parse(readFileSync(join(repo, directory, 'package.json'), 'utf8'));
      if (typeof manifest.name !== 'string' || entries.some((item) => item.name === manifest.name)) {
        throw new Error(`Missing or duplicate workspace name: ${directory}`);
      }
      entries.push({ name: manifest.name, directory, scripts: manifest.scripts ?? {},
        dependencies: dependencyKinds.flatMap((kind) => Object.keys(manifest[kind] ?? {})) });
    }
  }
  return entries;
}

export function dependencyClosure(names, graph, direction = 'dependents') {
  const selected = new Set(names);
  let previousSize;
  do {
    previousSize = selected.size;
    for (const item of graph) {
      if (direction === 'dependents' && item.dependencies.some((name) => selected.has(name))) selected.add(item.name);
      if (direction === 'dependencies' && selected.has(item.name)) {
        for (const name of item.dependencies) if (graph.some((candidate) => candidate.name === name)) selected.add(name);
      }
    }
  } while (selected.size !== previousSize);
  return [...selected].sort();
}

export function ownerOf(file, graph) {
  return graph.find((item) => file.startsWith(`${item.directory}/`));
}

export function selectTasks(repo, { baseRef, headRef = 'HEAD', tasks = [] } = {}) {
  let graph;
  const full = (reason, files = []) => ({ mode: 'full', reason, files, packages: graph?.map((item) => item.name).sort() ?? [] });
  try {
    graph = workspaces(repo);
    if (!baseRef) return full('No trusted comparison base; running the full graph.');
    const base = git(repo, ['merge-base', baseRef, headRef]);
    const files = git(repo, ['diff', '--name-only', '-z', base, headRef, '--']).split('\0').filter(Boolean);
    if (!files.length) return full('The comparison selected no files; running the full graph.');
    if (files.some((file) => !ownerOf(file, graph) || /(?:^|\/)package\.json$/.test(file))) {
      return full('Global input, workspace manifest, or unmapped path changed.', files);
    }
    const packages = dependencyClosure(files.map((file) => ownerOf(file, graph).name), graph);
    if (!packages.length || (tasks.length && !graph.some((item) => packages.includes(item.name) && tasks.some((task) => item.scripts[task])))) {
      return full('No runnable tasks in the selection; running the full graph.', files);
    }
    return { mode: 'affected', reason: 'Changed workspaces and every dependent.', files, packages };
  } catch (error) {
    return full(`Selection could not be proven: ${error.message}`);
  }
}

export function taskArguments(tasks, plan, { concurrency } = {}) {
  if (!tasks.length || tasks.some((task) => !['lint', 'typecheck', 'test:ci', 'build'].includes(task))) {
    throw new Error('Expected lint, typecheck, test:ci, or build tasks.');
  }
  if (plan.mode !== 'full' && (plan.mode !== 'affected' || !plan.packages.length)) throw new Error('Invalid task selection.');
  if (concurrency !== undefined && !/^\d+$/.test(String(concurrency))) throw new Error('Concurrency must be a positive integer.');
  if (concurrency !== undefined && Number(concurrency) < 1) throw new Error('Concurrency must be a positive integer.');
  return ['run', ...tasks, ...(concurrency === undefined ? [] : [`--concurrency=${concurrency}`]),
    ...(plan.mode === 'affected' ? plan.packages.map((name) => `--filter=${name}`) : [])];
}
