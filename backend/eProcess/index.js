const express = require('express');
const { eProcessGate } = require('./middleware');
const workflowRoutes = require('./routes/workflows');
const runRoutes = require('./routes/runs');
const dashboardRoutes = require('./routes/dashboard');
const groupRoutes = require('./routes/groups');
const procedureRoutes = require('./routes/procedures');

const router = express.Router();

router.use(eProcessGate);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'e-process' });
});

router.get('/me', (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      display_name: req.user.display_name,
      employee_number: req.user.employee_number,
      email: req.user.email || '',
    },
    isGlobalAdmin: req.eProcess.isGlobalAdmin,
    isSectionAdmin: req.eProcess.isSectionAdmin,
    isSupervisor: req.eProcess.isSupervisor,
    memberGroupIds: req.eProcess.memberGroupIds,
    manageGroupIds: req.eProcess.manageWorkflowGroupIds,
    manageWorkflowGroupIds: req.eProcess.manageWorkflowGroupIds,
    assignAudienceGroupIds: req.eProcess.manageWorkflowGroupIds,
  });
});

router.use('/groups', groupRoutes);
router.use('/procedures', procedureRoutes);
router.use('/workflows', workflowRoutes);
router.use('/runs', runRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', require('./routes/users'));

router.use((err, req, res, next) => {
  console.error('E-Process error:', err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal server error.' });
});

module.exports = router;
