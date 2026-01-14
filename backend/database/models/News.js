const knex = require('../../config/database');

class News {
  // 獲取用戶可見的最新消息列表
  static async findAll(userId = null) {
    let query = knex('news')
      .leftJoin('users as creator', 'news.created_by_id', 'creator.id')
      .select(
        'news.*',
        'creator.employee_number as creator_employee_number',
        'creator.display_name as creator_display_name',
        'creator.email as creator_email'
      );

    // 過濾邏輯：顯示所有員工的消息，或者用戶所屬消息群組的消息
    if (userId) {
      // 獲取用戶所屬的消息群組 ID（通過檢查 user_ids 數組）
      const newsGroups = await knex('news_groups')
        .whereRaw('? = ANY(user_ids)', [Number(userId)])
        .where('closed', false)
        .select('id');
      
      const userNewsGroupIds = newsGroups.map(g => Number(g.id));

      query = query.where(function() {
        this.where('news.is_all_employees', true);
        
        // 如果用戶屬於某些消息群組，也顯示發送給這些群組的消息
        if (userNewsGroupIds.length > 0) {
          userNewsGroupIds.forEach(groupId => {
            this.orWhereRaw('? = ANY(news.group_ids)', [groupId]);
          });
        }
      });
    } else {
      // 如果沒有用戶 ID，只顯示所有員工的消息
      query = query.where('news.is_all_employees', true);
    }

    // 按置頂和創建時間排序：置頂的在前，然後按創建時間倒序
    query = query.orderBy([
      { column: 'news.is_pinned', order: 'desc' },
      { column: 'news.created_at', order: 'desc' }
    ]);

    const newsList = await query;

    // 為每個消息獲取附件數量
    for (const news of newsList) {
      const attachmentCount = await knex('news_attachments')
        .where('news_id', news.id)
        .count('id as count')
        .first();
      const countValue = attachmentCount?.count;
      news.attachment_count = typeof countValue === 'string' ? parseInt(countValue, 10) : (countValue || 0);
    }

    return newsList;
  }

  // 根據 ID 獲取單個消息
  static async findById(id, userId = null) {
    let query = knex('news')
      .leftJoin('users as creator', 'news.created_by_id', 'creator.id')
      .select(
        'news.*',
        'creator.employee_number as creator_employee_number',
        'creator.display_name as creator_display_name',
        'creator.email as creator_email'
      )
      .where('news.id', id)
      .first();

    const news = await query;

    if (!news) {
      return null;
    }

    // 檢查用戶是否有權限查看此消息
    if (userId) {
      const newsGroups = await knex('news_groups')
        .whereRaw('? = ANY(user_ids)', [Number(userId)])
        .where('closed', false)
        .select('id');
      
      const userNewsGroupIds = newsGroups.map(g => Number(g.id));

      let hasPermission = news.is_all_employees;
      
      if (!hasPermission && userNewsGroupIds.length > 0) {
        // 使用更簡單的方式：直接查詢數據庫檢查權限
        const matchingNews = await knex('news')
          .where('id', id)
          .where(function() {
            this.where('is_all_employees', true)
              .orWhere(function() {
                userNewsGroupIds.forEach(groupId => {
                  this.orWhereRaw('? = ANY(group_ids)', [groupId]);
                });
              });
          })
          .first();
        
        hasPermission = !!matchingNews;
      }

      if (!hasPermission) {
        return null;
      }
    } else {
      // 如果沒有用戶 ID，只返回所有員工的消息
      if (!news.is_all_employees) {
        return null;
      }
    }

    // 獲取附件列表
    const attachments = await knex('news_attachments')
      .where('news_id', news.id)
      .select('*')
      .orderBy('created_at', 'asc');

    news.attachments = attachments;
    news.attachment_count = attachments.length;

    return news;
  }

  // 創建新消息
  static async create(newsData) {
    const [news] = await knex('news')
      .insert({
        title: newsData.title,
        content: newsData.content,
        created_by_id: newsData.created_by_id,
        is_pinned: newsData.is_pinned || false,
        is_all_employees: newsData.is_all_employees !== undefined ? newsData.is_all_employees : false,
        group_ids: newsData.is_all_employees ? [] : (newsData.group_ids && newsData.group_ids.length > 0 ? newsData.group_ids : [])
      })
      .returning('*');
    
    return news;
  }

  // 更新消息
  static async update(id, newsData) {
    const [news] = await knex('news')
      .where('id', id)
      .update({
        title: newsData.title,
        content: newsData.content,
        is_pinned: newsData.is_pinned || false,
        is_all_employees: newsData.is_all_employees !== undefined ? newsData.is_all_employees : false,
        group_ids: newsData.is_all_employees ? [] : (newsData.group_ids && newsData.group_ids.length > 0 ? newsData.group_ids : []),
        updated_at: knex.fn.now()
      })
      .returning('*');
    
    return news;
  }

  // 刪除消息
  static async delete(id) {
    await knex('news').where('id', id).del();
    return true;
  }
}

module.exports = News;

