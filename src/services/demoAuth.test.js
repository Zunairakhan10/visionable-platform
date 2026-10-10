import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import test, { beforeEach } from 'node:test'
import {
  getDemoSession,
  loginCandidate,
  loginExaminer,
  registerCandidate,
  signOutDemoUser,
} from './demoAuth.js'

const storage = new Map()

globalThis.window = {
  localStorage: {
    getItem(key) {
      return storage.get(key) ?? null
    },
    setItem(key, value) {
      storage.set(key, value)
    },
    removeItem(key) {
      storage.delete(key)
    },
  },
}
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })

beforeEach(() => storage.clear())

test('stores candidate credentials as salted hashes and restores the session', async () => {
  const session = await registerCandidate(' Candidate@example.com ', 'candidate-password')
  const storedAccounts = JSON.parse(storage.get('visionable:demo-accounts:v1'))
  const storedSession = JSON.parse(storage.get('visionable:demo-session:v1'))

  assert.deepEqual(session, { email: 'candidate@example.com', role: 'candidate' })
  assert.equal('role' in storedAccounts.accounts[0], false)
  assert.notEqual(storedAccounts.accounts[0].passwordHash, 'candidate-password')
  assert.equal(JSON.stringify(storedAccounts).includes('candidate-password'), false)
  assert.equal('passwordHash' in storedSession, false)
  assert.equal(storedSession.role, 'candidate')
  assert.deepEqual(getDemoSession(), session)
})

test('rejects malformed email, short passwords, and duplicate candidate accounts', async () => {
  await assert.rejects(registerCandidate('not-an-email', 'candidate-password'), /valid email/i)
  await assert.rejects(registerCandidate('candidate@example.com', 'short'), /at least 8 characters/i)
  await registerCandidate('candidate@example.com', 'candidate-password')
  await assert.rejects(
    registerCandidate('CANDIDATE@example.com', 'another-password'),
    /already exists/i,
  )
})

test('candidate login rejects incorrect passwords and restores valid logins', async () => {
  await registerCandidate('candidate@example.com', 'candidate-password')
  signOutDemoUser()

  await assert.rejects(
    loginCandidate('candidate@example.com', 'incorrect-password'),
    /email or password is incorrect/i,
  )
  assert.deepEqual(await loginCandidate('candidate@example.com', 'candidate-password'), {
    email: 'candidate@example.com',
    role: 'candidate',
  })
  assert.deepEqual(getDemoSession(), {
    email: 'candidate@example.com',
    role: 'candidate',
  })
})

test('candidate registration cannot create or sign into an examiner account', async () => {
  await assert.rejects(
    registerCandidate('examiner.demo@example.com', 'candidate-password'),
    /reserved for the separate examiner/i,
  )
  await assert.rejects(
    loginCandidate('examiner.demo@example.com', 'VisionAbleDemo@123'),
    /separate examiner sign-in/i,
  )
})

test('only the separate examiner demo credentials create an examiner session', () => {
  assert.throws(
    () => loginExaminer('examiner.demo@example.com', 'incorrect-password'),
    /examiner email or password is incorrect/i,
  )
  assert.deepEqual(
    loginExaminer('EXAMINER.DEMO@example.com', 'VisionAbleDemo@123'),
    { email: 'examiner.demo@example.com', role: 'examiner' },
  )
  assert.deepEqual(getDemoSession(), {
    email: 'examiner.demo@example.com',
    role: 'examiner',
  })
})

test('clears malformed sessions and rejects outdated account storage', async () => {
  storage.set('visionable:demo-session:v1', '{bad json')
  assert.equal(getDemoSession(), null)
  assert.equal(storage.has('visionable:demo-session:v1'), false)

  storage.set('visionable:demo-accounts:v1', JSON.stringify({ version: 0, accounts: [] }))
  await assert.rejects(
    registerCandidate('candidate@example.com', 'candidate-password'),
    /unsupported format/i,
  )
})
