import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterMonitoringEventsBySession,
  getMonitoringSessionOptions,
} from './monitoringSessionFilter.js'

test('current-session filtering returns matching events without changing the stored list', () => {
  const events = [
    { id: 'newer', sessionId: 'session-new', timestamp: '2026-10-10T09:00:00.000Z' },
    { id: 'older', sessionId: 'session-old', timestamp: '2026-10-09T09:00:00.000Z' },
    { id: 'unscoped', timestamp: '2026-10-08T09:00:00.000Z' },
    { id: 'same-session', sessionId: 'session-new', timestamp: '2026-10-10T08:59:00.000Z' },
  ]
  const originalEvents = structuredClone(events)
  const sessions = getMonitoringSessionOptions(events)

  assert.equal(sessions[0].sessionId, 'session-new')
  assert.deepEqual(
    filterMonitoringEventsBySession(events, sessions[0].sessionId).map((event) => event.id),
    ['newer', 'same-session'],
  )
  assert.deepEqual(events, originalEvents)
  assert.equal(events.length, 4)
})

test('events from older deployments remain available as an unscoped filter group', () => {
  const events = [{ id: 'legacy-event', timestamp: '2026-10-08T09:00:00.000Z' }]

  assert.deepEqual(getMonitoringSessionOptions(events).map((session) => session.sessionId), ['legacy'])
  assert.deepEqual(filterMonitoringEventsBySession(events, 'legacy'), events)
})
