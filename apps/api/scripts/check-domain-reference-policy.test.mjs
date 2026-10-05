import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDomainReferencePolicy, validateDomainReferencePolicy } from './check-domain-reference-policy.mjs';

function fixture() {
  return structuredClone(loadDomainReferencePolicy());
}

test('covers all cross-domain foreign keys and validates scalar references', () => {
  assert.deepEqual(validateDomainReferencePolicy(fixture()), []);
});

test('rejects a missing cross-domain foreign-key policy', () => {
  const source = fixture();
  source.policy.foreignKeyProfiles[0].constraints.pop();
  assert.ok(validateDomainReferencePolicy(source).some((error) => error.startsWith('Missing owner policy for cross-domain foreign key:')));
});

test('rejects a duplicate foreign-key policy', () => {
  const source = fixture();
  source.policy.foreignKeyProfiles[0].constraints.push(source.policy.foreignKeyProfiles[1].constraints[0]);
  assert.ok(validateDomainReferencePolicy(source).some((error) => error.startsWith('Duplicate foreign-key reference:')));
});

test('rejects scalar references whose owner no longer matches Prisma ownership', () => {
  const source = fixture();
  source.policy.scalarReferences[0].sourceOwner = 'commercial';
  assert.ok(validateDomainReferencePolicy(source).includes('Source owner drift for scalar reference: FloorPlan.eventId'));
});

test('rejects scalar links to fields missing from the Prisma schema', () => {
  const source = fixture();
  source.policy.scalarReferences[0].source = 'FloorPlan.missingEventId';
  assert.ok(validateDomainReferencePolicy(source).includes('Unknown scalar source: FloorPlan.missingEventId'));
});