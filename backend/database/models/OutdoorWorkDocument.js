const knex = require('../../config/database');

class OutdoorWorkDocument {
  static async create(documentData) {
    const [document] = await knex('outdoor_work_documents').insert(documentData).returning('*');
    return document;
  }

  static async findByApplicationId(applicationId) {
    return await knex('outdoor_work_documents')
      .leftJoin('users', 'outdoor_work_documents.uploaded_by_id', 'users.id')
      .select(
        'outdoor_work_documents.*',
        'users.surname as uploaded_by_surname',
        'users.given_name as uploaded_by_given_name',
        'users.name_zh as uploaded_by_name_zh'
      )
      .where('outdoor_work_documents.outdoor_work_application_id', applicationId)
      .orderBy('outdoor_work_documents.created_at', 'desc');
  }

  static async findById(id) {
    return await knex('outdoor_work_documents')
      .leftJoin('users', 'outdoor_work_documents.uploaded_by_id', 'users.id')
      .select(
        'outdoor_work_documents.*',
        'users.surname as uploaded_by_surname',
        'users.given_name as uploaded_by_given_name',
        'users.name_zh as uploaded_by_name_zh'
      )
      .where('outdoor_work_documents.id', id)
      .first();
  }

  static async delete(id) {
    return await knex('outdoor_work_documents').where('id', id).delete();
  }
}

module.exports = OutdoorWorkDocument;

