const express = require('express');
const { authenticate } = require('../middleware/auth');
const { defaultDemoAuthService } = require('../services/demoAuthService');
const { issueDemoSession } = require('../services/demoSessions');

function createAuthRouter({
  demoAuthService = defaultDemoAuthService,
  authenticateRequest = authenticate,
  createSession = issueDemoSession,
} = {}) {
  const router = express.Router();

  router.post('/demo/register', async (req, res, next) => {
    try {
      const user = await demoAuthService.registerCandidate(req.body?.email, req.body?.password);
      return res.status(201).json({
        session: {
          email: user.email,
          role: user.role,
          ...(user.candidateId ? { candidateId: user.candidateId } : {}),
        },
        accessToken: createSession(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/demo/login', async (req, res, next) => {
    try {
      const user = await demoAuthService.login(req.body?.email, req.body?.password);
      return res.json({
        session: {
          email: user.email,
          role: user.role,
          ...(user.candidateId ? { candidateId: user.candidateId } : {}),
        },
        accessToken: createSession(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me', authenticateRequest, (req, res) => {
    res.json({
      id: req.auth.id,
      email: req.auth.email,
      role: req.auth.role,
    });
  });

  return router;
}

module.exports = createAuthRouter();
module.exports.createAuthRouter = createAuthRouter;
