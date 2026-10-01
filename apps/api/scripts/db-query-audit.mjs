import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const rootPath = fileURLToPath(new URL('../../../', import.meta.url));
const sourceRoot = join(rootPath, 'apps', 'api', 'src');
const apiTsconfigPath = join(rootPath, 'apps', 'api', 'tsconfig.json');
const apiTsconfig = ts.readConfigFile(apiTsconfigPath, ts.sys.readFile);
const apiCompilerOptions = ts.parseJsonConfigFileContent(
  apiTsconfig.config,
  ts.sys,
  dirname(apiTsconfigPath),
  undefined,
  apiTsconfigPath,
).options;
const broadNames = new Set(['normalizePrism', 'normalizeData', 'handleThing']);
const allowedBoundaryNames = new Set(['normalizePrismApiProblem', 'normalizePrismPageLimit']);
const queryMethods = ['find', 'create', 'update', 'delete', 'upsert'];
const callbackIterationMethods = new Set([
  'forEach', 'map', 'flatMap', 'reduce', 'reduceRight', 'filter', 'find', 'findIndex', 'some', 'every',
]);
const prismaRootNames = new Set(['prisma', 'tx', 'db', 'database', 'client', 'transaction']);
const sourceCommentCache = new WeakMap();
// A larger global read needs an explicit reason instead of masquerading as pagination.
const MAX_AUDIT_TAKE = 1000;

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

function rel(file) {
  return relative(rootPath, file).split(String.fromCharCode(92)).join('/');
}

function propertyName(property) {
  if (!property.name) return undefined;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
  if (ts.isComputedPropertyName(property.name)) {
    const expression = property.name.expression;
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) return expression.text;
  }
  return undefined;
}

function sourceComments(sourceFile) {
  const cached = sourceCommentCache.get(sourceFile);
  if (cached) return cached;

  const commentsByPosition = new Map();
  const collect = (ranges) => {
    for (const range of ranges ?? []) {
      commentsByPosition.set(range.pos, {
        pos: range.pos,
        end: range.end,
        text: sourceFile.text.slice(range.pos, range.end),
      });
    }
  };
  const visit = (node) => {
    collect(ts.getLeadingCommentRanges(sourceFile.text, node.pos));
    collect(ts.getTrailingCommentRanges(sourceFile.text, node.end));
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  const comments = [...commentsByPosition.values()];
  sourceCommentCache.set(sourceFile, comments);
  return comments;
}

function hasMarker(sourceFile, node, marker) {
  const directlyAssociated = [
    ...(ts.getLeadingCommentRanges(sourceFile.text, node.pos) ?? []),
    ...(ts.getTrailingCommentRanges(sourceFile.text, node.end) ?? []),
  ];
  if (directlyAssociated.some((comment) => sourceFile.text.slice(comment.pos, comment.end).includes(marker))) return true;

  let statement = node.parent;
  while (statement && !ts.isStatement(statement) && !ts.isSourceFile(statement)) statement = statement.parent;
  if (!statement || ts.isSourceFile(statement)) return false;

  const commentsByPosition = new Map(sourceComments(sourceFile)
    .filter((comment) => comment.text.includes(marker) &&
      comment.pos >= statement.getFullStart() && comment.end <= statement.end)
    .map((comment) => [comment.pos, comment]));
  for (const range of [
    ...(ts.getLeadingCommentRanges(sourceFile.text, statement.pos) ?? []),
    ...(ts.getTrailingCommentRanges(sourceFile.text, statement.end) ?? []),
  ]) {
    const comment = { pos: range.pos, end: range.end, text: sourceFile.text.slice(range.pos, range.end) };
    if (comment.text.includes(marker)) commentsByPosition.set(comment.pos, comment);
  }
  const comments = [...commentsByPosition.values()];
  if (comments.length === 0) return false;

  const targets = [];
  const visit = (current) => {
    if (current !== statement && ts.isStatement(current)) return;
    if (isMarkerTarget(current, marker)) targets.push(current);
    ts.forEachChild(current, visit);
  };
  visit(statement);
  if (targets.length === 1) return true;
  if (targets.length === 0) return false;

  return comments.some((comment) => {
    const distance = (target) => comment.end <= target.getStart(sourceFile)
      ? target.getStart(sourceFile) - comment.end
      : comment.pos >= target.end
        ? comment.pos - target.end
        : 0;
    const distances = targets.map(distance);
    const minimum = Math.min(...distances);
    const nearest = targets.filter((_, index) => distances[index] === minimum);
    return nearest.length === 1 && nearest[0] === node;
  });
}

function isRawQueryExpression(node) {
  if (!ts.isCallExpression(node) && !ts.isTaggedTemplateExpression(node)) return false;
  const expression = ts.isTaggedTemplateExpression(node) ? node.tag : node.expression;
  if (!ts.isPropertyAccessExpression(expression)) return false;
  return /^\$(?:query|execute)Raw(?:Unsafe)?$/.test(expression.name.text);
}

function isPrismaDelegateCall(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  if (!ts.isPropertyAccessExpression(node.expression.expression)) return false;
  let root = node.expression.expression;
  while (ts.isPropertyAccessExpression(root)) {
    if (root.name.text === 'prisma' ||
      (ts.isThis(root.expression) && prismaRootNames.has(root.name.text))) {
      return queryMethods.some((method) => node.expression.name.text.startsWith(method));
    }
    root = root.expression;
  }
  return ts.isIdentifier(root) && prismaRootNames.has(root.text) &&
    queryMethods.some((method) => node.expression.name.text.startsWith(method));
}

function isLoop(node) {
  return ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) || ts.isDoStatement(node);
}

