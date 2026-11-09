import { createHash } from 'node:crypto';
import { pool } from './db.js';

/**
 * PostgreSQL-backed express-rate-limit store.
 * Counters are shared by every app replica and survive application restarts.
 * Client identifiers are hashed before persistence so raw IPs/emails are not stored.
 */
export default class PostgresRateLimitStore {
  constructor(prefix, query = pool.query.bind(pool)) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(prefix)) {
      throw new Error('A short, stable rate-limit store prefix is required.');
    }
    this.prefix = prefix;
    this.query = query;
    this.windowMs = 15 * 60 * 1000;
    this.operations = 0;
  }

  init(options) {
    this.windowMs = Number(options.windowMs);
    if (!Number.isFinite(this.windowMs) || this.windowMs < 1) {
      throw new Error('Rate-limit windowMs must be a positive number.');
    }
  }

  keyHash(key) {
    return createHash('sha256').update(String(key)).digest('hex');
  }

  async increment(key) {
    const result = await this.query(
      `INSERT INTO rate_limit_counters (limiter_name, key_hash, total_hits, reset_time)
       VALUES ($1, $2, 1, NOW() + ($3 * INTERVAL '1 millisecond'))
       ON CONFLICT (limiter_name, key_hash) DO UPDATE SET
         total_hits = CASE
           WHEN rate_limit_counters.reset_time <= NOW() THEN 1
           ELSE rate_limit_counters.total_hits + 1
         END,
         reset_time = CASE
           WHEN rate_limit_counters.reset_time <= NOW()
             THEN NOW() + ($3 * INTERVAL '1 millisecond')
           ELSE rate_limit_counters.reset_time
         END
       RETURNING total_hits, reset_time`,
      [this.prefix, this.keyHash(key), this.windowMs]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Rate-limit store did not return a counter.');
    this.operations += 1;
    if (this.operations % 500 === 0) {
      this.query('DELETE FROM rate_limit_counters WHERE reset_time <= NOW()')
        .catch(error => console.error('Rate-limit counter cleanup failed:', error.message));
    }
    return { totalHits: Number(row.total_hits), resetTime: new Date(row.reset_time) };
  }

  async decrement(key) {
    await this.query(
      `UPDATE rate_limit_counters
       SET total_hits = GREATEST(total_hits - 1, 0)
       WHERE limiter_name = $1 AND key_hash = $2 AND reset_time > NOW()`,
      [this.prefix, this.keyHash(key)]
    );
  }

  async resetKey(key) {
    await this.query(
      'DELETE FROM rate_limit_counters WHERE limiter_name = $1 AND key_hash = $2',
      [this.prefix, this.keyHash(key)]
    );
  }

  async resetAll() {
    await this.query('DELETE FROM rate_limit_counters WHERE limiter_name = $1', [this.prefix]);
  }
}
