import { authenticatedApiRequest, getSupabaseAuthSession } from './authClient'
import { getDemoSession } from './demoAuth'

const EVENTS_STORAGE_KEY = 'visionable:monitoring-events'
const CANDIDATE_ID_STORAGE_KEY = 'visionable:candidate-id'
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
const listeners = new Set()
const pendingWrites = new Map()
export const DEFAULT_CANDIDATE_ID = 'VA-1048'

let syncError = ''
let storageMode = 'local'
let remoteEvents = []

function createEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  const bytes = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint8Array(16))
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function saveEvents(events) {
  window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events))
}

function readLocalEvents() {
  try {
    const storedEvents = window.localStorage.getItem(EVENTS_STORAGE_KEY)
    return storedEvents ? JSON.parse(storedEvents) : []
  } catch {
    return []
  }
}

function removeCachedSharedEvents() {
  const localEvents = readLocalEvents()
  const retainedEvents = localEvents.filter((event) => (
    !event._id && event.syncStatus !== 'synced' && event.storageSource !== 'supabase'
  ))
  if (retainedEvents.length !== localEvents.length) saveEvents(retainedEvents)
}

function notifyListeners() {
  const events = getMonitoringEvents()
  listeners.forEach((listener) => listener(events, syncError, storageMode))
}

function replaceEvent(eventId, update) {
  const localEvents = readLocalEvents()
  const localIndex = localEvents.findIndex((event) => event.id === eventId)
  if (localIndex !== -1) {
    localEvents[localIndex] = update(localEvents[localIndex])
    saveEvents(localEvents)
    notifyListeners()
    return
  }

  const remoteIndex = remoteEvents.findIndex((event) => event.id === eventId)
  if (remoteIndex === -1) return
  remoteEvents[remoteIndex] = update(remoteEvents[remoteIndex])
  notifyListeners()
}

async function apiRequest(path, options) {
  const response = await authenticatedApiRequest(`${API_BASE_URL}${path}`, options)

  if (!response.ok) {
    throw new Error(`Monitoring API returned HTTP ${response.status}.`)
  }

  return response.json()
}

function mergeEvents(remoteEvents, localEvents) {
  const localByRemoteId = new Map(
    localEvents.map((event) => [event._id || event.clientEventId || event.id, event])
  )
  const remoteIds = new Set(remoteEvents.map((event) => event.id))
  const mergedRemoteEvents = remoteEvents.map((event) => {
    const localEvent = localByRemoteId.get(event.id)
    return {
      ...event,
      ...(localEvent ? { id: localEvent.id } : {}),
      _id: event.id,
      syncStatus: 'synced',
      storageSource: 'supabase',
    }
  })
  const localOnlyEvents = localEvents
    .filter((event) => !remoteIds.has(event._id || event.clientEventId || event.id))
    .map((event) => ({
      ...event,
      storageSource: event.storageSource || 'local-demo',
    }))

  return [...mergedRemoteEvents, ...localOnlyEvents]
    .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))
}

async function hasRemoteSession() {
  return Boolean(await getSupabaseAuthSession())
}

export function getCandidateId() {
  const storedId = window.localStorage.getItem(CANDIDATE_ID_STORAGE_KEY)
  if (storedId && /^VA-\d{4}$/.test(storedId)) return storedId

  window.localStorage.setItem(CANDIDATE_ID_STORAGE_KEY, DEFAULT_CANDIDATE_ID)

  if (storedId) {
    const events = readLocalEvents()
    if (Array.isArray(events)) {
      let eventsChanged = false
      const migratedEvents = events.map((event) => {
        if (event.candidateId !== storedId) return event
        eventsChanged = true
        return { ...event, candidateId: DEFAULT_CANDIDATE_ID }
      })

      if (eventsChanged) {
        saveEvents(migratedEvents)
        notifyListeners()
      }
    }
  }

  return DEFAULT_CANDIDATE_ID
}

export function getMonitoringEvents() {
  return mergeEvents(remoteEvents, readLocalEvents())
}

export function getMonitoringSyncError() {
  return syncError
}

export function getMonitoringStorageMode() {
  return storageMode
}

export function clearRemoteMonitoringEvents() {
  remoteEvents = []
  storageMode = 'local'
  syncError = ''
  removeCachedSharedEvents()
  notifyListeners()
}

export async function refreshMonitoringEvents() {
  try {
    if (!await hasRemoteSession()) {
      remoteEvents = []
      storageMode = 'local'
      syncError = ''
      removeCachedSharedEvents()
      notifyListeners()
      return getMonitoringEvents()
    }

    const fetchedEvents = await apiRequest('/monitoring-events')
    const remoteIds = new Set(fetchedEvents.map((event) => event.id))
    const localEvents = readLocalEvents()
    const remainingLocalEvents = localEvents.filter((event) => (
      !event._id
      && event.syncStatus !== 'synced'
      && event.storageSource !== 'supabase'
      && !remoteIds.has(event.clientEventId || event.id)
    ))
    if (remainingLocalEvents.length !== localEvents.length) {
      saveEvents(remainingLocalEvents)
    }
    const mergedEvents = mergeEvents(fetchedEvents, remainingLocalEvents)
    remoteEvents = mergedEvents.filter((event) => event.storageSource === 'supabase')
    storageMode = 'shared'
    syncError = mergedEvents.some((event) => ['failed', 'pending'].includes(event.syncStatus))
      ? 'Some locally stored monitoring events have not been saved to the server.'
      : ''
    notifyListeners()
    return mergedEvents
  } catch {
    remoteEvents = []
    storageMode = 'local'
    syncError = 'Monitoring events could not be loaded from the server. Showing locally available events.'
    notifyListeners()
    throw new Error(syncError)
  }
}

