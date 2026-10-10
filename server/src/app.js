const express = require('express');
const cors = require('cors');
const createAuthRouter = require('./routes/auth').createAuthRouter;
const createMonitoringEventsRouter = require('./routes/monitoringEvents').createMonitoringEventsRouter;

function createApp({
  authRouter = createAuthRouter(),
  monitoringEventsRouter = createMonitoringEventsRouter(),
} = {}) {
  const app = express();
  const allowedOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'visionable-api',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/monitoring-events', monitoringEventsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;

    if (status >= 500) {
      console.error('API request failed.');
    }

    res.status(status).json({
      error: error.type === 'entity.parse.failed'
        ? 'Invalid JSON request body'
        : error.expose === true && status < 500
          ? error.message
          : 'Internal server error',
    });
  });
  return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
