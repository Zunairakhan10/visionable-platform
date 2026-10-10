import assert from 'node:assert/strict'
import test from 'node:test'
import { isVoiceControlCommandAllowed, parseVoiceControlCommand } from './voiceControlCommands.js'

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
