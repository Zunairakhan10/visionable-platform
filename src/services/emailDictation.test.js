import assert from 'node:assert/strict'
import test from 'node:test'
import {
  configureEmailRecognition,
  EMAIL_RECOGNITION_LANGUAGE,
  getEmailRecognitionErrorMessage,
  isValidEmailTranscript,
  normalizeEmailTranscript,
  startEmailRecognition,
  startEmailRecognitionAfterVoiceControl,
} from './emailDictation.js'

test('normalizes spoken at and dot into an email address', () => {
  assert.equal(normalizeEmailTranscript('  Alex dot Morgan at Example dot Org  '), 'alex.morgan@example.org')
})

test('converts spoken digit words in local names', () => {
  assert.equal(normalizeEmailTranscript('name one two three at gmail dot com'), 'name123@gmail.com')
})

test('converts spoken underscore and digits', () => {
  assert.equal(normalizeEmailTranscript('name underscore one at outlook dot com'), 'name_1@outlook.com')
})

test('preserves ordinary email text without spoken email terms', () => {
  assert.equal(normalizeEmailTranscript('User.Name+Tag@example.com'), 'User.Name+Tag@example.com')
})

test('validates normalized email and preserves invalid recognized text for correction', () => {
  const normalized = normalizeEmailTranscript('maybe use my work email')
  assert.equal(normalized, 'maybe use my work email')
  assert.equal(isValidEmailTranscript(normalized), false)
  assert.equal(isValidEmailTranscript(normalizeEmailTranscript('Alex at Example dot Org')), true)
})

test('configures English (India) and wires recognition lifecycle events', () => {
  const recognition = {}
  const calls = []
  let ended
  configureEmailRecognition(recognition, {
    onStart: () => calls.push(['start']),
    onDiagnostic: (event) => calls.push(['diagnostic', event.event]),
    onProcessing: () => calls.push(['processing']),
    onTranscript: (value) => calls.push(['transcript', value]),
    onError: (value) => calls.push(['error', value]),
    onEnd: (value) => { ended = value; calls.push(['end']) },
  })

  assert.equal(recognition.lang, EMAIL_RECOGNITION_LANGUAGE)
  assert.equal(recognition.continuous, false)
  assert.equal(recognition.interimResults, false)
  assert.equal(recognition.maxAlternatives, 3)

  recognition.onstart()
  recognition.onaudiostart()
  recognition.onspeechstart()
  recognition.onresult({ results: [{ 0: { transcript: 'name at gmail dot com' } }] })
  recognition.onend()
  assert.deepEqual(calls, [
    ['diagnostic', 'start'],
    ['start'],
    ['diagnostic', 'audiostart'],
    ['diagnostic', 'speechstart'],
    ['diagnostic', 'result'],
    ['processing'],
    ['transcript', 'name at gmail dot com'],
    ['diagnostic', 'end'],
    ['end'],
  ])
  assert.equal(ended.receivedResult, true)
  assert.equal(ended.receivedError, false)
  assert.equal(typeof ended.startedAt, 'number')
  assert.equal(typeof ended.elapsedMs, 'number')
})

test('ignores empty or interim results and reports resultless recognition distinctly', () => {
  const recognition = {}
  const errors = []
  const transcripts = []
  let ended
  configureEmailRecognition(recognition, {
    onStart() {},
    onTranscript: (transcript) => transcripts.push(transcript),
    onError: (error) => errors.push(error),
    onEnd: (state) => { ended = state },
  })

  recognition.onresult({ results: [] })
  recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'not final' } }] })
  assert.deepEqual(errors, [])
  assert.deepEqual(transcripts, [])
  recognition.onend()
  assert.deepEqual(ended, { receivedResult: false, receivedError: false, startedAt: null, elapsedMs: 0 })

  recognition.onerror({ error: 'network' })
  recognition.onend()
  assert.deepEqual(errors, ['network'])
  assert.deepEqual(ended, { receivedResult: false, receivedError: true, startedAt: null, elapsedMs: 0 })
})

test('provides distinct accessible guidance for permission and service failures', () => {
  assert.match(getEmailRecognitionErrorMessage('not-allowed'), /permission was denied/i)
  assert.match(getEmailRecognitionErrorMessage('network'), /service could not be reached/i)
  assert.match(getEmailRecognitionErrorMessage('no-speech'), /no speech was detected/i)
  assert.match(getEmailRecognitionErrorMessage('audio-capture'), /unavailable or busy/i)
  assert.match(getEmailRecognitionErrorMessage('microphone-busy'), /already in use/i)
  assert.match(getEmailRecognitionErrorMessage('unsupported'), /not supported/i)
})

const createHandlers = (calls) => ({
  onStart: () => calls.push('Listening…'),
  onTranscript: (transcript) => calls.push(`result:${transcript}`),
  onError: (error) => calls.push(`error:${error}`),
  onEnd: () => calls.push('end'),
  onFallbackStart: () => calls.push('fallback'),
})

test('shows unsupported feedback when speech recognition is missing', () => {
  const calls = []
  assert.equal(startEmailRecognition(undefined, createHandlers(calls)), null)
  assert.deepEqual(calls, ['error:unsupported'])
})

