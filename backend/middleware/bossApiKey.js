const crypto = require('crypto');

function getConfiguredApiKey() {
  return String(process.env.BOSS_INTERNAL_API_KEY || '').trim();
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireBossApiKey(req, res, next) {
  const expected = getConfiguredApiKey();
  if (!expected) {
    return res.status(503).json({ message: 'BOSS internal API key is not configured' });
  }

  const provided = String(
    req.get('x-boss-api-key')
    || req.get('X-Boss-Api-Key')
    || ''
  ).trim();

  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ message: 'Invalid or missing BOSS API key' });
  }

  next();
}

module.exports = {
  requireBossApiKey,
  getConfiguredApiKey
};
