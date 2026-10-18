import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const API_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const DEFAULT_MIGRATIONS_ROOT = join(API_ROOT, 'prisma', 'migrations');
const DEFAULT_POLICY_PATH = join(API_ROOT, 'prisma', 'migration-policy.json');
const DEFAULT_OWNERSHIP_PATH = join(API_ROOT, 'prisma', 'domain-ownership.json');

const NAME_PATTERN = /^(\d{14})_([a-z0-9]+(?:-[a-z0-9]+)*)_([a-z0-9]+(?:_[a-z0-9]+)*)$/;
const LEGACY_SHAPE = /^(\d{14})_(.+)$/;
const IDENTIFIER = '(?:"[^"]+"|[a-z_][a-z0-9_]*)';
const QUALIFIED_IDENTIFIER = `${IDENTIFIER}(?:\\s*\\.\\s*${IDENTIFIER})?`;
const IGNORED_PREFIXES = new Set(['new', 'old', 'excluded']);
const RISK_RANK = { low: 0, medium: 1, high: 2 };
const CHANGE_KINDS = new Set(['schema', 'data', 'mixed']);
const RISK_LEVELS = new Set(Object.keys(RISK_RANK));
const ALLOWED_MIGRATION_ROOT_FILES = new Set(['migration_lock.toml']);
const UNSUPPORTED_SQL_RULES = [
  { code: 'procedural DO block', pattern: /\bDO\s+(?!NOTHING\b|UPDATE\b)/i },
  { code: 'dynamic EXECUTE', pattern: /\bEXECUTE\s+/i },
  { code: 'stored procedure call', pattern: /\bCALL\s+/i },
  { code: 'MERGE statement', pattern: /\bMERGE\s+INTO\b/i },
  { code: 'COPY statement', pattern: /\bCOPY\s+/i },
  {
    code: 'stored function or procedure definition',
    pattern: /\b(?:CREATE\s+(?:OR\s+REPLACE\s+)?|ALTER\s+|DROP\s+)(?:FUNCTION|PROCEDURE)\b/i,
  },
];

const RISK_RULES = [
  { level: 'high', code: 'drop-schema', pattern: /\bDROP\s+SCHEMA\b/i },
  { level: 'high', code: 'drop-table', pattern: /\bDROP\s+TABLE\b/i },
  { level: 'high', code: 'drop-object', pattern: /\bDROP\s+(?:VIEW|SEQUENCE|TYPE|FUNCTION)\b/i },
  { level: 'high', code: 'drop-column', pattern: /\bDROP\s+COLUMN\b/i },
  { level: 'high', code: 'drop-constraint', pattern: /\bDROP\s+CONSTRAINT\b/i },
  { level: 'high', code: 'drop-policy', pattern: /\bDROP\s+POLICY\b/i },
  { level: 'high', code: 'drop-trigger', pattern: /\bDROP\s+TRIGGER\b/i },
  { level: 'high', code: 'truncate', pattern: /\bTRUNCATE\b/i },
  { level: 'high', code: 'delete', pattern: /\bDELETE\s+FROM\b/i },
  { level: 'high', code: 'alter-type', pattern: /\bALTER\s+(?:COLUMN\s+)?[^;\n]+\bTYPE\b/i },
  { level: 'high', code: 'alter-type-object', pattern: /\bALTER\s+TYPE\b/i },
  { level: 'medium', code: 'drop-index', pattern: /\bDROP\s+INDEX\b/i },
  { level: 'medium', code: 'create-index', pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i },
  { level: 'medium', code: 'alter-table', pattern: /\bALTER\s+TABLE\b/i },
  { level: 'medium', code: 'create-table', pattern: /\bCREATE\s+TABLE\b/i },
  { level: 'medium', code: 'create-schema', pattern: /\bCREATE\s+SCHEMA\b/i },
  { level: 'medium', code: 'alter-schema', pattern: /\bALTER\s+SCHEMA\b/i },
  {
    level: 'medium',
    code: 'schema-ddl',
    pattern: /\b(?:CREATE|ALTER)\s+(?:TABLE|SEQUENCE|VIEW|TYPE|CONSTRAINT|TRIGGER|POLICY|MATERIALIZED\s+VIEW)\b/i,
  },
  { level: 'medium', code: 'create-function', pattern: /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i },
  { level: 'medium', code: 'create-trigger', pattern: /\bCREATE\s+TRIGGER\b/i },
  { level: 'medium', code: 'create-policy', pattern: /\bCREATE\s+POLICY\b/i },
  { level: 'medium', code: 'comment', pattern: /\bCOMMENT\s+ON\b/i },
  { level: 'medium', code: 'grant', pattern: /\b(?:GRANT|REVOKE)\b/i },
  { level: 'medium', code: 'insert', pattern: /\bINSERT\s+INTO\b/i },
  { level: 'medium', code: 'update', pattern: /\bUPDATE\s+/i },
];

