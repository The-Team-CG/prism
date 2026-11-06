import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaces } from './ci/task-plan.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const runs = Number(args.find((arg) => arg.startsWith('--runs='))?.split('=')[1] ?? 5);
const project = args.find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer.');
const projects = workspaces(root).filter((item) => item.scripts.typecheck && (!project || item.directory === project));
if (!projects.length) throw new Error('No matching typecheck project.');
const observations = [];
mkdirSync(resolve(root, '.local-dev'), { recursive: true });
const artifact = resolve(root, '.local-dev/typecheck-benchmark.json');
for (let iteration = 0; iteration < runs; iteration += 1) {
  // Rotate execution order so every compiler gets both earlier and later runs.
  const compilers = ['legacy', 'native', 'bun'];
  const ordered = [...compilers.slice(iteration % 3), ...compilers.slice(0, iteration % 3)];
  for (const compiler of ordered) {
    const started = performance.now();
    for (const item of projects) {
      const result = spawnSync(process.execPath, [resolve(root, 'scripts/typescript.mjs'), `--compiler=${compiler}`,
        '--noEmit', '--incremental', 'false', '-p', resolve(root, item.directory, 'tsconfig.json')],
      { cwd: root, encoding: 'utf8', windowsHide: true });
      if (result.error || result.status !== 0) {
        console.error(result.stdout, result.stderr);
        throw result.error ?? new Error(`${compiler} failed in ${item.name}; failed checks are not performance samples.`);
      }
    }
    const milliseconds = Math.round(performance.now() - started);
    observations.push({ compiler, iteration: iteration + 1, projects: projects.length, milliseconds });
    writeFileSync(artifact, JSON.stringify({ collectedAt: new Date().toISOString(), node: process.version,
      platform: platform(), cores: cpus().length, projects: projects.map((item) => item.directory),
      incremental: false, observations }, null, 2) + '\n');
    console.log(`${compiler} run ${iteration + 1}: ${milliseconds}ms (${projects.length} successful projects)`);
  }
}
console.log(`Raw observations: ${artifact}`);
