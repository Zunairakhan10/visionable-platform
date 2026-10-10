const express = require('express');
const { randomUUID } = require('node:crypto');
const { authenticate, requireRole } = require('../middleware/auth');
const { defaultMonitoringEventStore, eventIdPattern } = require('../services/monitoringEventStore');

const reviewActions = new Set(['no_issue', 'escalated']);
const severities = new Set(['info', 'warning', 'error']);
const eventStatuses = new Set(['logged', 'needs_review']);

function createMonitoringEventsRouter({
  eventStore = defaultMonitoringEventStore,
  authenticateRequest = authenticate,
  requireRoleCheck = requireRole,
} = {}) {
  const router = express.Router();

  router.post('/', authenticateRequest, requireRoleCheck('candidate'), async (req, res, next) => {
    const { id, candidateId, sessionId, type, timestamp, severity, status } = req.body || {};
    if (id !== undefined && (typeof id !== 'string' || !eventIdPattern.test(id))) {
      return res.status(400).json({ error: 'id must be a valid UUID when provided.' });
    }
    if (sessionId !== undefined && (typeof sessionId !== 'string' || !eventIdPattern.test(sessionId))) {
      return res.status(400).json({ error: 'sessionId must be a valid UUID when provided.' });
    }
    if (
      typeof candidateId !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(candidateId.trim())
      || typeof type !== 'string'
      || !type.trim()
      || type.length > 100
    ) {
      return res.status(400).json({ error: 'candidateId and type must be valid non-empty strings.' });
    }
    if (!severities.has(severity)) {
      return res.status(400).json({ error: 'severity must be info, warning, or error.' });
    }
    if (!eventStatuses.has(status)) {
      return res.status(400).json({ error: 'status must be logged or needs_review.' });
    }

    const parsedTimestamp = new Date(timestamp);
    if (timestamp === undefined || timestamp === null || Number.isNaN(parsedTimestamp.getTime())) {
      return res.status(400).json({ error: 'timestamp must be a valid date.' });
    }

    try {
      const event = await eventStore.create({
        id: id || randomUUID(),
        candidateId: req.auth?.isDemo && req.auth.role === 'candidate'
          ? req.auth.candidateId
          : candidateId.trim(),
        ...(sessionId ? { sessionId } : {}),
        type: type.trim(),
        timestamp: parsedTimestamp.toISOString(),
        severity,
        status,
      });
      return res.status(201).json(event);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', authenticateRequest, requireRoleCheck('examiner'), async (req, res, next) => {
    try {
      return res.json(await eventStore.list());
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id/review', authenticateRequest, requireRoleCheck('examiner'), async (req, res, next) => {
    const { id } = req.params;
    const { action, note = '' } = req.body || {};
    if (!eventIdPattern.test(id)) {
      return res.status(400).json({ error: 'id must be a valid event id.' });
    }
    if (!reviewActions.has(action)) {
      return res.status(400).json({ error: 'action must be no_issue or escalated.' });
    }
    if (typeof note !== 'string' || note.length > 4000) {
      return res.status(400).json({ error: 'note must be a string no longer than 4000 characters.' });
    }

    try {
      const event = await eventStore.review(id, action, note);
      if (!event) return res.status(404).json({ error: 'Monitoring event not found.' });
      return res.json(event);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createMonitoringEventsRouter();
module.exports.createMonitoringEventsRouter = createMonitoringEventsRouter;
