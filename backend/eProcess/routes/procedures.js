const express = require('express');
const { randomUUID } = require('crypto');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  canCreateWorkflowInGroup,
  canAssignUserGroups,
  canEditProcedure,
  canViewProcedure,
  applyVisibleProcedureFilter,
} = require('../access');
const { eProcessProcedureImageUpload } = require('../middleware/uploadProcedureImage');
const fileStorage = require('../localFiles');
const { buildProcedurePdf } = require('../services/procedurePdf');

const router = express.Router();
const AUDIENCES = new Set(['everyone', 'user_groups']);
const STATUSES = new Set(['draft', 'published']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STEPS = 200;
const MAX_CHILDREN = 50;
const MAX_BODY = 20000;

function db(req) {
  return require('../../config/database');
}

function bad(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function withCapabilities(ctx, procedure) {
  const canEdit = canEditProcedure(ctx, procedure);
  return {
    ...procedure,
    canEdit,
    canView: canViewProcedure(ctx, procedure),
    canDelete: canEdit,
    canAssignAudience: canAssignUserGroups(ctx, procedure.group_id),
  };
}

function publicImage(image) {
  return {
    id: image.id,
    step_id: image.step_id,
    file_name: image.file_name,
    file_size: Number(image.file_size) || 0,
    mime_type: image.mime_type,
    position: image.position,
  };
}

function nestSteps(rows, images) {
  const byStep = new Map();
  for (const image of images) {
    const list = byStep.get(image.step_id) || [];
    list.push(publicImage(image));
    byStep.set(image.step_id, list);
  }

  const nodes = new Map();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      title: row.title,
      body: row.body || '',
      position: row.position,
      images: byStep.get(row.id) || [],
      children: [],
    });
  }

  const roots = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (row.parent_id && nodes.has(row.parent_id)) nodes.get(row.parent_id).children.push(node);
    else roots.push(node);
  }

  const byPos = (a, b) => a.position - b.position;
  roots.sort(byPos);
  for (const root of roots) root.children.sort(byPos);
  return roots;
}

function parseSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  if (rawSteps.length > MAX_STEPS) throw bad('Too many steps.');

  const flat = [];
  const seen = new Set();

  rawSteps.forEach((step, index) => {
    const id = String(step?.id || '').trim();
    if (!UUID_RE.test(id)) throw bad(`Step ${index + 1} has an invalid id.`);
    if (seen.has(id)) throw bad('Duplicate step id.');
    seen.add(id);

    const title = String(step?.title || '').trim();
    if (!title || title.length > 180) throw bad(`Step ${index + 1} needs a title (max 180 characters).`);
    const body = String(step?.body ?? '');
    if (body.length > MAX_BODY) throw bad(`Step "${title}" is too long.`);

    const children = Array.isArray(step?.children) ? step.children : [];
    if (children.length > MAX_CHILDREN) throw bad(`Step "${title}" has too many sub-steps.`);

    flat.push({ id, parent_id: null, title, body, position: 0 });
    children.forEach((child, childIndex) => {
      if (flat.length >= MAX_STEPS) throw bad('Too many steps.');
      const childId = String(child?.id || '').trim();
      if (!UUID_RE.test(childId)) throw bad(`A sub-step of "${title}" has an invalid id.`);
      if (seen.has(childId)) throw bad('Duplicate step id.');
      seen.add(childId);
      if (Array.isArray(child?.children) && child.children.length) {
        throw bad('Sub-steps cannot contain further sub-steps.');
      }
      const childTitle = String(child?.title || '').trim();
      if (!childTitle || childTitle.length > 180) {
        throw bad(`A sub-step of "${title}" needs a title (max 180 characters).`);
      }
      const childBody = String(child?.body ?? '');
      if (childBody.length > MAX_BODY) throw bad(`Sub-step "${childTitle}" is too long.`);
      flat.push({
        id: childId,
        parent_id: id,
        title: childTitle,
        body: childBody,
        position: childIndex,
      });
    });
  });

  let rootPos = 0;
  for (const step of flat) {
    if (!step.parent_id) step.position = rootPos++;
  }
  return flat;
}

async function listAudienceGroups(knex, procedureId) {
  const [users, delegations] = await Promise.all([
    knex('e_process_procedure_audience_groups as a')
      .join('department_groups as g', 'g.id', 'a.group_id')
      .where('a.procedure_id', procedureId)
      .orderBy('g.name_zh', 'asc')
      .select('g.id', knex.raw('COALESCE(g.name_zh, g.name) as name'), 'g.description', knex.raw("'user' as kind")),
    knex('e_process_procedure_audience_delegations as a')
      .join('delegation_groups as g', 'g.id', 'a.delegation_group_id')
      .where('a.procedure_id', procedureId)
      .orderBy('g.name_zh', 'asc')
      .select('g.id', knex.raw('COALESCE(g.name_zh, g.name) as name'), 'g.description', knex.raw("'delegation' as kind")),
  ]);
  return [...users, ...delegations];
}

