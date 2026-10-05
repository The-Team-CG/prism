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

export function databaseBehaviorTestFiles() {
  const sourceBehaviorTests = findTestFiles(
    path.join(API_ROOT, 'src'),
    (name) => /\.(database|integration|postgres)\.test\.ts$/.test(name),
  );
  const integrationTests = findTestFiles(
    path.join(API_ROOT, 'test', 'integration'),
    (name) => name.endsWith('.test.ts'),
  );
  return [...sourceBehaviorTests, ...integrationTests].sort();
}

function selectTestFiles(args, availableFiles) {
  const requested = args.filter((arg) => arg.endsWith('.test.ts'));
  if (requested.length === 0) {
    throw new Error('Pass one or more explicit database behavior test file paths. The CI runner resets prism_p0 between files.');
  }

  const available = new Set(availableFiles);
  return requested.map((requestedPath) => {
    const absolutePath = path.resolve(API_ROOT, requestedPath);
    const relativePath = path.relative(API_ROOT, absolutePath).split(path.sep).join('/');
    if (!available.has(relativePath)) {
      throw new Error('Unknown database behavior test file: ' + requestedPath);
    }
    return relativePath;
  });
}

function run(args = process.argv.slice(2)) {
  const availableFiles = databaseBehaviorTestFiles();
  if (availableFiles.length === 0) {
    throw new Error('No database behavior suites were found.');
  }

  const testFiles = selectTestFiles(args, availableFiles);
  const child = spawn(
    process.execPath,
    [
      VITEST_CLI,
      'run',
      '--no-file-parallelism',
      ...testFiles,
      ...args.filter((arg) => !arg.endsWith('.test.ts')),
    ],
    {
      cwd: API_ROOT,
      env: process.env,
      windowsHide: true,
      stdio: 'inherit',
    },
  );

  child.once('error', (error) => {
    process.stderr.write('Could not start the database behavior suites: ' + error.message + '\n');
    process.exitCode = 1;
  });
  child.once('close', (code) => {
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    process.stderr.write('Database behavior test selection failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
