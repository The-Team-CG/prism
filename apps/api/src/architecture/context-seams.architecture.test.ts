import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src', 'modules');

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
    return [readFileSync(path, 'utf8')];
  });
}

describe('context dependency seams', () => {
  it('keeps platform workflow implementations behind focused ports', () => {
    const workflowSources = sourceFiles(join(sourceRoot, 'commercial', 'application'))
      .concat(sourceFiles(join(sourceRoot, 'event-lifecycle', 'application')))
      .concat(sourceFiles(join(sourceRoot, 'floorplan', 'application')))
      .concat(sourceFiles(join(sourceRoot, 'identity-access', 'application')))
      .concat(sourceFiles(join(sourceRoot, 'live-ops', 'application')))
      .concat(sourceFiles(join(sourceRoot, 'operations', 'application')))
      .concat(sourceFiles(join(sourceRoot, 'read-models')));
    const source = workflowSources.join('\n');

    expect(source).not.toMatch(
      /import\s+\{[^}]*\b(?:AuditService|NotificationOutboxService|BillingOperationsService|FloorPlanWorkflowService|CoordinatorsService|GuestWorkflowService|DocumentVaultService|InquiriesService)\b[^}]*\}\s+from\s+['"]@prism\/contexts\//s,
    );
  });
});
