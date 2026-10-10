const ACCOUNTS_STORAGE_KEY = 'visionable:demo-accounts:v1'
const SESSION_STORAGE_KEY = 'visionable:demo-session:v1'
const STORAGE_VERSION = 1
const SESSION_VERSION = 2
const PASSWORD_ITERATIONS = 210_000
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

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
  if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
    throw new Error('Your password must be between 8 and 1024 characters long.')
  }
}

function readLegacyAccounts() {
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

function saveSession(profile, accessToken) {
  const storedSession = {
    version: SESSION_VERSION,
    email: profile.email,
    role: profile.role,
    ...(profile.candidateId ? { candidateId: profile.candidateId } : {}),
    accessToken,
  }
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession))
  } catch {
    throw new Error('Your sign-in could not be saved in this browser. Check its available storage and try again.')
  }
  return {
    email: profile.email,
    role: profile.role,
    ...(profile.candidateId ? { candidateId: profile.candidateId } : {}),
    accessToken,
  }
}

async function requestDemoAuth(action, email, password) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/auth/demo/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch (error) {
    throw new Error('The demo authentication API could not be reached. Check your connection and try again.', { cause: error })
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    throw new Error('The demo authentication server returned an invalid response.', { cause: error })
  }
  if (!response.ok) {
    const requestError = new Error(result?.error || 'Authentication could not be completed.')
    requestError.status = response.status
    throw requestError
  }
  if (
    !result?.session
    || typeof result.session.email !== 'string'
    || !['candidate', 'examiner'].includes(result.session.role)
    || typeof result.accessToken !== 'string'
    || (result.session.role === 'candidate' && typeof result.session.candidateId !== 'string')
  ) {
    throw new Error('The demo authentication server returned an incomplete session.')
  }
  return result
}

function storeSession(result) {
  return saveSession(result.session, result.accessToken)
}

export async function registerCandidate(email, password) {
  const normalizedEmail = normalizeEmail(email)
  validatePassword(password)
  return storeSession(await requestDemoAuth('register', normalizedEmail, password))
}

export async function loginCandidate(email, password) {
  const normalizedEmail = normalizeEmail(email)
  validatePassword(password)

  let result
  try {
    result = await requestDemoAuth('login', normalizedEmail, password)
  } catch (loginError) {
    if (loginError.status !== 401) throw loginError

    const legacyAccount = readLegacyAccounts().find((storedAccount) => storedAccount.email === normalizedEmail)
    if (!legacyAccount || !await passwordMatches(password, legacyAccount)) throw loginError

    try {
      const migratedSession = await requestDemoAuth('register', normalizedEmail, password)
      const accounts = readLegacyAccounts().filter((storedAccount) => storedAccount.email !== normalizedEmail)
      writeAccounts(accounts)
      return storeSession(migratedSession)
    } catch (migrationError) {
      if (migrationError.status === 409) throw loginError
      throw migrationError
    }
  }

  if (result.session.role !== 'candidate') {
    throw new Error('Use the separate examiner sign-in option for this account.')
  }
  return storeSession(result)
}

export async function loginExaminer(email, password) {
  const normalizedEmail = normalizeEmail(email)
  validatePassword(password)
  try {
    const result = await requestDemoAuth('login', normalizedEmail, password)
    if (result.session.role !== 'examiner') {
      throw new Error('The examiner email or password is incorrect.')
    }
    return storeSession(result)
  } catch (error) {
    if (error.status === 401) throw new Error('The examiner email or password is incorrect.', { cause: error })
    throw error
  }
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

  const validSession = session?.version === SESSION_VERSION
    && typeof session.email === 'string'
    && (session.role === 'candidate' || session.role === 'examiner')
    && typeof session.accessToken === 'string'
  if (!validSession) {
    clearStoredSession()
    return null
  }

  if (session.role === 'examiner') {
    return {
      email: session.email,
      role: session.role,
      ...(session.candidateId ? { candidateId: session.candidateId } : {}),
      accessToken: session.accessToken,
    }
  }

  if (typeof session.candidateId !== 'string') {
    clearStoredSession()
    return null
  }
  return {
    email: session.email,
    role: session.role,
    candidateId: session.candidateId,
    accessToken: session.accessToken,
  }
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
