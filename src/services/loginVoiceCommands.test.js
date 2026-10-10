import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLoginVoiceCommand } from './loginVoiceCommands.js'

test('parses login navigation and page actions with voice variations', () => {
  assert.equal(parseLoginVoiceCommand('Candidate sign-in!')?.key, 'candidate-login')
  assert.equal(parseLoginVoiceCommand('log in as examiner')?.key, 'examiner-login')
  assert.equal(parseLoginVoiceCommand('create candidate account')?.key, 'signup')
  assert.equal(parseLoginVoiceCommand('Sign up')?.key, 'signup')
  assert.equal(parseLoginVoiceCommand('Repeat the instructions.')?.key, 'read-instructions')
  assert.equal(parseLoginVoiceCommand('go back')?.key, 'go-back')
  assert.equal(parseLoginVoiceCommand('turn on camera')?.key, 'start-camera')
  assert.equal(parseLoginVoiceCommand('stop voice control')?.key, 'stop-voice')
})

test('maps login-form commands to field focus and safe submit actions', () => {
  assert.equal(parseLoginVoiceCommand('Email field', 'form')?.key, 'email-field')
  assert.equal(parseLoginVoiceCommand('Password field', 'form')?.key, 'password-field')
  assert.equal(parseLoginVoiceCommand('Confirm password field', 'form')?.key, 'confirm-password-field')
  assert.equal(parseLoginVoiceCommand('Sign in', 'form')?.key, 'submit-login')
  assert.equal(parseLoginVoiceCommand('Create account', 'form')?.key, 'create-account')
  assert.equal(parseLoginVoiceCommand('Create candidate account', 'form')?.key, 'signup')
  assert.equal(parseLoginVoiceCommand('Repeat instructions', 'form')?.key, 'read-instructions')
  assert.equal(parseLoginVoiceCommand('go back', 'form')?.key, 'go-back')
  assert.equal(parseLoginVoiceCommand('sign in', 'unexpected-context'), null)
})

test('does not parse unrelated or ambiguous login phrases', () => {
  assert.equal(parseLoginVoiceCommand('please help me sign into something'), null)
  assert.equal(parseLoginVoiceCommand('camera'), null)
  assert.equal(parseLoginVoiceCommand('open dashboard'), null)
})
