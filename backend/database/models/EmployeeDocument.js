const knex = require('../../config/database');

class EmployeeDocument {
  static async findAll(options = {}) {
    let query = knex('employee_documents')
      .leftJoin('users as recipient', 'employee_documents.user_id', 'recipient.id')
      .leftJoin('users as uploader', 'employee_documents.uploaded_by_id', 'uploader.id')
      .leftJoin('departments as recipient_dept', 'recipient.department_id', 'recipient_dept.id')
      .leftJoin('positions as recipient_pos', 'recipient.position_id', 'recipient_pos.id')
      .select(
        'employee_documents.*',
        'recipient.employee_number as recipient_employee_number',
        'recipient.surname as recipient_surname',
        'recipient.given_name as recipient_given_name',
        'recipient.display_name as recipient_display_name',
        'recipient.email as recipient_email',
        'recipient_dept.name as recipient_department_name',
        'recipient_dept.name_zh as recipient_department_name_zh',
        'recipient_pos.name as recipient_position_name',
        'recipient_pos.name_zh as recipient_position_name_zh',
        'uploader.employee_number as uploader_employee_number',
        'uploader.display_name as uploader_display_name',
        'uploader.email as uploader_email'
      );

    if (options.user_id) {
      query = query.where('employee_documents.user_id', options.user_id);
    }

    if (options.uploaded_by_id) {
      query = query.where('employee_documents.uploaded_by_id', options.uploaded_by_id);
    }

    if (options.category) {
      query = query.where('employee_documents.category', options.category);
    }

    if (options.search) {
      query = query.where(function() {
        this.where('employee_documents.display_name', 'like', `%${options.search}%`)
          .orWhere('employee_documents.file_name', 'like', `%${options.search}%`)
          .orWhere('recipient.display_name', 'like', `%${options.search}%`)
          .orWhere('recipient.employee_number', 'like', `%${options.search}%`);
      });
    }

    // 根據部門群組過濾
    if (options.department_group_id) {
      try {
        // 獲取該群組的所有用戶ID
        const group = await knex('department_groups')
          .where('id', options.department_group_id)
          .first();
        
        if (group && group.user_ids) {
          // 解析 user_ids 數組
          let userIds = group.user_ids;
          if (typeof userIds === 'string') {
            try {
              userIds = JSON.parse(userIds);
            } catch (e) {
              userIds = userIds.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
            }
          }
          
          if (Array.isArray(userIds) && userIds.length > 0) {
            query = query.whereIn('employee_documents.user_id', userIds);
          } else {
            // 如果群組沒有成員，返回空結果
            query = query.where('employee_documents.user_id', -1);
          }
        } else {
          // 如果群組不存在或沒有成員，返回空結果
          query = query.where('employee_documents.user_id', -1);
        }
      } catch (error) {
        console.error('Error filtering by department group:', error);
        // 發生錯誤時返回空結果
        query = query.where('employee_documents.user_id', -1);
      }
    }

    return await query.orderBy('employee_documents.id', 'desc');
  }

  static async findById(id) {
    const document = await knex('employee_documents')
      .leftJoin('users as recipient', 'employee_documents.user_id', 'recipient.id')
      .leftJoin('users as uploader', 'employee_documents.uploaded_by_id', 'uploader.id')
      .leftJoin('departments as recipient_dept', 'recipient.department_id', 'recipient_dept.id')
      .leftJoin('positions as recipient_pos', 'recipient.position_id', 'recipient_pos.id')
      .select(
        'employee_documents.*',
        'recipient.employee_number as recipient_employee_number',
        'recipient.surname as recipient_surname',
        'recipient.given_name as recipient_given_name',
        'recipient.display_name as recipient_display_name',
        'recipient.email as recipient_email',
        'recipient_dept.name as recipient_department_name',
        'recipient_dept.name_zh as recipient_department_name_zh',
        'recipient_pos.name as recipient_position_name',
        'recipient_pos.name_zh as recipient_position_name_zh',
        'uploader.employee_number as uploader_employee_number',
        'uploader.display_name as uploader_display_name',
        'uploader.email as uploader_email'
      )
      .where('employee_documents.id', id)
      .first();

    return document;
  }

  static async create(documentData) {
    const [document] = await knex('employee_documents').insert(documentData).returning('*');
    return await this.findById(document.id);
  }

  static async update(id, documentData) {
    await knex('employee_documents').where('id', id).update(documentData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('employee_documents').where('id', id).del();
  }

  // 獲取所有文件類別（固定列表）
  static async getCategories() {
    // 返回固定的類別列表
    return [
      'Salary Advice',
      'IR56B',
      'IR56F',
      'IR56G',
      'Service Letter',
      'Others'
    ];
  }
}

module.exports = EmployeeDocument;

