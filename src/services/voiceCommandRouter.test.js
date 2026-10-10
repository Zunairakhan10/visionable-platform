import assert from 'node:assert/strict'
import test from 'node:test'
import { createVoiceCommandRouter } from './voiceCommandRouter.js'

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