function hasBoundedWorkMarker(sourceFile, iteration, marker) {
  const text = sourceFile.text;
  const comments = sourceComments(sourceFile).filter((comment) => comment.text.includes(marker));
  const associatedComments = [
    ...(ts.getLeadingCommentRanges(text, iteration.pos) ?? []),
    ...(ts.getTrailingCommentRanges(text, iteration.end) ?? []),
  ];
  if (associatedComments.some((comment) => text.slice(comment.pos, comment.end).includes(marker))) return true;

  for (const comment of comments) {
    if (comment.pos < iteration.getFullStart() || comment.end > iteration.end) continue;
    let belongsToNestedLoop = false;
    const visit = (node) => {
      if (belongsToNestedLoop) return;
      if (node !== iteration && isDatabaseIteration(node) &&
        comment.pos >= node.getFullStart() && comment.end <= node.end) {
        belongsToNestedLoop = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(isLoop(iteration) ? iteration.statement : iteration.arguments[0]);
    if (!belongsToNestedLoop) return true;
  }
  return false;
}

function isIterationCallbackCall(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) ||
    !callbackIterationMethods.has(node.expression.name.text)) return false;
  return Boolean(node.arguments[0]);
}

function resolveImportedModule(sourceFile, moduleSpecifier, sourceFilesByPath) {
  const directKey = sourceFile.fileName + '::' + moduleSpecifier;
  if (sourceFilesByPath.has(directKey)) return sourceFilesByPath.get(directKey);

  const containingFile = resolve(rootPath, sourceFile.fileName);
  const resolvedModule = ts.resolveModuleName(moduleSpecifier, containingFile, apiCompilerOptions, ts.sys).resolvedModule;
  if (resolvedModule) {
    const resolvedSource = sourceFilesByPath.get(resolve(resolvedModule.resolvedFileName));
    if (resolvedSource) return resolvedSource;
  }
  if (!moduleSpecifier.startsWith('.')) return undefined;

  const base = resolve(dirname(containingFile), moduleSpecifier);
  const candidates = [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.map((candidate) => sourceFilesByPath.get(resolve(candidate))).find(Boolean);
}

function hasModifier(node, kind) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

function findLocalCallbackDeclaration(sourceFile, name) {
  const declarations = [];
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && propertyName(statement) === name) {
      declarations.push(statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
          declarations.push(declaration.initializer);
        }
      }
    }
  }
  return declarations.length === 1 ? declarations[0] : undefined;
}

function resolveExportedCallbackFunction(sourceFile, exportName, sourceFilesByPath, seen = new Set()) {
  const key = sourceFile.fileName + '::' + exportName;
  if (seen.has(key)) return undefined;
  const nextSeen = new Set(seen);
  nextSeen.add(key);
  const candidates = [];

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      (exportName === 'default' ? hasModifier(statement, ts.SyntaxKind.DefaultKeyword) : propertyName(statement) === exportName)) {
      candidates.push(statement);
    } else if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword) && exportName !== 'default') {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer) {
          candidates.push(declaration.initializer);
        }
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals && exportName === 'default') {
      candidates.push(statement.expression);
    } else if (ts.isExportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;
      if (!statement.exportClause && moduleSpecifier) {
        const target = resolveImportedModule(sourceFile, moduleSpecifier, sourceFilesByPath);
        const callback = target && resolveExportedCallbackFunction(target, exportName, sourceFilesByPath, nextSeen);
        if (callback) candidates.push(callback);
      } else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          if (specifier.isTypeOnly || specifier.name.text !== exportName) continue;
          const localName = specifier.propertyName?.text ?? specifier.name.text;
          if (moduleSpecifier) {
            const target = resolveImportedModule(sourceFile, moduleSpecifier, sourceFilesByPath);
            const callback = target && resolveExportedCallbackFunction(target, localName, sourceFilesByPath, nextSeen);
            if (callback) candidates.push(callback);
          } else {
            const callback = findLocalCallbackDeclaration(sourceFile, localName);
            if (callback) candidates.push(callback);
          }
        }
      }
    }
  }

  const uniqueCandidates = [...new Set(candidates)];
  return uniqueCandidates.length === 1 ? uniqueCandidates[0] : undefined;
}

