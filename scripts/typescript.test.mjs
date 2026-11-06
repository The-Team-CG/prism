import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

test('all supported checkers detect an error in an imported file and accept the repaired project', () => {
  const directory = mkdtempSync(join(tmpdir(), 'prism-typecheck-'));
  try {
    mkdirSync(join(directory, 'src'));
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, types: [], skipLibCheck: true, module: 'NodeNext' },
      include: ['src/**/*.ts'],
    }));
    writeFileSync(join(directory, 'src/index.ts'), 'import { label } from "./value.js";\nexport { label };\n');
    for (const compiler of ['legacy', 'native', 'bun']) {
      const check = () => spawnSync(process.execPath, [resolve('scripts/typescript.mjs'), `--compiler=${compiler}`,
        '--noEmit', '-p', join(directory, 'tsconfig.json')], { encoding: 'utf8', windowsHide: true });
      writeFileSync(join(directory, 'src/value.ts'), 'export const label: string = 42;\n');
      const broken = check();
      assert.ok(broken.status > 0, `${compiler} must reject the invalid imported file: ${broken.stderr}`);
      assert.match(broken.stdout + broken.stderr, /TS2322/);
      writeFileSync(join(directory, 'src/value.ts'), 'export const label: string = "ready";\n');
      const fixed = check();
      assert.equal(fixed.status, 0, `${compiler} must accept the repaired project: ${fixed.stdout} ${fixed.stderr}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