async function allowedAudienceIds(trx, workGroupId, groupIds) {
  const unique = [...new Set((groupIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return [];
  const allowed = new Set(
    (await trx('e_process_work_group_assignable_groups')
      .where({ work_group_id: workGroupId })
      .whereIn('department_group_id', unique)
      .pluck('department_group_id')).map(Number)
  );
  if (unique.some((id) => !allowed.has(id))) {
    throw bad('Choose only user groups this work group can assign.');
  }
  return unique;
}

async function allowedDelegationIds(trx, workGroupId, groupIds) {
  const unique = [...new Set((groupIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return [];
  const allowed = new Set(
    (await trx('e_process_work_group_assignable_delegations')
      .where({ work_group_id: workGroupId })
      .whereIn('delegation_group_id', unique)
      .pluck('delegation_group_id')).map(Number)
  );
  if (unique.some((id) => !allowed.has(id))) {
    throw bad('Choose only delegation groups this work group can assign.');
  }
  return unique;
}

async function replaceAudienceGroups(trx, procedureId, workGroupId, groupIds) {
  const groups = await allowedAudienceIds(trx, workGroupId, groupIds);
  await trx('e_process_procedure_audience_groups').where({ procedure_id: procedureId }).del();
  if (!groups.length) return;
  await trx('e_process_procedure_audience_groups').insert(
    groups.map((group_id) => ({
      procedure_id: procedureId,
      group_id,
    }))
  );
}

async function replaceAudienceDelegations(trx, procedureId, workGroupId, groupIds) {
  const groups = await allowedDelegationIds(trx, workGroupId, groupIds);
  await trx('e_process_procedure_audience_delegations').where({ procedure_id: procedureId }).del();
  if (!groups.length) return;
  await trx('e_process_procedure_audience_delegations').insert(
    groups.map((delegation_group_id) => ({
      procedure_id: procedureId,
      delegation_group_id,
    }))
  );
}

async function deleteStored(paths) {
  for (const storedPath of paths) {
    try {
      await fileStorage.deleteFile(storedPath);
    } catch (err) {
      console.error('Procedure image delete error:', err);
    }
  }
}

async function replaceSteps(trx, procedureId, steps) {
  const existing = await trx('e_process_procedure_steps').where({ procedure_id: procedureId }).select('id');
  const existingIds = new Set(existing.map((row) => row.id));
  const incomingIds = new Set(steps.map((step) => step.id));

  const removedIds = existing.filter((row) => !incomingIds.has(row.id)).map((row) => row.id);
  let removedPaths = [];
  if (removedIds.length) {
    removedPaths = await trx('e_process_procedure_images').whereIn('step_id', removedIds).pluck('file_path');
  }

  const freshRoots = steps.filter((step) => !step.parent_id && !existingIds.has(step.id));
  const freshChildren = steps.filter((step) => step.parent_id && !existingIds.has(step.id));
  if (freshRoots.length) {
    await trx('e_process_procedure_steps').insert(
      freshRoots.map((step) => ({
        id: step.id,
        procedure_id: procedureId,
        parent_id: null,
        position: step.position,
        title: step.title,
        body: step.body,
      }))
    );
  }
  if (freshChildren.length) {
    await trx('e_process_procedure_steps').insert(
      freshChildren.map((step) => ({
        id: step.id,
        procedure_id: procedureId,
        parent_id: step.parent_id,
        position: step.position,
        title: step.title,
        body: step.body,
      }))
    );
  }

  for (const step of steps) {
    if (!existingIds.has(step.id)) continue;
    await trx('e_process_procedure_steps').where({ id: step.id, procedure_id: procedureId }).update({
      parent_id: step.parent_id,
      position: step.position,
      title: step.title,
      body: step.body,
      updated_at: trx.fn.now(),
    });
  }

  if (removedIds.length) {
    await trx('e_process_procedure_steps').whereIn('id', removedIds).del();
  }

  return removedPaths;
}

async function loadProcedure(knex, procedureId) {
  const procedure = await knex('e_process_procedures as p')
    .leftJoin('e_process_work_groups as g', 'g.id', 'p.group_id')
    .leftJoin('users as creator', 'creator.id', 'p.created_by')
    .where('p.id', procedureId)
    .select(
      'p.*',
      knex.raw('g.name as group_name'),
      knex.raw("'work' as group_kind"),
      'creator.display_name as created_by_name',
      'creator.employee_number as created_by_username'
    )
    .first();
  if (!procedure) return null;

  const audienceGroups = await listAudienceGroups(knex, procedure.id);
  const stepRows = await knex('e_process_procedure_steps')
    .where({ procedure_id: procedure.id })
    .orderBy('position', 'asc');
  const images = stepRows.length
    ? await knex('e_process_procedure_images')
      .whereIn('step_id', stepRows.map((step) => step.id))
      .orderBy('position', 'asc')
    : [];

  return {
    ...procedure,
    audience_groups: audienceGroups,
    audience_group_ids: audienceGroups.filter((group) => group.kind !== 'delegation').map((group) => group.id),
    audience_delegation_group_ids: audienceGroups.filter((group) => group.kind === 'delegation').map((group) => group.id),
    steps: nestSteps(stepRows, images),
  };
}

function parsePagination(query, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function applyProcedureSearch(query, q) {
  const text = String(q || '').trim();
  if (!text) return query;
  const like = `%${text}%`;
  return query.where(function () {
    this.whereILike('p.name', like)
      .orWhereILike('p.description', like)
      .orWhereILike('g.name', like)
      .orWhereRaw('p.status::text ilike ?', [like])
      .orWhereExists(function () {
        this.select(this.client.raw('1'))
          .from('e_process_procedure_steps as st')
          .whereRaw('st.procedure_id = p.id')
          .where(function () {
            this.whereILike('st.title', like).orWhereILike('st.body', like);
          });
      });
  });
}

function procedureListQuery(knex, ctx, { groupId, q }) {
  let query = knex('e_process_procedures as p')
    .leftJoin('e_process_work_groups as g', 'g.id', 'p.group_id')
    .leftJoin('users as creator', 'creator.id', 'p.created_by');
  query = applyVisibleProcedureFilter(query, ctx);
  if (groupId) query = query.andWhere('p.group_id', groupId);
  return applyProcedureSearch(query, q);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const ctx = req.eProcess;
    const groupFilter = req.query.group_id ? String(req.query.group_id) : null;
    const q = String(req.query.q || '');
    const { page, limit, offset } = parsePagination(req.query);

    const filters = { groupId: groupFilter, q };
    const countRow = await procedureListQuery(knex, ctx, filters).countDistinct({ total: 'p.id' }).first();
    const total = Number(countRow?.total || 0);
    const rows = total
      ? await procedureListQuery(knex, ctx, filters)
        .select(
          'p.*',
          knex.raw('g.name as group_name'),
          'creator.display_name as created_by_name',
          'creator.employee_number as created_by_username',
          knex.raw('(select count(*)::int from e_process_procedure_steps as s where s.procedure_id = p.id) as step_count')
        )
        .orderBy('p.updated_at', 'desc')
        .orderBy('p.name', 'asc')
        .limit(limit)
        .offset(offset)
      : [];

    const procedures = [];
    for (const row of rows) {
      const audienceGroups = row.audience === 'user_groups'
        ? await listAudienceGroups(knex, row.id)
        : [];
      const procedure = withCapabilities(ctx, {
        ...row,
        step_count: Number(row.step_count) || 0,
        audience_groups: audienceGroups,
        audience_group_ids: audienceGroups.filter((group) => group.kind !== 'delegation').map((group) => group.id),
        audience_delegation_group_ids: audienceGroups.filter((group) => group.kind === 'delegation').map((group) => group.id),
      });
      if (procedure.canView) procedures.push(procedure);
    }

    return res.json({
      procedures,
      canCreate: ctx.isSupervisor || (ctx.manageWorkflowGroupIds || []).length > 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const ctx = req.eProcess;
    const groupId = String(req.body?.group_id || '').trim();
    if (!groupId) return res.status(400).json({ message: 'group_id is required.' });

    const group = await knex('e_process_work_groups').where({ id: groupId, closed: false }).first();
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (!canCreateWorkflowInGroup(ctx, groupId)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required for this work group.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 180) {
      return res.status(400).json({ message: 'Procedure name is required (max 180 characters).' });
    }
    const description = String(req.body?.description || '');
    const audience = AUDIENCES.has(req.body?.audience) ? req.body.audience : 'user_groups';
    const groupIds = Array.isArray(req.body?.user_group_ids) ? req.body.user_group_ids : [];
    const delegationIds = Array.isArray(req.body?.delegation_group_ids) ? req.body.delegation_group_ids : [];
    if (audience === 'everyone' && !ctx.isSupervisor) {
      return res.status(403).json({ message: 'Only HR can open a procedure to everyone.' });
    }
    if ((audience === 'user_groups' || groupIds.length > 0) && !canAssignUserGroups(ctx, groupId)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required to choose who can read this procedure.' });
    }

    const procedureId = randomUUID();
    const steps = parseSteps(req.body?.steps || []);
    await knex.transaction(async (trx) => {
      await trx('e_process_procedures').insert({
        id: procedureId,
        group_id: groupId,
        name,
        description,
        created_by: req.user.id,
        audience,
        status: 'draft',
      });
      if (audience === 'user_groups') {
        await replaceAudienceGroups(trx, procedureId, groupId, groupIds);
        await replaceAudienceDelegations(trx, procedureId, groupId, delegationIds);
      }
      if (steps.length) await replaceSteps(trx, procedureId, steps);
    });

    const procedure = await loadProcedure(knex, procedureId);
    return res.status(201).json({ procedure: withCapabilities(ctx, procedure) });
  })
);

router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const procedure = await loadProcedure(knex, req.params.id);
    if (!procedure) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canViewProcedure(req.eProcess, procedure)) {
      return res.status(403).json({ message: 'You do not have access to this procedure.' });
    }

    const imageRows = await knex('e_process_procedure_images as i')
      .join('e_process_procedure_steps as s', 's.id', 'i.step_id')
      .where('s.procedure_id', procedure.id)
      .select('i.id', 'i.file_name', 'i.file_path', 'i.mime_type');

    const files = new Map();
    for (const image of imageRows) {
      let bytes = null;
      if (image.file_path && await fileStorage.exists(image.file_path)) {
        bytes = await fileStorage.readBuffer(image.file_path);
      }
      files.set(image.id, {
        bytes,
        mime: image.mime_type,
        name: image.file_name,
      });
    }

    const pdf = await buildProcedurePdf(procedure, files);
    const downloadName = `${String(procedure.name || 'procedure').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'procedure'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(pdf.length));
    return res.send(pdf);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const procedure = await loadProcedure(knex, req.params.id);
    if (!procedure) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canViewProcedure(req.eProcess, procedure)) {
      return res.status(403).json({ message: 'You do not have access to this procedure.' });
    }
    return res.json({ procedure: withCapabilities(req.eProcess, procedure) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const ctx = req.eProcess;
    const current = await knex('e_process_procedures').where({ id: req.params.id }).first();
    if (!current) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canEditProcedure(ctx, current)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required for this work group.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 180) {
      return res.status(400).json({ message: 'Procedure name is required (max 180 characters).' });
    }
    const description = String(req.body?.description || '');
    const steps = parseSteps(req.body?.steps || []);

    let audience = current.audience;
    let userGroupIds = null;
    let delegationGroupIds = null;
    const touchesAudience = req.body?.audience != null
      || Array.isArray(req.body?.user_group_ids)
      || Array.isArray(req.body?.delegation_group_ids);
    if (touchesAudience) {
      audience = AUDIENCES.has(req.body?.audience) ? req.body.audience : current.audience;
      userGroupIds = Array.isArray(req.body?.user_group_ids) ? req.body.user_group_ids : null;
      delegationGroupIds = Array.isArray(req.body?.delegation_group_ids) ? req.body.delegation_group_ids : null;
      const audienceChanged = audience !== current.audience || userGroupIds != null || delegationGroupIds != null;
      if (audience === 'everyone' && !ctx.isSupervisor) {
        return res.status(403).json({ message: 'Only HR can open a procedure to everyone.' });
      }
      if (audienceChanged && !canAssignUserGroups(ctx, current.group_id)) {
        return res.status(403).json({ message: 'Manage-workflows permission is required to choose who can read this procedure.' });
      }
    }

    let status = current.status;
    if (req.body?.status != null) {
      if (!STATUSES.has(req.body.status)) return res.status(400).json({ message: 'status must be draft or published.' });
      status = req.body.status;
    }
    if (status === 'published' && steps.length === 0) {
      return res.status(400).json({ message: 'Add at least one step before publishing.' });
    }

    const removedPaths = await knex.transaction(async (trx) => {
      await trx('e_process_procedures').where({ id: current.id }).update({
        name,
        description,
        audience,
        status,
        updated_at: trx.fn.now(),
      });
      if (audience === 'everyone') {
        await trx('e_process_procedure_audience_groups').where({ procedure_id: current.id }).del();
        await trx('e_process_procedure_audience_delegations').where({ procedure_id: current.id }).del();
      } else {
        if (userGroupIds) await replaceAudienceGroups(trx, current.id, current.group_id, userGroupIds);
        if (delegationGroupIds) await replaceAudienceDelegations(trx, current.id, current.group_id, delegationGroupIds);
      }
      return replaceSteps(trx, current.id, steps);
    });
    await deleteStored(removedPaths);

    const procedure = await loadProcedure(knex, current.id);
    return res.json({ procedure: withCapabilities(ctx, procedure) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const current = await knex('e_process_procedures').where({ id: req.params.id }).first();
    if (!current) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canEditProcedure(req.eProcess, current)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required for this work group.' });
    }

    const paths = await knex('e_process_procedure_images as i')
      .join('e_process_procedure_steps as s', 's.id', 'i.step_id')
      .where('s.procedure_id', current.id)
      .pluck('i.file_path');
    await knex('e_process_procedures').where({ id: current.id }).del();
    await deleteStored(paths);
    return res.status(204).send();
  })
);

router.post(
  '/:id/steps/:stepId/images',
  eProcessProcedureImageUpload,
  asyncHandler(async (req, res) => {
    const knex = db(req);
    if (!req.file) return res.status(400).json({ message: 'Choose an image or PDF to upload.' });

    const procedure = await knex('e_process_procedures').where({ id: req.params.id }).first();
    if (!procedure) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canEditProcedure(req.eProcess, procedure)) {
      await deleteStored([req.file.path || req.file.storageKey]);
      return res.status(403).json({ message: 'Manage-workflows permission is required for this work group.' });
    }

    const step = await knex('e_process_procedure_steps')
      .where({ id: req.params.stepId, procedure_id: procedure.id })
      .first();
    if (!step) {
      await deleteStored([req.file.path || req.file.storageKey]);
      return res.status(404).json({ message: 'Step not found. Save the procedure, then upload the image.' });
    }

    const countRow = await knex('e_process_procedure_images').where({ step_id: step.id }).count('* as count').first();
    if (Number(countRow.count) >= 12) {
      await deleteStored([req.file.path || req.file.storageKey]);
      return res.status(400).json({ message: 'This step already has 12 files.' });
    }

    const positionRow = await knex('e_process_procedure_images').where({ step_id: step.id }).max('position as max').first();
    const imageId = randomUUID();
    await knex('e_process_procedure_images').insert({
      id: imageId,
      step_id: step.id,
      file_name: String(req.file.originalname || req.file.filename || 'file').slice(0, 255),
      file_path: req.file.path || req.file.storageKey,
      file_size: req.file.size || 0,
      mime_type: req.file.mimetype || 'application/octet-stream',
      position: Number(positionRow?.max ?? -1) + 1,
      uploaded_by_user_id: req.user.id,
    });
    await knex('e_process_procedures').where({ id: procedure.id }).update({ updated_at: knex.fn.now() });

    const image = await knex('e_process_procedure_images').where({ id: imageId }).first();
    return res.status(201).json({ image: publicImage(image) });
  })
);

router.delete(
  '/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const procedure = await knex('e_process_procedures').where({ id: req.params.id }).first();
    if (!procedure) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canEditProcedure(req.eProcess, procedure)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required for this work group.' });
    }

    const image = await knex('e_process_procedure_images as i')
      .join('e_process_procedure_steps as s', 's.id', 'i.step_id')
      .where('i.id', req.params.imageId)
      .andWhere('s.procedure_id', procedure.id)
      .select('i.*')
      .first();
    if (!image) return res.status(404).json({ message: 'Image not found.' });

    await knex('e_process_procedure_images').where({ id: image.id }).del();
    await deleteStored([image.file_path]);
    return res.status(204).send();
  })
);

router.get(
  '/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const procedure = await loadProcedure(knex, req.params.id);
    if (!procedure) return res.status(404).json({ message: 'Procedure not found.' });
    if (!canViewProcedure(req.eProcess, procedure)) {
      return res.status(403).json({ message: 'You do not have access to this procedure.' });
    }

    const image = await knex('e_process_procedure_images as i')
      .join('e_process_procedure_steps as s', 's.id', 'i.step_id')
      .where('i.id', req.params.imageId)
      .andWhere('s.procedure_id', procedure.id)
      .select('i.*')
      .first();
    if (!image) return res.status(404).json({ message: 'Image not found.' });
    if (!(await fileStorage.exists(image.file_path))) {
      return res.status(404).json({ message: 'File not found.' });
    }
    await fileStorage.streamToResponse(res, image.file_path, image.file_name, { inline: true });
  })
);

module.exports = router;
