const knex = require('../../config/database');

class ExtraWorkingHoursDocument {
  static async create(documentData) {
    const [document] = await knex('extra_working_hours_documents').insert(documentData).returning('*');
    return document;
  }

  static async findByApplicationId(applicationId) {
    return await knex('extra_working_hours_documents')
      .leftJoin('users', 'extra_working_hours_documents.uploaded_by_id', 'users.id')
      .select(
        'extra_working_hours_documents.*',
        'users.surname as uploaded_by_surname',
        'users.given_name as uploaded_by_given_name',
        'users.name_zh as uploaded_by_name_zh'
      )
      .where('extra_working_hours_documents.extra_working_hours_application_id', applicationId)
      .orderBy('extra_working_hours_documents.created_at', 'desc');
  }

  static async findById(id) {
    return await knex('extra_working_hours_documents')
      .leftJoin('users', 'extra_working_hours_documents.uploaded_by_id', 'users.id')
      .select(
        'extra_working_hours_documents.*',
        'users.surname as uploaded_by_surname',
        'users.given_name as uploaded_by_given_name',
        'users.name_zh as uploaded_by_name_zh'
      )
      .where('extra_working_hours_documents.id', id)
      .first();
  }

  static async delete(id) {
    return await knex('extra_working_hours_documents').where('id', id).delete();
  }
}

module.exports = ExtraWorkingHoursDocument;

