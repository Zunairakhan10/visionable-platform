const path = require('node:path');
const { promisify } = require('node:util');
const { createHash, pbkdf2, randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const { createApplicationRecordStore } = require('./recordStore');

const deriveKey = promisify(pbkdf2);
const passwordIterations = 210_000;
const passwordKeyLength = 32;
const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const examinerEmailInput = process.env.DEMO_EXAMINER_EMAIL || (isVercelRuntime ? '' : 'examiner.demo@example.com');
const examinerPassword = process.env.DEMO_EXAMINER_PASSWORD || (isVercelRuntime ? '' : 'VisionAbleDemo@123');
const examinerEmail = examinerEmailInput.trim().toLowerCase();
const defaultFilePath = path.resolve(__dirname, '../../data/demo-users.json');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (isVercelRuntime && (!examinerEmail || !examinerPassword)) {
  throw new Error('DEMO_EXAMINER_EMAIL and DEMO_EXAMINER_PASSWORD must be configured on Vercel.');
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function normalizeCredentials(email, password) {
  if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
    throw createHttpError(400, 'Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
    throw createHttpError(400, 'Your password must be between 8 and 1024 characters.');
  }
  return { email: email.trim().toLowerCase(), password };
}

function isValidUser(user) {
  return user
    && typeof user.id === 'string'
    && typeof user.email === 'string'
    && typeof user.candidateId === 'string'
    && typeof user.salt === 'string'
    && typeof user.passwordHash === 'string';
}

function createDemoAuthService(filePath = defaultFilePath, { recordStore, candidateIdStore } = {}) {
  const users = recordStore || createApplicationRecordStore({
    filePath,
    prefix: 'visionable/demo-users',
    keyForRecord: (user) => createHash('sha256').update(user.email).digest('hex'),
    isValidRecord: isValidUser,
  });
  const candidateIds = candidateIdStore || createApplicationRecordStore({
    filePath: path.join(path.dirname(filePath), 'demo-candidate-ids.json'),
    prefix: 'visionable/demo-candidate-ids',
    keyForRecord: (record) => record.id,
    isValidRecord: (record) => record && typeof record.id === 'string',
  });

  async function passwordHash(password, salt) {
    return deriveKey(password, salt, passwordIterations, passwordKeyLength, 'sha256');
  }

  return {
    async registerCandidate(emailInput, passwordInput) {
      const { email, password } = normalizeCredentials(emailInput, passwordInput);
      if (email === examinerEmail) {
        throw createHttpError(400, 'This email is reserved for the separate examiner demo sign-in.');
      }

      const salt = randomBytes(16);
      const hash = await passwordHash(password, salt);
      const user = {
        id: randomBytes(16).toString('hex'),
        email,
        candidateId: 'VA-0000',
        salt: salt.toString('base64url'),
        passwordHash: hash.toString('base64url'),
      };

      const existingIds = new Set([
        ...(await users.list()).map((storedUser) => storedUser.candidateId),
        ...(await candidateIds.list()).map((record) => record.id),
      ]);
      let reservedCandidateId = false;
      for (let attempt = 0; attempt < 10_000 && !reservedCandidateId; attempt += 1) {
        user.candidateId = !existingIds.size && attempt === 0
          ? 'VA-1048'
          : `VA-${randomInt(1000, 10_000)}`;
        if (existingIds.has(user.candidateId)) continue;
        try {
          await candidateIds.create({ id: user.candidateId });
          reservedCandidateId = true;
        } catch (error) {
          if (error.code !== 'RECORD_CONFLICT') throw error;
          existingIds.add(user.candidateId);
        }
      }
      if (!reservedCandidateId) {
        throw createHttpError(503, 'A candidate identifier is temporarily unavailable. Please try again.');
      }

      try {
        await users.create(user);
      } catch (error) {
        if (error.code === 'RECORD_CONFLICT') {
          throw createHttpError(409, 'An account with this email already exists. Sign in instead.');
        }
        throw error;
      }

      return { id: user.id, email: user.email, role: 'candidate', candidateId: user.candidateId };
    },

    async login(emailInput, passwordInput) {
      if (typeof emailInput !== 'string' || typeof passwordInput !== 'string') {
        throw createHttpError(400, 'Enter an email address and password.');
      }
      const email = emailInput.trim().toLowerCase();
      if (email === examinerEmail) {
        if (passwordInput !== examinerPassword) {
          throw createHttpError(401, 'The email or password is incorrect.');
        }
        return { id: 'demo-examiner', email: examinerEmail, role: 'examiner' };
      }

      const { password } = normalizeCredentials(email, passwordInput);
      const userKey = createHash('sha256').update(email).digest('hex');
      const user = await users.get(userKey);
      if (!user) throw createHttpError(401, 'The email or password is incorrect.');

      const actualHash = await passwordHash(password, Buffer.from(user.salt, 'base64url'));
      const expectedHash = Buffer.from(user.passwordHash, 'base64url');
      if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
        throw createHttpError(401, 'The email or password is incorrect.');
      }
      return { id: user.id, email: user.email, role: 'candidate', candidateId: user.candidateId };
    },
  };
}

module.exports = { createDemoAuthService, defaultDemoAuthService: createDemoAuthService() };
