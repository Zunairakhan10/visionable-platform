import assert from 'node:assert/strict'
import test from 'node:test'
import {
  configureEmailRecognition,
  EMAIL_RECOGNITION_LANGUAGE,
  getEmailRecognitionErrorMessage,
  normalizeEmailTranscript,
  startEmailRecognition,
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

test('configures English (India) and wires recognition lifecycle events', () => {
  const recognition = {}
  const calls = []
  configureEmailRecognition(recognition, {
    onStart: () => calls.push(['start']),
    onTranscript: (value) => calls.push(['transcript', value]),
    onError: (value) => calls.push(['error', value]),
    onEnd: (value) => calls.push(['end', value]),
  })

  assert.equal(recognition.lang, EMAIL_RECOGNITION_LANGUAGE)
  assert.equal(recognition.continuous, false)
  assert.equal(recognition.interimResults, false)
  assert.equal(recognition.maxAlternatives, 3)

  recognition.onstart()
  recognition.onresult({ results: [{ 0: { transcript: 'name at gmail dot com' } }] })
  recognition.onend()
  assert.deepEqual(calls, [
    ['start'],
    ['transcript', 'name at gmail dot com'],
    ['end', { receivedResult: true, receivedError: false }],
  ])
})

test('reports empty results and speech service errors', () => {
  const recognition = {}
  const errors = []
  let ended
  configureEmailRecognition(recognition, {
    onStart() {},
    onTranscript() {},
    onError: (error) => errors.push(error),
    onEnd: (state) => { ended = state },
  })

  recognition.onresult({ results: [] })
  recognition.onerror({ error: 'network' })
  recognition.onend()
  assert.deepEqual(errors, ['empty-transcript', 'network'])
  assert.deepEqual(ended, { receivedResult: false, receivedError: true })
})

test('provides distinct accessible guidance for permission and service failures', () => {
  assert.match(getEmailRecognitionErrorMessage('not-allowed'), /permission was denied/i)
  assert.match(getEmailRecognitionErrorMessage('network'), /service could not be reached/i)
  assert.match(getEmailRecognitionErrorMessage('no-speech'), /no speech was detected/i)
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
  assert.deepEqual(startErrors, ['fallback', 'error:start-failed'])
})

test('starts once and updates listeners through start, result, and end events', () => {
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
  instance.onstart()
  instance.onresult({ results: [{ 0: { transcript: 'name at gmail dot com' } }] })
  instance.onend()
  assert.deepEqual(calls, ['created', 'Listening…', 'result:name at gmail dot com', 'end'])
})
