import test from 'node:test';
import assert from 'node:assert/strict';
import { clientTemporaryPasswordSchema } from '../src/password-policy.js';

test('client temporary passwords accept six to 128 characters', () => {
  assert.equal(clientTemporaryPasswordSchema.safeParse('123456').success, true);
  assert.equal(clientTemporaryPasswordSchema.safeParse('x'.repeat(128)).success, true);
  assert.equal(clientTemporaryPasswordSchema.safeParse('12345').success, false);
  assert.equal(clientTemporaryPasswordSchema.safeParse('x'.repeat(129)).success, false);
  assert.equal(clientTemporaryPasswordSchema.safeParse(123456).success, false);
});
