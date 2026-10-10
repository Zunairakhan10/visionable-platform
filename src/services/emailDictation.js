import { claimSpeechRecognitionSession } from './speechRecognitionSession.js'

export const EMAIL_RECOGNITION_LANGUAGE = 'en-IN'
export const EMAIL_RECOGNITION_START_TIMEOUT_MS = 8000
export const EMAIL_RECOGNITION_MIN_LISTEN_MS = 3500

const SPOKEN_NUMBER_WORDS = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
}

export function normalizeEmailTranscript(transcript) {
  const trimmedTranscript = typeof transcript === 'string' ? transcript.trim() : ''
  const hasSpokenEmailTerms = /\b(?:at|dot|underscore|under\s+score|hyphen|dash|plus)\b/i.test(trimmedTranscript)
  if (!hasSpokenEmailTerms) return trimmedTranscript

  return trimmedTranscript
    .toLowerCase()
    .replace(/\bunder\s+score\b|\bunderscore\b/g, '_')
    .replace(/\bhyphen\b|\bdash\b/g, '-')
    .replace(/\bplus\b/g, '+')
    .replace(/\bat\b/g, '@')
    .replace(/\bdot\b/g, '.')
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (word) => SPOKEN_NUMBER_WORDS[word])
    .replace(/\s*([@._+-])\s*/g, '$1')
    .replace(/\s+/g, '')
}

export function isValidEmailTranscript(transcript) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transcript)
}

export function getEmailRecognitionErrorMessage(error) {
  switch (error) {
    case 'unsupported':
      return 'Voice email entry is not supported in this browser. Enter your email using the keyboard.'
    case 'construction-failed':
      return 'The browser could not create speech recognition. Try another supported browser or enter your email using the keyboard.'
    case 'start-failed':
      return 'The microphone or speech recognition could not start. Check browser permissions and try again, or enter your email using the keyboard.'
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech-recognition permission was denied. You can enter your email using the keyboard.'
    case 'audio-capture':
      return 'The microphone is unavailable or busy. Check that another app is not using it, then try again or enter your email using the keyboard.'
    case 'microphone-busy':
      return 'The microphone is already in use or unavailable. Close other microphone apps and try again, or enter your email using the keyboard.'
    case 'no-speech':
      return 'No speech was detected. Check your microphone, speak after listening starts, or enter your email using the keyboard.'
    case 'network':
      return 'The browser speech-recognition service could not be reached. Check your connection or enter your email using the keyboard.'
    case 'language-not-supported':
      return 'English speech recognition is not supported by this browser. Try another supported browser or enter your email using the keyboard.'
    case 'aborted':
      return 'Voice input stopped.'
    case 'empty-transcript':
      return 'No speech was recognized. Try again and speak after listening starts, or enter your email using the keyboard.'
    case 'voice-control-stop-failed':
      return 'Voice control could not release the microphone. Stop it manually before dictating your email, or use the keyboard.'
    default:
      return 'Voice input could not be completed. Check microphone access and try again, or enter your email using the keyboard.'
  }
}

export function configureEmailRecognition(recognition, handlers) {
  let receivedResult = false
  let receivedError = false
  let startedAt = null

  recognition.lang = EMAIL_RECOGNITION_LANGUAGE
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 3
  recognition.onstart = () => {
    startedAt = Date.now()
    receivedResult = false
    receivedError = false
    handlers.onDiagnostic?.({ event: 'start', state: 'listening' })
    handlers.onStart()
  }
  for (const eventName of ['onaudiostart', 'onsoundstart', 'onspeechstart', 'onaudioend', 'onsoundend', 'onspeechend']) {
    recognition[eventName] = () => handlers.onDiagnostic?.({ event: eventName.slice(2), state: 'event' })
  }
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results || [])
      .filter((result) => result?.isFinal !== false)
      .map((result) => result?.[0]?.transcript?.trim() || '')
      .filter(Boolean)
      .join(' ')
      .trim()

    if (!transcript) return

    receivedResult = true
    handlers.onDiagnostic?.({ event: 'result', state: 'result-received' })
    handlers.onProcessing?.()
    handlers.onTranscript(transcript)
  }
  recognition.onerror = (event) => {
    receivedError = true
    const error = event.error || 'unknown'
    handlers.onDiagnostic?.({ event: 'error', error })
    handlers.onError(error, { startedAt, elapsedMs: startedAt === null ? 0 : Date.now() - startedAt })
  }
  recognition.onend = () => {
    const elapsedMs = startedAt === null ? 0 : Date.now() - startedAt
    handlers.onDiagnostic?.({
      event: 'end',
      state: receivedResult ? 'result-received' : 'ended-without-result',
      receivedResult,
    })
    handlers.onEnd({ receivedResult, receivedError, startedAt, elapsedMs })
  }

  return recognition
}

export function startEmailRecognition(SpeechRecognition, handlers, onCreated = () => {}) {
  if (!SpeechRecognition) {
    handlers.onDiagnostic?.({ event: 'unsupported', state: 'unavailable' })
    handlers.onError('unsupported')
    return null
  }

  const releaseSession = claimSpeechRecognitionSession('email-dictation')
  if (!releaseSession) {
    handlers.onDiagnostic?.({ event: 'start-blocked', state: 'microphone-busy' })
    handlers.onError('microphone-busy')
    return null
  }

  let recognition
  try {
    recognition = new SpeechRecognition()
  } catch {
    releaseSession()
    handlers.onDiagnostic?.({ event: 'construction-failed', state: 'unavailable' })
    handlers.onError('construction-failed')
    return null
  }

  configureEmailRecognition(recognition, handlers)
  recognition.onend = ((onend) => (...args) => {
    releaseSession()
    onend(...args)
  })(recognition.onend)
  onCreated(recognition)

  try {
    handlers.onDiagnostic?.({ event: 'start-requested', state: 'starting' })
    recognition.start()
    return recognition
  } catch (error) {
    releaseSession()
    handlers.onDiagnostic?.({ event: 'start-failed', error: error?.name || 'unknown', state: 'unavailable' })
    handlers.onError(getStartErrorCode(error))
    return null
  }
}

function getStartErrorCode(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'not-allowed'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'NotReadableError':
    case 'TrackStartError':
      return 'audio-capture'
    case 'InvalidStateError':
      return 'microphone-busy'
    case 'NotSupportedError':
      return 'language-not-supported'
    default:
      return 'start-failed'
  }
}

export async function startEmailRecognitionAfterVoiceControl({
  stopVoiceControl,
  SpeechRecognition,
  handlers,
  onCreated,
  shouldStart = () => true,
}) {
  try {
    const stopped = await stopVoiceControl()
    if (stopped === false) throw new Error('recognizer did not stop')
  } catch {
    if (!shouldStart()) return null
    handlers.onError('voice-control-stop-failed')
    return null
  }
  if (!shouldStart()) return null
  return startEmailRecognition(SpeechRecognition, handlers, onCreated)
}