function importedCallbackBinding(expression, sourceFile) {
  const value = unwrapExpression(expression);
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause) continue;
    const clause = statement.importClause;
    if (clause.isTypeOnly) continue;

    if (ts.isIdentifier(value) && clause.name?.text === value.text) {
      return { moduleSpecifier: statement.moduleSpecifier.text, importName: 'default' };
    }
    if (ts.isIdentifier(value) && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      const specifier = clause.namedBindings.elements.find((element) => !element.isTypeOnly && element.name.text === value.text);
      if (specifier) {
        return {
          moduleSpecifier: statement.moduleSpecifier.text,
          importName: specifier.propertyName?.text ?? specifier.name.text,
        };
      }
    }
    if (ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.expression) && clause.namedBindings &&
      ts.isNamespaceImport(clause.namedBindings) && clause.namedBindings.name.text === value.expression.text) {
      return { moduleSpecifier: statement.moduleSpecifier.text, importName: value.name.text };
    }
  }
  return undefined;
}

function resolveImportedCallbackFunction(expression, sourceFile, sourceFilesByPath, seen) {
  const binding = importedCallbackBinding(expression, sourceFile);
  if (!binding) return undefined;
  const moduleSource = resolveImportedModule(sourceFile, binding.moduleSpecifier, sourceFilesByPath);
  if (!moduleSource) return undefined;
  const callback = resolveExportedCallbackFunction(moduleSource, binding.importName, sourceFilesByPath);
  return callback && resolveCallbackFunction(callback, moduleSource, moduleSource, sourceFilesByPath, seen);
}

function resolveCallbackFunction(expression, sourceFile, scopeNode, sourceFilesByPath, seen = new Set()) {
  const value = unwrapExpression(expression);
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value) ||
    ts.isFunctionDeclaration(value) || ts.isMethodDeclaration(value)) return value;
  if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) && value.expression.name.text === 'bind') {
    return resolveCallbackFunction(value.expression.expression, sourceFile, scopeNode, sourceFilesByPath, seen);
  }

  let name;
  if (ts.isIdentifier(value)) name = value.text;
  else if (ts.isPropertyAccessExpression(value)) name = value.name.text;
  if (!name || seen.has(name)) return undefined;

  if (ts.isIdentifier(value)) {
    const lexicalDeclaration = resolveIdentifierDeclaration(value, sourceFile, scopeNode);
    if (lexicalDeclaration) {
      if (ts.isVariableDeclaration(lexicalDeclaration) && lexicalDeclaration.initializer) {
        const nextSeen = new Set(seen);
        nextSeen.add(name);
        return resolveCallbackFunction(lexicalDeclaration.initializer, sourceFile, scopeNode, sourceFilesByPath, nextSeen);
      }
      return undefined;
    }
  }

  const declarations = [];
  const visit = (node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && propertyName(node) === name) {
      declarations.push(node);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      declarations.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (declarations.length === 1) {
    const nextSeen = new Set(seen);
    nextSeen.add(name);
    return resolveCallbackFunction(declarations[0], sourceFile, scopeNode, sourceFilesByPath, nextSeen);
  }
  if (declarations.length > 1) return undefined;
  return resolveImportedCallbackFunction(value, sourceFile, sourceFilesByPath, seen);
}

function isResolvableHelperCall(node, sourceFile) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return true;
  return ts.isPropertyAccessExpression(node.expression) &&
    (ts.isThis(node.expression.expression) || importedCallbackBinding(node.expression, sourceFile) !== undefined);
}

function containsPrismaCallInCallback(call, sourceFile, sourceFilesByPath) {
  const callback = call.arguments[0];
  const callbackFunction = callback && resolveCallbackFunction(callback, sourceFile, call, sourceFilesByPath);
  if (!callbackFunction?.body) return false;
  const pending = [callbackFunction];
  const visited = new Set();
  while (pending.length > 0) {
    const currentFunction = pending.pop();
    if (visited.has(currentFunction)) continue;
    visited.add(currentFunction);
    let found = false;
    const currentSourceFile = currentFunction.getSourceFile();
    const visit = (node) => {
      if (found) return;
      if (ts.isCallExpression(node)) {
        if (isPrismaDelegateCall(node)) {
          found = true;
          return;
        }
        if (isResolvableHelperCall(node, currentSourceFile)) {
          const helper = resolveCallbackFunction(node.expression, currentSourceFile, node, sourceFilesByPath);
          if (helper?.body && !visited.has(helper)) pending.push(helper);
        }
      }
      if (isFunctionBoundary(node)) return;
      ts.forEachChild(node, visit);
    };
    visit(currentFunction.body);
    if (found) return true;
  }
  return false;
}

