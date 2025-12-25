const knex = require('../../config/database');

class FormLibrary {
  // 獲取所有表單（根據visible_to_users過濾）
  static async findAll(options = {}) {
    let query = knex('form_library')
      .leftJoin('users as uploader', 'form_library.uploaded_by_id', 'uploader.id')
      .select(
        'form_library.*',
        'uploader.employee_number as uploader_employee_number',
        'uploader.display_name as uploader_display_name',
        'uploader.email as uploader_email'
      );

    // 如果不是HR，只顯示visible_to_users為true的表單
    if (options.onlyVisible !== false) {
      query = query.where('form_library.visible_to_users', true);
    }

    // 搜索功能
    if (options.search) {
      query = query.where(function() {
        this.where('form_library.display_name', 'like', `%${options.search}%`)
          .orWhere('form_library.file_name', 'like', `%${options.search}%`)
          .orWhere('form_library.description', 'like', `%${options.search}%`);
      });
    }

    return await query.orderBy('form_library.created_at', 'desc');
  }

  // 根據ID查找表單
  static async findById(id) {
    const form = await knex('form_library')
      .leftJoin('users as uploader', 'form_library.uploaded_by_id', 'uploader.id')
      .select(
        'form_library.*',
        'uploader.employee_number as uploader_employee_number',
        'uploader.display_name as uploader_display_name',
        'uploader.email as uploader_email'
      )
      .where('form_library.id', id)
      .first();

    return form;
  }

  // 創建新表單
  static async create(formData) {
    const [form] = await knex('form_library').insert(formData).returning('*');
    return await this.findById(form.id);
  }

  // 更新表單
  static async update(id, formData) {
    await knex('form_library').where('id', id).update(formData);
    return await this.findById(id);
  }

  // 刪除表單
  static async delete(id) {
    return await knex('form_library').where('id', id).del();
  }
}

module.exports = FormLibrary;

