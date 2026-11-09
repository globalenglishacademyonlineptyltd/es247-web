import test from 'node:test';
import assert from 'node:assert/strict';
import { isCloudflareIp } from '../src/cloudflare-proxy.js';

test('recognises Cloudflare IPv4 ranges and rejects unrelated addresses', () => {
  assert.equal(isCloudflareIp('173.245.48.1'), true);
  assert.equal(isCloudflareIp('104.16.0.1'), true);
  assert.equal(isCloudflareIp('1.1.1.1'), false);
  assert.equal(isCloudflareIp('192.0.2.1'), false);
});

test('recognises Cloudflare IPv6 ranges and rejects unrelated addresses', () => {
  assert.equal(isCloudflareIp('2606:4700::1'), true);
  assert.equal(isCloudflareIp('2400:cb00:1234::1'), true);
  assert.equal(isCloudflareIp('2001:4860:4860::8888'), false);
});

test('normalises IPv4-mapped IPv6 addresses and rejects malformed input', () => {
  assert.equal(isCloudflareIp('::ffff:173.245.48.1'), true);
  assert.equal(isCloudflareIp('not-an-ip'), false);
  assert.equal(isCloudflareIp(''), false);
});
