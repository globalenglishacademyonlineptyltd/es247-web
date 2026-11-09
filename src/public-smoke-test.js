import assert from 'node:assert/strict';

const base = (process.env.ES247_PUBLIC_URL || 'https://securitysolutionses247.co.za').replace(/\/$/, '');
const railwayOrigin = process.env.ES247_RAILWAY_ORIGIN || 'https://es247-web-production.up.railway.app';
const timeout = ms => AbortSignal.timeout(ms);

async function request(path, options = {}) {
  return fetch(base + path, { redirect: 'manual', signal: timeout(30000), ...options });
}

async function check(name, fn) {
  try {
    await fn();
    console.log('PUBLIC SMOKE PASS: ' + name);
  } catch (error) {
    console.error('PUBLIC SMOKE FAIL: ' + name + ': ' + error.message);
    throw error;
  }
}

export async function runPublicSmokeTests() {
  await check('public health endpoint', async () => {
    const response = await request('/health');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'es247-web');
  });

  await check('HTTPS security headers and homepage', async () => {
    const response = await request('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/i);
    assert.match(response.headers.get('strict-transport-security') || '', /max-age=/i);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('content-security-policy'));
    const html = await response.text();
    assert.match(html, /<html/i);
    assert.match(html, /loader\.js/i);
  });

  await check('www domain health endpoint', async () => {
    const response = await fetch('https://www.securitysolutionses247.co.za/health', { redirect: 'follow', signal: timeout(30000) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
  });

  await check('client portal route', async () => {
    const response = await request('/client-app');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/i);
    const html = await response.text();
    assert.match(html, /login-form/i);
  });

  for (const path of ['/app', '/download']) {
    await check('Android landing page ' + path, async () => {
      const response = await request(path);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Official ES 24\/7 Client App/i);
      assert.match(html, /href="\/app\/download"/i);
    });
  }

  for (const path of ['/.env', '/.git/config', '/dump.sql', '/config.php', '/package.json', '/server.js']) {
    await check('sensitive path blocked ' + path, async () => {
      const response = await request(path);
      assert.equal(response.status, 404);
      await response.body?.cancel().catch(() => {});
    });
  }

  await check('unauthenticated dashboard is rejected', async () => {
    const response = await request('/api/dashboard');
    assert.equal(response.status, 401);
    await response.body?.cancel().catch(() => {});
  });

  await check('unauthenticated panic request is rejected', async () => {
    const response = await request('/api/client/panic', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ incident_type: 'Panic: Ambulance Assistance Needed' })
    });
    assert.equal(response.status, 401);
    await response.body?.cancel().catch(() => {});
  });

  await check('invalid login payload is rejected', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    assert.equal(response.status, 400);
    await response.body?.cancel().catch(() => {});
  });

  await check('direct Railway origin is blocked', async () => {
    const response = await fetch(railwayOrigin + '/', { redirect: 'manual', signal: timeout(30000) });
    assert.equal(response.status, 403);
    await response.body?.cancel().catch(() => {});
  });

  await check('Android APK download endpoint and ZIP signature', async () => {
    const response = await request('/app/download');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application\/vnd\.android\.package-archive/i);
    assert.match(response.headers.get('content-disposition') || '', /ES-24-7-Client-App\.apk/i);
    const size = Number(response.headers.get('content-length') || 0);
    assert.ok(size > 100000, 'APK response is unexpectedly small or has no Content-Length');
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.ok(first.value && first.value.length >= 4, 'APK response body is empty');
    assert.equal(first.value[0], 0x50, 'APK does not start with ZIP signature P');
    assert.equal(first.value[1], 0x4b, 'APK does not start with ZIP signature K');
    await reader.cancel();
  });

  const { runApplicationFlowSmokeTests } = await import('./application-flow-smoke-test.js');
  await runApplicationFlowSmokeTests();

  console.log('PUBLIC SMOKE TESTS COMPLETED SUCCESSFULLY.');
}
