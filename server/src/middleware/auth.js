function createAuthMiddleware(getSupabase, verifyDemoSession = require('../services/demoSessions').verifyDemoSession) {
  async function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({ error: 'Authentication is required.' });
    }

    try {
      if (match[1].startsWith('demo.')) {
        const demoUser = verifyDemoSession(match[1]);
        if (!demoUser) {
          return res.status(401).json({ error: 'A valid access token is required.' });
        }
        req.auth = { ...demoUser, isDemo: true };
        return next();
      }

      const { data, error } = await getSupabase().auth.getUser(match[1]);
      if (error || !data.user) {
        return res.status(401).json({ error: 'A valid access token is required.' });
      }

      const { data: roleRecord, error: roleError } = await getSupabase()
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (roleError) {
        return next(roleError);
      }

      req.auth = {
        id: data.user.id,
        email: data.user.email,
        role: roleRecord?.role === 'examiner' ? 'examiner' : 'candidate',
      };
      return next();
    } catch (error) {
      return next(error);
    }
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (req.auth?.role !== role) {
        return res.status(403).json({ error: 'You are not authorized to access this resource.' });
      }
      return next();
    };
  }

  return { authenticate, requireRole };
}

const { authenticate, requireRole } = createAuthMiddleware(
  () => require('../config/db').getSupabase()
);

module.exports = { authenticate, createAuthMiddleware, requireRole };
