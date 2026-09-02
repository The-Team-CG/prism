const { spawnSync } = require('node:child_process');
const path = require('node:path');

const result = spawnSync(
  process.execPath,
  [
    path.join(__dirname, '..', '..', '..', 'scripts', 'kill-prism-port.cjs'),
    '--app',
    'api',
    '--port',
    String(process.env.PORT || 4000),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