function isDatabaseIteration(node) {
  return isLoop(node) || isIterationCallbackCall(node);
}

function isPrismaQueryOption(node, optionName) {
  const isMatchingProperty = (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
    propertyName(node) === optionName;
  if (!isMatchingProperty) return false;
  const options = node.parent;
  if (!ts.isObjectLiteralExpression(options)) return false;
  const call = options.parent;
  return ts.isCallExpression(call) && call.arguments[0] === options && isPrismaDelegateCall(call);
}

function isMarkerTarget(node, marker) {
  if (marker === 'QUERY_AUDIT_RAW_SQL') return isRawQueryExpression(node);
  if (marker === 'QUERY_AUDIT_ALLOW_UNBOUNDED') {
    return ts.isCallExpression(node) && isPrismaDelegateCall(node) && node.expression.name.text === 'findMany';
  }
  if (marker === 'QUERY_AUDIT_ALLOW_BOUNDED_TAKE') return isPrismaQueryOption(node, 'take');
  if (marker === 'QUERY_AUDIT_ALLOW_OFFSET') return isPrismaQueryOption(node, 'skip');
  return false;
}

function isFunctionBoundary(node) {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);
}

function unwrapExpression(expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression;
  }
  return current;
}

function mayBeUndefined(expression, sourceFile, scopeNode, seen = new Set()) {
  const value = unwrapExpression(expression);
  if ((ts.isIdentifier(value) && value.text === 'undefined') || ts.isVoidExpression(value)) return true;
  if ((ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) || ts.isCallExpression(value)) &&
    value.questionDotToken) return true;
  if (ts.isConditionalExpression(value)) {
    return mayBeUndefined(value.whenTrue, sourceFile, scopeNode, seen) ||
      mayBeUndefined(value.whenFalse, sourceFile, scopeNode, seen);
  }
  if (ts.isIdentifier(value)) {
    if (seen.has(value.text)) return false;
    seen.add(value.text);
    const declaration = resolveIdentifierDeclaration(value, sourceFile, scopeNode);
    if (!declaration) return false;
    if (ts.isParameter(declaration) && declaration.questionToken) return true;
    if (mayBeUndefinedType(declaration.type, sourceFile, scopeNode)) return true;
    return Boolean(declaration.initializer && mayBeUndefined(declaration.initializer, sourceFile, scopeNode, seen));
  }
  if (ts.isCallExpression(value)) {
    return mayBeUndefinedType(resolveCallReturnType(value, sourceFile), sourceFile, scopeNode);
  }
  return false;
}

function mayBeUndefinedType(typeNode, sourceFile, scopeNode, seenTypes = new Set()) {
  if (!typeNode) return false;
  if (typeNode.kind === ts.SyntaxKind.UndefinedKeyword || typeNode.kind === ts.SyntaxKind.VoidKeyword ||
    typeNode.kind === ts.SyntaxKind.AnyKeyword || typeNode.kind === ts.SyntaxKind.UnknownKeyword) return true;
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some((member) => mayBeUndefinedType(member, sourceFile, scopeNode, seenTypes));
  }
  if (ts.isParenthesizedTypeNode(typeNode)) return mayBeUndefinedType(typeNode.type, sourceFile, scopeNode, seenTypes);
  if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) return false;
  const name = typeNode.typeName.text;
  if (['undefined', 'void', 'any', 'unknown'].includes(name)) return true;
  if (seenTypes.has(name)) return false;
  seenTypes.add(name);
  const alias = resolveTypeAlias(name, sourceFile);
  return Boolean(alias && mayBeUndefinedType(alias.type, sourceFile, scopeNode, seenTypes));
}

function resolveTypeAlias(name, sourceFile) {
  const declarations = [];
  const visit = (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) declarations.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations.length === 1 ? declarations[0] : undefined;
}

