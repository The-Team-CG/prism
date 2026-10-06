import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const API_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const PRISMA_ROOT = join(API_ROOT, 'prisma');
const REPO_ROOT = resolve(API_ROOT, '../..');
const PRISMA_MUTATIONS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const RAW_SQL_METHODS = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
const RAW_MUTATION_PATTERN = /\b(?:INSERT\s+INTO|UPDATE\b|DELETE\s+FROM|TRUNCATE\b|MERGE\s+INTO|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+INDEX)\b/i;

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function parseList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseModels(schemaText) {
  const models = [];
  const modelNames = new Set([...schemaText.matchAll(/^model\s+(\w+)\s*\{/gm)].map(([, name]) => name));
  for (const match of schemaText.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, modelName, body] = match;
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? modelName;
    const schema = body.match(/@@schema\("([^"]+)"\)/)?.[1] ?? null;
    const fields = new Map();
    const relations = [];
    const relationFields = [];

    for (const line of body.split(/\r?\n/)) {
      const scalar = line.match(/^\s{2}(\w+)\s+(?:String|Int|BigInt|Float|Boolean|DateTime|Json|Decimal|Bytes)(?:\?)?(?:\[\])?\b/);
      if (scalar) fields.set(scalar[1], line.match(/@map\("([^"]+)"\)/)?.[1] ?? camelToSnake(scalar[1]));

      const relationField = line.match(/^\s{2}(\w+)\s+(\w+)(?:\[\])?\??(?:\s+@relation\((.*)\))?\s*$/);
      if (relationField && modelNames.has(relationField[2])) {
        const [, fieldName, targetModel, relationDefinition = ''] = relationField;
        relationFields.push({ fieldName, targetModel });
        const localFields = relationDefinition.match(/\bfields\s*:\s*\[([^\]]*)\]/)?.[1];
        const targetFields = relationDefinition.match(/\breferences\s*:\s*\[([^\]]*)\]/)?.[1];
        if (localFields && targetFields) {
          relations.push({
            fieldName,
            targetModel,
            fields: parseList(localFields.replace(/[\[\]]/g, '')),
            references: parseList(targetFields.replace(/[\[\]]/g, '')),
          });
        }
      }
    }

    models.push({ modelName, table, schema, fields, relations, relationFields });
  }
  return models;
}

function parseReferencedColumns(definition) {
  const match = definition.match(/\bREFERENCES\s+(?:"([^"]+)"|([a-z_][a-z0-9_]*))\.(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s*\(([^)]+)\)/i);
  if (!match) return null;
  return {
    schema: (match[1] ?? match[2]).toLowerCase(),
    table: (match[3] ?? match[4]).toLowerCase(),
    columns: parseList(match[5].replaceAll('"', '')).map((column) => column.toLowerCase()),
  };
}

function fkSignature({ sourceSchema, sourceTable, sourceColumns, targetSchema, targetTable, targetColumns }) {
  return `${sourceSchema}.${sourceTable}(${sourceColumns.join(',')})->${targetSchema}.${targetTable}(${targetColumns.join(',')})`;
}

function ownerKey(entry) {
  return `${entry.currentSchema}.${entry.table}`;
}

