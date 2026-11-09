import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidOriginSecret } from '../src/cloudflare-proxy.js';

test('accepts only an exact non-empty origin secret', () => {
  assert.equal(isValidOriginSecret('private-secret-value', 'private-secret-value'), true);
  assert.equal(isValidOriginSecret('wrong-secret-value', 'private-secret-value'), false);
  assert.equal(isValidOriginSecret('', 'private-secret-value'), false);
  assert.equal(isValidOriginSecret('private-secret-value', ''), false);
  assert.equal(isValidOriginSecret('short', 'private-secret-value'), false);
  assert.equal(isValidOriginSecret(null, 'private-secret-value'), false);
});
