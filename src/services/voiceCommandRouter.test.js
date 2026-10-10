import assert from 'node:assert/strict'
import test from 'node:test'
import { createVoiceCommandRouter } from './voiceCommandRouter.js'
import { parseLoginVoiceCommand } from './loginVoiceCommands.js'
import { claimSpeechRecognitionSession, getSpeechRecognitionSessionOwner } from './speechRecognitionSession.js'

test('routes commands only to the active screen handler', () => {
  const calls = []
  const router = createVoiceCommandRouter()
  const unregisterLanding = router.register('landing', (command) => calls.push(`landing:${command}`))

  assert.equal(router.dispatch('landing', 'candidate login'), true)
  assert.equal(router.dispatch('auth', 'sign in'), false)

  const unregisterAuth = router.register('auth', (command) => calls.push(`auth:${command}`))
  assert.equal(router.dispatch('auth', 'sign in'), true)
  unregisterLanding()
  assert.equal(router.dispatch('auth', 'sign in'), true)
  unregisterAuth()
  assert.equal(router.dispatch('auth', 'sign in'), false)
  assert.deepEqual(calls, ['landing:candidate login', 'auth:sign in', 'auth:sign in'])
})

test('routes landing Log in and Sign up phrases through navigation handlers', () => {
  const router = createVoiceCommandRouter()
  const navigation = []
  let view = 'landing'
  let mode = 'login'
  const unregisterLanding = router.register('landing', (transcript) => {
    const command = parseLoginVoiceCommand(transcript)
    if (command?.key === 'candidate-login') {
      navigation.push('open-login')
      view = 'auth'
      mode = 'login'
    } else if (command?.key === 'signup') {
      navigation.push('open-signup')
      mode = 'signup'
      view = 'auth'
    }
  })

  assert.equal(router.dispatch(view, 'Log in'), true)
  assert.equal(view, 'auth')
  assert.equal(mode, 'login')
  assert.deepEqual(navigation, ['open-login'])
  unregisterLanding()

  view = 'landing'
  const unregisterLandingAgain = router.register('landing', (transcript) => {
    const command = parseLoginVoiceCommand(transcript)
    if (command?.key === 'signup') {
      navigation.push('open-signup')
      mode = 'signup'
      view = 'auth'
    }
  })
  assert.equal(router.dispatch(view, 'Sign up'), true)
  assert.equal(view, 'auth')
  assert.equal(mode, 'signup')
  assert.deepEqual(navigation, ['open-login', 'open-signup'])
  unregisterLandingAgain()

  view = 'auth'
  mode = 'login'
  const unregisterAuth = router.register('auth', (transcript) => {
    const command = parseLoginVoiceCommand(transcript, 'form')
    if (command?.key === 'signup') {
      mode = 'signup'
      navigation.push('switch-to-signup')
    }
  })
  assert.equal(router.dispatch(view, 'Sign up'), true)
  assert.equal(mode, 'signup')
  assert.deepEqual(navigation, ['open-login', 'open-signup', 'switch-to-signup'])
  unregisterAuth()
})

test('routes login and signup from the account-selection screen without a card click', () => {
  const router = createVoiceCommandRouter()
  const navigation = []
  let view = 'auth-selection'
  const unregisterSelection = router.register('auth-selection', (transcript) => {
    const command = parseLoginVoiceCommand(transcript)
    if (command?.key === 'candidate-login') {
      navigation.push('open-candidate-login')
      view = 'auth'
    } else if (command?.key === 'signup') {
      navigation.push('open-candidate-signup')
      view = 'auth'
    }
  })

  assert.equal(router.dispatch(view, 'Log in'), true)
  assert.equal(view, 'auth')
  assert.deepEqual(navigation, ['open-candidate-login'])
  view = 'auth-selection'
  assert.equal(router.dispatch(view, 'Sign up'), true)
  assert.deepEqual(navigation, ['open-candidate-login', 'open-candidate-signup'])
  unregisterSelection()
})

test('keeps one recognition session claimed while screen command handlers change', () => {
  const router = createVoiceCommandRouter()
  const releaseRecognition = claimSpeechRecognitionSession('voice-control')
  assert.equal(typeof releaseRecognition, 'function')

  const unregisterLanding = router.register('landing', () => {})
  assert.equal(router.dispatch('landing', 'Log in'), true)
  unregisterLanding()
  const unregisterSelection = router.register('auth-selection', () => {})
  assert.equal(router.dispatch('auth-selection', 'Sign up'), true)

  assert.equal(getSpeechRecognitionSessionOwner(), 'voice-control')
  unregisterSelection()
  assert.equal(getSpeechRecognitionSessionOwner(), 'voice-control')
  releaseRecognition()
  assert.equal(getSpeechRecognitionSessionOwner(), null)
})
