const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createApplicationRecordStore, createBlobRecordStore } = require('../src/services/recordStore');

function createFakeBlob() {
  const objects = new Map();
  let version = 0;
  const writes = [];
  return {
    objects,
    writes,
    async put(pathname, body, options) {
      const existing = objects.get(pathname);
      if (existing && !options.allowOverwrite) {
        const error = new Error('Object already exists.');
        error.name = 'BlobPreconditionFailedError';
        throw error;
      }
      if (options.ifMatch && options.ifMatch !== existing?.etag) {
        const error = new Error('Object changed.');
        error.name = 'BlobPreconditionFailedError';
        throw error;
      }
      const etag = `etag-${++version}`;
      objects.set(pathname, { body, etag });
      writes.push({ pathname, options });
      return { pathname, etag };
    },
    async get(pathname, options) {
      assert.equal(options.access, 'private');
      const object = objects.get(pathname);
      if (!object) return null;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(object.body));
          controller.close();
        },
      });
      return { stream, blob: { etag: object.etag } };
    },
    async list({ prefix, cursor, limit }) {
      const allPathnames = [...objects.keys()].filter((pathname) => pathname.startsWith(prefix));
      const offset = cursor ? Number(cursor) : 0;
      const pageSize = Math.min(limit, 1);
      const page = allPathnames.slice(offset, offset + pageSize);
      const hasMore = offset + pageSize < allPathnames.length;
      return {
        blobs: page.map((pathname) => ({ pathname })),
        hasMore,
        ...(hasMore ? { cursor: String(offset + pageSize) } : {}),
      };
    },
  };
}

const isValidRecord = (record) => (
  record && typeof record.id === 'string' && typeof record.email === 'string'
);
const keyForRecord = (record) => record.id;

test('private Blob storage writes one object per record and reviews update only the matching object', async () => {
  const priorToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'test-only-token';
  try {
    const blob = createFakeBlob();
    const store = createBlobRecordStore({
      prefix: 'visionable/test-users',
      keyForRecord,
      isValidRecord,
      blob,
    });
    const first = { id: 'first', email: 'one@example.test' };
    const second = { id: 'second', email: 'two@example.test' };

    await store.create(first);
    await store.create(second);
    await assert.rejects(store.create(first), { code: 'RECORD_CONFLICT', status: 409 });
    await store.update('first', (record) => ({ ...record, email: 'changed@example.test' }));

    assert.deepEqual(await store.list(), [
      { id: 'first', email: 'changed@example.test' },
      second,
    ]);
    assert.equal(blob.objects.size, 2);
    assert.equal(blob.writes.length, 3);
    assert.ok(blob.writes.every((write) => write.options.access === 'private'));
    assert.equal(blob.writes[0].options.addRandomSuffix, false);
    assert.equal(blob.writes[0].options.allowOverwrite, false);
    assert.equal(blob.writes[2].options.ifMatch, 'etag-1');
  } finally {
    if (priorToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = priorToken;
  }
});

test('Vercel runtime selects Blob rather than creating local JSON files', async () => {
  const priorVercel = process.env.VERCEL;
  const priorToken = process.env.BLOB_READ_WRITE_TOKEN;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'visionable-vercel-records-'));
  const filePath = path.join(directory, 'records.json');
  process.env.VERCEL = '1';
  process.env.BLOB_READ_WRITE_TOKEN = 'test-only-token';
  try {
    const blob = createFakeBlob();
    const store = createApplicationRecordStore({
      filePath,
      prefix: 'visionable/test-events',
      keyForRecord,
      isValidRecord,
      blob,
    });
    await store.create({ id: 'event-1', email: 'event@example.test' });
    assert.equal(blob.objects.size, 1);
    await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
  } finally {
    if (priorVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = priorVercel;
    if (priorToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = priorToken;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('Vercel Blob storage fails explicitly when no store credentials are connected', async () => {
  const priorVercel = process.env.VERCEL;
  const priorToken = process.env.BLOB_READ_WRITE_TOKEN;
  const priorStoreId = process.env.BLOB_STORE_ID;
  const priorOidcToken = process.env.VERCEL_OIDC_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  delete process.env.VERCEL_OIDC_TOKEN;
  process.env.VERCEL = '1';
  try {
    const store = createBlobRecordStore({
      prefix: 'visionable/test',
      keyForRecord,
      isValidRecord,
      blob: createFakeBlob(),
    });
    await assert.rejects(store.list(), /Connect a private Vercel Blob store/);
  } finally {
    if (priorVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = priorVercel;
    if (priorToken !== undefined) process.env.BLOB_READ_WRITE_TOKEN = priorToken;
    if (priorStoreId !== undefined) process.env.BLOB_STORE_ID = priorStoreId;
    if (priorOidcToken !== undefined) process.env.VERCEL_OIDC_TOKEN = priorOidcToken;
  }
});
