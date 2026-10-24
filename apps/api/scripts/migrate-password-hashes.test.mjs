import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import test from 'node:test';
import passwordHash from '../src/modules/identity-access/application/auth/password-hash.cjs';
import { planPasswordRewrite, rewritePasswordValue } from './migrate-password-hashes.mjs';

// Node-default scrypt hash, written by the code before the current format existed.
function legacyHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

test('legacy Node-default hashes are rewritten to explicit parameters and still verify the same password', async () => {
  const stored = legacyHash('legacy-operator-password');
  assert.equal(planPasswordRewrite(stored).kind, 'legacy');

  const rewritten = await rewritePasswordValue(stored, 'legacy');

  assert.match(rewritten, /^scrypt\$N=16384,r=8,p=1\$/);
  assert.equal(await passwordHash.verifyScryptPassword(rewritten, 'legacy-operator-password'), true);
  assert.equal(await passwordHash.verifyScryptPassword(rewritten, 'wrong-password'), false);
  assert.equal(planPasswordRewrite(rewritten).kind, 'skip');
});

test('plaintext values are hashed in the current format and then skipped on a re-run', async () => {
  const plan = planPasswordRewrite('plain-operator-password');
  assert.equal(plan.kind, 'plaintext');

  const hashed = await rewritePasswordValue('plain-operator-password', plan.kind);

  assert.equal(passwordHash.isCurrentScryptPasswordHash(hashed), true);
  assert.equal(await passwordHash.verifyScryptPassword(hashed, 'plain-operator-password'), true);
  assert.equal(planPasswordRewrite(hashed).kind, 'skip');
});

test('values in the current format are skipped whatever their parameters', () => {
  const lowerCost = 'scrypt$N=16384,r=8,p=1$' + 'a'.repeat(32) + '$' + 'b'.repeat(128);
  assert.equal(planPasswordRewrite(lowerCost).kind, 'skip');
});

test('a scrypt-prefixed value that matches neither format is refused rather than treated as plaintext', () => {
  for (const malformed of ['scrypt$', 'scrypt$N=3,r=8,p=1$' + 'a'.repeat(32) + '$' + 'b'.repeat(128), 'scrypt$abc$def']) {
    assert.equal(planPasswordRewrite(malformed).kind, 'malformed', malformed);
  }
});
