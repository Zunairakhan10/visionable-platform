const { createJsonFileStore } = require('./jsonFileStore');

function createRecordConflictError() {
  const error = new Error('A record with this identifier already exists or changed during update.');
  error.status = 409;
  error.expose = true;
  error.code = 'RECORD_CONFLICT';
  return error;
}

function createJsonRecordStore(filePath, { keyForRecord, isValidRecord }) {
  const fileStore = createJsonFileStore(filePath, (records) => (
    Array.isArray(records) && records.every(isValidRecord)
  ));

  return {
    list() {
      return fileStore.read();
    },
    async get(key) {
      const records = await fileStore.read();
      return records.find((record) => keyForRecord(record) === key) || null;
    },
    async create(record) {
      const records = await fileStore.update((currentRecords) => {
        if (currentRecords.some((current) => keyForRecord(current) === keyForRecord(record))) {
          throw createRecordConflictError();
        }
        currentRecords.push(record);
        return currentRecords;
      });
      return records.find((current) => keyForRecord(current) === keyForRecord(record));
    },
    async update(key, updater) {
      const records = await fileStore.update((currentRecords) => {
        const index = currentRecords.findIndex((record) => keyForRecord(record) === key);
        if (index === -1) return currentRecords;
        currentRecords[index] = updater(currentRecords[index]);
        return currentRecords;
      });
      return records.find((record) => keyForRecord(record) === key) || null;
    },
  };
}

function createBlobRecordStore({ prefix, keyForRecord, isValidRecord, blob = require('@vercel/blob') }) {
  function assertBlobConfigured() {
    const hasOidcCredentials = process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN;
    if (!hasOidcCredentials && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('Connect a private Vercel Blob store or configure BLOB_READ_WRITE_TOKEN.');
    }
  }

  function pathname(key) {
    return `${prefix}/${key}.json`;
  }

  async function readPath(blobPath) {
    const result = await blob.get(blobPath, { access: 'private', useCache: false });
    if (!result) return null;

    let record;
    try {
      record = JSON.parse(await new Response(result.stream).text());
    } catch (error) {
      throw new Error(`Private Blob record contains invalid JSON: ${blobPath}.`, { cause: error });
    }
    if (!isValidRecord(record)) {
      throw new Error(`Private Blob record has an unsupported format: ${blobPath}.`);
    }
    return { record, etag: result.blob.etag };
  }

  async function list() {
    assertBlobConfigured();
    const records = [];
    let cursor;
    do {
      const page = await blob.list({ prefix: `${prefix}/`, limit: 1000, ...(cursor ? { cursor } : {}) });
      const pageRecords = await Promise.all(page.blobs.map(async (item) => {
        const result = await readPath(item.pathname);
        return result?.record || null;
      }));
      records.push(...pageRecords.filter(Boolean));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return records;
  }

  return {
    list,
    async get(key) {
      assertBlobConfigured();
      return (await readPath(pathname(key)))?.record || null;
    },
    async create(record) {
      assertBlobConfigured();
      try {
        await blob.put(pathname(keyForRecord(record)), JSON.stringify(record), {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: false,
        });
      } catch (error) {
        if (error?.name === 'BlobPreconditionFailedError' || error?.status === 412) {
          throw createRecordConflictError();
        }
        throw error;
      }
      return record;
    },
    async update(key, updater) {
      assertBlobConfigured();
      const existing = await readPath(pathname(key));
      if (!existing) return null;
      const updated = updater(existing.record);
      try {
        await blob.put(pathname(key), JSON.stringify(updated), {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: true,
          ifMatch: existing.etag,
        });
      } catch (error) {
        if (error?.name === 'BlobPreconditionFailedError' || error?.status === 412) {
          throw createRecordConflictError();
        }
        throw error;
      }
      return updated;
    },
  };
}

function createApplicationRecordStore(options) {
  const onVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
  if (onVercel || process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) {
    return createBlobRecordStore(options);
  }
  return createJsonRecordStore(options.filePath, options);
}

module.exports = {
  createApplicationRecordStore,
  createBlobRecordStore,
  createJsonRecordStore,
  createRecordConflictError,
};
