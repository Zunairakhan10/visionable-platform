const path = require('node:path');
const { createApplicationRecordStore } = require('./recordStore');

const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reviewActions = new Set(['no_issue', 'escalated']);
const defaultFilePath = path.resolve(__dirname, '../../data/monitoring-events.json');

function isValidEvent(event) {
  return event
    && typeof event.id === 'string'
    && typeof event.candidateId === 'string'
    && (event.sessionId === undefined || eventIdPattern.test(event.sessionId))
    && typeof event.type === 'string'
    && typeof event.timestamp === 'string'
    && typeof event.severity === 'string'
    && typeof event.status === 'string';
}

function createMonitoringEventStore(filePath = defaultFilePath, now = () => new Date(), { recordStore } = {}) {
  const events = recordStore || createApplicationRecordStore({
    filePath,
    prefix: 'visionable/monitoring-events',
    keyForRecord: (event) => event.id,
    isValidRecord: isValidEvent,
  });

  return {
    async list() {
      const records = await events.list();
      return [...records].sort((first, second) => (
        new Date(second.timestamp) - new Date(first.timestamp)
        || String(second.createdAt || '').localeCompare(String(first.createdAt || ''))
        || second.id.localeCompare(first.id)
      ));
    },
    async create(input) {
      const record = { ...input, createdAt: now().toISOString() };
      try {
        return await events.create(record);
      } catch (error) {
        if (error.code !== 'RECORD_CONFLICT') throw error;
        const existing = await events.get(input.id);
        const isSameEvent = existing
          && existing.candidateId === input.candidateId
          && existing.sessionId === input.sessionId
          && existing.type === input.type
          && existing.timestamp === input.timestamp
          && existing.severity === input.severity
          && existing.status === input.status;
        if (isSameEvent) return existing;
        const conflict = new Error('id is already in use by a different monitoring event.');
        conflict.status = 409;
        conflict.expose = true;
        throw conflict;
      }
    },
    async review(id, action, note) {
      if (!reviewActions.has(action)) {
        const error = new Error('action must be no_issue or escalated.');
        error.status = 400;
        error.expose = true;
        throw error;
      }

      return events.update(id, (event) => {
        event.status = action === 'no_issue' ? 'reviewed' : 'escalated';
        event.review = {
          action,
          note: note.trim(),
          reviewedAt: now().toISOString(),
        };
        return event;
      });
    },
  };
}

module.exports = {
  createMonitoringEventStore,
  defaultMonitoringEventStore: createMonitoringEventStore(),
  eventIdPattern,
};
