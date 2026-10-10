const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const { createAuthMiddleware } = require('../src/middleware/auth');
const { issueDemoSession } = require('../src/services/demoSessions');

const userByToken = {
  'candidate-token': {
    id: 'candidate-id',
    email: 'candidate@example.test',
    app_metadata: { role: 'examiner' },
  },
  'examiner-token': {
    id: 'examiner-id',
    email: 'examiner@example.test',
    user_metadata: { role: 'candidate' },
  },
};

const app = express();
const { authenticate, requireRole } = createAuthMiddleware(() => ({
  auth: {
    getUser: async (token) => ({
      data: { user: userByToken[token] || null },
      error: userByToken[token] ? null : new Error('Invalid token'),
    }),
  },
  from: () => ({
    select: () => ({
      eq: (_column, userId) => ({
        maybeSingle: async () => ({
          data: userId === 'examiner-id' ? { role: 'examiner' } : null,
          error: null,
        }),
      }),
    }),
  }),
}));

app.get('/candidate', authenticate, requireRole('candidate'), (req, res) => {
  res.json({ role: req.auth.role });
});
app.get('/examiner', authenticate, requireRole('examiner'), (req, res) => {
  res.json({ role: req.auth.role });
});
app.get('/demo-candidate', authenticate, requireRole('candidate'), (req, res) => {
  res.json({ role: req.auth.role, candidateId: req.auth.candidateId });
});
app.get('/demo-examiner', authenticate, requireRole('examiner'), (req, res) => {
  res.json({ role: req.auth.role });
});

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('rejects missing and invalid bearer tokens', async () => {
  const missing = await fetch(`${baseUrl}/candidate`);
  assert.equal(missing.status, 401);

  const invalid = await fetch(`${baseUrl}/candidate`, {
    headers: { authorization: 'Bearer invalid-token' },
  });
  assert.equal(invalid.status, 401);
});

test('candidate stays a candidate even when token metadata claims examiner', async () => {
  const candidateRoute = await fetch(`${baseUrl}/candidate`, {
    headers: { authorization: 'Bearer candidate-token' },
  });
  assert.equal(candidateRoute.status, 200);
  assert.deepEqual(await candidateRoute.json(), { role: 'candidate' });

  const examinerRoute = await fetch(`${baseUrl}/examiner`, {
    headers: { authorization: 'Bearer candidate-token' },
  });
  assert.equal(examinerRoute.status, 403);
});

test('only a server-provisioned examiner role grants examiner access', async () => {
  const examinerRoute = await fetch(`${baseUrl}/examiner`, {
    headers: { authorization: 'Bearer examiner-token' },
  });
  assert.equal(examinerRoute.status, 200);
  assert.deepEqual(await examinerRoute.json(), { role: 'examiner' });

  const candidateRoute = await fetch(`${baseUrl}/candidate`, {
    headers: { authorization: 'Bearer examiner-token' },
  });
  assert.equal(candidateRoute.status, 403);
});

test('signed demo sessions cannot change their role or access another role API', async () => {
  const candidateToken = issueDemoSession({
    id: 'demo-candidate',
    email: 'candidate@example.test',
    role: 'candidate',
    candidateId: 'VA-1048',
  });
  const candidateRoute = await fetch(`${baseUrl}/demo-candidate`, {
    headers: { authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(candidateRoute.status, 200);
  assert.deepEqual(await candidateRoute.json(), { role: 'candidate', candidateId: 'VA-1048' });

  assert.equal((await fetch(`${baseUrl}/demo-examiner`, {
    headers: { authorization: `Bearer ${candidateToken}` },
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/demo-examiner`, {
    headers: { authorization: `Bearer ${candidateToken.slice(0, -1)}x` },
  })).status, 401);

  const examinerToken = issueDemoSession({
    id: 'demo-examiner',
    email: 'examiner@example.test',
    role: 'examiner',
  });
  assert.equal((await fetch(`${baseUrl}/demo-examiner`, {
    headers: { authorization: `Bearer ${examinerToken}` },
  })).status, 200);
});
