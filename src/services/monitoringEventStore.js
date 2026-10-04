const EVENTS_STORAGE_KEY = 'visionable:monitoring-events'
const CANDIDATE_ID_STORAGE_KEY = 'visionable:candidate-id'
const listeners = new Set()
export const DEFAULT_CANDIDATE_ID = 'VA-1048'

function createId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${value}`
}

export function getCandidateId() {
  const storedId = window.localStorage.getItem(CANDIDATE_ID_STORAGE_KEY)
  if (storedId && /^VA-\d{4}$/.test(storedId)) return storedId

  window.localStorage.setItem(CANDIDATE_ID_STORAGE_KEY, DEFAULT_CANDIDATE_ID)

  if (storedId) {
    const events = getMonitoringEvents()
    if (Array.isArray(events)) {
      let eventsChanged = false
      const migratedEvents = events.map((event) => {
        if (event.candidateId !== storedId) return event
        eventsChanged = true
        return { ...event, candidateId: DEFAULT_CANDIDATE_ID }
      })

      if (eventsChanged) {
        window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(migratedEvents))
        notifyListeners()
      }
    }
  }

  return DEFAULT_CANDIDATE_ID
}

export function getMonitoringEvents() {
  try {
    const storedEvents = window.localStorage.getItem(EVENTS_STORAGE_KEY)
    return storedEvents ? JSON.parse(storedEvents) : []
  } catch {
    return []
  }
}

function notifyListeners() {
  const events = getMonitoringEvents()
  listeners.forEach((listener) => listener(events))
}

export function recordMonitoringEvent(event) {
  const recordedEvent = {
    id: createId('event'),
    candidateId: event.candidateId ?? getCandidateId(),
    type: event.type,
    timestamp: event.timestamp ?? new Date().toISOString(),
    severity: event.severity ?? 'info',
    status: event.status ?? 'logged',
  }
  const events = [...getMonitoringEvents(), recordedEvent]

  window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events))
  notifyListeners()
  return recordedEvent
}

export function reviewMonitoringEvent(eventId, action, note = '') {
  if (action !== 'no_issue' && action !== 'escalated') {
    throw new Error(`Unsupported monitoring event review action: ${action}`)
  }

  const events = getMonitoringEvents()
  const eventIndex = events.findIndex((event) => event.id === eventId)
  if (eventIndex === -1) {
    throw new Error(`Monitoring event not found: ${eventId}`)
  }

  const updatedEvent = {
    ...events[eventIndex],
    status: action === 'no_issue' ? 'reviewed' : 'escalated',
    review: {
      action,
      note: note.trim(),
      reviewedAt: new Date().toISOString(),
    },
  }
  events[eventIndex] = updatedEvent
  window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events))
  notifyListeners()
  return updatedEvent
}

export function subscribeToMonitoringEvents(listener) {
  listeners.add(listener)

  const handleStorageChange = (event) => {
    if (event.key === EVENTS_STORAGE_KEY) listener(getMonitoringEvents())
  }
  window.addEventListener('storage', handleStorageChange)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorageChange)
  }
}