import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const compiler = args[0]?.startsWith('--compiler=') ? args.shift().slice('--compiler='.length) : 'native';
const packages = { native: '@typescript/native', legacy: 'typescript', bun: 'bun' };
if (!Object.hasOwn(packages, compiler)) throw new Error(`Unsupported TypeScript compiler: ${compiler}`);

// Resolve the exact compiler instead of relying on competing npm .bin/tsc links.
const manifestPath = require.resolve(`${packages[compiler]}/package.json`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const binary = resolve(dirname(manifestPath), manifest.bin[compiler === 'bun' ? 'bun' : 'tsc']);
const command = compiler === 'bun' ? binary : process.execPath;
const commandArgs = compiler === 'bun' ? ['check', '--no-script', ...args] : [binary, ...args];
const result = spawnSync(command, commandArgs, { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