function unquote(identifier) {
  return identifier.startsWith('"') && identifier.endsWith('"')
    ? identifier.slice(1, -1)
    : identifier;
}

function stripSqlCommentsAndStrings(sql, { preserveDollarBodies = false } = {}) {
  let result = '';
  let index = 0;
  let state = 'normal';
  let dollarTag = '';

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (state === 'line-comment') {
      if (character === '\n' || character === '\r') {
        state = 'normal';
        result += character;
      } else {
        result += ' ';
      }
      index += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        state = 'normal';
        result += '  ';
        index += 2;
      } else {
        result += character === '\n' || character === '\r' ? character : ' ';
        index += 1;
      }
      continue;
    }

    if (state === 'single-quote') {
      if (character === "'" && next === "'") {
        result += '  ';
        index += 2;
      } else if (character === "'") {
        state = 'normal';
        result += ' ';
        index += 1;
      } else {
        result += character === '\n' || character === '\r' ? character : ' ';
        index += 1;
      }
      continue;
    }

    if (state === 'dollar-quote') {
      if (sql.startsWith(dollarTag, index)) {
        result += ' '.repeat(dollarTag.length);
        index += dollarTag.length;
        state = 'normal';
        dollarTag = '';
      } else {
        result += preserveDollarBodies
          ? character
          : character === '\n' || character === '\r'
            ? character
            : ' ';
        index += 1;
      }
      continue;
    }

    if (character === '-' && next === '-') {
      state = 'line-comment';
      result += '  ';
      index += 2;
      continue;
    }
    if (character === '/' && next === '*') {
      state = 'block-comment';
      result += '  ';
      index += 2;
      continue;
    }
    if (character === "'") {
      state = 'single-quote';
      result += ' ';
      index += 1;
      continue;
    }
    if (character === '$') {
      const tagMatch = sql.slice(index).match(/^\$[a-z_][a-z0-9_]*\$|^\$\$/i);
      if (tagMatch) {
        dollarTag = tagMatch[0];
        state = 'dollar-quote';
        result += ' '.repeat(dollarTag.length);
        index += dollarTag.length;
        continue;
      }
    }

    result += character;
    index += 1;
  }

  return result;
}

function extractQualifiedSchemas(sql) {
  const cleanSql = stripSqlCommentsAndStrings(sql);
  const schemas = new Set();
  const qualifiedPattern = new RegExp(
    `(${IDENTIFIER})\\s*\\.\\s*(${IDENTIFIER})`,
    'gi',
  );

  for (const match of cleanSql.matchAll(qualifiedPattern)) {
    const prefix = unquote(match[1]).toLowerCase();
    if (!IGNORED_PREFIXES.has(prefix)) {
      schemas.add(prefix);
    }
  }

  const schemaDdlPattern = new RegExp(
    `\\b(?:CREATE|ALTER|DROP)\\s+SCHEMA\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(${IDENTIFIER})`,
    'gi',
  );
  for (const match of cleanSql.matchAll(schemaDdlPattern)) {
    schemas.add(unquote(match[1]).toLowerCase());
  }

  const schemaMovePattern = new RegExp(
    `\\bSET\\s+SCHEMA\\s+(${IDENTIFIER})`,
    'gi',
  );
  for (const match of cleanSql.matchAll(schemaMovePattern)) {
    schemas.add(unquote(match[1]).toLowerCase());
  }

  const schemaRenamePattern = new RegExp(
    `\\bALTER\\s+SCHEMA\\s+${IDENTIFIER}\\s+RENAME\\s+TO\\s+(${IDENTIFIER})`,
    'gi',
  );
  for (const match of cleanSql.matchAll(schemaRenamePattern)) {
    schemas.add(unquote(match[1]).toLowerCase());
  }

  const schemaPrivilegePattern = new RegExp(
    `\\b(?:GRANT|REVOKE)\\b[^;]*?\\bON\\s+SCHEMA\\s+(${IDENTIFIER})`,
    'gi',
  );
  for (const match of cleanSql.matchAll(schemaPrivilegePattern)) {
    schemas.add(unquote(match[1]).toLowerCase());
  }

  const searchPathPattern = new RegExp(
    `\\bSET\\s+(?:LOCAL\\s+)?search_path\\s*(?:TO|=)\\s*([^;]+)`,
    'gi',
  );
  for (const match of cleanSql.matchAll(searchPathPattern)) {
    for (const rawSchema of match[1].split(',')) {
      const schemaMatch = rawSchema.trim().match(new RegExp(`^(${IDENTIFIER})$`, 'i'));
      if (schemaMatch) schemas.add(unquote(schemaMatch[1]).toLowerCase());
    }
  }

  return { cleanSql, schemas };
}

