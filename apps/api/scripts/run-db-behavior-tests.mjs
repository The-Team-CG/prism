import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITEST_CLI = path.resolve(API_ROOT, '..', '..', 'node_modules', 'vitest', 'vitest.mjs');

function findTestFiles(directory, accepts) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(fullPath, accepts));
    } else if (entry.isFile() && accepts(entry.name)) {
      files.push(path.relative(API_ROOT, fullPath).split(path.sep).join('/'));
    }
  }
  return files;
}

const sourceBehaviorTests = findTestFiles(
  path.join(API_ROOT, 'src'),
  (name) => /\.(database|integration|postgres)\.test\.ts$/.test(name),
);
const integrationTests = findTestFiles(
  path.join(API_ROOT, 'test', 'integration'),
  (name) => name.endsWith('.test.ts'),
);
const testFiles = [...sourceBehaviorTests, ...integrationTests].sort();

if (testFiles.length === 0) {
  throw new Error('No database behavior suites were found.');
}

// The audit chain is globally serialized, so independent files must not race it.
const child = spawn(process.execPath, [VITEST_CLI, 'run', '--no-file-parallelism', ...testFiles, ...process.argv.slice(2)], {
  cwd: API_ROOT,
  env: process.env,
  windowsHide: true,
  stdio: 'inherit',
});

child.once('error', (error) => {
  process.stderr.write('Could not start the database behavior suites: ' + error.message + '\n');
  process.exitCode = 1;
});
child.once('close', (code) => {
  process.exitCode = code ?? 1;
});
