import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function dependencyCacheKeys(repo, runtime = {
  node: process.version, platform: process.platform, arch: process.arch, image: process.env.ImageOS ?? 'local',
}) {
  const parts = ['platform', 'arch', 'image', 'node'].map(name => {
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(runtime[name] ?? '')) throw new Error(`Invalid cache runtime ${name}.`);
    return runtime[name];
  });
  const manifest = JSON.parse(readFileSync(resolve(repo, 'package.json'), 'utf8'));
  const patterns = manifest.workspaces;
  if (!Array.isArray(patterns) || patterns.some(pattern => typeof pattern !== 'string' || pattern.split('/').includes('..'))) throw new Error('Invalid cache workspace patterns.');
  const manifests = globSync(patterns.map(pattern => `${pattern}/package.json`), { cwd: repo, exclude: ['**/node_modules/**'] });
  const files = ['package.json', 'package-lock.json', ...manifests,
    'apps/api/prisma/schema.prisma', 'apps/api/prisma.config.ts', 'apps/api/src/kernel/database/db-connection-config.cjs'];
  if (existsSync(resolve(repo, '.npmrc'))) files.push('.npmrc');
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(file).update('\0').update(readFileSync(resolve(repo, file))).update('\0');
  const lock = JSON.parse(readFileSync(resolve(repo, 'package-lock.json'), 'utf8'));
  const playwright = lock.packages['node_modules/@playwright/test']?.version;
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(playwright ?? '')) throw new Error('Missing pinned Playwright cache version.');
  return { dependencies: `prism-deps-v1-${parts.join('-')}-${hash.digest('hex')}`,
    browser: `prism-playwright-v1-${parts.slice(0, 3).join('-')}-${playwright}-chromium-headless-shell` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const keys = dependencyCacheKeys(resolve(fileURLToPath(new URL('../../', import.meta.url))));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `dependencies=${keys.dependencies}\nbrowser=${keys.browser}\n`);
  console.log(JSON.stringify(keys));
}
