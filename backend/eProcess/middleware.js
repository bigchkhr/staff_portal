const knex = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { loadEProcessContext } = require('./access');

function attachEProcessUser(req, res, next) {
  loadEProcessContext(knex, req.user)
    .then((ctx) => {
      if (!ctx) return res.status(401).json({ message: 'Authentication required.' });
      req.eProcess = ctx;
      next();
    })
    .catch((err) => {
      console.error('E-Process attach user error:', err);
      res.status(500).json({ message: 'Internal server error.' });
    });
}

const eProcessGate = [authenticate, attachEProcessUser];

module.exports = { eProcessGate, attachEProcessUser };