function syncEvent(event) {
  if (pendingWrites.has(event.id)) return pendingWrites.get(event.id)

  const clientEventId = event.clientEventId || (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.id)
      ? event.id
      : createEventId()
  )
  replaceEvent(event.id, (localEvent) => ({
    ...localEvent,
    clientEventId,
    syncStatus: 'pending',
  }))
  const saveRequest = apiRequest('/monitoring-events', {
    method: 'POST',
    body: JSON.stringify({
      id: clientEventId,
      candidateId: event.candidateId,
      type: event.type,
      timestamp: event.timestamp,
      severity: event.severity,
      status: event.status,
      ...(event.review ? { review: event.review } : {}),
    }),
  })
    .then((remoteEvent) => {
      const localEvents = readLocalEvents().filter((localEvent) => localEvent.id !== event.id)
      saveEvents(localEvents)
      const syncedEvent = {
        ...remoteEvent,
        _id: remoteEvent.id,
        syncStatus: 'synced',
        storageSource: 'supabase',
      }
      remoteEvents = mergeEvents(
        [...remoteEvents.filter((storedEvent) => storedEvent.id !== remoteEvent.id), syncedEvent],
        localEvents,
      ).filter((storedEvent) => storedEvent.storageSource === 'supabase')
      storageMode = 'shared'
      syncError = ''
      notifyListeners()
      return remoteEvent
    })
    .catch(() => {
      replaceEvent(event.id, (localEvent) => ({
        ...localEvent,
        syncStatus: 'failed',
      }))
      syncError = 'One or more monitoring events could not be saved to the server.'
      notifyListeners()
      return null
    })
    .finally(() => {
      pendingWrites.delete(event.id)
    })

  pendingWrites.set(event.id, saveRequest)
  return saveRequest
}

export function recordMonitoringEvent(event) {
  const isLocalDemoSession = Boolean(getDemoSession())
  const id = createEventId()
  const recordedEvent = {
    id,
    clientEventId: id,
    candidateId: event.candidateId ?? getCandidateId(),
    type: event.type,
    timestamp: event.timestamp ?? new Date().toISOString(),
    severity: event.severity ?? 'info',
    status: event.status ?? 'logged',
    syncStatus: isLocalDemoSession ? 'local' : 'pending',
    storageSource: isLocalDemoSession ? 'local-demo' : 'local',
  }
  const events = [...readLocalEvents(), recordedEvent]
  saveEvents(events)
  notifyListeners()
  if (!isLocalDemoSession) syncEvent(recordedEvent)

  return recordedEvent
}

export async function retryUnsyncedMonitoringEvents() {
  if (!await hasRemoteSession()) return 0

  const unsyncedEvents = getMonitoringEvents().filter((event) => (
    !event._id && ['failed', 'pending'].includes(event.syncStatus)
  ))
  if (!unsyncedEvents.length) return 0

  const results = await Promise.all(unsyncedEvents.map(syncEvent))
  const savedCount = results.filter(Boolean).length
  const remainingEvents = getMonitoringEvents().filter((event) => (
    !event._id && ['failed', 'pending'].includes(event.syncStatus)
  ))
  syncError = remainingEvents.length
    ? `${remainingEvents.length} monitoring event${remainingEvents.length === 1 ? '' : 's'} could not be saved to the server.`
    : ''
  notifyListeners()
  return savedCount
}

export async function reviewMonitoringEvent(eventId, action, note = '') {
  if (action !== 'no_issue' && action !== 'escalated') {
    throw new Error(`Unsupported monitoring event review action: ${action}`)
  }

  let event = getMonitoringEvents().find((storedEvent) => storedEvent.id === eventId)
  if (!event) {
    throw new Error('Monitoring event not found.')
  }

  if (!event._id && getDemoSession()) {
    const review = {
      action,
      note: typeof note === 'string' ? note.trim() : '',
      reviewedAt: new Date().toISOString(),
    }
    replaceEvent(eventId, (localEvent) => ({
      ...localEvent,
      status: action === 'no_issue' ? 'reviewed' : 'escalated',
      review,
      syncStatus: 'local',
    }))
    return review
  }

  if (pendingWrites.has(eventId)) {
    await pendingWrites.get(eventId)
    event = getMonitoringEvents().find((storedEvent) => storedEvent.id === eventId)
  }

  const remoteId = event?._id
  if (!remoteId || event.syncStatus === 'failed') {
    syncError = 'The review cannot be saved until the monitoring event reaches the server.'
    notifyListeners()
    throw new Error(syncError)
  }

  try {
    const reviewedEvent = await apiRequest(`/monitoring-events/${remoteId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, note }),
    })
    replaceEvent(eventId, (localEvent) => ({
      ...localEvent,
      ...reviewedEvent,
      id: eventId,
      _id: reviewedEvent.id,
      syncStatus: 'synced',
    }))
    syncError = ''
    notifyListeners()
    return reviewedEvent
  } catch {
    syncError = 'The examiner review could not be saved to the server. Please try again.'
    notifyListeners()
    throw new Error(syncError)
  }
}

export function subscribeToMonitoringEvents(listener) {
  listeners.add(listener)

  const handleStorageChange = (event) => {
    if (event.key === EVENTS_STORAGE_KEY) listener(getMonitoringEvents(), syncError, storageMode)
  }
  window.addEventListener('storage', handleStorageChange)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorageChange)
  }
}
