const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const sessionLifetimeSeconds = 60 * 60 * 12;
const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const signingSecret = process.env.DEMO_SESSION_SECRET || (
  isVercelRuntime ? '' : randomBytes(32).toString('base64url')
);

if (signingSecret.length < 32) {
  throw new Error('DEMO_SESSION_SECRET must contain at least 32 characters.');
}

function sign(payload, secret = signingSecret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function issueDemoSession(user, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    ...(user.candidateId ? { candidateId: user.candidateId } : {}),
    exp: Math.floor(now / 1000) + sessionLifetimeSeconds,
  })).toString('base64url');
  return `demo.${payload}.${sign(payload)}`;
}

function verifyDemoSession(token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const match = /^demo\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return null;

  const [, payload, signature] = match;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof claims.sub !== 'string'
    || typeof claims.email !== 'string'
    || !['candidate', 'examiner'].includes(claims.role)
    || !Number.isInteger(claims.exp)
    || claims.exp <= Math.floor(now / 1000)
    || (claims.role === 'candidate' && typeof claims.candidateId !== 'string')
  ) {
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    ...(claims.candidateId ? { candidateId: claims.candidateId } : {}),
  };
}

module.exports = { issueDemoSession, verifyDemoSession };