export function validateDomainPersistence({ ownershipManifest, schemaText, final = false }) {
  const errors = [];
  const models = parseModels(schemaText);
  const manifestOwnership = Array.isArray(ownershipManifest.ownership)
    ? ownershipManifest.ownership
    : [];
  const ownerByCurrentTable = new Map();
  const ownerByTargetTable = new Map();
  const domainSchemaByDomain = new Map();
  const domainByTargetSchema = new Map();

  for (const entry of ownershipManifest.summary?.domains ?? []) {
    if (!entry.domain || !entry.schema) {
      errors.push('ownership manifest contains a domain without a name or target schema');
      continue;
    }
    if (domainSchemaByDomain.has(entry.domain)) {
      errors.push(`ownership manifest has duplicate target schema entries for domain ${entry.domain}`);
    }
    domainSchemaByDomain.set(entry.domain, entry.schema);
    const existingDomain = domainByTargetSchema.get(entry.schema);
    if (existingDomain && existingDomain !== entry.domain) {
      errors.push(`target schema ${entry.schema} is assigned to multiple domains (${existingDomain}, ${entry.domain})`);
    }
    domainByTargetSchema.set(entry.schema, entry.domain);
  }

  if (ownershipManifest.summary?.totalTables !== undefined &&
      ownershipManifest.summary.totalTables !== manifestOwnership.length) {
    errors.push(`ownership manifest totalTables ${ownershipManifest.summary.totalTables} does not match ${manifestOwnership.length} ownership rows`);
  }
  if (ownershipManifest.summary?.targetSchemas !== undefined &&
      ownershipManifest.summary.targetSchemas !== domainSchemaByDomain.size) {
    errors.push(`ownership manifest targetSchemas ${ownershipManifest.summary.targetSchemas} does not match ${domainSchemaByDomain.size} domains`);
  }

  const modelOwners = new Map();
  for (const entry of manifestOwnership) {
    if (!entry.model || !entry.currentSchema || !entry.table || !entry.domain || !entry.targetSchema) {
      errors.push(`ownership manifest row is missing model, schema, table, or domain identity`);
      continue;
    }
    if (modelOwners.has(entry.model)) {
      errors.push(`Prisma model ${entry.model} has more than one ownership manifest row`);
    }
    modelOwners.set(entry.model, entry);
    if (!domainSchemaByDomain.has(entry.domain)) {
      errors.push(`ownership manifest model ${entry.model} uses unknown owner domain ${entry.domain}`);
    } else if (domainSchemaByDomain.get(entry.domain) !== entry.targetSchema) {
      errors.push(`ownership manifest model ${entry.model} target schema ${entry.targetSchema} differs from ${entry.domain} domain schema ${domainSchemaByDomain.get(entry.domain)}`);
    }
    const currentKey = ownerKey(entry);
    if (ownerByCurrentTable.has(currentKey)) errors.push(`duplicate ownership manifest entry for ${currentKey}`);
    ownerByCurrentTable.set(currentKey, entry);
    const targetKey = `${entry.targetSchema}.${entry.table}`;
    if (ownerByTargetTable.has(targetKey)) errors.push(`duplicate target ownership manifest entry for ${targetKey}`);
    ownerByTargetTable.set(targetKey, entry);
  }

  const modelByTableSchema = new Map();
  const modelNames = new Set();
  for (const model of models) {
    const key = `${model.schema}.${model.table}`;
    if (modelNames.has(model.modelName)) errors.push(`duplicate Prisma model name ${model.modelName}`);
    modelNames.add(model.modelName);
    if (modelByTableSchema.has(key)) errors.push(`duplicate Prisma model mapping for ${key}`);
    modelByTableSchema.set(key, model);
  }

  const seenManifestKeys = new Set();
  for (const model of models) {
    const currentKey = `${model.schema}.${model.table}`;
    const manifestEntry = final
      ? ownerByTargetTable.get(currentKey)
      : ownerByCurrentTable.get(currentKey);
    const expectedSchema = manifestEntry ? (final ? manifestEntry.targetSchema : manifestEntry.currentSchema) : null;
    if (!manifestEntry) {
      errors.push(`Prisma model ${model.modelName} maps to unowned table ${currentKey}`);
      continue;
    }
    seenManifestKeys.add(final ? `${manifestEntry.targetSchema}.${manifestEntry.table}` : ownerKey(manifestEntry));
    if (model.schema !== expectedSchema) {
      errors.push(`Prisma model ${model.modelName} schema ${model.schema} does not match ${manifestEntry.domain} owner schema ${expectedSchema}`);
    }
    const expectedDomainSchema = ownershipManifest.summary?.domains?.find(({ domain }) => domain === manifestEntry.domain)?.schema;
    if (!expectedDomainSchema || expectedDomainSchema !== manifestEntry.targetSchema) {
      errors.push(`Ownership manifest target schema for ${manifestEntry.domain} is missing or inconsistent`);
    }
  }

  for (const entry of manifestOwnership) {
    const key = final ? `${entry.targetSchema}.${entry.table}` : ownerKey(entry);
    if (!seenManifestKeys.has(key)) errors.push(`ownership manifest table ${key} has no Prisma model`);
  }

  const foreignKeyEntries = Array.isArray(ownershipManifest.foreignKeys)
    ? ownershipManifest.foreignKeys
    : [];
  const expectedForeignKeys = new Set();
  const foreignKeyNames = new Set();
  let sameDomainForeignKeyCount = 0;
  let crossDomainForeignKeyCount = 0;
  let currentCrossSchemaForeignKeyCount = 0;
  for (const fk of foreignKeyEntries) {
    const target = parseReferencedColumns(fk.definition);
    if (!target) {
      errors.push(`could not parse target columns for manifest foreign key ${fk.name}`);
      continue;
    }
    const foreignKeyName = `${fk.schema}.${fk.table}.${fk.name}`;
    if (foreignKeyNames.has(foreignKeyName)) {
      errors.push(`duplicate physical foreign key entry ${foreignKeyName}`);
    }
    foreignKeyNames.add(foreignKeyName);
    const sourceOwner = ownerByCurrentTable.get(`${fk.schema}.${fk.table}`);
    const targetKey = `${target.schema}.${target.table}`;
    const targetOwner = ownerByCurrentTable.get(targetKey)
      ?? (sourceOwner?.introducedAfterCutover ? ownerByTargetTable.get(targetKey) : undefined);
    if (!sourceOwner) errors.push(`foreign key ${fk.name} has no source owner mapping`);
    if (!targetOwner) errors.push(`foreign key ${fk.name} has no target owner mapping`);
    if (sourceOwner?.domain !== fk.sourceDomain) errors.push(`foreign key ${fk.name} source owner differs from ownership manifest`);
    if (targetOwner?.domain !== fk.targetDomain) errors.push(`foreign key ${fk.name} target owner differs from ownership manifest`);
    if (fk.sameDomain !== (fk.sourceDomain === fk.targetDomain)) errors.push(`foreign key ${fk.name} has an inconsistent same-domain classification`);
    if (fk.targetCurrentSchema && fk.targetCurrentSchema !== target.schema) {
      errors.push(`foreign key ${fk.name} target schema differs from its recorded targetCurrentSchema`);
    }
    if (fk.targetTable && fk.targetTable !== target.table) {
      errors.push(`foreign key ${fk.name} target table differs from its recorded targetTable`);
    }
    if (fk.sameDomain) sameDomainForeignKeyCount += 1;
    else crossDomainForeignKeyCount += 1;
    if (fk.schema !== target.schema) currentCrossSchemaForeignKeyCount += 1;
    if (final && !fk.sameDomain) continue;
    const signature = fkSignature({
      sourceSchema: final ? sourceOwner?.targetSchema : fk.schema,
      sourceTable: fk.table,
      sourceColumns: fk.columns,
      targetSchema: final ? targetOwner?.targetSchema : target.schema,
      targetTable: target.table,
      targetColumns: target.columns,
    });
    if (expectedForeignKeys.has(signature)) errors.push(`duplicate physical foreign key signature ${signature}`);
    expectedForeignKeys.add(signature);
  }

  const expectedSummaryCounts = [
    ['targetSameDomainFks', sameDomainForeignKeyCount],
    ['crossDomainFksToDrop', crossDomainForeignKeyCount],
    ['currentCrossSchemaFks', currentCrossSchemaForeignKeyCount],
  ];
  for (const [field, count] of expectedSummaryCounts) {
    if (ownershipManifest.summary?.[field] !== undefined && ownershipManifest.summary[field] !== count) {
      errors.push(`ownership manifest ${field} ${ownershipManifest.summary[field]} does not match ${count} classified foreign keys`);
    }
  }

  const actualForeignKeys = new Set();
  const actualForeignKeyCounts = new Map();
  for (const model of models) {
    const sourceOwner = final
      ? ownerByTargetTable.get(`${model.schema}.${model.table}`)
      : ownerByCurrentTable.get(`${model.schema}.${model.table}`);
    for (const relation of model.relations) {
      const targetModel = models.find(({ modelName }) => modelName === relation.targetModel);
      if (!targetModel) {
        errors.push(`Prisma relation ${model.modelName}.${relation.fieldName} targets missing model ${relation.targetModel}`);
        continue;
      }
      const targetOwner = final
        ? ownerByTargetTable.get(`${targetModel.schema}.${targetModel.table}`)
        : ownerByCurrentTable.get(`${targetModel.schema}.${targetModel.table}`);
      if (!sourceOwner || !targetOwner) {
        errors.push(`Prisma relation ${model.modelName}.${relation.fieldName} has an unowned endpoint`);
        continue;
      }
      if (sourceOwner.domain !== targetOwner.domain && final) {
        errors.push(`final domain schema still contains cross-domain Prisma relation ${model.modelName}.${relation.fieldName}`);
      }
      const sourceColumns = relation.fields.map((field) => model.fields.get(field) ?? camelToSnake(field));
      const targetColumns = relation.references.map((field) => targetModel.fields.get(field) ?? camelToSnake(field));
      const signature = fkSignature({
        sourceSchema: model.schema,
        sourceTable: model.table,
        sourceColumns,
        targetSchema: targetModel.schema,
        targetTable: targetModel.table,
        targetColumns,
      });
      actualForeignKeyCounts.set(signature, (actualForeignKeyCounts.get(signature) ?? 0) + 1);
      actualForeignKeys.add(signature);
    }
  }

  for (const [signature, count] of actualForeignKeyCounts) {
    if (count > 1) errors.push(`duplicate Prisma relation signature ${signature}`);
  }

  for (const signature of expectedForeignKeys) {
    if (!actualForeignKeys.has(signature)) errors.push(`manifest foreign key is missing from Prisma relations: ${signature}`);
  }
  for (const signature of actualForeignKeys) {
    if (!expectedForeignKeys.has(signature)) errors.push(`Prisma relation is not classified in the ownership manifest: ${signature}`);
  }

  if (final && [...actualForeignKeys].some((signature) => {
    const [source, target] = signature.split('->');
    const sourceOwner = ownerByTargetTable.get(source.slice(0, source.indexOf('(')));
    const targetOwner = ownerByTargetTable.get(target.slice(0, target.indexOf('(')));
    return sourceOwner && targetOwner && sourceOwner.domain !== targetOwner.domain;
  })) {
    errors.push('final domain schema contains an unclassified cross-domain Prisma relation');
  }

  const actualCrossDomainForeignKeys = [...actualForeignKeys].filter((signature) => {
    const source = signature.slice(0, signature.indexOf('('));
    const sourceOwner = final ? ownerByTargetTable.get(source) : ownerByCurrentTable.get(source);
    const targetRef = signature.split('->')[1];
    const target = targetRef.slice(0, targetRef.indexOf('('));
    const targetOwner = final ? ownerByTargetTable.get(target) : ownerByCurrentTable.get(target);
    return sourceOwner && targetOwner && sourceOwner.domain !== targetOwner.domain;
  });

  return {
    errors,
    summary: {
      models: models.length,
      foreignKeys: actualForeignKeys.size,
      crossDomainForeignKeys: actualCrossDomainForeignKeys.length,
    },
  };
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
}

