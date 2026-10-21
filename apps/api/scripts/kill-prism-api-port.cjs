const { spawnSync } = require('node:child_process');
const path = require('node:path');

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const result = spawnSync(
  process.execPath,
  [
    path.join(__dirname, '..', '..', '..', 'scripts', 'kill-prism-port.cjs'),
    '--app',
    'api',
    '--port',
    String(readArg('--port', process.env.PORT || 4000)),
    '--root',
    readArg('--root', process.cwd()),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
