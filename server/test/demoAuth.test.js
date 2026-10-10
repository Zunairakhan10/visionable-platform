const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createDemoAuthService } = require('../src/services/demoAuthService');
const { issueDemoSession, verifyDemoSession } = require('../src/services/demoSessions');

let directory;
let authService;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'visionable-demo-auth-test-'));
  authService = createDemoAuthService(path.join(directory, 'demo-users.json'));
});

after(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

test('demo candidates register with server-side password hashes and can sign in', async () => {
  const registered = await authService.registerCandidate(' Candidate@example.test ', 'candidate-password');
  assert.equal(registered.email, 'candidate@example.test');
  assert.equal(registered.role, 'candidate');
  assert.match(registered.candidateId, /^VA-\d{4}$/);

  const persisted = JSON.parse(await fs.readFile(path.join(directory, 'demo-users.json'), 'utf8'));
  assert.equal(persisted[0].passwordHash === 'candidate-password', false);
  assert.equal(JSON.stringify(persisted).includes('candidate-password'), false);

  const signedIn = await authService.login('CANDIDATE@example.test', 'candidate-password');
  assert.equal(signedIn.id, registered.id);
  assert.equal(signedIn.role, 'candidate');
  await assert.rejects(authService.login('candidate@example.test', 'wrong-password'), {
    status: 401,
  });
});

test('candidate registration cannot assign the examiner role', async () => {
  await assert.rejects(
    authService.registerCandidate('examiner.demo@example.com', 'candidate-password'),
    { status: 400 },
  );
  const examiner = await authService.login('examiner.demo@example.com', 'VisionAbleDemo@123');
  assert.equal(examiner.role, 'examiner');
  await assert.rejects(
    authService.login('examiner.demo@example.com', 'incorrect-password'),
    { status: 401 },
  );
});

test('concurrent duplicate registrations produce one account', async () => {
  const attempts = await Promise.allSettled([
    authService.registerCandidate('duplicate@example.test', 'candidate-password'),
    authService.registerCandidate('DUPLICATE@example.test', 'candidate-password'),
  ]);
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((result) => result.status === 'rejected' && result.reason.status === 409).length, 1);
});

test('concurrent registrations reserve distinct candidate identifiers', async () => {
  const registrations = await Promise.all(
    Array.from({ length: 8 }, (_, index) => (
      authService.registerCandidate(`candidate-${index}@example.test`, 'candidate-password')
    )),
  );
  assert.equal(new Set(registrations.map((user) => user.candidateId)).size, registrations.length);
});

test('demo sessions are signed, role-bound, and expire', () => {
  const user = { id: 'candidate-id', email: 'candidate@example.test', role: 'candidate', candidateId: 'VA-1048' };
  const now = Date.now();
  const token = issueDemoSession(user, now);
  assert.deepEqual(verifyDemoSession(token, now), user);
  assert.equal(verifyDemoSession(`${token.slice(0, -1)}x`, now), null);
  assert.equal(verifyDemoSession(token, now + 13 * 60 * 60 * 1000), null);
});

test('invalid account JSON is not reset on read or write', async () => {
  const filePath = path.join(directory, 'invalid-users.json');
  await fs.writeFile(filePath, '{invalid');
  const invalidAuthService = createDemoAuthService(filePath);
  await assert.rejects(invalidAuthService.login('candidate@example.test', 'candidate-password'), /invalid JSON/);
  await assert.rejects(invalidAuthService.registerCandidate('new@example.test', 'candidate-password'), /invalid JSON/);
  assert.equal(await fs.readFile(filePath, 'utf8'), '{invalid');
});