function resolveIdentifierDeclaration(identifier, sourceFile, scopeNode) {
  let scope = scopeNode;
  while (scope && !isFunctionBoundary(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
  if (!scope) return undefined;

  const declarations = [];
  const visit = (node) => {
    if (node !== scope && isFunctionBoundary(node)) return;
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
      ts.isIdentifier(node.name) && node.name.text === identifier.text) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  if (declarations.length !== 1) return undefined;

  const declaration = declarations[0];
  if (ts.isParameter(declaration)) return declaration;
  const declarationList = declaration.parent;
  if (!ts.isVariableDeclarationList(declarationList) || !(declarationList.flags & ts.NodeFlags.Const)) return undefined;
  return declaration;
}

function resolveConstInitializer(identifier, sourceFile, scopeNode) {
  const declaration = resolveIdentifierDeclaration(identifier, sourceFile, scopeNode);
  return declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
}

function resolveCallReturnType(call, sourceFile) {
  let calledName;
  if (ts.isIdentifier(call.expression)) calledName = call.expression.text;
  else if (ts.isPropertyAccessExpression(call.expression)) calledName = call.expression.name.text;
  if (!calledName) return undefined;

  const declarations = [];
  const visit = (node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name &&
      propertyName(node) === calledName) {
      declarations.push(node);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === calledName &&
      node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      declarations.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations.length === 1 ? declarations[0].type : undefined;
}

const WHERE_ALWAYS_TRUE = 'always-true';
const WHERE_ALWAYS_FALSE = 'always-false';
const WHERE_SCOPED = 'scoped';
const WHERE_UNKNOWN = 'unknown';

function combineWhereAnd(states) {
  if (states.includes(WHERE_ALWAYS_FALSE)) return WHERE_ALWAYS_FALSE;
  if (states.includes(WHERE_SCOPED)) return WHERE_SCOPED;
  if (states.includes(WHERE_UNKNOWN)) return WHERE_UNKNOWN;
  return WHERE_ALWAYS_TRUE;
}

function combineWhereOr(states) {
  if (states.includes(WHERE_ALWAYS_TRUE)) return WHERE_ALWAYS_TRUE;
  if (states.includes(WHERE_UNKNOWN)) return WHERE_UNKNOWN;
  if (states.length > 0 && states.every((state) => state === WHERE_ALWAYS_FALSE)) return WHERE_ALWAYS_FALSE;
  if (states.includes(WHERE_SCOPED)) return WHERE_SCOPED;
  return WHERE_ALWAYS_FALSE;
}

function invertWhereState(state) {
  if (state === WHERE_ALWAYS_TRUE) return WHERE_ALWAYS_FALSE;
  if (state === WHERE_ALWAYS_FALSE) return WHERE_ALWAYS_TRUE;
  return state;
}

function classifyCollectionConstraint(expression, emptyState, sourceFile, scopeNode, seen = new Set()) {
  const value = unwrapExpression(expression);
  if (ts.isArrayLiteralExpression(value)) {
    if (value.elements.length === 0) return emptyState;
    const definitelyNonEmpty = value.elements.some((element) =>
      !ts.isSpreadElement(element) && !mayBeUndefined(element, sourceFile, scopeNode),
    );
    if (definitelyNonEmpty || emptyState === WHERE_ALWAYS_FALSE) return WHERE_SCOPED;
    return WHERE_UNKNOWN;
  }
  if (ts.isConditionalExpression(value)) {
    return combineWhereOr([
      classifyCollectionConstraint(value.whenTrue, emptyState, sourceFile, scopeNode, new Set(seen)),
      classifyCollectionConstraint(value.whenFalse, emptyState, sourceFile, scopeNode, new Set(seen)),
    ]);
  }
  if (ts.isIdentifier(value)) {
    if (seen.has(value.text) || mayBeUndefined(value, sourceFile, scopeNode)) return WHERE_UNKNOWN;
    const initializer = resolveConstInitializer(value, sourceFile, scopeNode);
    if (initializer) {
      const nextSeen = new Set(seen);
      nextSeen.add(value.text);
      return classifyCollectionConstraint(initializer, emptyState, sourceFile, scopeNode, nextSeen);
    }
    return emptyState === WHERE_ALWAYS_FALSE ? WHERE_SCOPED : WHERE_UNKNOWN;
  }
  if (mayBeUndefined(value, sourceFile, scopeNode)) return WHERE_UNKNOWN;
  return emptyState === WHERE_ALWAYS_FALSE ? WHERE_SCOPED : WHERE_UNKNOWN;
}

function classifyFieldSpread(expression, sourceFile, scopeNode, seen) {
  const value = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(value) || ts.isConditionalExpression(value)) {
    return classifyFieldCondition(value, sourceFile, scopeNode, seen);
  }
  if (ts.isIdentifier(value)) {
    const initializer = resolveConstInitializer(value, sourceFile, scopeNode);
    if (initializer) return classifyFieldCondition(initializer, sourceFile, scopeNode, seen);
  }
  return WHERE_UNKNOWN;
}

function classifyFieldCondition(expression, sourceFile, scopeNode, seen = new Set()) {
  const value = unwrapExpression(expression);
  if (mayBeUndefined(value, sourceFile, scopeNode)) return WHERE_UNKNOWN;
  if (ts.isObjectLiteralExpression(value)) {
    const states = [];
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) {
        states.splice(0, states.length, classifyFieldSpread(property.expression, sourceFile, scopeNode, seen));
        continue;
      }
      if (property.name && ts.isComputedPropertyName(property.name) && propertyName(property) === undefined) {
        states.splice(0, states.length, WHERE_UNKNOWN);
        continue;
      }
      if (!ts.isPropertyAssignment(property)) return WHERE_UNKNOWN;
      const name = propertyName(property);
      if (name === 'not') {
        states.push(invertWhereState(classifyFieldCondition(property.initializer, sourceFile, scopeNode, seen)));
        continue;
      }
      if (name === 'in' || name === 'hasSome') {
        states.push(classifyCollectionConstraint(property.initializer, WHERE_ALWAYS_FALSE, sourceFile, scopeNode, seen));
        continue;
      }
      if (name === 'notIn' || name === 'hasEvery') {
        states.push(classifyCollectionConstraint(property.initializer, WHERE_ALWAYS_TRUE, sourceFile, scopeNode, seen));
        continue;
      }
      if (name === 'mode') {
        states.push(WHERE_ALWAYS_TRUE);
        continue;
      }
      if (name === 'every' && ts.isObjectLiteralExpression(unwrapExpression(property.initializer)) &&
        unwrapExpression(property.initializer).properties.length === 0) {
        states.push(WHERE_ALWAYS_TRUE);
        continue;
      }
      states.push(mayBeUndefined(property.initializer, sourceFile, scopeNode) ? WHERE_UNKNOWN : WHERE_SCOPED);
    }
    return combineWhereAnd(states);
  }
  if (ts.isConditionalExpression(value)) {
    return combineWhereOr([
      classifyFieldCondition(value.whenTrue, sourceFile, scopeNode, new Set(seen)),
      classifyFieldCondition(value.whenFalse, sourceFile, scopeNode, new Set(seen)),
    ]);
  }
  if (ts.isIdentifier(value)) {
    if (seen.has(value.text)) return WHERE_UNKNOWN;
    const initializer = resolveConstInitializer(value, sourceFile, scopeNode);
    if (initializer) {
      const nextSeen = new Set(seen);
      nextSeen.add(value.text);
      return classifyFieldCondition(initializer, sourceFile, scopeNode, nextSeen);
    }
  }
  return WHERE_SCOPED;
}
function classifyWhere(expression, sourceFile, scopeNode, seen = new Set()) {
  const value = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(value)) {
    const states = [];
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) {
        states.splice(0, states.length, classifyWhere(property.expression, sourceFile, scopeNode, seen));
        continue;
      }
      if (property.name && ts.isComputedPropertyName(property.name) && propertyName(property) === undefined) {
        states.splice(0, states.length, WHERE_UNKNOWN);
        continue;
      }
      if (ts.isPropertyAssignment(property)) {
        const name = propertyName(property);
        if (name === 'AND' || name === 'OR' || name === 'NOT') {
          states.push(classifyLogicalWhere(property.initializer, name, sourceFile, scopeNode, seen));
          continue;
        }
        states.push(classifyFieldCondition(property.initializer, sourceFile, scopeNode, seen));
        continue;
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        states.push(classifyFieldCondition(property.name, sourceFile, scopeNode, seen));
        continue;
      }
      states.push(WHERE_UNKNOWN);
    }
    return combineWhereAnd(states);
  }
  if (ts.isConditionalExpression(value)) {
    return combineWhereOr([
      classifyWhere(value.whenTrue, sourceFile, scopeNode, new Set(seen)),
      classifyWhere(value.whenFalse, sourceFile, scopeNode, new Set(seen)),
    ]);
  }
  if (ts.isBinaryExpression(value) &&
    (value.operatorToken.kind === ts.SyntaxKind.BarBarToken || value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    return combineWhereOr([
      classifyWhere(value.left, sourceFile, scopeNode, new Set(seen)),
      classifyWhere(value.right, sourceFile, scopeNode, new Set(seen)),
    ]);
  }
  if (ts.isIdentifier(value)) {
    if (seen.has(value.text) || mayBeUndefined(value, sourceFile, scopeNode)) return WHERE_UNKNOWN;
    const initializer = resolveConstInitializer(value, sourceFile, scopeNode);
    if (!initializer) return WHERE_UNKNOWN;
    const nextSeen = new Set(seen);
    nextSeen.add(value.text);
    return classifyWhere(initializer, sourceFile, scopeNode, nextSeen);
  }
  return WHERE_UNKNOWN;
}

