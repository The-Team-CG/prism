import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function requireSuccessfulJobs(results, expected) {
  if (!results || typeof results !== 'object' || Array.isArray(results) || !expected.length) throw new Error('Missing required job results.');
  const failed = expected.filter((name) => results[name]?.result !== 'success');
  if (failed.length) throw new Error(`Required jobs did not succeed: ${failed.map((name) => `${name}=${results[name]?.result ?? 'missing'}`).join(', ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireSuccessfulJobs(JSON.parse(process.env.REQUIRED_JOB_RESULTS ?? 'null'), process.argv.slice(2));
    console.log('Every required job succeeded.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
