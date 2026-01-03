const knex = require('../../config/database');

class ExternalLink {
  // 獲取所有外部連結
  static async findAll(options = {}) {
    let query = knex('external_links')
      .leftJoin('users as creator', 'external_links.created_by_id', 'creator.id')
      .leftJoin('users as updater', 'external_links.updated_by_id', 'updater.id')
      .select(
        'external_links.*',
        'creator.display_name as creator_display_name',
        'creator.email as creator_email',
        'updater.display_name as updater_display_name',
        'updater.email as updater_email'
      );

    // 如果只顯示啟用的連結
    if (options.onlyActive !== false) {
      query = query.where('external_links.is_active', true);
    }

    // 搜索功能
    if (options.search) {
      query = query.where(function() {
        this.where('external_links.name', 'like', `%${options.search}%`)
          .orWhere('external_links.narrative', 'like', `%${options.search}%`)
          .orWhere('external_links.url', 'like', `%${options.search}%`);
      });
    }

    return await query.orderBy('external_links.display_order', 'asc')
      .orderBy('external_links.created_at', 'desc');
  }

  // 根據ID查找連結
  static async findById(id) {
    const link = await knex('external_links')
      .leftJoin('users as creator', 'external_links.created_by_id', 'creator.id')
      .leftJoin('users as updater', 'external_links.updated_by_id', 'updater.id')
      .select(
        'external_links.*',
        'creator.display_name as creator_display_name',
        'creator.email as creator_email',
        'updater.display_name as updater_display_name',
        'updater.email as updater_email'
      )
      .where('external_links.id', id)
      .first();

    return link;
  }

  // 創建新連結
  static async create(linkData) {
    const [link] = await knex('external_links').insert(linkData).returning('*');
    return await this.findById(link.id);
  }

  // 更新連結
  static async update(id, linkData) {
    await knex('external_links').where('id', id).update(linkData);
    return await this.findById(id);
  }

  // 刪除連結
  static async delete(id) {
    return await knex('external_links').where('id', id).del();
  }
}

module.exports = ExternalLink;