function classifyLogicalWhere(expression, operator, sourceFile, scopeNode, seen = new Set()) {
  const value = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(value)) {
    const state = classifyWhere(value, sourceFile, scopeNode, seen);
    return operator === 'NOT' ? invertWhereState(state) : state;
  }
  if (ts.isArrayLiteralExpression(value)) {
    if (value.elements.length === 0) {
      if (operator === 'OR') return WHERE_ALWAYS_FALSE;
      return WHERE_ALWAYS_TRUE;
    }
    const states = value.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        return classifyLogicalWhere(element.expression, operator, sourceFile, scopeNode, seen);
      }
      const state = classifyWhere(element, sourceFile, scopeNode, seen);
      return operator === 'NOT' ? invertWhereState(state) : state;
    });
    if (operator === 'OR') return combineWhereOr(states);
    if (operator === 'AND' || operator === 'NOT') return combineWhereAnd(states);
    return WHERE_UNKNOWN;
  }
  if (ts.isConditionalExpression(value)) {
    return combineWhereOr([
      classifyLogicalWhere(value.whenTrue, operator, sourceFile, scopeNode, new Set(seen)),
      classifyLogicalWhere(value.whenFalse, operator, sourceFile, scopeNode, new Set(seen)),
    ]);
  }
  if (ts.isIdentifier(value)) {
    if (seen.has(value.text) || mayBeUndefined(value, sourceFile, scopeNode)) return WHERE_UNKNOWN;
    const initializer = resolveConstInitializer(value, sourceFile, scopeNode);
    if (!initializer) return WHERE_UNKNOWN;
    const nextSeen = new Set(seen);
    nextSeen.add(value.text);
    return classifyLogicalWhere(initializer, operator, sourceFile, scopeNode, nextSeen);
  }
  return WHERE_UNKNOWN;
}

