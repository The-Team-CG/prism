import process from 'node:process';

const [action, envVar] = process.argv.slice(2);

if (!action || !envVar) {
  console.error('Usage: node scripts/require-ack.mjs <action> <ENV_VAR_NAME>');
  process.exit(2);
}

const value = process.env[envVar];
const ok = value === '1' || value === 'true' || value === 'TRUE';

if (!ok) {
  console.error(`Refusing to run ${action} without explicit acknowledgement.`);
  console.error(`Set ${envVar}=1 and re-run if you are sure this is safe for your environment.`);
  process.exit(1);
}

