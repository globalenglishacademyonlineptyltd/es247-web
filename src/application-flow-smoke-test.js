import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = (process.env.ES247_PUBLIC_URL || 'https://securitysolutionses247.co.za').replace(/\/$/, '');
const timeout = ms => AbortSignal.timeout(ms);

async function request(path, options = {}) {
  return fetch(base + path, { redirect: 'manual', signal: timeout(30000), ...options });
}

function sessionCookie(response) {
  const raw = response.headers.get('set-cookie') || '';
  assert.ok(raw.includes('es247_session='), 'Session cookie was not issued');
  assert.match(raw, /HttpOnly/i, 'Session cookie must be HttpOnly');
  assert.match(raw, /Secure/i, 'Session cookie must be Secure');
  assert.match(raw, /SameSite=Strict/i, 'Session cookie must use SameSite=Strict');
  return raw.split(';')[0];
}

async function json(response) {
  return response.json();
}

export async function runApplicationFlowSmokeTests() {
  const { migrationPool } = await import('./migrations.js');
  const suffix = randomBytes(10).toString('hex');
  const masterEmail = 'es247-master-smoke-' + suffix + '@example.invalid';
  const controllerEmail = 'es247-controller-smoke-' + suffix + '@example.invalid';
  const clientEmail = 'es247-client-smoke-' + suffix + '@example.invalid';
  const masterPassword = 'Master-Smoke-' + suffix + '!A';
  const controllerPassword = 'Controller-Smoke-' + suffix + '!A';
  const clientPassword = 'Client-Smoke-' + suffix + '!A';
  const changedClientPassword = 'Smk6!a';
  let masterId = null, companyId = null, controllerId = null, clientUserId = null;
  let clientId = null, incidentId = null, clientRequestId = null;

  try {
    const bcrypt = (await import('bcryptjs')).default;
    const masterHash = await bcrypt.hash(masterPassword, 12);
    const controllerHash = await bcrypt.hash(controllerPassword, 12);
    const clientHash = await bcrypt.hash(clientPassword, 12);

    const master = await migrationPool.query(
      "INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password,active) VALUES($1,$2,'master_admin',NULL,'ES247 Smoke Master',false,true) RETURNING id",
      [masterEmail, masterHash]
    );
    masterId = master.rows[0].id;

    const company = await migrationPool.query(
      'INSERT INTO companies(registered_name,cipc_number,psira_number,contact_number,contact_email,covering_areas,tax_number) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      ['ES247 Verification ' + suffix, 'SMOKE-CIPC-' + suffix, 'SMOKE-PSIRA-' + suffix, '+27000000000', 'verification-' + suffix + '@example.invalid', 'Verification Area', 'SMOKE-TAX-' + suffix]
    );
    companyId = company.rows[0].id;

    const controller = await migrationPool.query(
      "INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password,active) VALUES($1,$2,'controller',$3,'ES247 Smoke Controller',false,true) RETURNING id",
      [controllerEmail, controllerHash, companyId]
    );
    controllerId = controller.rows[0].id;

    const clientUser = await migrationPool.query(
      "INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password,active) VALUES($1,$2,'client',$3,'ES247 Smoke Client',true,true) RETURNING id",
      [clientEmail, clientHash, companyId]
    );
    clientUserId = clientUser.rows[0].id;

    const client = await migrationPool.query(
      'INSERT INTO clients(company_id,user_id,full_name,email,phone) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [companyId, clientUserId, 'ES247 Smoke Client', clientEmail, '+27000000000']
    );
    clientId = client.rows[0].id;

    const incident = await migrationPool.query(
      "INSERT INTO incidents(company_id,client_id,incident_type,status,location_text,panic_at) VALUES($1,$2,'Emergency Service','Panic Received','ES247 verification test location',NOW()) RETURNING id",
      [companyId, clientId]
    );
    incidentId = incident.rows[0].id;

    await migrationPool.query(
      "INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,'Panic Activated','ES247 verification timeline event')",
      [incidentId, clientUserId]
    );

    const clientRequest = await migrationPool.query(
      "INSERT INTO client_requests(company_id,client_id,request_type,family_member_count,request_message) VALUES($1,$2,'Verification Request',1,'Temporary ES247 verification record') RETURNING id",
      [companyId, clientId]
    );
    clientRequestId = clientRequest.rows[0].id;

    const masterLogin = await request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: masterEmail, password: masterPassword })
    });
    assert.equal(masterLogin.status, 200, 'Master administrator login failed');
    const masterCookie = sessionCookie(masterLogin);
    const masterDashboardResponse = await request('/api/dashboard', { headers: { cookie: masterCookie } });
    assert.equal(masterDashboardResponse.status, 200, 'Master dashboard failed');
    const masterDashboard = await json(masterDashboardResponse);
    assert.equal(masterDashboard.role, 'master_admin');
    assert.ok(masterDashboard.companies.some(item => String(item.id) === String(companyId)), 'New company missing from master dashboard');
    console.log('APPLICATION FLOW PASS: master administrator login and dashboard');

    const controllerLogin = await request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: controllerEmail, password: controllerPassword })
    });
    assert.equal(controllerLogin.status, 200, 'Controller login failed');
    const controllerCookie = sessionCookie(controllerLogin);
    const controllerMe = await request('/api/me', { headers: { cookie: controllerCookie } });
    assert.equal(controllerMe.status, 200);
    assert.equal((await json(controllerMe)).user.role, 'controller');

    const companyDashboard = await request('/api/dashboard', { headers: { cookie: controllerCookie } });
    assert.equal(companyDashboard.status, 200, 'Company dashboard failed');
    const companyClients = await request('/api/company/clients', { headers: { cookie: controllerCookie } });
    assert.equal(companyClients.status, 200, 'Company client list failed');
    assert.ok((await json(companyClients)).clients.some(item => String(item.id) === String(clientId)), 'Client missing from company client list');

    const incidentsResponse = await request('/api/incidents', { headers: { cookie: controllerCookie } });
    assert.equal(incidentsResponse.status, 200, 'Company incidents list failed');
    assert.ok((await json(incidentsResponse)).incidents.some(item => String(item.id) === String(incidentId)), 'Incident missing from company incidents');

    const eventsResponse = await request('/api/incidents/' + incidentId + '/events', { headers: { cookie: controllerCookie } });
    assert.equal(eventsResponse.status, 200, 'Incident timeline failed');
    assert.ok((await json(eventsResponse)).events.some(item => item.event_type === 'Panic Activated'), 'Incident timeline event missing');
    console.log('APPLICATION FLOW PASS: controller dashboard, clients, incidents and timeline');

    const clientLogin = await request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: clientEmail, password: clientPassword, accept_terms: true })
    });
    assert.equal(clientLogin.status, 200, 'Client login and terms acceptance failed');
    assert.equal((await json(clientLogin)).user.must_change_password, true, 'Temporary password flag was not enforced');
    let clientCookie = sessionCookie(clientLogin);

    const changePassword = await request('/api/auth/change-password', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: clientCookie },
      body: JSON.stringify({ current_password: clientPassword, new_password: changedClientPassword })
    });
    assert.equal(changePassword.status, 200, 'Six-character client password change failed');
    clientCookie = sessionCookie(changePassword);

    const clientMe = await request('/api/me', { headers: { cookie: clientCookie } });
    assert.equal(clientMe.status, 200);
    assert.equal((await json(clientMe)).user.must_change_password, false);

    const profile = await request('/api/client/profile', { headers: { cookie: clientCookie } });
    assert.equal(profile.status, 200, 'Client profile failed');
    assert.equal((await json(profile)).profile.full_name, 'ES247 Smoke Client');

    const clientIncidents = await request('/api/client/incidents', { headers: { cookie: clientCookie } });
    assert.equal(clientIncidents.status, 200, 'Client incident history failed');
    assert.ok((await json(clientIncidents)).incidents.some(item => String(item.id) === String(incidentId)), 'Client incident history is missing the test incident');

    const webLogout = await request('/api/auth/logout', { method: 'POST', headers: { cookie: clientCookie } });
    assert.equal(webLogout.status, 200, 'Client web logout failed');
    const revokedWebSession = await request('/api/me', { headers: { cookie: clientCookie } });
    assert.equal(revokedWebSession.status, 401, 'Logged-out web session remained valid');
    console.log('APPLICATION FLOW PASS: client login, terms, six-character password change, profile, incidents and logout');

    const mobileLogin = await request('/api/mobile/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: clientEmail, password: changedClientPassword })
    });
    assert.equal(mobileLogin.status, 200, 'Android client token login failed');
    const mobileToken = (await json(mobileLogin)).access_token;
    assert.ok(mobileToken, 'Android bearer token was not returned');

    const mobileProfile = await request('/api/client/profile', { headers: { authorization: 'Bearer ' + mobileToken } });
    assert.equal(mobileProfile.status, 200, 'Android bearer-token profile access failed');

    const mobileLogout = await request('/api/mobile/auth/logout', {
      method: 'POST', headers: { authorization: 'Bearer ' + mobileToken }
    });
    assert.equal(mobileLogout.status, 200, 'Android bearer-token logout failed');

    const revokedMobileSession = await request('/api/client/profile', { headers: { authorization: 'Bearer ' + mobileToken } });
    assert.equal(revokedMobileSession.status, 401, 'Logged-out Android token remained valid');
    console.log('APPLICATION FLOW PASS: Android token login, profile access and logout');

    const archive = await request('/api/company/archive/' + companyId, {
      method: 'POST', headers: { cookie: masterCookie }
    });
    assert.equal(archive.status, 200, 'Company archive failed');

    const revokedControllerSession = await request('/api/dashboard', { headers: { cookie: controllerCookie } });
    assert.ok([401, 403].includes(revokedControllerSession.status), 'Archived company controller session remained active');

    const deletion = await request('/api/company/' + companyId, {
      method: 'DELETE', headers: { cookie: masterCookie }
    });
    assert.equal(deletion.status, 200, 'Permanent company deletion with linked records failed');
    assert.equal((await json(deletion)).deleted, true);

    const remaining = await migrationPool.query(
      "SELECT (SELECT COUNT(*)::int FROM companies WHERE id=$1) AS companies, " +
      "(SELECT COUNT(*)::int FROM users WHERE id=ANY($2::bigint[])) AS users, " +
      "(SELECT COUNT(*)::int FROM clients WHERE id=$3) AS clients, " +
      "(SELECT COUNT(*)::int FROM incidents WHERE id=$4) AS incidents, " +
      "(SELECT COUNT(*)::int FROM incident_events WHERE incident_id=$4) AS events, " +
      "(SELECT COUNT(*)::int FROM client_requests WHERE id=$5) AS requests, " +
      "(SELECT COUNT(*)::int FROM company_incident_sequences WHERE company_id=$1) AS sequences",
      [companyId, [controllerId, clientUserId], clientId, incidentId, clientRequestId]
    );
    assert.ok(Object.values(remaining.rows[0]).every(value => value === 0), 'Permanent company deletion left linked records behind');
    console.log('APPLICATION FLOW PASS: archive, revoke company sessions and permanently delete linked company/client/incident/history data');
  } finally {
    if (companyId) {
      await migrationPool.query('DELETE FROM client_requests WHERE company_id=$1', [companyId]).catch(() => {});
      await migrationPool.query('DELETE FROM incidents WHERE company_id=$1', [companyId]).catch(() => {});
      await migrationPool.query('DELETE FROM clients WHERE company_id=$1', [companyId]).catch(() => {});
      await migrationPool.query('DELETE FROM users WHERE company_id=$1', [companyId]).catch(() => {});
      await migrationPool.query('DELETE FROM companies WHERE id=$1', [companyId]).catch(() => {});
    }
    if (masterId) await migrationPool.query('DELETE FROM users WHERE id=$1', [masterId]).catch(() => {});
  }
}
