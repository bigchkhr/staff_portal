const knex = require('../../config/database');

class LeaveDocument {
  static async create(documentData) {
    const [document] = await knex('leave_documents').insert(documentData).returning('*');
    return document;
  }

  static async findByApplicationId(applicationId) {
    return await knex('leave_documents')
      .leftJoin('users', 'leave_documents.uploaded_by_id', 'users.id')
      .select(
        'leave_documents.*',
        'users.surname as uploaded_by_surname',
        'users.given_name as uploaded_by_given_name',
        'users.name_zh as uploaded_by_name_zh'
      )
      .where('leave_documents.leave_application_id', applicationId)
      .orderBy('leave_documents.created_at', 'desc');
  }

  static async findById(id) {
    return await knex('leave_documents')
      .leftJoin('users', 'leave_documents.uploaded_by_id', 'users.id')
      .select(
        'leave_documents.*',
        'users.surname as uploaded_by_surname',
        'users.given_name as uploaded_by_given_name',
        'users.name_zh as uploaded_by_name_zh'
      )
      .where('leave_documents.id', id)
      .first();
  }

  static async delete(id) {
    return await knex('leave_documents').where('id', id).delete();
  }
}

module.exports = LeaveDocument;
