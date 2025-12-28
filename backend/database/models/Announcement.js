const knex = require('../../config/database');

class Announcement {
  static async findAll(options = {}) {
    let query = knex('announcements')
      .leftJoin('users as creator', 'announcements.created_by_id', 'creator.id')
      .select(
        'announcements.*',
        'creator.employee_number as creator_employee_number',
        'creator.display_name as creator_display_name',
        'creator.email as creator_email'
      );

    // 按置頂和創建時間排序：置頂的在前，然後按創建時間倒序
    query = query.orderBy([
      { column: 'announcements.is_pinned', order: 'desc' },
      { column: 'announcements.created_at', order: 'desc' }
    ]);

    const announcements = await query;
    
    // 為每個公告獲取附件數量
    for (const announcement of announcements) {
      const attachmentCount = await knex('announcement_attachments')
        .where('announcement_id', announcement.id)
        .count('id as count')
        .first();
      // PostgreSQL 的 count 返回格式可能是 { count: '0' } 或 { count: 0 }
      const countValue = attachmentCount?.count;
      announcement.attachment_count = typeof countValue === 'string' ? parseInt(countValue, 10) : (countValue || 0);
    }

    return announcements;
  }

  static async findById(id) {
    const announcement = await knex('announcements')
      .leftJoin('users as creator', 'announcements.created_by_id', 'creator.id')
      .select(
        'announcements.*',
        'creator.employee_number as creator_employee_number',
        'creator.display_name as creator_display_name',
        'creator.email as creator_email'
      )
      .where('announcements.id', id)
      .first();

    if (announcement) {
      // 獲取附件列表
      const attachments = await knex('announcement_attachments')
        .leftJoin('users as uploader', 'announcement_attachments.uploaded_by_id', 'uploader.id')
        .select(
          'announcement_attachments.*',
          'uploader.display_name as uploader_display_name',
          'uploader.email as uploader_email'
        )
        .where('announcement_attachments.announcement_id', id)
        .orderBy('announcement_attachments.created_at', 'asc');
      
      announcement.attachments = attachments;
    }

    return announcement;
  }

  static async create(announcementData) {
    const [announcement] = await knex('announcements').insert(announcementData).returning('*');
    return await this.findById(announcement.id);
  }

  static async update(id, announcementData) {
    await knex('announcements').where('id', id).update(announcementData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('announcements').where('id', id).del();
  }
}

module.exports = Announcement;

