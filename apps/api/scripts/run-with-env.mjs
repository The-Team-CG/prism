import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Node 24: process environment takes precedence over the selected env file.
const envFile = process.env.PRISM_ENV_FILE || '.env';
if (process.env.PRISM_ENV_FILE && !existsSync(envFile)) throw new Error(`Selected API environment file does not exist: ${envFile}`);
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.argv.splice(1, 1);
if (!process.argv[1]) throw new Error('Supply a database script to run.');
await import(pathToFileURL(resolve(process.argv[1])).href);
