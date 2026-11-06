import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const statistics = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    minMs: sorted[0], maxMs: sorted.at(-1) };
};

export function compareBrowserTimings(runs, repetitions = 5) {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 5) throw new Error('Expected one to five complete samples per mode and viewport.');
  if (runs.length !== repetitions * 4) throw new Error('Missing or extra browser timing samples.');
  const configurations = new Set(), keys = new Set();
  for (const run of runs) {
    const requiredPhases = ['create-database', 'mailpit', 'migrate', 'seed-accounts', 'seed-portal-uat', 'build-api',
      'api-ready', 'prepare-fixtures', 'portals-ready', 'playwright', 'cleanup-restore portal files',
      'cleanup-stop Mailpit', 'cleanup-drop database', 'cleanup-close pool'];
    if (run.server === 'production') requiredPhases.push('build-client', 'build-supplier', 'build-guest', 'build-event');
    if (!run.success || !run.completeSuite || !['development', 'production'].includes(run.server)
      || !['desktop', 'mobile'].includes(run.project) || !Number.isInteger(run.sample) || run.sample < 1 || run.sample > repetitions
      || !Number.isFinite(run.elapsedMs) || run.elapsedMs <= 0 || !/^[a-f0-9]{40,64}$/.test(run.revision ?? '')
      || !run.node || !run.platform || !run.arch || !Number.isInteger(run.logicalCpus) || run.logicalCpus < 1
      || !run.phases?.length || run.phases.some(phase => phase.status !== 'passed')
      || requiredPhases.some(name => run.phases.filter(phase => phase.phase === name).length !== 1)) {
      throw new Error('Failed, partial or invalid browser timing sample.');
    }
    const key = `${run.server}/${run.project}/${run.sample}`;
    if (keys.has(key)) throw new Error('Duplicate browser timing sample.');
    keys.add(key);
    configurations.add(JSON.stringify([run.revision, run.node, run.platform, run.arch, run.logicalCpus, run.image, run.imageVersion]));
  }
  if (configurations.size !== 1) throw new Error('Browser timings mix revisions or runner configurations.');
  const modes = {};
  for (const server of ['development', 'production']) {
    const selected = runs.filter(run => run.server === server);
    const criticalPath = Array.from({ length: repetitions }, (_, index) => Math.max(...selected.filter(run => run.sample === index + 1).map(run => run.elapsedMs)));
    modes[server] = { desktop: statistics(selected.filter(run => run.project === 'desktop').map(run => run.elapsedMs)),
      mobile: statistics(selected.filter(run => run.project === 'mobile').map(run => run.elapsedMs)), criticalPath: statistics(criticalPath) };
  }
  const before = modes.development.criticalPath, after = modes.production.criticalPath;
  return { revision: runs[0].revision, samplesPerModeAndViewport: repetitions, modes,
    medianReductionPercent: (1 - after.medianMs / before.medianMs) * 100,
    productionClearlyFaster: repetitions >= 5 && after.maxMs < before.minMs,
    measured: 'Complete harness elapsed time, including API/portal builds, migrations, fixtures, acceptance and cleanup; excluding runner queue and dependency bootstrap.' };
}

export function readBrowserTimings(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name === 'timings.json')
    .map(entry => JSON.parse(readFileSync(join(entry.parentPath, entry.name), 'utf8')));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(process.argv[2] ?? '.local-dev/browser-comparison');
  const result = compareBrowserTimings(readBrowserTimings(directory), Number(process.argv[3] ?? 5));
  writeFileSync(join(directory, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
  const seconds = value => `${(value / 1000).toFixed(1)}s`;
  const report = `# Complete browser server comparison\n\nRevision: ${result.revision}\n\nSamples per mode and viewport: ${result.samplesPerModeAndViewport}\n\n`
    + '| Server | Median critical path | Range |\n| --- | ---: | --- |\n'
    + Object.entries(result.modes).map(([server, value]) => `| ${server} | ${seconds(value.criticalPath.medianMs)} | ${seconds(value.criticalPath.minMs)} to ${seconds(value.criticalPath.maxMs)} |`).join('\n')
    + `\n\nProduction median reduction: ${result.medianReductionPercent.toFixed(1)}%. Clear repeated improvement: ${result.productionClearlyFaster}.\n\n${result.measured}\n`;
  writeFileSync(join(directory, 'comparison.md'), report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  console.log(JSON.stringify(result, null, 2));
}
