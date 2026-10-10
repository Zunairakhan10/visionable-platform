const express = require('express');
const { getSupabase } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const reviewActions = new Set(['no_issue', 'escalated']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toApiEvent(row) {
  const event = {
    id: row.id,
    _id: row.id,
    candidateId: row.candidate_id,
    type: row.type,
    timestamp: row.timestamp,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
  };

  if (row.review_action !== null || row.review_note !== null || row.reviewed_at !== null) {
    event.review = {
      action: row.review_action,
      note: row.review_note,
      reviewedAt: row.reviewed_at,
    };
  }

  return event;
}

function getReviewFields(review) {
  if (review === undefined || review === null) {
    return { review_action: null, review_note: null, reviewed_at: null };
  }

  if (typeof review !== 'object' || Array.isArray(review)) {
    return null;
  }

  const { action, note, reviewedAt } = review;
  if (!reviewActions.has(action)) {
    return null;
  }
  if (note !== undefined && typeof note !== 'string') {
    return null;
  }
  if (reviewedAt !== undefined && Number.isNaN(new Date(reviewedAt).getTime())) {
    return null;
  }

  return {
    review_action: action ?? null,
    review_note: note?.trim() ?? null,
    reviewed_at: action ? (reviewedAt ? new Date(reviewedAt).toISOString() : new Date().toISOString()) : null,
  };
}

router.post('/', authenticate, requireRole('candidate'), async (req, res, next) => {
  const { id, candidateId, type, timestamp, severity, status, review } = req.body || {};
  const requiredStrings = { candidateId, type, severity, status };

  if (id !== undefined && (typeof id !== 'string' || !uuidPattern.test(id))) {
    return res.status(400).json({ error: 'id must be a valid UUID when provided.' });
  }

  if (Object.entries(requiredStrings).some(([, value]) => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({
      error: 'candidateId, type, severity, and status are required non-empty strings.',
    });
  }

  if (timestamp === undefined || timestamp === null || timestamp === '') {
    return res.status(400).json({ error: 'timestamp is required.' });
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return res.status(400).json({ error: 'timestamp must be a valid date.' });
  }

  const reviewFields = getReviewFields(review);
  if (!reviewFields) {
    return res.status(400).json({ error: 'review must contain a supported action and an optional string note.' });
  }

  try {
    const eventValues = {
      ...(id ? { id } : {}),
      candidate_id: candidateId.trim(),
      type: type.trim(),
      timestamp: parsedTimestamp.toISOString(),
      severity: severity.trim(),
      status: status.trim(),
      ...reviewFields,
    };
    const { data, error } = await getSupabase()
      .from('monitoring_events')
      .insert(eventValues)
      .select()
      .single();

    if (error) {
      if (id && error.code === '23505') {
        const { data: existingEvent, error: lookupError } = await getSupabase()
          .from('monitoring_events')
          .select('*')
          .eq('id', id)
          .eq('candidate_id', candidateId.trim())
          .maybeSingle();

        if (lookupError) {
          return next(lookupError);
        }
        if (
          existingEvent
          && existingEvent.type === type.trim()
          && new Date(existingEvent.timestamp).getTime() === parsedTimestamp.getTime()
          && existingEvent.severity === severity.trim()
        ) {
          return res.status(200).json(toApiEvent(existingEvent));
        }
        return res.status(409).json({ error: 'id is already in use by a different monitoring event.' });
      }
      return next(error);
    }

    return res.status(201).json(toApiEvent(data));
  } catch (error) {
    return next(error);
  }
});

router.get('/', authenticate, requireRole('examiner'), async (req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('monitoring_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      return next(error);
    }

    return res.json(data.map(toApiEvent));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/review', authenticate, requireRole('examiner'), async (req, res, next) => {
  const { id } = req.params;
  const { action, note = '' } = req.body || {};

  if (!uuidPattern.test(id)) {
    return res.status(400).json({ error: 'id must be a valid event id.' });
  }
  if (!reviewActions.has(action)) {
    return res.status(400).json({ error: 'action must be no_issue or escalated.' });
  }
  if (typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string.' });
  }

  try {
    const { data, error } = await getSupabase()
      .from('monitoring_events')
      .update({
        status: action === 'no_issue' ? 'reviewed' : 'escalated',
        review_action: action,
        review_note: note.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return next(error);
    }
    if (!data) {
      return res.status(404).json({ error: 'Monitoring event not found.' });
    }

    return res.json(toApiEvent(data));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
