const express = require('express');
const knex = require('../../config/database');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  ON_DUTY,
  WORK_MEMBERS,
  listAssignableGroups,
  listGroupMembers,
  listWorkGroupMembers,
  listOnDutyMembers,
} = require('../users');

const router = express.Router();

router.get(
  '/assignable-groups',
  asyncHandler(async (req, res) => {
    const ownerGroupId = String(req.query.owner_group_id || '').trim();
    if (!ownerGroupId) return res.status(400).json({ message: 'owner_group_id is required.' });
    const groups = await listAssignableGroups(knex, req.eProcess, ownerGroupId);
    return res.json({ groups });
  })
);

router.get(
  '/assignable-members',
  asyncHandler(async (req, res) => {
    const ownerGroupId = String(req.query.owner_group_id || '').trim();
    const groupId = String(req.query.group_id || '');
    if (!ownerGroupId || !groupId) {
      return res.status(400).json({ message: 'owner_group_id and group_id are required.' });
    }
    const allowed = await listAssignableGroups(knex, req.eProcess, ownerGroupId);
    if (!allowed.some((group) => String(group.id) === groupId)) {
      return res.status(403).json({ message: 'This group is not available for assignment.' });
    }
    let members = [];
    if (groupId === ON_DUTY) members = await listOnDutyMembers(knex, ownerGroupId);
    else if (groupId === WORK_MEMBERS) members = await listWorkGroupMembers(knex, ownerGroupId);
    else members = await listGroupMembers(knex, groupId);
    return res.json({ members });
  })
);

module.exports = router;
