import { spawnSync } from 'node:child_process';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const result = spawnSync(npxCommand, ['prisma', 'migrate', 'deploy'], {
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
