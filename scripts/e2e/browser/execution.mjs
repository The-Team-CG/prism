import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function browserExecution(args) {
  const options = args.filter(arg => arg.startsWith('--server='));
  if (options.length > 1) throw new Error('Provide one browser server mode.');
  const server = options[0]?.slice('--server='.length) ?? 'production';
  if (!['production', 'development'].includes(server)) throw new Error('Browser server mode must be production or development.');
  if (server === 'production' && args.includes('--skip-build')) throw new Error('Production acceptance always builds the portals from the current source.');
  return { server, playwrightArgs: args.filter(arg => !arg.startsWith('--server=') && arg !== '--skip-build'),
    buildApi: !args.includes('--skip-build') };
}

export function portalEnvironment(env, server) {
  if (!['production', 'development'].includes(server)) throw new Error('Unknown portal server mode.');
  return { ...env, NODE_ENV: server, PRISM_VERCEL_SERVICES: '', PRISM_DOCKER_STANDALONE: '' };
}

export function browserTimingScope(playwrightArgs, sample = '1') {
  const projects = [];
  let completeSuite = true;
  for (let index = 0; index < playwrightArgs.length; index += 1) {
    const arg = playwrightArgs[index];
    if (arg.startsWith('--project=')) projects.push(arg.slice('--project='.length));
    else if (arg === '--project') projects.push(playwrightArgs[++index]);
    else completeSuite = false;
  }
  if (projects.some(project => !['desktop', 'mobile'].includes(project))) completeSuite = false;
  const project = new Set(projects).size === 1 ? projects[0] : 'all';
  const iteration = Number(sample);
  if (!Number.isInteger(iteration) || iteration < 1 || iteration > 5) throw new Error('Invalid browser comparison sample.');
  return { project, sample: iteration, completeSuite };
}

export function browserJobMatrix({ server = 'production', repetitions = 1 } = {}) {
  const count = Number(repetitions);
  if (!['production', 'development', 'compare'].includes(server) || !Number.isInteger(count) || count < 1 || count > 5) {
    throw new Error('Choose a supported browser mode and one to five repetitions.');
  }
  const include = [];
  for (let sample = 1; sample <= count; sample += 1) {
    // Alternate submission order. Each sample still runs on fresh, separate runners.
    const modes = server === 'compare' ? (sample % 2 ? ['development', 'production'] : ['production', 'development']) : [server];
    for (const mode of modes) for (const project of ['desktop', 'mobile']) include.push({ server: mode, project, sample });
  }
  return { include };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const matrix = browserJobMatrix({ server: process.env.BROWSER_COMPARISON_SERVER || 'production', repetitions: process.env.BROWSER_COMPARISON_RUNS || 1 });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
  console.log(JSON.stringify(matrix));
}
