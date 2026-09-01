import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const rootPath = fileURLToPath(new URL('../../../', import.meta.url));
const sourceRoot = join(rootPath, 'apps', 'api', 'apps', 'api', 'src');

function collectTypeScriptFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = collectTypeScriptFiles(sourceRoot);
const failures = [];
const broadNames = /\b(?:normalizePrism|normalizeData|handleThing)\b/;
const allowedBoundaryNames = new Set(['normalizePrismApiProblem', 'normalizePrismPageLimit']);

function rel(file) {
  return relative(rootPath, file).replace(/\\/g, '/');
}

function hasQueryShape(block) {
  return /(\b(where|take|cursor|select)\s*:|\bwhere\s*[,}]|\btake\s*[,}])/.test(block) || /QUERY_AUDIT_ALLOW_UNBOUNDED/.test(block);
}

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nameMatch = line.match(broadNames);
    if (nameMatch && !allowedBoundaryNames.has(nameMatch[0])) {
      failures.push(`${rel(file)}:${i + 1} broad helper name '${nameMatch[0]}'`);
    }

    if (line.includes('.findMany({')) {
      const block = lines.slice(i, Math.min(lines.length, i + 16)).join('\n');
      if (!hasQueryShape(block)) {
        failures.push(`${rel(file)}:${i + 1} findMany lacks where/take/cursor/select or QUERY_AUDIT_ALLOW_UNBOUNDED reason`);
      }
    }

    if (line.includes('skip:') && !line.includes('QUERY_AUDIT_ALLOW_OFFSET')) {
      failures.push(`${rel(file)}:${i + 1} offset pagination requires QUERY_AUDIT_ALLOW_OFFSET reason`);
    }

    if ((line.includes('$queryRaw') || line.includes('$executeRaw')) && !line.includes('QUERY_AUDIT_RAW_SQL')) {
      failures.push(`${rel(file)}:${i + 1} raw SQL requires QUERY_AUDIT_RAW_SQL reason`);
    }

    if (/for\s*\(|for\s+await\s*\(/.test(line)) {
      const loopBlock = lines.slice(i, Math.min(lines.length, i + 25)).join('\n');
      if (/prisma\.[a-zA-Z0-9_]+\.(find|create|update|delete|upsert)/.test(loopBlock) && !/QUERY_AUDIT_ALLOW_BOUNDED_LOOP/.test(loopBlock)) {
        failures.push(`${rel(file)}:${i + 1} Prisma call inside loop needs batching or QUERY_AUDIT_ALLOW_BOUNDED_LOOP reason`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('DB query audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`DB query audit passed for ${files.length} API source files.`);
