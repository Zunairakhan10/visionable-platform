const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.auth.id,
    email: req.auth.email,
    role: req.auth.role,
  });
});

module.exports = router;