function modelDelegateName(modelName) {
  return modelName.length === 0
    ? modelName
    : modelName[0].toLowerCase() + modelName.slice(1);
}

function moduleDomain(filePath) {
  return filePath.replaceAll('\\', '/').match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1] ?? null;
}

function staticSqlText(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return staticSqlText(node.expression);
  if (ts.isTaggedTemplateExpression(node)) return staticSqlText(node.template);
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map(({ literal }) => literal.text).join('');
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticSqlText(node.left);
    const right = staticSqlText(node.right);
    return left === null || right === null ? null : `${left} ${right}`;
  }
  if (ts.isCallExpression(node)) {
    const parts = node.arguments.map(staticSqlText);
    return parts.some((part) => part === null) ? null : parts.join(' ');
  }
  return null;
}

function parseSqlIdentifier(value) {
  const match = value.trim().match(/^(?:(?:"([^"]+)"|([a-z_][a-z0-9_$]*))\s*\.\s*)?(?:"([^"]+)"|([a-z_][a-z0-9_$]*))/i);
  if (!match) return null;
  return {
    schema: (match[1] ?? match[2] ?? '').toLowerCase() || null,
    table: (match[3] ?? match[4]).toLowerCase(),
  };
}

function rawSqlTargets(sql) {
  const cleanSql = sql
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\bON\s+CONFLICT\b[^;]*?\bDO\s+UPDATE\b/gi, (clause) =>
      clause.replace(/\bDO\s+UPDATE\b/gi, 'DO NOTHING'));
  const identifier = '(?:"[^"]+"|[a-z_][a-z0-9_$]*)';
  const relation = `((?:${identifier}\\s*\\.\\s*)?${identifier})`;
  const patterns = [
    new RegExp(`\\bINSERT\\s+INTO\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bUPDATE\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bDELETE\\s+FROM\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bTRUNCATE(?:\\s+TABLE)?\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bMERGE\\s+INTO\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bDROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${relation}`, 'gi'),
    new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${identifier}\\s+ON\\s+(?:ONLY\\s+)?${relation}`, 'gi'),
  ];
  return patterns.flatMap((pattern) => [...cleanSql.matchAll(pattern)].map((match) =>
    parseSqlIdentifier(match[1])));
}

function containsRawMutation(sql) {
  const comparable = sql
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b/gi, 'FOR ROW LOCK');
  return RAW_MUTATION_PATTERN.test(comparable);
}

function propertyAssignments(object) {
  if (!ts.isObjectLiteralExpression(object)) return [];
  return object.properties.filter(ts.isPropertyAssignment);
}

function relationCommands(value) {
  const supported = new Set(['create', 'connect', 'connectOrCreate', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany', 'disconnect', 'set']);
  return propertyAssignments(value)
    .map((property) => propertyName(property.name))
    .filter((name) => supported.has(name));
}

export function validatePrivateWrites({ ownershipManifest, schemaText, sourceFiles, final = false }) {
  const errors = [];
  const models = parseModels(schemaText);
  const entries = ownershipManifest.ownership ?? [];
  const ownersByTable = new Map(entries.map((entry) => [
    `${final ? entry.targetSchema : entry.currentSchema}.${entry.table}`,
    entry,
  ]));
  const modelByName = new Map(models.map((model) => [model.modelName, model]));
  const modelByDelegate = new Map();
  for (const model of models) {
    const owner = ownersByTable.get(`${model.schema}.${model.table}`);
    if (owner) modelByDelegate.set(modelDelegateName(model.modelName), { model, owner });
  }

  const addViolation = ({ file, kind, model, operation, sourceDomain, targetDomain, detail }) => {
    errors.push({
      file,
      kind,
      model,
      operation,
      sourceDomain,
      targetDomain,
      ...(detail ? { detail } : {}),
      message: `${file}: ${kind} ${operation} on ${model} writes ${targetDomain ?? 'an unowned table'} from ${sourceDomain ?? 'outside an owning context'}${detail ? ` (${detail})` : ''}`,
    });
  };

  const isOwnedWrite = (file, owner, model, operation, kind) => {
    const sourceDomain = moduleDomain(file);
    if (sourceDomain === owner.domain) return true;
    addViolation({ file, kind, model, operation, sourceDomain, targetDomain: owner.domain });
    return false;
  };

  const inspectNestedWrites = (file, parentModelInfo, input) => {
    const visit = (node, modelInfo) => {
      if (!ts.isObjectLiteralExpression(node)) return;
      for (const property of propertyAssignments(node)) {
        const field = propertyName(property.name);
        const relation = modelInfo.model.relationFields.find(({ fieldName }) => fieldName === field);
        if (!relation) continue;
        const targetModel = modelByName.get(relation.targetModel);
        const targetOwner = targetModel && ownersByTable.get(`${targetModel.schema}.${targetModel.table}`);
        const commands = relationCommands(property.initializer);
        if (!targetModel || !targetOwner) {
          addViolation({
            file,
            kind: 'nested Prisma relation write',
            model: relation.targetModel,
            operation: commands.join(',') || field,
            sourceDomain: moduleDomain(file),
            targetDomain: targetOwner?.domain ?? null,
            detail: 'relation target is not owned in the selected catalog',
          });
          continue;
        }
        if (commands.length > 0 && modelInfo.owner.domain !== targetOwner.domain) {
          addViolation({
            file,
            kind: 'nested Prisma relation write',
            model: relation.targetModel,
            operation: commands.join(','),
            sourceDomain: modelInfo.owner.domain,
            targetDomain: targetOwner.domain,
            detail: `parent model ${modelInfo.model.modelName} is owned by ${modelInfo.owner.domain}`,
          });
        }
        visit(property.initializer, { model: targetModel, owner: targetOwner });
      }
    };

    if (!ts.isObjectLiteralExpression(input)) return;
    for (const property of propertyAssignments(input)) {
      if (!['data', 'create', 'update'].includes(propertyName(property.name))) continue;
      visit(property.initializer, parentModelInfo);
    }
  };

  const inspectRawSql = (file, method, expression) => {
    const sql = staticSqlText(expression);
    if (sql === null) {
      addViolation({
        file,
        kind: 'raw SQL write',
        model: '(unclassified)',
        operation: method,
        sourceDomain: moduleDomain(file),
        targetDomain: null,
        detail: 'SQL text is dynamic and cannot be checked against table owners',
      });
      return;
    }
    if (!containsRawMutation(sql)) return;
    const targets = rawSqlTargets(sql);
    if (targets.length === 0 || targets.some((target) => !target?.schema)) {
      addViolation({
        file,
        kind: 'raw SQL write',
        model: '(unclassified)',
        operation: method,
        sourceDomain: moduleDomain(file),
        targetDomain: null,
        detail: 'mutating SQL must name an owner-mapped schema and table',
      });
      return;
    }
    for (const target of targets) {
      const owner = ownersByTable.get(`${target.schema}.${target.table}`);
      if (!owner) {
        addViolation({
          file,
          kind: 'raw SQL write',
          model: `${target.schema}.${target.table}`,
          operation: method,
          sourceDomain: moduleDomain(file),
          targetDomain: null,
          detail: 'target is not in the selected ownership catalog',
        });
        continue;
      }
      isOwnedWrite(file, owner, `${target.schema}.${target.table}`, method, 'raw SQL write');
    }
  };

  for (const [rawPath, sourceText] of Object.entries(sourceFiles ?? {})) {
    const file = rawPath.replaceAll('\\', '/');
    const sourceDomain = moduleDomain(file);
    if (!sourceDomain || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) continue;
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = propertyName(node.expression.name);
        const receiver = node.expression.expression;
        if (RAW_SQL_METHODS.has(method)) {
          inspectRawSql(file, method, node.arguments[0]);
        } else if (PRISMA_MUTATIONS.has(method) && ts.isPropertyAccessExpression(receiver)) {
          const delegate = propertyName(receiver.name);
          const modelInfo = modelByDelegate.get(delegate);
          if (modelInfo) {
            isOwnedWrite(file, modelInfo.owner, modelInfo.model.modelName, method, 'Prisma write');
            if (node.arguments[0]) inspectNestedWrites(file, modelInfo, node.arguments[0]);
          }
        }
      } else if (ts.isTaggedTemplateExpression(node) && ts.isPropertyAccessExpression(node.tag)) {
        const method = propertyName(node.tag.name);
        if (RAW_SQL_METHODS.has(method)) inspectRawSql(file, method, node.template);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return errors;
}

export function loadPrivateWriteSources(root = REPO_ROOT) {
  let trackedFiles;
  try {
    trackedFiles = execFileSync('git', ['ls-files', 'apps/api/src/modules'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    const moduleRoot = join(root, 'apps/api/src/modules');
    const visit = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return visit(path);
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
    });
    trackedFiles = visit(moduleRoot).map((path) => path.slice(root.length + 1).replaceAll('\\', '/'));
  }
  const files = trackedFiles.filter((file) => /\.tsx?$/.test(file) && !/\.(?:test|spec)\.[cm]?tsx?$/.test(file));
  return Object.fromEntries(files.map((file) => [file, readFileSync(join(root, file), 'utf8')]));
}

export function loadDomainPersistenceInputs(prismaDirectory = PRISMA_ROOT) {
  return {
    ownershipManifest: JSON.parse(readFileSync(join(prismaDirectory, 'domain-ownership.json'), 'utf8')),
    schemaText: readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8'),
    writePolicy: JSON.parse(readFileSync(join(prismaDirectory, 'domain-write-policy.json'), 'utf8')),
  };
}

function writeExceptionKey(entry) {
  return [entry.file, entry.kind, entry.model, entry.operation, entry.sourceDomain, entry.targetDomain].join('|');
}

export function applyWriteExceptions(findings, exceptions = []) {
  const errors = [];
  const remaining = new Map();
  for (const exception of exceptions) {
    if (!exception.file || !exception.kind || !exception.model || !exception.operation ||
        !exception.sourceDomain || !exception.targetDomain || !Number.isInteger(exception.count) ||
        exception.count < 1 || !exception.reason || !exception.replacesBy || !exception.expiresBy) {
      errors.push('transitional write exception is missing exact identity, count, reason, replacement task, or expiry milestone');
      continue;
    }
    const key = writeExceptionKey(exception);
    if (remaining.has(key)) errors.push(`duplicate transitional write exception ${key}`);
    remaining.set(key, exception.count);
  }

  const unapproved = [];
  for (const finding of findings) {
    const key = writeExceptionKey(finding);
    const count = remaining.get(key) ?? 0;
    if (count === 0) {
      unapproved.push(finding);
      continue;
    }
    remaining.set(key, count - 1);
  }
  for (const [key, count] of remaining) {
    if (count > 0) errors.push(`transitional write exception ${key} expected ${count} more matching write(s)`);
  }
  return { errors, unapproved };
}

export function validateWritePolicy(writePolicy, { final = false } = {}) {
  const errors = [];
  if (writePolicy?.policyVersion !== 1) {
    errors.push('domain write policy must declare supported policyVersion 1');
  }
  if (!Array.isArray(writePolicy?.transitionalWrites)) {
    errors.push('domain write policy transitionalWrites must be an array');
  } else if (final && writePolicy.transitionalWrites.length > 0) {
    errors.push('final domain persistence policy must remove all transitional write exceptions');
  }
  return errors;
}

function main() {
  const acceptedArguments = new Set(['--final']);
  const unknownArguments = process.argv.slice(2).filter((argument) => !acceptedArguments.has(argument));
  if (unknownArguments.length > 0) {
    console.error(`Unknown argument(s): ${unknownArguments.join(', ')}. Supported option: --final.`);
    process.exitCode = 1;
    return;
  }
  const final = process.argv.includes('--final');
  const inputs = loadDomainPersistenceInputs();
  const persistence = validateDomainPersistence({ ...inputs, final });
  const writes = validatePrivateWrites({
    ...inputs,
    sourceFiles: loadPrivateWriteSources(),
    final,
  });
  const policy = applyWriteExceptions(writes, final ? [] : inputs.writePolicy.transitionalWrites ?? []);
  const errors = [
    ...persistence.errors,
    ...validateWritePolicy(inputs.writePolicy, { final }),
    ...policy.errors,
    ...policy.unapproved.map(({ message }) => message),
  ];
  if (errors.length > 0) {
    console.error(`Domain persistence check failed (${errors.length} issue(s)):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  const stage = final ? 'final target' : 'current transition';
  const writeLabel = final ? 'private writes' : 'transition-authorized private writes';
  console.log(`Domain persistence check passed for ${stage} (${persistence.summary.models} models; ${persistence.summary.foreignKeys} relations; ${persistence.summary.crossDomainForeignKeys} cross-domain; ${writes.length} ${writeLabel}).`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href) main();
