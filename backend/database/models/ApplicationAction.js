const knex = require('../../config/database');

class ApplicationAction {
  static async create(data, trx = knex) {
    const [row] = await trx('application_actions').insert(data).returning('*');
    return row;
  }

  static async listByApplication(applicationType, applicationId) {
    return knex('application_actions')
      .leftJoin('users', 'application_actions.actor_id', 'users.id')
      .where({
        application_type: applicationType,
        application_id: applicationId
      })
      .select(
        'application_actions.*',
        'users.display_name as actor_display_name',
        'users.employee_number as actor_employee_number'
      )
      .orderBy('application_actions.created_at', 'asc');
  }

  static async attachLatestReturns(applications) {
    if (!applications || applications.length === 0) {
      return applications || [];
    }

    const idsByType = {};
    applications.forEach((app) => {
      const type = app.application_type || 'leave';
      if (!idsByType[type]) idsByType[type] = [];
      idsByType[type].push(app.id);
    });

    const latest = {};
    for (const [type, ids] of Object.entries(idsByType)) {
      const rows = await knex('application_actions')
        .leftJoin('users', 'application_actions.actor_id', 'users.id')
        .where('application_actions.application_type', type)
        .where('application_actions.action', 'returned')
        .whereIn('application_actions.application_id', ids)
        .select(
          'application_actions.*',
          'users.display_name as actor_display_name'
        )
        .orderBy('application_actions.created_at', 'desc');

      rows.forEach((row) => {
        const key = `${type}:${row.application_id}`;
        if (!latest[key]) latest[key] = row;
      });
    }

    return applications.map((app) => {
      const type = app.application_type || 'leave';
      const row = latest[`${type}:${app.id}`];
      if (!row || row.to_stage !== app.current_approval_stage) {
        return app;
      }
      return {
        ...app,
        return_reason: row.reason,
        returned_from_stage: row.from_stage,
        returned_by_name: row.actor_display_name || null
      };
    });
  }
}

module.exports = ApplicationAction;
