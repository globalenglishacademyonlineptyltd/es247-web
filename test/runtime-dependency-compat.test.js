import test from 'node:test';
import assert from 'node:assert/strict';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

test('express-rate-limit exposes the default middleware factory used by the server', () => {
  assert.equal(typeof rateLimit, 'function');
});

test('Zod 4 supports the validation APIs used by ES 24/7 routes', () => {
  const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
  const password = z.string().min(6).max(128);
  const legalAcceptance = z.object({
    accepted: z.literal(true),
    version: z.string().refine(value => value === '1.2')
  });
  const incident = z.object({
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    incidentType: z.enum(['Emergency Service', 'Accident', 'Fire Panic'])
  });
  const client = z.object({
    vehicles: z.array(z.object({
      make: z.string().trim().max(80).optional().default(''),
      model: z.string().trim().max(80).optional().default('')
    })).max(10).optional().default([])
  });

  assert.equal(email.parse('  USER@example.com  '), 'user@example.com');
  assert.equal(password.safeParse('sixsix').success, true);
  assert.equal(legalAcceptance.safeParse({ accepted: true, version: '1.2' }).success, true);
  assert.deepEqual(incident.parse({ latitude: '45.5', incidentType: 'Accident' }), {
    latitude: 45.5, incidentType: 'Accident'
  });
  assert.deepEqual(client.parse({}), { vehicles: [] });
});
