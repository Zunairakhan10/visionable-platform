const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const express = require('express');
const appModule = require('../src/app');
const { createMonitoringEventsRouter } = require('../src/routes/monitoringEvents');
const { createMonitoringEventStore } = require('../src/services/monitoringEventStore');

const candidateToken = 'candidate-test-token';
const examinerToken = 'examiner-test-token';
const eventId = 'd0e2d492-8d07-48a2-a210-946634e0d6c5';
const sessionId = '80e2d492-8d07-48a2-a210-946634e0d6c5';
let directory;
let filePath;
let store;
let server;
let baseUrl;

function createTestAuth() {
  const authenticateRequest = (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const role = token === candidateToken ? 'candidate' : token === examinerToken ? 'examiner' : null;
    if (!role) return res.status(401).json({ error: 'Authentication is required.' });
    req.auth = { role, isDemo: true, candidateId: 'VA-1048' };
    return next();
  };
  const requireRoleCheck = (role) => (req, res, next) => (
    req.auth?.role === role
      ? next()
      : res.status(403).json({ error: 'You are not authorized to access this resource.' })
  );
  return { authenticateRequest, requireRoleCheck };
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'visionable-monitoring-test-'));
  filePath = path.join(directory, 'monitoring-events.json');
  store = createMonitoringEventStore(filePath, () => new Date('2026-01-02T03:04:05.000Z'));
  const { authenticateRequest, requireRoleCheck } = createTestAuth();
  const monitoringEventsRouter = createMonitoringEventsRouter({
    eventStore: store,
    authenticateRequest,
    requireRoleCheck,
  });
  const app = appModule.createApp({ authRouter: express.Router(), monitoringEventsRouter });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
  await fs.rm(directory, { recursive: true, force: true });
});

test('monitoring API requires the appropriate candidate and examiner roles', async () => {
  assert.equal((await fetch(`${baseUrl}/api/monitoring-events`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/monitoring-events`, {
    headers: authHeaders(candidateToken),
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/monitoring-events`, {
    method: 'POST',
    headers: authHeaders(examinerToken),
    body: JSON.stringify({}),
  })).status, 403);
});

test('candidate events are written to the JSON file and examiner can list and review them', async () => {
  const createdResponse = await fetch(`${baseUrl}/api/monitoring-events`, {
    method: 'POST',
    headers: authHeaders(candidateToken),
    body: JSON.stringify({
      id: eventId,
      candidateId: 'VA-1061',
      sessionId,
      type: 'FOCUS_LOST',
      timestamp: '2026-01-02T03:00:00.000Z',
      severity: 'warning',
      status: 'needs_review',
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.candidateId, 'VA-1048');
  assert.equal(created.sessionId, sessionId);
  assert.equal(created.review, undefined);

  const savedFile = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.equal(savedFile.length, 1);
  assert.equal(savedFile[0].id, eventId);

  const listResponse = await fetch(`${baseUrl}/api/monitoring-events`, {
    headers: authHeaders(examinerToken),
  });
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json())[0].id, eventId);

  const reviewResponse = await fetch(`${baseUrl}/api/monitoring-events/${eventId}/review`, {
    method: 'PATCH',
    headers: authHeaders(examinerToken),
    body: JSON.stringify({ action: 'escalated', note: 'Needs a second review.' }),
  });
  assert.equal(reviewResponse.status, 200);
  const reviewed = await reviewResponse.json();
  assert.equal(reviewed.status, 'escalated');
  assert.deepEqual(reviewed.review, {
    action: 'escalated',
    note: 'Needs a second review.',
    reviewedAt: '2026-01-02T03:04:05.000Z',
  });

  assert.equal((await fetch(`${baseUrl}/api/monitoring-events/${eventId}/review`, {
    method: 'PATCH',
    headers: authHeaders(candidateToken),
    body: JSON.stringify({ action: 'no_issue' }),
  })).status, 403);
});

test('monitoring API validates event and review input', async () => {
  const invalidEvent = await fetch(`${baseUrl}/api/monitoring-events`, {
    method: 'POST',
    headers: authHeaders(candidateToken),
    body: JSON.stringify({
      candidateId: 'VA-1048',
      type: 'FOCUS_LOST',
      timestamp: 'not-a-date',
      severity: 'critical',
      status: 'escalated',
    }),
  });
  assert.equal(invalidEvent.status, 400);

  const invalidSession = await fetch(`${baseUrl}/api/monitoring-events`, {
    method: 'POST',
    headers: authHeaders(candidateToken),
    body: JSON.stringify({
      candidateId: 'VA-1048',
      sessionId: 'not-a-uuid',
      type: 'FOCUS_LOST',
      timestamp: '2026-01-02T03:00:00.000Z',
      severity: 'warning',
      status: 'needs_review',
    }),
  });
  assert.equal(invalidSession.status, 400);

  const invalidReview = await fetch(`${baseUrl}/api/monitoring-events/${eventId}/review`, {
    method: 'PATCH',
    headers: authHeaders(examinerToken),
    body: JSON.stringify({ action: 'unsupported' }),
  });
  assert.equal(invalidReview.status, 400);
});

test('concurrent creates are serialized and retries with the same id do not duplicate events', async () => {
  const makeEvent = (id) => store.create({
    id,
    candidateId: 'VA-1048',
    type: 'CANDIDATE_PRESENT',
    timestamp: '2026-01-02T03:01:00.000Z',
    severity: 'info',
    status: 'logged',
  });
  const ids = Array.from({ length: 20 }, (_, index) => (
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
  ));
  await Promise.all(ids.map(makeEvent));
  await makeEvent(ids[0]);
  assert.equal((await store.list()).length, 21);
});

test('malformed JSON is reported without overwriting the corrupt file', async () => {
  await fs.writeFile(filePath, '{broken');
  await assert.rejects(store.list(), /invalid JSON/);
  await assert.rejects(store.create({
    id: '00000000-0000-4000-8000-000000000001',
    candidateId: 'VA-1048',
    type: 'FOCUS_LOST',
    timestamp: '2026-01-02T03:00:00.000Z',
    severity: 'warning',
    status: 'needs_review',
  }), /invalid JSON/);
  assert.equal(await fs.readFile(filePath, 'utf8'), '{broken');
});
