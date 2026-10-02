const EVENTS_STORAGE_KEY = 'visionable:monitoring-events'
const CANDIDATE_ID_STORAGE_KEY = 'visionable:candidate-id'
const listeners = new Set()

function createId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${value}`
}

export function getCandidateId() {
  const storedId = window.localStorage.getItem(CANDIDATE_ID_STORAGE_KEY)
  if (storedId) return storedId

  const candidateId = createId('candidate')
  window.localStorage.setItem(CANDIDATE_ID_STORAGE_KEY, candidateId)
  return candidateId
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