import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTasks, taskArguments } from './task-plan.mjs';

export function runTasks({ repo, tasks, baseRef, headRef = 'HEAD', concurrency, plan, run = spawnSync }) {
  const selection = plan ?? selectTasks(repo, { baseRef, headRef, tasks });
  const args = taskArguments(tasks, selection, { concurrency });
  console.log(`Task selection (${selection.mode}): ${selection.reason}`);
  if (selection.mode === 'affected') console.log(`Workspaces: ${selection.packages.join(', ')}`);
  const turbo = createRequire(resolve(repo, 'package.json')).resolve('turbo/bin/turbo');
  const result = run(process.execPath, [turbo, ...args], { cwd: repo, stdio: 'inherit', windowsHide: true, env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));
  const tasks = args.filter((arg) => !arg.startsWith('--concurrency='));
  const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const baseRef = process.env.GITHUB_EVENT_NAME === 'pull_request' ? process.env.PR_BASE_SHA : undefined;
  const selection = selectTasks(repo, { baseRef, tasks });
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nTask selection: **${selection.mode}**. ${selection.reason.replaceAll('\n', ' ')}\n`);
  }
  try {
    process.exitCode = runTasks({ repo, tasks, plan: selection, concurrency: concurrencyArg?.split('=')[1] });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