test('reports synchronous constructor and start failures', () => {
  const constructorErrors = []
  class BrokenRecognition {
    constructor() {
      throw new Error('not available')
    }
  }
  assert.equal(startEmailRecognition(BrokenRecognition, createHandlers(constructorErrors)), null)
  assert.deepEqual(constructorErrors, ['error:construction-failed'])

  const startErrors = []
  class FailingRecognition {
    start() {
      throw new Error('cannot start')
    }
  }
  assert.equal(startEmailRecognition(FailingRecognition, createHandlers(startErrors)), null)
  assert.deepEqual(startErrors, ['error:start-failed'])

  const deniedErrors = []
  class DeniedRecognition {
    start() {
      throw new DOMException('Microphone denied', 'NotAllowedError')
    }
  }
  assert.equal(startEmailRecognition(DeniedRecognition, createHandlers(deniedErrors)), null)
  assert.deepEqual(deniedErrors, ['error:not-allowed'])

  const busyErrors = []
  class BusyRecognition {
    start() {
      throw new DOMException('Already started', 'InvalidStateError')
    }
  }
  assert.equal(startEmailRecognition(BusyRecognition, createHandlers(busyErrors)), null)
  assert.deepEqual(busyErrors, ['error:microphone-busy'])
})

test('does not retry start automatically after a startup exception', () => {
  const calls = []
  class UnsupportedRecognition {
    starts = 0
    start() {
      this.starts += 1
      if (this.starts === 1) throw new DOMException('Language unsupported', 'NotSupportedError')
    }
  }
  assert.equal(startEmailRecognition(UnsupportedRecognition, createHandlers(calls)), null)
  assert.deepEqual(calls, ['error:language-not-supported'])
})

test('maps microphone permission denial events distinctly from missing speech', () => {
  const recognition = {}
  const errors = []
  configureEmailRecognition(recognition, {
    onStart() {},
    onTranscript() {},
    onError: (error) => errors.push(error),
    onEnd() {},
  })
  recognition.onerror({ error: 'not-allowed' })
  assert.deepEqual(errors, ['not-allowed'])
})

test('starts exactly once and waits for delayed onstart before reporting listening', () => {
  const calls = []
  let instance
  class MockRecognition {
    starts = 0

    start() {
      this.starts += 1
    }
  }

  instance = startEmailRecognition(MockRecognition, createHandlers(calls), () => {
    calls.push('created')
  })
  assert.equal(instance.starts, 1)
  assert.deepEqual(calls, ['created'])
  instance.onstart()
  instance.onresult({ results: [{ 0: { transcript: 'name at gmail dot com' } }] })
  instance.onend()
  assert.deepEqual(calls, ['created', 'Listening…', 'result:name at gmail dot com', 'end'])
})

test('waits for voice control to release the microphone before starting email dictation', async () => {
  const order = []
  let releaseVoiceControl
  let emailRecognition
  class MockRecognition {
    start() {
      order.push('email-start')
    }
  }

  const started = startEmailRecognitionAfterVoiceControl({
    stopVoiceControl: () => new Promise((resolve) => {
      order.push('voice-stop')
      releaseVoiceControl = resolve
    }),
    SpeechRecognition: MockRecognition,
    handlers: createHandlers([]),
    onCreated: (recognition) => { emailRecognition = recognition },
  })
  await Promise.resolve()
  assert.deepEqual(order, ['voice-stop'])
  releaseVoiceControl()
  await started
  assert.deepEqual(order, ['voice-stop', 'email-start'])
  emailRecognition.onend()
})

test('does not start email recognition when voice control cannot release the microphone', async () => {
  const calls = []
  class MockRecognition {
    start() {
      calls.push('start')
    }
  }
  const result = await startEmailRecognitionAfterVoiceControl({
    stopVoiceControl: () => Promise.reject(new Error('stop failed')),
    SpeechRecognition: MockRecognition,
    handlers: {
      ...createHandlers(calls),
      onError: (error) => calls.push(`error:${error}`),
    },
  })
  assert.equal(result, null)
  assert.deepEqual(calls, ['error:voice-control-stop-failed'])
})

test('prevents overlapping email recognizers from starting', () => {
  const firstCalls = []
  const secondCalls = []
  let first
  class MockRecognition {
    start() {}
  }

  first = startEmailRecognition(MockRecognition, createHandlers(firstCalls))
  assert.ok(first)
  assert.equal(startEmailRecognition(MockRecognition, createHandlers(secondCalls)), null)
  assert.deepEqual(secondCalls, ['error:microphone-busy'])
  first.onend()
})

test('does not start dictation if the requesting page is no longer active', async () => {
  let starts = 0
  class MockRecognition {
    start() {
      starts += 1
    }
  }
  const result = await startEmailRecognitionAfterVoiceControl({
    stopVoiceControl: async () => {},
    SpeechRecognition: MockRecognition,
    handlers: createHandlers([]),
    shouldStart: () => false,
  })
  assert.equal(result, null)
  assert.equal(starts, 0)
})
