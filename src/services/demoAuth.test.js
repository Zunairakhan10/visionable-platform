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
const accounts = new Map()
let tokenCounter = 0

function response(status, result) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return result
    },
  }
}

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
globalThis.fetch = async (_url, options) => {
  const { email: inputEmail, password } = JSON.parse(options.body)
  const email = inputEmail.trim().toLowerCase()

  if (options.method !== 'POST') return response(404, { error: 'Not found' })
  if (email === 'examiner.demo@example.com') {
    if (_url.endsWith('/register')) {
      return response(400, { error: 'This email is reserved for the separate examiner demo sign-in.' })
    }
    if (password !== 'VisionAbleDemo@123') return response(401, { error: 'The email or password is incorrect.' })
    return response(200, {
      session: { email, role: 'examiner' },
      accessToken: `demo.examiner.${++tokenCounter}`,
    })
  }

  if (options.body && _url.endsWith('/register')) {
    if (accounts.has(email)) return response(409, { error: 'An account with this email already exists. Sign in instead.' })
    const candidateId = accounts.size === 0 ? 'VA-1048' : `VA-${1050 + accounts.size}`
    accounts.set(email, { password, candidateId })
    return response(201, {
      session: { email, role: 'candidate', candidateId },
      accessToken: `demo.candidate.${++tokenCounter}`,
    })
  }

  const account = accounts.get(email)
  if (!account || account.password !== password) {
    return response(401, { error: 'The email or password is incorrect.' })
  }
  return response(200, {
    session: { email, role: 'candidate', candidateId: account.candidateId },
    accessToken: `demo.candidate.${++tokenCounter}`,
  })
}

beforeEach(() => {
  storage.clear()
  accounts.clear()
  tokenCounter = 0
})

test('candidate credentials are verified by the backend and only a signed session is stored locally', async () => {
  const session = await registerCandidate(' Candidate@example.com ', 'candidate-password')
  const storedSession = JSON.parse(storage.get('visionable:demo-session:v1'))

  assert.deepEqual(session, {
    email: 'candidate@example.com',
    role: 'candidate',
    candidateId: 'VA-1048',
    accessToken: 'demo.candidate.1',
  })
  assert.equal(storage.has('visionable:demo-accounts:v1'), false)
  assert.equal(JSON.stringify(storedSession).includes('candidate-password'), false)
  assert.deepEqual(getDemoSession(), session)
})

test('rejects malformed email, short passwords, and duplicate candidate accounts', async () => {
  await assert.rejects(registerCandidate('not-an-email', 'candidate-password'), /valid email/i)
  await assert.rejects(registerCandidate('candidate@example.com', 'short'), /between 8 and 1024/i)
  await registerCandidate('candidate@example.com', 'candidate-password')
  await assert.rejects(
    registerCandidate('CANDIDATE@example.com', 'another-password'),
    /already exists/i,
  )
})

test('candidate login rejects incorrect passwords and restores valid backend sessions', async () => {
  await registerCandidate('candidate@example.com', 'candidate-password')
  signOutDemoUser()

  await assert.rejects(
    loginCandidate('candidate@example.com', 'incorrect-password'),
    /email or password is incorrect/i,
  )
  const session = await loginCandidate('candidate@example.com', 'candidate-password')
  assert.equal(session.email, 'candidate@example.com')
  assert.equal(session.role, 'candidate')
  assert.deepEqual(getDemoSession(), session)
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

test('only the separate examiner demo credentials create an examiner session', async () => {
  await assert.rejects(
    loginExaminer('examiner.demo@example.com', 'incorrect-password'),
    /examiner email or password is incorrect/i,
  )
  const session = await loginExaminer('EXAMINER.DEMO@example.com', 'VisionAbleDemo@123')
  assert.equal(session.email, 'examiner.demo@example.com')
  assert.equal(session.role, 'examiner')
  assert.deepEqual(getDemoSession(), session)
})

test('migrates a valid existing browser candidate account to backend authentication', async () => {
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('legacy-password'),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await webcrypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations: 210_000,
  }, key, 256)
  const base64 = (bytes) => btoa(String.fromCharCode(...bytes))
  storage.set('visionable:demo-accounts:v1', JSON.stringify({
    version: 1,
    accounts: [{
      version: 1,
      email: 'legacy@example.com',
      salt: base64(salt),
      passwordHash: base64(new Uint8Array(bits)),
    }],
  }))

  const session = await loginCandidate('legacy@example.com', 'legacy-password')
  assert.equal(session.role, 'candidate')
  assert.equal(storage.get('visionable:demo-accounts:v1'), JSON.stringify({ version: 1, accounts: [] }))
})

test('clears malformed sessions and reports unsupported legacy account storage', async () => {
  storage.set('visionable:demo-session:v1', '{bad json')
  assert.equal(getDemoSession(), null)
  assert.equal(storage.has('visionable:demo-session:v1'), false)

  storage.set('visionable:demo-accounts:v1', JSON.stringify({ version: 0, accounts: [] }))
  await assert.rejects(
    loginCandidate('candidate@example.com', 'candidate-password'),
    /unsupported format/i,
  )
})
