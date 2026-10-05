import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const prismaDirectory = path.resolve(scriptDirectory, '../prisma');

function parseModels(schemaText, ownershipManifest) {
  const ownerByTable = new Map(ownershipManifest.ownership.map((entry) => [entry.table, entry.domain]));
  const byTable = new Map();
  const byName = new Map();
  for (const match of schemaText.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, modelName, body] = match;
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? modelName;
    const fields = new Map();
    for (const line of body.split(/\r?\n/)) {
      const field = line.match(/^\s{2}(\w+)\s+(?:String|Int|BigInt|Float|Boolean|DateTime|Json|Decimal|Bytes)(?:\?)?(?:\[\])?\b/);
      if (field) fields.set(field[1], line.match(/@map\("([^"]+)"\)/)?.[1] ?? null);
    }
    const model = { modelName, table, owner: ownerByTable.get(table), fields };
    byTable.set(table, model);
    byName.set(modelName, model);
  }
  return { byTable, byName };
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function action(definition, name) {
  return definition.match(new RegExp('ON ' + name + ' (CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT)'))?.[1] ?? 'NO ACTION';
}

export function validateDomainReferencePolicy({ ownershipManifest, policy, schemaText }) {
  const errors = [];
  const models = parseModels(schemaText, ownershipManifest);
  const externalFks = ownershipManifest.foreignKeys.filter((entry) => !entry.sameDomain);
  const fkByName = new Map(externalFks.map((entry) => [entry.name, entry]));
  const referencedFks = new Map();
  const profileIds = new Set(Object.keys(policy.profiles ?? {}));

  for (const [profileName, profile] of Object.entries(policy.profiles ?? {})) {
    for (const field of ['eventAgreement', 'authorization', 'meaning', 'targetLifecycle', 'failure', 'recovery']) {
      if (typeof profile[field] !== 'string' || !profile[field].trim()) errors.push('Profile ' + profileName + ' is missing ' + field);
    }
  }

  for (const group of policy.foreignKeyProfiles ?? []) {
    if (!profileIds.has(group.profile)) errors.push('Unknown foreign-key profile: ' + group.profile);
    for (const constraint of group.constraints ?? []) {
      if (referencedFks.has(constraint)) errors.push('Duplicate foreign-key reference: ' + constraint);
      referencedFks.set(constraint, group.profile);
      const fk = fkByName.get(constraint);
      if (!fk) {
        errors.push('Policy names a non-cross-domain or missing foreign key: ' + constraint);
        continue;
      }
      const sourceModel = models.byTable.get(fk.table);
      const targetModel = models.byTable.get(fk.targetTable);
      if (!sourceModel) errors.push('Missing Prisma source model for ' + constraint);
      if (!targetModel) errors.push('Missing Prisma target model for ' + constraint);
      for (const column of fk.columns) {
        const sourceField = sourceModel
          ? ([...sourceModel.fields].find(([, mapped]) => mapped === column)?.[0] ??
            [...sourceModel.fields.keys()].find((name) => name === snakeToCamel(column)))
          : undefined;
        if (!sourceField) errors.push('Missing Prisma scalar for ' + fk.table + '.' + column);
      }
      if (sourceModel?.owner !== fk.sourceDomain) errors.push('Source owner drift for ' + constraint);
      if (targetModel?.owner !== fk.targetDomain) errors.push('Target owner drift for ' + constraint);
      if (action(fk.definition, 'DELETE') === 'NO ACTION' && !/ON DELETE NO ACTION/.test(fk.definition)) errors.push('Could not parse ON DELETE action for ' + constraint);
      if (action(fk.definition, 'UPDATE') === 'NO ACTION' && !/ON UPDATE NO ACTION/.test(fk.definition)) errors.push('Could not parse ON UPDATE action for ' + constraint);
    }
  }
  for (const constraint of fkByName.keys()) {
    if (!referencedFks.has(constraint)) errors.push('Missing owner policy for cross-domain foreign key: ' + constraint);
  }

  const scalarSources = new Set();
  for (const reference of policy.scalarReferences ?? []) {
    if (scalarSources.has(reference.source)) errors.push('Duplicate scalar reference: ' + reference.source);
    scalarSources.add(reference.source);
    const [sourceName, sourceField] = reference.source?.split('.') ?? [];
    const [targetName, targetField] = reference.target?.split('.') ?? [];
    const sourceModel = models.byName.get(sourceName);
    const targetModel = models.byName.get(targetName);
    if (!sourceModel?.fields.has(sourceField)) errors.push('Unknown scalar source: ' + reference.source);
    if (sourceModel?.owner !== reference.sourceOwner) errors.push('Source owner drift for scalar reference: ' + reference.source);
    if (targetModel && (!targetModel.fields.has(targetField) || targetModel.owner !== reference.targetOwner)) errors.push('Target identifier or owner drift for scalar reference: ' + reference.source);
    if (!reference.targetOwner) errors.push('Missing target owner for scalar reference: ' + reference.source);
    if (!profileIds.has(reference.profile)) errors.push('Unknown scalar policy profile for: ' + reference.source);
    if (!reference.meaning?.trim()) errors.push('Missing meaning for scalar reference: ' + reference.source);
    if (!['implemented', 'transitional', 'planned'].includes(reference.status)) errors.push('Invalid status for scalar reference: ' + reference.source);
  }
  return errors;
}

export function loadDomainReferencePolicy(directory = prismaDirectory) {
  return {
    ownershipManifest: JSON.parse(fs.readFileSync(path.join(directory, 'domain-ownership.json'), 'utf8')),
    policy: JSON.parse(fs.readFileSync(path.join(directory, 'domain-reference-policy.json'), 'utf8')),
    schemaText: fs.readFileSync(path.join(directory, 'schema.prisma'), 'utf8')
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = loadDomainReferencePolicy();
  const errors = validateDomainReferencePolicy(source);
  if (errors.length) {
    console.error('Domain reference policy invalid (' + errors.length + ' issue(s)):');
    for (const error of errors) console.error('- ' + error);
    process.exitCode = 1;
  } else {
    const foreignKeys = source.ownershipManifest.foreignKeys.filter((entry) => !entry.sameDomain);
    const deletes = {};
    for (const fk of foreignKeys) {
      const deleteAction = action(fk.definition, 'DELETE');
      deletes[deleteAction] = (deletes[deleteAction] ?? 0) + 1;
    }
    console.log('Domain reference policy valid: ' + foreignKeys.length + ' cross-domain foreign keys, ' +
      source.policy.scalarReferences.length + ' scalar references; current external deletes: ' +
      Object.entries(deletes).map(([name, count]) => name + '=' + count).join(', ') + '.');
  }
}