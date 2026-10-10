import assert from 'node:assert/strict'
import test from 'node:test'
import { isVoiceControlCommandAllowed, parseSpeechGuidanceCommand, parseVoiceControlCommand } from './voiceControlCommands.js'

test('recognizes explicit pause, resume, and microphone stop commands', () => {
  assert.equal(parseVoiceControlCommand('Pause voice control!')?.key, 'pause')
  assert.equal(parseVoiceControlCommand('stop voice commands')?.key, 'pause')
  assert.equal(parseVoiceControlCommand('Start   voice control')?.key, 'resume')
  assert.equal(parseVoiceControlCommand('resume voice commands')?.key, 'resume')
  assert.equal(parseVoiceControlCommand('Stop microphone')?.key, 'stop-microphone')
  assert.equal(parseVoiceControlCommand('Turn off the microphone.')?.key, 'stop-microphone')
})

test('accepts only resume and microphone stop when command mode is paused', () => {
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Resume voice control'), true), true)
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Stop microphone'), true), true)
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Candidate login'), true), false)
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Next question'), true), false)
  assert.equal(isVoiceControlCommandAllowed(null, true), false)
  assert.equal(isVoiceControlCommandAllowed(null, false), true)
})

test('recognizes spoken-guidance commands independently of microphone controls', () => {
  assert.equal(parseSpeechGuidanceCommand('Pause guidance')?.key, 'pause-guidance')
  assert.equal(parseSpeechGuidanceCommand('Resume guidance')?.key, 'resume-guidance')
  assert.equal(parseSpeechGuidanceCommand('Stop speaking')?.key, 'stop-speaking')
  assert.equal(parseSpeechGuidanceCommand('Read instructions')?.key, 'read-instructions')
  assert.equal(parseSpeechGuidanceCommand('Repeat the instructions aloud.')?.key, 'read-instructions')
  assert.equal(parseSpeechGuidanceCommand('Pause voice control'), null)
  assert.equal(parseSpeechGuidanceCommand('Stop microphone'), null)
  assert.equal(parseSpeechGuidanceCommand('Pause dictation'), null)
  assert.equal(parseSpeechGuidanceCommand('Read password instructions'), null)
})

test('keeps guidance commands out of microphone-control handling while preserving voice controls', () => {
  assert.equal(parseVoiceControlCommand('Pause voice control')?.key, 'pause')
  assert.equal(parseVoiceControlCommand('Resume voice control')?.key, 'resume')
  assert.equal(parseVoiceControlCommand('Stop microphone')?.key, 'stop-microphone')
  assert.equal(parseVoiceControlCommand('Pause guidance'), null)
  assert.equal(parseVoiceControlCommand('Resume guidance'), null)
  assert.equal(parseVoiceControlCommand('Stop speaking'), null)
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Pause guidance'), true), false)
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Resume guidance'), true), false)
  assert.equal(isVoiceControlCommandAllowed(parseVoiceControlCommand('Stop speaking'), true), false)
})