function canonicalizeSql(sql) {
  return sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function checksumSql(sql) {
  return createHash('sha256').update(canonicalizeSql(sql), 'utf8').digest('hex');
}

function isValidVersion(version) {
  const year = Number(version.slice(0, 4));
  const month = Number(version.slice(4, 6));
  const day = Number(version.slice(6, 8));
  const hour = Number(version.slice(8, 10));
  const minute = Number(version.slice(10, 12));
  const second = Number(version.slice(12, 14));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

function extractMetadata(sql) {
  const values = { owner: [], kind: [], risk: [] };
  const pattern = /^\s*--\s*prism-(owner|kind|risk):\s*([^\s]+)\s*$/i;
  for (const line of sql.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('--')) break;

    const match = line.match(pattern);
    if (match) values[match[1]].push(match[2].toLowerCase());
  }

  const metadata = {};
  const errors = [];
  for (const key of Object.keys(values)) {
    if (values[key].length === 0) {
      errors.push(`missing prism-${key} metadata`);
    } else {
      metadata[key] = values[key][values[key].length - 1];
      if (values[key].length > 1) {
        errors.push(`duplicate prism-${key} metadata`);
      }
    }
  }

  return { metadata, errors };
}

function inferChangeKind(cleanSql) {
  const hasSchemaChange =
    /\b(?:CREATE|ALTER|DROP)\s+(?:SCHEMA|TABLE|INDEX|SEQUENCE|VIEW|TYPE|CONSTRAINT|TRIGGER|POLICY|FUNCTION|PROCEDURE|MATERIALIZED\s+VIEW)\b/i.test(
      cleanSql,
    );
  const hasDataChange =
    /\b(?:INSERT\s+INTO|UPDATE\b|DELETE\s+FROM|TRUNCATE\b)/i.test(cleanSql);

  if (hasSchemaChange && hasDataChange) return 'mixed';
  if (hasDataChange) return 'data';
  if (hasSchemaChange) return 'schema';
  return 'none';
}

function inferRisk(cleanSql) {
  let highest = 'low';
  const reasons = [];
  for (const rule of RISK_RULES) {
    if (rule.pattern.test(cleanSql)) {
      if (RISK_RANK[rule.level] > RISK_RANK[highest]) highest = rule.level;
      reasons.push(rule.code);
    }
  }
  return { level: highest, reasons: [...new Set(reasons)] };
}

function stripReferentialActionUpdates(sql) {
  return sql.replace(
    /\bON\s+UPDATE\s+(?:CASCADE|RESTRICT|NO\s+ACTION|SET\s+(?:NULL|DEFAULT))\b/gi,
    (clause) => ' '.repeat(clause.length),
  );
}

function splitQualifiedIdentifier(target) {
  const match = target.trim().match(
    new RegExp(`^(${IDENTIFIER})\\s*\\.\\s*(${IDENTIFIER})$`, 'i'),
  );
  if (!match) return null;

  return {
    schema: unquote(match[1]).toLowerCase(),
    table: unquote(match[2]).toLowerCase(),
  };
}

const RELATION_TARGET_PATTERNS = [
  {
    label: 'table-like DDL',
    kind: 'table',
    pattern: new RegExp(
      `\\b(?:CREATE|ALTER|DROP)\\s+(?:TABLE|SEQUENCE|VIEW|TYPE|MATERIALIZED\\s+VIEW)\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(?:ONLY\\s+)?(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'index DDL',
    kind: 'index',
    pattern: new RegExp(
      `\\b(?:ALTER|DROP)\\s+INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'index target',
    kind: 'table',
    pattern: new RegExp(
      `\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENTIFIER}\\s+ON\\s+(?:ONLY\\s+)?(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'data target',
    kind: 'table',
    pattern: new RegExp(
      `\\b(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|TRUNCATE(?:\\s+TABLE)?)\\s+(?:ONLY\\s+)?(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'relation reference',
    kind: 'table',
    pattern: new RegExp(
      `\\b(?:REFERENCES|FROM|JOIN|LIKE|INHERITS)\\s+(?:ONLY\\s+)?(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'policy target',
    kind: 'table',
    pattern: new RegExp(
      `\\b(?:CREATE|ALTER|DROP)\\s+POLICY\\b[^;]*?\\s+ON\\s+(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'trigger target',
    kind: 'table',
    pattern: new RegExp(
      `\\b(?:CREATE|DROP)\\s+TRIGGER\\b[^;]*?\\s+ON\\s+(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'comment target',
    kind: 'table',
    pattern: new RegExp(
      `\\bCOMMENT\\s+ON\\s+(?:TABLE|VIEW|SEQUENCE|TYPE)\\s+(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
  {
    label: 'grant table target',
    kind: 'table',
    pattern: new RegExp(
      `\\b(?:GRANT|REVOKE)\\b[^;]*?\\bON\\s+(?!(?:SCHEMA|ALL)\\b)(?:TABLE\\s+)?(${QUALIFIED_IDENTIFIER})`,
      'gi',
    ),
  },
];

function extractRelationTargets(cleanSql) {
  const targets = [];
  for (const { label, kind, pattern } of RELATION_TARGET_PATTERNS) {
    for (const match of cleanSql.matchAll(pattern)) {
      targets.push({ label, kind, raw: match[1], relation: splitQualifiedIdentifier(match[1]) });
    }
  }
  return targets;
}

function unqualifiedTargets(cleanSql) {
  return [
    ...new Set(
      extractRelationTargets(cleanSql)
        .filter(({ relation }) => relation === null)
        .map(({ label }) => label),
    ),
  ];
}

function unsupportedSql(cleanSql, sql) {
  const bodyAwareSql = stripSqlCommentsAndStrings(sql, { preserveDollarBodies: true });
  return UNSUPPORTED_SQL_RULES.filter(({ code, pattern }) => {
    const source = code === 'dynamic EXECUTE' ? bodyAwareSql : cleanSql;
    return pattern.test(source);
  }).map(({ code }) => code);
}

export function parseMigrationName(name, policy) {
  const legacyMatch = name.match(LEGACY_SHAPE);
  if (!legacyMatch) {
    return { error: `invalid migration name ${name}; expected a 14-digit version prefix` };
  }

  const version = legacyMatch[1];
  if (!isValidVersion(version)) {
    return {
      error: `migration ${name} has an invalid calendar timestamp ${version}; expected YYYYMMDDHHmmss`,
    };
  }

  if (policy.legacyMigrationNames.includes(name)) {
    if (version > policy.legacyMaxVersion) {
      return {
        error: `migration ${name} is incorrectly listed as legacy after the immutable baseline ${policy.legacyMaxVersion}`,
      };
    }
    return {
      version,
      owner: null,
      slug: legacyMatch[2],
      legacy: true,
    };
  }

  const ownerAwareBaselineNames = new Set(policy.ownerAwareBaselineNames ?? []);
  const ownerAwareBaselineMaxVersion = policy.ownerAwareBaselineMaxVersion ?? policy.legacyMaxVersion;
  const ownerAwareBaseline = ownerAwareBaselineNames.has(name);
  if (ownerAwareBaseline && (version <= policy.legacyMaxVersion || version > ownerAwareBaselineMaxVersion)) {
    return { error: `migration ${name} is outside the immutable owner-aware baseline range` };
  }

  if (!ownerAwareBaseline && version <= ownerAwareBaselineMaxVersion) {
    return {
      error: `migration ${name} is not in the immutable migration baseline; applied history must not be renamed or recreated`,
    };
  }

  const match = name.match(NAME_PATTERN);
  if (!match) {
    return {
      error: `migration ${name} must use the owner-aware name pattern ${policy.ownerAwareNamePattern}`,
    };
  }

  const owner = match[2];
  if (!Object.hasOwn(policy.owners, owner)) {
    return {
      error: `migration ${name} uses an unknown owner-aware name owner ${owner}; choose one of ${Object.keys(policy.owners).join(', ')}`,
    };
  }

  const parsed = {
    version,
    owner,
    slug: match[3],
    legacy: false,
  };
  if (ownerAwareBaseline) parsed.ownerAwareBaseline = true;
  return parsed;
}

function ownerOwnsTable(ownershipManifest, policy, owner, schema, table) {
  if (ownershipManifest?.ownership) {
    return ownershipManifest.ownership.some((entry) =>
      entry.domain === owner &&
      entry.table === table &&
      (entry.currentSchema === schema || entry.targetSchema === schema));
  }

  const explicitOwners = policy.tableOwners?.[schema]?.[table];
  if (explicitOwners) return explicitOwners.includes(owner);
  const configuredSchemas = policy.owners[owner]?.schemas ?? [];
  return configuredSchemas.includes(schema) || policy.owners[owner]?.schema === schema;
}

function targetSchemaForOwner(policy, owner) {
  return policy.owners[owner]?.schema ?? policy.owners[owner]?.targetSchema ?? null;
}

function extractSchemaMoves(cleanSql) {
  const moves = [];
  const pattern = new RegExp(
    `\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?(${QUALIFIED_IDENTIFIER})\\s+SET\\s+SCHEMA\\s+(${IDENTIFIER})`,
    'gi',
  );
  for (const match of cleanSql.matchAll(pattern)) {
    const source = splitQualifiedIdentifier(match[1]);
    if (!source) {
      moves.push({ error: 'schema move source must be qualified' });
      continue;
    }
    moves.push({
      fromSchema: source.schema,
      table: source.table,
      toSchema: unquote(match[2]).toLowerCase(),
    });
  }
  return moves;
}

function validateSchemaMovePolicy(migration, parsed, cleanSql, policy, ownershipManifest) {
  const actual = extractSchemaMoves(cleanSql);
  const expected = policy.schemaMoveMigrations?.[migration.name];
  const errors = [];
  if (actual.length === 0 && !expected) return errors;
  if (!expected) {
    return [`${migration.name}: table schema moves require an exact migration-name transition policy`];
  }
  if (expected.owner !== parsed.owner) {
    errors.push(`${migration.name}: schema move policy owner does not match migration owner ${parsed.owner}`);
  }
  const coordinatedDomains = new Set([expected.owner, ...(expected.coordinatedDomains ?? [])]);
  for (const domain of expected.coordinatedDomains ?? []) {
    if (!ownershipManifest?.summary?.domains?.some((entry) => entry.domain === domain)) {
      errors.push(`${migration.name}: schema move policy names unknown coordinated domain ${domain}`);
    }
  }

  const normalize = (move) => `${move.fromSchema}.${move.table}->${move.toSchema}`;
  const expectedMoves = (expected.moves ?? []).map(normalize).sort();
  const actualMoves = actual.map(normalize).sort();
  if (actual.some((move) => move.error) || JSON.stringify(actualMoves) !== JSON.stringify(expectedMoves)) {
    errors.push(`${migration.name}: schema move statements do not match the exact reviewed transition list`);
  }

  for (const move of expected.moves ?? []) {
    const ownedTable = ownershipManifest?.ownership?.find((entry) =>
      coordinatedDomains.has(entry.domain) &&
      entry.table === move.table &&
      entry.currentSchema === move.fromSchema &&
      entry.targetSchema === move.toSchema);
    if (ownershipManifest?.ownership && !ownedTable) {
      errors.push(`${migration.name}: schema move ${normalize(move)} does not match the domain ownership manifest`);
    }
  }
  return errors;
}

function validateOwnerAwareMigration(migration, parsed, policy, ownershipManifest) {
  const errors = [];
  const { metadata, errors: metadataErrors } = extractMetadata(migration.sql);
  const systemSchemas = new Set(policy.systemSchemas ?? []);
  const forbiddenSchemas = new Set(policy.forbiddenSchemas ?? []);
  errors.push(...metadataErrors.map((error) => `${migration.name}: ${error}`));

  if (metadata.owner && metadata.owner !== parsed.owner) {
    errors.push(
      `${migration.name}: prism-owner ${metadata.owner} does not match migration owner ${parsed.owner}`,
    );
  }
  if (metadata.kind && !CHANGE_KINDS.has(metadata.kind)) {
    errors.push(
      `${migration.name}: prism-kind ${metadata.kind} must be one of schema, data, mixed`,
    );
  }
  if (metadata.risk && !RISK_LEVELS.has(metadata.risk)) {
    errors.push(
      `${migration.name}: prism-risk ${metadata.risk} must be one of low, medium, high`,
    );
  }

  const { cleanSql, schemas } = extractQualifiedSchemas(migration.sql);
  const analysisSql = stripReferentialActionUpdates(cleanSql);
  const unsupported = unsupportedSql(cleanSql, migration.sql);
  if (unsupported.length > 0) {
    errors.push(
      `${migration.name}: unsupported SQL requires manual review before static ownership/kind/risk checks can pass (${unsupported.join(', ')})`,
    );
  }

  const relationTargets = extractRelationTargets(analysisSql);
  errors.push(...validateSchemaMovePolicy(migration, parsed, cleanSql, policy, ownershipManifest));
  const tableOwners = policy.tableOwners ?? {};
  const strictTableSchemas = new Set(policy.requireTableOwnerMappingsForSchemas ?? []);
  const schemaMovePolicy = policy.schemaMoveMigrations?.[migration.name];
  const coordinatedOwners = new Set([parsed.owner, ...(schemaMovePolicy?.coordinatedDomains ?? [])]);
  const configuredOwnerSchemas = new Set(
    [...coordinatedOwners].flatMap((owner) => [
      ...(policy.owners[owner]?.schemas ?? []),
      targetSchemaForOwner(policy, owner),
    ]).filter(Boolean),
  );
  const coordinatedHistoricalSchemas = new Set((ownershipManifest?.ownership ?? [])
    .filter((entry) => coordinatedOwners.has(entry.domain))
    .map((entry) => entry.currentSchema));
  const targetSchema = targetSchemaForOwner(policy, parsed.owner);
  for (const schema of schemas) {
    if (systemSchemas.has(schema)) continue;
    const schemaRelations = relationTargets.filter(
      ({ relation }) => relation?.schema === schema,
    );
    const hasOwnerTableAccess = schemaRelations.length > 0 && schemaRelations.every(
      ({ kind, relation }) => relation && (kind === 'index'
        ? (policy.indexOwners?.[schema]?.[relation.table] ?? []).some((owner) => coordinatedOwners.has(owner))
        : [...coordinatedOwners].some((owner) => ownerOwnsTable(ownershipManifest, policy, owner, schema, relation.table))),
    );

    if (forbiddenSchemas.has(schema)) {
      errors.push(`${migration.name}: schema ${schema} is forbidden for Prism domain migrations`);
    } else if (ownershipManifest?.ownership
      ? !configuredOwnerSchemas.has(schema) && !coordinatedHistoricalSchemas.has(schema) && !hasOwnerTableAccess
      : !configuredOwnerSchemas.has(schema) && schema !== targetSchema && !hasOwnerTableAccess) {
      errors.push(
        `${migration.name}: schema ${schema} is not allowed for owner ${parsed.owner}; owner target schema: ${targetSchema ?? [...configuredOwnerSchemas].join(', ')}`,
      );
    }
  }

  const hasPotentialSchemaOrDataChange =
    /\b(?:CREATE|ALTER|DROP|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE)\b/i.test(
      analysisSql,
    );
  if (hasPotentialSchemaOrDataChange) {
    for (const target of unqualifiedTargets(analysisSql)) {
      errors.push(
        `${migration.name}: owner-aware DDL/data targets must be schema-qualified (${target})`,
      );
    }
  }

  for (const target of relationTargets) {
    const { kind, relation } = target;
    if (kind === 'index' || relation === null) continue;
    const tableKey = `${relation.schema}.${relation.table}`;

    if (ownershipManifest?.ownership) {
      if (![...coordinatedOwners].some((owner) => ownerOwnsTable(ownershipManifest, policy, owner, relation.schema, relation.table))) {
        errors.push(`${migration.name}: table ${tableKey} is not owned by ${parsed.owner} in the domain ownership manifest`);
      }
      continue;
    }

    const schemaOwners = tableOwners[relation.schema];
    const allowedOwners = schemaOwners?.[relation.table];
    if (allowedOwners && !allowedOwners.includes(parsed.owner)) {
      errors.push(
        `${migration.name}: table ${tableKey} is owned by ${allowedOwners.join(', ')}, not ${parsed.owner}`,
      );
    } else if (strictTableSchemas.has(relation.schema) && !allowedOwners) {
      errors.push(
        `${migration.name}: table ${tableKey} needs an explicit table-owner mapping before a migration can change the shared schema`,
      );
    }
  }

  for (const { kind, relation } of relationTargets) {
    if (kind !== 'index' || relation === null) continue;
    const indexKey = `${relation.schema}.${relation.table}`;
    const allowedOwners = policy.indexOwners?.[relation.schema]?.[relation.table];
    if (!Array.isArray(allowedOwners)) {
      errors.push(
        `${migration.name}: index ${indexKey} is in a shared schema and needs an explicit table-owner review`,
      );
    } else if (!allowedOwners.some((owner) => coordinatedOwners.has(owner))) {
      errors.push(
        `${migration.name}: index ${indexKey} is owned by ${allowedOwners.join(', ')}, not ${parsed.owner}`,
      );
    }
  }

  const inferredKind = inferChangeKind(analysisSql);
  if (metadata.kind && inferredKind !== 'none') {
    const kindCovers =
      (inferredKind === 'schema' && ['schema', 'mixed'].includes(metadata.kind)) ||
      (inferredKind === 'data' && ['data', 'mixed'].includes(metadata.kind)) ||
      (inferredKind === 'mixed' && metadata.kind === 'mixed');
    if (!kindCovers) {
      errors.push(
        `${migration.name}: declared kind ${metadata.kind} does not cover inferred ${inferredKind}`,
      );
    }
  }

  const inferredRisk = inferRisk(analysisSql);
  if (metadata.risk && RISK_RANK[metadata.risk] < RISK_RANK[inferredRisk.level]) {
    errors.push(
      `${migration.name}: declared risk ${metadata.risk} is below inferred ${inferredRisk.level} (${inferredRisk.reasons.join(', ')})`,
    );
  }

  return errors;
}

export function auditMigrationSet(migrations, policy, ownershipManifest = null) {
  const errors = [];
  const warnings = [];
  const parsedMigrations = [];
  const seenNames = new Set();
  const migrationVersions = new Map();
  const futureVersions = new Map();
  const sortedMigrations = [...migrations].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  if (policy.policyVersion !== 1) {
    errors.push(`unsupported migration policy version ${policy.policyVersion ?? '(missing)'}; expected version 1`);
  }

  const historicalPolicy = policy.historicalOwnerSchemas
    ? {
        ...policy,
        owners: policy.historicalOwnerSchemas,
        tableOwners: policy.historicalTableOwners ?? {},
        indexOwners: policy.historicalIndexOwners ?? {},
        requireTableOwnerMappingsForSchemas: policy.historicalRequireTableOwnerMappingsForSchemas ?? [],
        schemaMoveMigrations: policy.historicalSchemaMoveMigrations ?? {},
      }
    : null;

  if ((policy.ownerAwareBaselineNames ?? []).length > 0 && !historicalPolicy) {
    errors.push('immutable owner-aware migration history requires its saved historical owner schema policy');
  }

  for (const name of policy.legacyMigrationNames) {
    const legacyMatch = name.match(LEGACY_SHAPE);
    if (!legacyMatch || !isValidVersion(legacyMatch[1])) {
      errors.push(`${name}: immutable legacy policy entry has an invalid migration name or timestamp`);
    } else if (legacyMatch[1] > policy.legacyMaxVersion) {
      errors.push(
        `${name}: immutable legacy policy entry is beyond the baseline ${policy.legacyMaxVersion}`,
      );
    }
  }

  for (const migration of sortedMigrations) {
    if (seenNames.has(migration.name)) {
      errors.push(`duplicate migration directory name ${migration.name}`);
    }
    seenNames.add(migration.name);

    const parsed = parseMigrationName(migration.name, policy);
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }

    parsedMigrations.push({ migration, parsed });
    if (migrationVersions.has(parsed.version)) {
      migrationVersions.get(parsed.version).push(migration.name);
    } else {
      migrationVersions.set(parsed.version, [migration.name]);
    }

    if (parsed.legacy) {
      const expectedChecksum = policy.legacyMigrationChecksums?.[migration.name];
      if (policy.legacyMigrationChecksums && !expectedChecksum) {
        errors.push(`${migration.name}: missing immutable legacy SQL checksum in policy`);
      } else if (expectedChecksum && checksumSql(migration.sql) !== expectedChecksum) {
        errors.push(`${migration.name}: immutable legacy migration.sql checksum mismatch`);
      }
      continue;
    }

    if (parsed.ownerAwareBaseline) {
      const expectedChecksum = policy.ownerAwareBaselineChecksums?.[migration.name];
      if (!expectedChecksum) {
        errors.push(`${migration.name}: missing immutable owner-aware baseline SQL checksum in policy`);
      } else if (checksumSql(migration.sql) !== expectedChecksum) {
        errors.push(`${migration.name}: immutable owner-aware baseline migration.sql checksum mismatch`);
      }
      if (historicalPolicy) {
        if (!historicalPolicy.owners[parsed.owner]) {
          errors.push(`${migration.name}: historical owner schema policy is missing for ${parsed.owner}`);
        } else {
          errors.push(...validateOwnerAwareMigration(migration, parsed, historicalPolicy));
        }
      }
      continue;
    }

    if (futureVersions.has(parsed.version)) {
      futureVersions.get(parsed.version).push(migration.name);
    } else {
      futureVersions.set(parsed.version, [migration.name]);
    }
    errors.push(...validateOwnerAwareMigration(migration, parsed, policy, ownershipManifest));
  }

  const legacyDuplicateVersions = new Set(policy.legacyDuplicateVersions ?? []);
  for (const version of legacyDuplicateVersions) {
    if (!/^\d{14}$/.test(version) || !isValidVersion(version)) {
      errors.push(`${version}: legacy duplicate version policy entry has an invalid timestamp`);
    } else if (version > policy.legacyMaxVersion) {
      errors.push(
        `${version}: legacy duplicate version policy entry is beyond the baseline ${policy.legacyMaxVersion}`,
      );
    }
  }

  for (const [version, names] of migrationVersions) {
    if (names.length > 1) {
      if (!legacyDuplicateVersions.has(version)) {
        errors.push(`duplicate migration version ${version}: ${names.join(', ')}`);
      }
    }
  }

  for (const migrationName of Object.keys(policy.schemaMoveMigrations ?? {})) {
    if (!seenNames.has(migrationName)) {
      errors.push(`${migrationName}: schema move policy has no matching migration directory`);
    }
  }

  let previousVersion = '';
  for (const { parsed } of parsedMigrations) {
    if (parsed.version < previousVersion) {
      errors.push(
        `migration order is not globally monotonic at version ${parsed.version}; sort the full Prisma directory names`,
      );
    }
    previousVersion = parsed.version;
  }

  const summary = {
    total: migrations.length,
    legacy: parsedMigrations.filter(({ parsed }) => parsed.legacy).length,
    ownerAwareBaseline: parsedMigrations.filter(({ parsed }) => parsed.ownerAwareBaseline).length,
    ownerAware: parsedMigrations.filter(({ parsed }) => !parsed.legacy && !parsed.ownerAwareBaseline).length,
    futureVersions: futureVersions.size,
  };

  if (summary.legacy !== policy.legacyMigrationNames.length) {
    errors.push(
      `legacy migration count ${summary.legacy} does not match policy count ${policy.legacyMigrationNames.length}; review applied history before changing the baseline`,
    );
  }

  const ownerAwareBaselineNames = policy.ownerAwareBaselineNames ?? [];
  const ownerAwareBaselineNameSet = new Set(ownerAwareBaselineNames);
  if (ownerAwareBaselineNameSet.size !== ownerAwareBaselineNames.length) {
    errors.push('owner-aware migration baseline contains duplicate names');
  }
  const baselineMaxVersion = policy.ownerAwareBaselineMaxVersion ?? policy.legacyMaxVersion;
  for (const name of ownerAwareBaselineNames) {
    if (!seenNames.has(name)) errors.push(`${name}: immutable owner-aware baseline migration is missing`);
    const match = name.match(NAME_PATTERN);
    const version = match?.[1];
    if (!version || version <= policy.legacyMaxVersion || version > baselineMaxVersion) {
      errors.push(`${name}: immutable owner-aware baseline name is outside its configured version range`);
    }
    if (!Object.hasOwn(policy.ownerAwareBaselineChecksums ?? {}, name)) {
      errors.push(`${name}: immutable owner-aware baseline SQL checksum is missing from policy`);
    }
  }
  for (const name of Object.keys(policy.ownerAwareBaselineChecksums ?? {})) {
    if (!ownerAwareBaselineNameSet.has(name)) {
      errors.push(`${name}: owner-aware baseline checksum is not an immutable owner-aware baseline migration`);
    }
  }
  if (summary.ownerAwareBaseline !== ownerAwareBaselineNames.length) {
    errors.push(
      `owner-aware baseline migration count ${summary.ownerAwareBaseline} does not match policy count ${ownerAwareBaselineNames.length}; review applied history before changing the baseline`,
    );
  }

  if (policy.legacyMigrationChecksums) {
    for (const name of policy.legacyMigrationNames) {
      if (!Object.hasOwn(policy.legacyMigrationChecksums, name)) {
        errors.push(`${name}: immutable legacy SQL checksum is missing from policy`);
      }
    }
    for (const name of Object.keys(policy.legacyMigrationChecksums)) {
      if (!policy.legacyMigrationNames.includes(name)) {
        errors.push(`${name}: checksum policy entry is not an immutable legacy migration`);
      }
    }
  }

  return { errors, warnings, summary };
}

export function discoverMigrations(migrationsRoot = DEFAULT_MIGRATIONS_ROOT) {
  const entries = readdirSync(migrationsRoot, { withFileTypes: true });
  const invalidEntries = [];
  const migrations = [];

  for (const entry of entries) {
    const entryPath = join(migrationsRoot, entry.name);
    if (!entry.isDirectory()) {
      if (ALLOWED_MIGRATION_ROOT_FILES.has(entry.name)) continue;
      invalidEntries.push(
        `${entry.name}: Prisma migration roots may contain only direct migration directories`,
      );
      continue;
    }

    const migrationPath = join(entryPath, 'migration.sql');
    if (!existsSync(migrationPath) || !statSync(migrationPath).isFile()) {
      invalidEntries.push(
        `${entry.name}: missing migration.sql; Prisma migrations must be direct child directories`,
      );
      continue;
    }

    const nestedDirectories = readdirSync(entryPath, { withFileTypes: true })
      .filter((child) => child.isDirectory())
      .map((child) => child.name);
    if (nestedDirectories.length > 0) {
      invalidEntries.push(
        `${entry.name}: nested directories are not supported inside a Prisma migration directory (${nestedDirectories.join(', ')})`,
      );
      continue;
    }

    migrations.push({
      name: entry.name,
      path: entryPath,
      sql: readFileSync(migrationPath, 'utf8'),
    });
  }

  if (invalidEntries.length > 0) {
    throw new Error(`migration tree structure is invalid:\n- ${invalidEntries.join('\n- ')}`);
  }

  return migrations.sort((left, right) => left.name.localeCompare(right.name));
}

export function loadPolicy(policyPath = DEFAULT_POLICY_PATH) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function runMigrationGuard({
  migrationsRoot = DEFAULT_MIGRATIONS_ROOT,
  policyPath = DEFAULT_POLICY_PATH,
  ownershipPath = DEFAULT_OWNERSHIP_PATH,
} = {}) {
  const policy = loadPolicy(policyPath);
  const migrations = discoverMigrations(migrationsRoot);
  const ownershipManifest = JSON.parse(readFileSync(ownershipPath, 'utf8'));
  return { policy, migrations, ownershipManifest, ...auditMigrationSet(migrations, policy, ownershipManifest) };
}

function main() {
  try {
    const { errors, summary } = runMigrationGuard();
    if (errors.length > 0) {
      console.error('Prisma migration guard failed:');
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `Prisma migration guard passed (${summary.total} migrations; ${summary.legacy} immutable legacy; ${summary.ownerAwareBaseline} immutable owner-aware baseline; ${summary.ownerAware} new owner-aware).`,
    );
  } catch (error) {
    console.error(
      `Prisma migration guard failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href) {
  main();
}