function hasBoundedWhere(expression, sourceFile, scopeNode) {
  const state = classifyWhere(expression, sourceFile, scopeNode);
  return state === WHERE_ALWAYS_FALSE || state === WHERE_SCOPED;
}

function lastEffectiveProperty(objectLiteral, propertyNameToFind) {
  let effectiveProperty;
  for (const property of objectLiteral.properties) {
    if (ts.isSpreadAssignment(property)) {
      effectiveProperty = undefined;
      continue;
    }
    if (property.name && ts.isComputedPropertyName(property.name) && propertyName(property) === undefined) {
      effectiveProperty = undefined;
      continue;
    }
    if (propertyName(property) === propertyNameToFind) effectiveProperty = property;
  }
  return effectiveProperty;
}

function bindingNameContains(bindingName, expectedName) {
  if (ts.isIdentifier(bindingName)) return bindingName.text === expectedName;
  if (ts.isObjectBindingPattern(bindingName) || ts.isArrayBindingPattern(bindingName)) {
    return bindingName.elements.some((element) => ts.isOmittedExpression(element)
      ? false
      : bindingNameContains(element.name, expectedName));
  }
  return false;
}

function findUniqueConstInitializer(name, sourceFile) {
  // Duplicate value bindings make file-wide constant resolution ambiguous, so fail closed.
  const bindings = [];
  const constInitializers = [];
  const visit = (node) => {
    const declaresName =
      (ts.isVariableDeclaration(node) || ts.isParameter(node)) && bindingNameContains(node.name, name) ||
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) &&
        Boolean(node.name && ts.isIdentifier(node.name) && node.name.text === name) ||
      ts.isImportClause(node) && Boolean(node.name?.text === name) ||
      ts.isImportSpecifier(node) && node.name.text === name ||
      ts.isNamespaceImport(node) && node.name.text === name ||
      ts.isImportEqualsDeclaration(node) && node.name.text === name;
    if (declaresName) bindings.push(node);

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer &&
      ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const)) {
      constInitializers.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return bindings.length === 1 && constInitializers.length === 1 ? constInitializers[0] : undefined;
}

