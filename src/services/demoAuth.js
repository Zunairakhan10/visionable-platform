const ACCOUNTS_STORAGE_KEY = 'visionable:demo-accounts:v1'
const SESSION_STORAGE_KEY = 'visionable:demo-session:v1'
const STORAGE_VERSION = 1
const PASSWORD_ITERATIONS = 210_000
const EXAMINER_EMAIL = 'examiner.demo@example.com'
const EXAMINER_PASSWORD = 'VisionAbleDemo@123'

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw new Error('Enter a valid email address.')
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.')
  }
  return normalizedEmail
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Your password must be at least 8 characters long.')
  }
}

function readAccounts() {
  let storedAccounts
  try {
    storedAccounts = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
  } catch {
    throw new Error('Demo account storage is unavailable in this browser.')
  }

  if (storedAccounts === null) return []

  try {
    const parsed = JSON.parse(storedAccounts)
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.accounts)) {
      throw new Error('outdated')
    }

    const validAccounts = parsed.accounts.every((account) => (
      account
      && account.version === STORAGE_VERSION
      && typeof account.email === 'string'
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)
      && typeof account.salt === 'string'
      && typeof account.passwordHash === 'string'
    ))
    if (!validAccounts) throw new Error('corrupted')
    return parsed.accounts
  } catch (error) {
    if (error?.message === 'outdated') {
      throw new Error(
        'Saved demo accounts use an unsupported format. Clear this site’s local storage to start over.',
        { cause: error },
      )
    }
    throw new Error(
      'Saved demo accounts could not be read. Clear this site’s local storage to start over.',
      { cause: error },
    )
  }
}

function writeAccounts(accounts) {
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      accounts,
    }))
  } catch {
    throw new Error('Your demo account could not be saved in this browser. Check its available storage and try again.')
  }
}

function encodeBase64(bytes) {
  return btoa(String.fromCharCode(...bytes))
}

function decodeBase64(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure password storage is unavailable. Open this prototype on localhost or in a secure browser context.')
  }

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await globalThis.crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations: PASSWORD_ITERATIONS,
  }, keyMaterial, 256)
  return new Uint8Array(bits)
}

async function createPasswordHash(password) {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure password storage is unavailable. Open this prototype on localhost or in a secure browser context.')
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const passwordHash = await hashPassword(password, salt)
  return {
    salt: encodeBase64(salt),
    passwordHash: encodeBase64(passwordHash),
  }
}

async function passwordMatches(password, account) {
  let salt
  let expectedHash
  try {
    salt = decodeBase64(account.salt)
    expectedHash = decodeBase64(account.passwordHash)
  } catch (error) {
    throw new Error(
      'Saved demo accounts could not be read. Clear this site’s local storage to start over.',
      { cause: error },
    )
  }

  const actualHash = await hashPassword(password, salt)
  if (actualHash.length !== expectedHash.length) return false

  let difference = 0
  for (let index = 0; index < actualHash.length; index += 1) {
    difference |= actualHash[index] ^ expectedHash[index]
  }
  return difference === 0
}

function saveSession(email, role) {
  const session = {
    version: STORAGE_VERSION,
    email,
    role,
    issuedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    throw new Error('Your sign-in could not be saved in this browser. Check its available storage and try again.')
  }
  return { email, role }
}

export async function registerCandidate(email, password) {
  const normalizedEmail = normalizeEmail(email)
  validatePassword(password)
  const accounts = readAccounts()

  if (normalizedEmail === EXAMINER_EMAIL) {
    throw new Error('This email is reserved for the separate examiner demo sign-in.')
  }
  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error('An account with this email already exists. Sign in instead.')
  }

  const passwordData = await createPasswordHash(password)
  const latestAccounts = readAccounts()
  if (latestAccounts.some((account) => account.email === normalizedEmail)) {
    throw new Error('An account with this email already exists. Sign in instead.')
  }

  writeAccounts([
    ...latestAccounts,
    {
      version: STORAGE_VERSION,
      email: normalizedEmail,
      ...passwordData,
    },
  ])
  return saveSession(normalizedEmail, 'candidate')
}

export async function loginCandidate(email, password) {
  const normalizedEmail = normalizeEmail(email)
  validatePassword(password)
  if (normalizedEmail === EXAMINER_EMAIL) {
    throw new Error('Use the separate examiner sign-in option for this account.')
  }

  const account = readAccounts().find((storedAccount) => storedAccount.email === normalizedEmail)
  if (!account || !await passwordMatches(password, account)) {
    throw new Error('The email or password is incorrect.')
  }
  return saveSession(account.email, 'candidate')
}

export function loginExaminer(email, password) {
  const normalizedEmail = normalizeEmail(email)
  if (normalizedEmail !== EXAMINER_EMAIL || password !== EXAMINER_PASSWORD) {
    throw new Error('The examiner email or password is incorrect.')
  }
  return saveSession(EXAMINER_EMAIL, 'examiner')
}

export function getDemoSession() {
  let storedSession
  try {
    storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    throw new Error('Demo sign-in storage is unavailable in this browser.')
  }

  if (storedSession === null) return null

  let session
  try {
    session = JSON.parse(storedSession)
  } catch {
    clearStoredSession()
    return null
  }

  const validSession = session?.version === STORAGE_VERSION
    && typeof session.email === 'string'
    && (session.role === 'candidate' || session.role === 'examiner')
    && typeof session.issuedAt === 'string'
    && !Number.isNaN(Date.parse(session.issuedAt))
  if (!validSession) {
    clearStoredSession()
    return null
  }

  if (session.role === 'examiner') {
    if (session.email !== EXAMINER_EMAIL) {
      clearStoredSession()
      return null
    }
    return { email: session.email, role: session.role }
  }

  if (!readAccounts().some((account) => account.email === session.email)) {
    clearStoredSession()
    return null
  }
  return { email: session.email, role: session.role }
}

function clearStoredSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    throw new Error('Your demo session could not be cleared from this browser.')
  }
}

export function signOutDemoUser() {
  clearStoredSession()
}
