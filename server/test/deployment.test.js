const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { after, before, test } = require('node:test');

let server;
let baseUrl;

before(async () => {
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'preview';
  process.env.BLOB_STORE_ID = 'test-store';
  process.env.VERCEL_OIDC_TOKEN = 'test-oidc-token';
  process.env.DEMO_EXAMINER_EMAIL = 'examiner@example.test';
  process.env.DEMO_EXAMINER_PASSWORD = 'test-examiner-password';
  process.env.DEMO_SESSION_SECRET = 'test-demo-session-secret-at-least-32-characters';
  process.env.CORS_ALLOWED_ORIGINS = 'https://frontend.example.test';

  const { default: app } = await import(path.resolve(__dirname, '../../api/[...path].js'));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
});

test('Vercel settings build the Vite frontend and install both packages', async () => {
  const configuration = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
  assert.equal(configuration.framework, 'vite');
  assert.equal(configuration.installCommand, 'npm ci && npm ci --prefix server');
  assert.equal(configuration.buildCommand, 'npm run build');
  assert.equal(configuration.outputDirectory, 'dist');
});

test('Vercel catch-all function dispatches the Express API health route', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'visionable-api' });
});

test('API CORS allows configured frontend origins and omits unconfigured origins', async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://frontend.example.test' },
  });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://frontend.example.test');

  const denied = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://untrusted.example.test' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
