import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTasks, workspaces } from './task-plan.mjs';
import { runTasks } from './run-tasks.mjs';

const fullFallback = { include: [{ workspace: '*', id: 'full', coverage: '**/coverage/lcov.info' }] };

export function workspaceTestMatrix(repo, selection) {
  try {
    if (!['full', 'affected'].includes(selection.mode)) throw new Error('Uncertain selection.');
    const graph = workspaces(repo);
    if (selection.mode === 'affected' && (!selection.packages?.length || selection.packages.some(name => !graph.some(item => item.name === name)))) {
      throw new Error('Unknown selected workspace.');
    }
    const include = graph.filter(item => item.scripts['test:ci'] && (selection.mode === 'full' || selection.packages.includes(item.name)))
      .map(item => ({ workspace: item.name, id: item.directory.replace('/', '-'), coverage: `${item.directory}/coverage/lcov.info` }));
    return include.length ? { include } : fullFallback;
  } catch {
    return fullFallback;
  }
}

export function runWorkspaceTests(repo, workspace, run) {
  const full = workspace === '*';
  if (!full && !workspaces(repo).some(item => item.name === workspace && item.scripts['test:ci'])) {
    throw new Error('Expected one existing test workspace or the full fallback.');
  }
  return runTasks({ repo, tasks: ['test:ci'], concurrency: 1, run,
    plan: full ? { mode: 'full', reason: 'Uncertain workspace mapping; checking every suite.' }
      : { mode: 'affected', packages: [workspace], reason: 'One selected workspace on its own runner.' } });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  if (process.argv[2] === '--matrix') {
    const selection = selectTasks(repo, { tasks: ['test:ci'], baseRef: process.env.GITHUB_EVENT_NAME === 'pull_request' ? process.env.PR_BASE_SHA : undefined });
    const matrix = workspaceTestMatrix(repo, selection);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\nWorkspace test selection: **${selection.mode}**. ${selection.reason}\n\n${matrix.include.map(item => `- ${item.workspace}`).join('\n')}\n`);
    console.log(JSON.stringify(matrix));
  } else {
    try { process.exitCode = runWorkspaceTests(repo, process.env.TEST_WORKSPACE); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
