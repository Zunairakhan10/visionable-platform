const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const express = require('express');
const appModule = require('../src/app');
const { createAuthRouter } = require('../src/routes/auth');
const { createDemoAuthService } = require('../src/services/demoAuthService');

let directory;
let server;
let baseUrl;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'visionable-auth-api-test-'));
  const demoAuthService = createDemoAuthService(path.join(directory, 'demo-users.json'));
  const authRouter = createAuthRouter({
    demoAuthService,
    createSession: () => 'test-access-token',
  });
  authRouter.post('/demo/unexpected', (req, res, next) => {
    next(new Error('sensitive internal detail'));
  });
  const app = appModule.createApp({
    authRouter,
    monitoringEventsRouter: express.Router(),
  });
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

test('demo registration returns its safe validation message instead of an internal error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/demo/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid-email', password: 'valid-password' }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Enter a valid email address.' });
});

test('demo login returns the safe invalid-credentials message for unknown accounts', async () => {
  const response = await fetch(`${baseUrl}/api/auth/demo/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@example.test', password: 'valid-password' }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'The email or password is incorrect.' });
});

test('unexpected server errors remain generic and do not expose internal details', async () => {
  const response = await fetch(`${baseUrl}/api/auth/demo/unexpected`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error' });
});
