const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const { authenticate } = require('../middleware/auth');

// ========== Department Groups ==========
router.get('/department', authenticate, groupController.getDepartmentGroups);
router.get('/department/:id', authenticate, groupController.getDepartmentGroup);
router.post('/department', authenticate, groupController.createDepartmentGroup);
router.put('/department/:id', authenticate, groupController.updateDepartmentGroup);
router.delete('/department/:id', authenticate, groupController.deleteDepartmentGroup);

// Department Group Members
router.get('/department/:id/members', authenticate, groupController.getDepartmentGroupMembers);
router.post('/department/:id/members', authenticate, groupController.addUserToDepartmentGroup);
router.delete('/department/:id/members/:userId', authenticate, groupController.removeUserFromDepartmentGroup);

// Department Group Approval Flow
router.get('/department/:id/approval-flow', authenticate, groupController.getDepartmentGroupApprovalFlow);

// ========== Delegation Groups ==========
router.get('/delegation', authenticate, groupController.getDelegationGroups);
router.get('/delegation/:id', authenticate, groupController.getDelegationGroup);
router.post('/delegation', authenticate, groupController.createDelegationGroup);
router.put('/delegation/:id', authenticate, groupController.updateDelegationGroup);
router.delete('/delegation/:id', authenticate, groupController.deleteDelegationGroup);

// Delegation Group Members
router.get('/delegation/:id/members', authenticate, groupController.getDelegationGroupMembers);
router.post('/delegation/:id/members', authenticate, groupController.addUserToDelegationGroup);
router.delete('/delegation/:id/members/:userId', authenticate, groupController.removeUserFromDelegationGroup);

// ========== User Groups ==========
router.get('/my-groups', authenticate, groupController.getUserGroups);

module.exports = router;
