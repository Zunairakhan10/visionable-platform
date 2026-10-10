import assert from 'node:assert/strict'
import test from 'node:test'
import { isDuplicateVoiceTranscript, normalizeVoiceTranscript } from './voiceRecognition.js'

test('normalizes capitalization, whitespace, and harmless punctuation', () => {
  assert.equal(normalizeVoiceTranscript('  NEXT   Question! '), 'next question')
})

test('ignores empty and recently repeated recognition results but accepts later repeats', () => {
  const previous = { transcript: 'next question', at: 1000 }
  assert.equal(isDuplicateVoiceTranscript(previous, '', 1100), true)
  assert.equal(isDuplicateVoiceTranscript(previous, '  NEXT QUESTION! ', 1500), true)
  assert.equal(isDuplicateVoiceTranscript(previous, 'next question', 2100), false)
  assert.equal(isDuplicateVoiceTranscript(previous, 'previous question', 1100), false)
})
