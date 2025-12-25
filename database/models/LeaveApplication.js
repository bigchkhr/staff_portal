const knex = require('../../config/database');

class LeaveApplication {
  static async create(applicationData) {
    const [application] = await knex('leave_applications').insert(applicationData).returning('*');
    return await this.findById(application.id);
  }

  static async findById(id) {
    const application = await knex('leave_applications')
      .leftJoin('users as applicant', 'leave_applications.applicant_id', 'applicant.id')
      .leftJoin('users as applied_by', 'leave_applications.applied_by_id', 'applied_by.id')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .select(
        'leave_applications.*',
        'applicant.employee_number as applicant_employee_number',
        'applicant.surname as applicant_surname',
        'applicant.given_name as applicant_given_name',
        'applicant.name_zh as applicant_name_zh',
        'applied_by.employee_number as applied_by_employee_number',
        'applied_by.surname as applied_by_surname',
        'applied_by.given_name as applied_by_given_name',
        'applied_by.name_zh as applied_by_name_zh',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'leave_types.requires_balance as leave_type_requires_balance'
      )
      .where('leave_applications.id', id)
      .first();
    
    if (application) {
      application.documents = await knex('leave_documents')
        .where('leave_application_id', id);
    }
    
    return application;
  }

  static async findByTransactionId(transactionId) {
    const application = await knex('leave_applications')
      .leftJoin('users as applicant', 'leave_applications.applicant_id', 'applicant.id')
      .leftJoin('users as applied_by', 'leave_applications.applied_by_id', 'applied_by.id')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .select(
        'leave_applications.*',
        'applicant.employee_number as applicant_employee_number',
        'applicant.surname as applicant_surname',
        'applicant.given_name as applicant_given_name',
        'applicant.name_zh as applicant_name_zh',
        'applied_by.employee_number as applied_by_employee_number',
        'applied_by.surname as applied_by_surname',
        'applied_by.given_name as applied_by_given_name',
        'applied_by.name_zh as applied_by_name_zh',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'leave_types.requires_balance as leave_type_requires_balance'
      )
      .where('leave_applications.transaction_id', transactionId)
      .first();
    
    if (application) {
      application.documents = await knex('leave_documents')
        .where('leave_application_id', application.id);
    }
    
    return application;
  }

  static async findAll(options = {}) {
    let query = knex('leave_applications')
      .leftJoin('users as applicant', 'leave_applications.applicant_id', 'applicant.id')
      .leftJoin('users as applied_by', 'leave_applications.applied_by_id', 'applied_by.id')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .select(
        'leave_applications.*',
        'applicant.employee_number as applicant_employee_number',
        'applicant.surname as applicant_surname',
        'applicant.given_name as applicant_given_name',
        'applicant.name_zh as applicant_name_zh',
        'applied_by.employee_number as applied_by_employee_number',
        'applied_by.surname as applied_by_surname',
        'applied_by.given_name as applied_by_given_name',
        'applied_by.name_zh as applied_by_name_zh',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'leave_types.requires_balance as leave_type_requires_balance'
      );

    if (options.applicant_id) {
      query = query.where('leave_applications.applicant_id', options.applicant_id);
    }

    if (options.status) {
      query = query.where('leave_applications.status', options.status);
    }

    if (options.leave_type_id) {
      query = query.where('leave_applications.leave_type_id', options.leave_type_id);
    }

    if (options.transaction_id) {
      query = query.where('leave_applications.transaction_id', options.transaction_id);
    }

    if (options.approver_id) {
      query = query.where(function() {
        this.where('leave_applications.checker_id', options.approver_id)
          .orWhere('leave_applications.approver_1_id', options.approver_id)
          .orWhere('leave_applications.approver_2_id', options.approver_id)
          .orWhere('leave_applications.approver_3_id', options.approver_id);
      });
    }

    return await query.orderBy('leave_applications.created_at', 'desc');
  }

  static async update(id, updateData) {
    await knex('leave_applications').where('id', id).update(updateData);
    return await this.findById(id);
  }

  static generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `LV${timestamp}${random}`;
  }
}

module.exports = LeaveApplication;