function evaluateStaticNumber(expression, sourceFile, seen = new Set()) {
  const value = unwrapExpression(expression);
  if (ts.isNumericLiteral(value)) {
    const parsed = Number(value.text.replaceAll('_', ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (ts.isPrefixUnaryExpression(value) &&
    (value.operator === ts.SyntaxKind.PlusToken || value.operator === ts.SyntaxKind.MinusToken)) {
    const operand = evaluateStaticNumber(value.operand, sourceFile, seen);
    if (operand === undefined) return undefined;
    return value.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
  }
  if (ts.isBinaryExpression(value)) {
    const left = evaluateStaticNumber(value.left, sourceFile, new Set(seen));
    const right = evaluateStaticNumber(value.right, sourceFile, new Set(seen));
    if (left === undefined || right === undefined) return undefined;
    switch (value.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken: return left + right;
      case ts.SyntaxKind.MinusToken: return left - right;
      case ts.SyntaxKind.AsteriskToken: return left * right;
      case ts.SyntaxKind.SlashToken: return right === 0 ? undefined : left / right;
      case ts.SyntaxKind.PercentToken: return right === 0 ? undefined : left % right;
      default: return undefined;
    }
  }
  if (ts.isIdentifier(value) && !seen.has(value.text)) {
    const initializer = findUniqueConstInitializer(value.text, sourceFile);
    if (!initializer) return undefined;
    const nextSeen = new Set(seen);
    nextSeen.add(value.text);
    return evaluateStaticNumber(initializer, sourceFile, nextSeen);
  }
  return undefined;
}

function hasFindManyBound(args, sourceFile, call) {
  if (!args || !ts.isObjectLiteralExpression(args)) return false;
  const takeProperty = lastEffectiveProperty(args, 'take');
  const takeExpression = takeProperty && ts.isPropertyAssignment(takeProperty)
    ? takeProperty.initializer
    : takeProperty && ts.isShorthandPropertyAssignment(takeProperty)
      ? takeProperty.name
      : undefined;
  const take = takeExpression ? evaluateStaticNumber(takeExpression, sourceFile) : undefined;
  if (Number.isSafeInteger(take) && take > 0 && take <= MAX_AUDIT_TAKE) return true;

  const whereProperty = lastEffectiveProperty(args, 'where');
  const whereExpression = whereProperty && ts.isPropertyAssignment(whereProperty)
    ? whereProperty.initializer
    : whereProperty && ts.isShorthandPropertyAssignment(whereProperty)
      ? whereProperty.name
      : undefined;
  return Boolean(whereExpression && hasBoundedWhere(whereExpression, sourceFile, call));
}

function hasBoundedTakeReason(sourceFile, call) {
  const args = call.arguments[0];
  if (!args || !ts.isObjectLiteralExpression(args)) return false;
  const take = lastEffectiveProperty(args, 'take');
  return Boolean(take && hasMarker(sourceFile, take, 'QUERY_AUDIT_ALLOW_BOUNDED_TAKE'));
}

function containsPrismaCall(loop) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (node !== loop && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) return;
    if (ts.isCallExpression(node) && isPrismaDelegateCall(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(loop.statement);
  return found;
}

function sourceLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function auditSourceFile(text, fileName = 'source.ts', sourceFilesByPath = new Map()) {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind);
  const failures = [];
  const report = (node, message) => failures.push(fileName + ':' + sourceLine(sourceFile, node) + ' ' + message);

  const visit = (node) => {
    if (ts.isIdentifier(node) && broadNames.has(node.text) && !allowedBoundaryNames.has(node.text)) {
      report(node, "broad helper name '" + node.text + "'");
    }

    if (ts.isCallExpression(node) && isPrismaDelegateCall(node) && node.expression.name.text === 'findMany') {
      const args = node.arguments[0];
      if (!hasFindManyBound(args, sourceFile, node) &&
        !hasBoundedTakeReason(sourceFile, node) &&
        !hasMarker(sourceFile, node, 'QUERY_AUDIT_ALLOW_UNBOUNDED')) {
        report(node, 'findMany lacks a non-empty where, take, or explicit audit reason');
      }
    }

    if (isPrismaQueryOption(node, 'skip') && !hasMarker(sourceFile, node, 'QUERY_AUDIT_ALLOW_OFFSET')) {
      report(node, 'offset pagination requires QUERY_AUDIT_ALLOW_OFFSET reason');
    }

    if (isRawQueryExpression(node) && !hasMarker(sourceFile, node, 'QUERY_AUDIT_RAW_SQL')) {
      report(node, 'raw SQL requires QUERY_AUDIT_RAW_SQL reason');
    }

    if ((isLoop(node) && containsPrismaCall(node) ||
      isIterationCallbackCall(node) && containsPrismaCallInCallback(node, sourceFile, sourceFilesByPath)) &&
      !hasBoundedWorkMarker(sourceFile, node, 'QUERY_AUDIT_ALLOW_BOUNDED_LOOP')) {
      report(node, 'Prisma call inside loop needs batching or QUERY_AUDIT_ALLOW_BOUNDED_LOOP reason');
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return failures;
}

export function runQueryAudit() {
  const files = collectTypeScriptFiles(sourceRoot);
  const sourceFilesByPath = new Map();
  const sourceByPath = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const fileName = rel(file);
    sourceByPath.set(resolve(file), text);
    sourceFilesByPath.set(resolve(file), ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
  }
  const failures = files.flatMap((file) => auditSourceFile(sourceByPath.get(resolve(file)), rel(file), sourceFilesByPath));
  return { fileCount: files.length, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { fileCount, failures } = runQueryAudit();
  if (failures.length > 0) {
    console.error('DB query audit failed:');
    for (const failure of failures) console.error('- ' + failure);
    process.exit(1);
  }

  console.log('DB query audit passed for ' + fileCount + ' API source files.');
}
