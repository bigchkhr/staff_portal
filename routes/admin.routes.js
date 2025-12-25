const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');

router.use(authenticate);
router.use(isSystemAdmin);

router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.get('/users', adminController.getUsers);

router.post('/leave-types', adminController.createLeaveType);
router.put('/leave-types/:id', adminController.updateLeaveType);
router.get('/leave-types', adminController.getLeaveTypes);

router.post('/balances', adminController.updateBalance);

router.post('/departments', adminController.createDepartment);
router.put('/departments/:id', adminController.updateDepartment);
router.get('/departments', adminController.getDepartments);

router.post('/positions', adminController.createPosition);
router.put('/positions/:id', adminController.updatePosition);
router.get('/positions', adminController.getPositions);

router.post('/groups', adminController.createGroup);
router.put('/groups/:id', adminController.updateGroup);
router.get('/groups', adminController.getGroups);

module.exports = router;

