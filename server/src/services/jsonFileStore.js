const fs = require('node:fs/promises');
const path = require('node:path');

function createJsonFileStore(filePath, isValid) {
  let writeQueue = Promise.resolve();

  async function readUnlocked() {
    let contents;
    try {
      contents = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    let value;
    try {
      value = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Demo data file contains invalid JSON: ${path.basename(filePath)}.`, { cause: error });
    }

    if (!isValid(value)) {
      throw new Error(`Demo data file has an unsupported format: ${path.basename(filePath)}.`);
    }
    return value;
  }

  async function writeUnlocked(value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    const contents = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
  }

  function enqueue(operation) {
    const result = writeQueue.then(operation);
    writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    async read() {
      await writeQueue;
      return readUnlocked();
    },
    update(updater) {
      return enqueue(async () => {
        const currentValue = await readUnlocked();
        const nextValue = await updater(currentValue);
        await writeUnlocked(nextValue);
        return nextValue;
      });
    },
  };
}

module.exports = { createJsonFileStore };
