const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { applyVisibleWorkflowFilter, applyRunsVisibility } = require('../access');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const knex = require('../../config/database');
    const ctx = req.eProcess;

    const scopeWorkflows = (q) => applyVisibleWorkflowFilter(q, ctx);
    const scopeRuns = (q) => applyRunsVisibility(q, knex, ctx);

    const [workflowStats, runStats, taskStats, recentRuns] = await Promise.all([
      scopeWorkflows(knex('workflows as w'))
        .select(knex.raw('COUNT(*)::int AS total'))
        .select(knex.raw("COUNT(*) FILTER (WHERE w.status = 'published')::int AS published"))
        .first(),
      scopeRuns(
        knex('workflow_runs as r').join('workflows as w', 'w.id', 'r.workflow_id')
      )
        .select(knex.raw('COUNT(*)::int AS total'))
        .select(knex.raw("COUNT(*) FILTER (WHERE r.status = 'active')::int AS active"))
        .select(knex.raw("COUNT(*) FILTER (WHERE r.status = 'completed')::int AS completed"))
        .first(),
      scopeRuns(
        knex('task_runs as tr')
          .join('workflow_runs as r', 'r.id', 'tr.run_id')
          .join('workflows as w', 'w.id', 'r.workflow_id')
      )
        .select(knex.raw("COUNT(*) FILTER (WHERE tr.status = 'pending')::int AS pending"))
        .select(knex.raw("COUNT(*) FILTER (WHERE tr.status = 'completed')::int AS completed"))
        .first(),
      scopeRuns(
        knex('workflow_runs as r')
          .join('workflows as w', 'w.id', 'r.workflow_id')
          .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
      )
        .orderBy('r.created_at', 'desc')
        .limit(5)
        .select(
          'r.id',
          'r.name',
          'r.run_number',
          'r.status',
          'r.created_at',
          'w.name as workflow_name',
          'w.workflow_number',
          knex.raw('g.name as group_name')
        ),
    ]);

    return res.json({ workflowStats, runStats, taskStats, recentRuns, isSupervisor: ctx.isSupervisor });
  })
);

module.exports = router;
