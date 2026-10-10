import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimSpeechRecognitionSession,
  getSpeechRecognitionSessionOwner,
} from './speechRecognitionSession.js'

test('only one speech recognizer can hold the microphone session at a time', () => {
  const releaseVoice = claimSpeechRecognitionSession('voice-control')
  assert.equal(getSpeechRecognitionSessionOwner(), 'voice-control')
  assert.equal(claimSpeechRecognitionSession('email-dictation'), null)
  releaseVoice()

  const releaseEmail = claimSpeechRecognitionSession('email-dictation')
  assert.equal(getSpeechRecognitionSessionOwner(), 'email-dictation')
  releaseEmail()
  assert.equal(getSpeechRecognitionSessionOwner(), null)
})
