export function getMonitoringSessionOptions(events) {
  const sessions = new Map()
  events.forEach((event) => {
    const sessionId = event.sessionId || 'legacy'
    const timestamp = new Date(event.timestamp).getTime()
    const session = sessions.get(sessionId)
    if (!session || timestamp > session.latestTimestamp) {
      sessions.set(sessionId, { sessionId, latestTimestamp: timestamp })
    }
  })
  return [...sessions.values()].sort((first, second) => second.latestTimestamp - first.latestTimestamp)
}

export function filterMonitoringEventsBySession(events, sessionId) {
  const activeSessionId = sessionId || 'legacy'
  return events.filter((event) => (event.sessionId || 'legacy') === activeSessionId)
}
