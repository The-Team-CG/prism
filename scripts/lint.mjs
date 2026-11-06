import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const manifest = require('oxlint/package.json');
const binary = resolve(dirname(require.resolve('oxlint/package.json')), manifest.bin.oxlint);
const requested = process.argv.slice(2);
const paths = (requested.length ? requested : ['src']).map((path) => relative(root, resolve(process.cwd(), path)));
const result = spawnSync(process.execPath, [binary, '--config', resolve(root, '.oxlintrc.json'), ...paths], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
