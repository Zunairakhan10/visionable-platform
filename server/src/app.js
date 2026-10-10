const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const monitoringEventsRouter = require('./routes/monitoringEvents');

const app = express();

app.use(cors());
app.use(express.json());

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
    error: error.type === 'entity.parse.failed' ? 'Invalid JSON request body' : 'Internal server error',
  });
});

module.exports = app;
