import { authenticatedApiRequest } from './authClient'
import { getDemoSession } from './demoAuth'

const CANDIDATE_ID_STORAGE_KEY = 'visionable:candidate-id'
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
const listeners = new Set()
const pendingWrites = new Map()
export const DEFAULT_CANDIDATE_ID = 'VA-1048'

let events = []
let syncError = ''
let storageMode = 'server'
let currentMonitoringSessionId = ''

function createEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  throw new Error('Secure monitoring event identifiers are not available in this browser.')
}

function sortEvents(eventList) {
  return [...eventList].sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))
}

function notifyListeners() {
  const currentEvents = getMonitoringEvents()
  listeners.forEach((listener) => listener(currentEvents, syncError, storageMode))
}

function replaceEvent(eventId, update) {
  const index = events.findIndex((event) => event.id === eventId)
  if (index === -1) return
  events[index] = update(events[index])
  events = sortEvents(events)
  notifyListeners()
}

async function apiRequest(path, options = {}) {
  const demoSession = getDemoSession()
  const response = demoSession?.accessToken
    ? await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${demoSession.accessToken}`,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    })
    : await authenticatedApiRequest(`${API_BASE_URL}${path}`, options)

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body?.error === 'string' ? ` ${body.error}` : ''
    } catch (error) {
      if (response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The monitoring API returned an invalid JSON response.', { cause: error })
      }
    }
    throw new Error(`Monitoring API returned HTTP ${response.status}.${detail}`)
  }

  try {
    return await response.json()
  } catch (error) {
    throw new Error('The monitoring API returned an invalid JSON response.', { cause: error })
  }
}

export function getCandidateId() {
  const demoCandidateId = getDemoSession()?.candidateId
  if (demoCandidateId) return demoCandidateId

  const storedId = window.localStorage.getItem(CANDIDATE_ID_STORAGE_KEY)
  if (storedId && /^VA-\d{4}$/.test(storedId)) return storedId

  window.localStorage.setItem(CANDIDATE_ID_STORAGE_KEY, DEFAULT_CANDIDATE_ID)
  return DEFAULT_CANDIDATE_ID
}

export function startMonitoringSession() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure monitoring session identifiers are not available in this browser.')
  }
  currentMonitoringSessionId = globalThis.crypto.randomUUID()
  return currentMonitoringSessionId
}

function getMonitoringSessionId() {
  return currentMonitoringSessionId || startMonitoringSession()
}

export function getMonitoringEvents() {
  return sortEvents(events)
}

export function getMonitoringSyncError() {
  return syncError
}

export function getMonitoringStorageMode() {
  return storageMode
}

export function clearRemoteMonitoringEvents() {
  events = []
  syncError = ''
  storageMode = 'server'
  notifyListeners()
}

export async function refreshMonitoringEvents() {
  try {
    const fetchedEvents = await apiRequest('/monitoring-events')
    if (!Array.isArray(fetchedEvents)) {
      throw new Error('The monitoring API returned an invalid event list.')
    }
    events = sortEvents(fetchedEvents.map((event) => ({
      ...event,
      syncStatus: 'synced',
      storageSource: 'json',
    })))
    syncError = ''
    storageMode = 'server'
    notifyListeners()
    return getMonitoringEvents()
  } catch (error) {
    syncError = 'Monitoring events could not be loaded from the demo server.'
    storageMode = 'unavailable'
    notifyListeners()
    throw error
  }
}

function saveEvent(event) {
  if (pendingWrites.has(event.id)) return pendingWrites.get(event.id)

  const saveRequest = apiRequest('/monitoring-events', {
    method: 'POST',
    body: JSON.stringify({
      id: event.id,
      candidateId: event.candidateId,
      sessionId: event.sessionId,
      type: event.type,
      timestamp: event.timestamp,
      severity: event.severity,
      status: event.status,
    }),
  })
    .then((savedEvent) => {
    syncError = ''
    replaceEvent(event.id, () => ({
      ...savedEvent,
      syncStatus: 'synced',
      storageSource: 'json',
    }))
      return savedEvent
    })
    .catch((error) => {
    syncError = 'One or more monitoring events could not be saved to the demo server.'
    replaceEvent(event.id, (currentEvent) => ({
      ...currentEvent,
      syncStatus: 'failed',
    }))
      throw error
    })
    .finally(() => pendingWrites.delete(event.id))

  pendingWrites.set(event.id, saveRequest)
  return saveRequest
}

export function recordMonitoringEvent(event) {
  const recordedEvent = {
    id: createEventId(),
    candidateId: event.candidateId ?? getCandidateId(),
    sessionId: event.sessionId ?? getMonitoringSessionId(),
    type: event.type,
    timestamp: event.timestamp ?? new Date().toISOString(),
    severity: event.severity ?? 'info',
    status: event.status ?? 'logged',
    syncStatus: 'pending',
    storageSource: 'json',
  }
  events = sortEvents([...events, recordedEvent])
  notifyListeners()
  return saveEvent(recordedEvent)
}

export async function retryUnsyncedMonitoringEvents() {
  const unsyncedEvents = events.filter((event) => event.syncStatus === 'failed')
  if (!unsyncedEvents.length) return 0

  const results = await Promise.allSettled(unsyncedEvents.map(saveEvent))
  const savedCount = results.filter((result) => result.status === 'fulfilled').length
  const remainingCount = events.filter((event) => event.syncStatus === 'failed').length
  syncError = remainingCount
    ? `${remainingCount} monitoring event${remainingCount === 1 ? '' : 's'} could not be saved to the demo server.`
    : ''
  notifyListeners()
  return savedCount
}

export async function reviewMonitoringEvent(eventId, action, note = '') {
  if (action !== 'no_issue' && action !== 'escalated') {
    throw new Error(`Unsupported monitoring event review action: ${action}`)
  }
  if (!events.some((event) => event.id === eventId)) {
    throw new Error('Monitoring event not found.')
  }

  const reviewedEvent = await apiRequest(`/monitoring-events/${eventId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ action, note }),
  })
  replaceEvent(eventId, () => ({
    ...reviewedEvent,
    syncStatus: 'synced',
    storageSource: 'json',
  }))
  syncError = ''
  return reviewedEvent
}

export function subscribeToMonitoringEvents(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
