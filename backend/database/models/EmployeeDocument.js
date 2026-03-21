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

    // 根據部門群組過濾（支援單選與多選）
    const departmentGroupIdSet = new Set();
    if (options.department_group_id) {
      const n = parseInt(options.department_group_id, 10);
      if (!isNaN(n) && n > 0) departmentGroupIdSet.add(n);
    }
    if (options.department_group_ids) {
      String(options.department_group_ids).split(',').forEach((s) => {
        const n = parseInt(s.trim(), 10);
        if (!isNaN(n) && n > 0) departmentGroupIdSet.add(n);
      });
    }

    if (departmentGroupIdSet.size > 0) {
      try {
        const groups = await knex('department_groups').whereIn('id', Array.from(departmentGroupIdSet));
        const mergedUserIds = new Set();

        for (const group of groups) {
          if (!group || !group.user_ids) continue;
          let userIds = group.user_ids;
          if (typeof userIds === 'string') {
            try {
              userIds = JSON.parse(userIds);
            } catch (e) {
              userIds = userIds.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
            }
          }
          if (Array.isArray(userIds)) {
            userIds.forEach((id) => {
              const uid = parseInt(id, 10);
              if (!isNaN(uid) && uid > 0) mergedUserIds.add(uid);
            });
          }
        }

        if (mergedUserIds.size > 0) {
          query = query.whereIn('employee_documents.user_id', Array.from(mergedUserIds));
        } else {
          query = query.where('employee_documents.user_id', -1);
        }
      } catch (error) {
        console.error('Error filtering by department group:', error);
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

