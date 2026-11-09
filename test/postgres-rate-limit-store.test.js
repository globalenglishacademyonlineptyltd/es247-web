import test from 'node:test';
import assert from 'node:assert/strict';
import PostgresRateLimitStore from '../src/postgres-rate-limit-store.js';

test('Postgres store returns hit count and reset time without persisting raw identifiers', async () => {
  const calls = [];
  const resetTime = new Date('2026-11-09T12:15:00.000Z');
  const query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ total_hits: 2, reset_time: resetTime }] };
  };
  const store = new PostgresRateLimitStore('login-ip', query);
  store.init({ windowMs: 900000 });

  const result = await store.increment('192.0.2.44');

  assert.equal(result.totalHits, 2);
  assert.equal(result.resetTime.toISOString(), resetTime.toISOString());
  assert.equal(calls[0].values[0], 'login-ip');
  assert.match(calls[0].values[1], /^[a-f0-9]{64}$/);
  assert.notEqual(calls[0].values[1], '192.0.2.44');
  assert.match(calls[0].sql, /ON CONFLICT/);
});

test('Postgres store decrements, resets one key, and resets only its own limiter namespace', async () => {
  const calls = [];
  const query = async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; };
  const store = new PostgresRateLimitStore('password-reset', query);
  store.init({ windowMs: 900000 });

  await store.decrement('203.0.113.8');
  await store.resetKey('203.0.113.8');
  await store.resetAll();

  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /GREATEST/);
  assert.equal(calls[1].values[0], 'password-reset');
  assert.equal(calls[2].values[0], 'password-reset');
});
