const knex = require('../../config/database');
const User = require('./User');

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

    // 過濾邏輯：顯示所有員工的消息，或者用戶所屬部門群組的消息，或者用戶通過 delegation group 關聯的部門群組的消息
    if (userId) {
      // HR Group 成員可以不受限制看到所有消息
      const isHRMember = await User.isHRMember(userId);
      if (!isHRMember) {
        // 非 HR 成員需要應用過濾條件
        // 獲取用戶直接所屬的部門群組 ID（通過檢查 user_ids 數組）
        const directDepartmentGroups = await knex('department_groups')
          .whereRaw('? = ANY(user_ids)', [Number(userId)])
          .where('closed', false)
          .select('id');
        
        const directDepartmentGroupIds = directDepartmentGroups.map(g => Number(g.id));

        // 獲取用戶通過 delegation group 關聯的部門群組 ID
        // 獲取用戶所屬的授權群組
        const userDelegationGroups = await knex('delegation_groups')
          .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
          .where('closed', false)
          .select('id');
        
        const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));
        
        // 獲取所有未關閉的部門群組，找出用戶通過 delegation group 可以訪問的群組
        let accessibleViaDelegationGroupIds = [];
        if (userDelegationGroupIds.length > 0) {
          const allDepartmentGroups = await knex('department_groups')
            .where('closed', false)
            .select('id', 'checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id');
          
          const accessibleViaDelegation = allDepartmentGroups.filter(deptGroup => {
            const checkerId = deptGroup.checker_id ? Number(deptGroup.checker_id) : null;
            const approver1Id = deptGroup.approver_1_id ? Number(deptGroup.approver_1_id) : null;
            const approver2Id = deptGroup.approver_2_id ? Number(deptGroup.approver_2_id) : null;
            const approver3Id = deptGroup.approver_3_id ? Number(deptGroup.approver_3_id) : null;

            return userDelegationGroupIds.includes(checkerId) ||
                   userDelegationGroupIds.includes(approver1Id) ||
                   userDelegationGroupIds.includes(approver2Id) ||
                   userDelegationGroupIds.includes(approver3Id);
          });
          
          accessibleViaDelegationGroupIds = accessibleViaDelegation.map(g => Number(g.id));
        }

        // 合併直接所屬和通過 delegation group 關聯的部門群組 ID
        const allAccessibleGroupIds = [...new Set([...directDepartmentGroupIds, ...accessibleViaDelegationGroupIds])];

        query = query.where(function() {
          // 顯示發送給所有員工的消息
          this.where('news.is_all_employees', true);
          
          // 如果用戶屬於某些部門群組（直接或通過 delegation group），也顯示發送給這些群組的消息
          if (allAccessibleGroupIds.length > 0) {
            // 使用 PostgreSQL 數組交集運算符檢查 group_ids 是否包含用戶可訪問的任何群組
            // 將用戶群組 ID 數組轉換為 PostgreSQL 數組格式
            const userGroupIdsArray = `{${allAccessibleGroupIds.join(',')}}`;
            this.orWhereRaw(`news.group_ids && '${userGroupIdsArray}'::integer[]`);
          }
        });
      }
      // 如果是 HR 成員，不應用任何過濾條件，返回所有消息
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
      // HR Group 成員可以不受限制看到所有消息
      const isHRMember = await User.isHRMember(userId);
      if (!isHRMember) {
        // 獲取用戶直接所屬的部門群組 ID（通過檢查 user_ids 數組）
        const directDepartmentGroups = await knex('department_groups')
          .whereRaw('? = ANY(user_ids)', [Number(userId)])
          .where('closed', false)
          .select('id');
        
        const directDepartmentGroupIds = directDepartmentGroups.map(g => Number(g.id));

        // 獲取用戶通過 delegation group 關聯的部門群組 ID
        // 獲取用戶所屬的授權群組
        const userDelegationGroups = await knex('delegation_groups')
          .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
          .where('closed', false)
          .select('id');
        
        const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));
        
        // 獲取所有未關閉的部門群組，找出用戶通過 delegation group 可以訪問的群組
        let accessibleViaDelegationGroupIds = [];
        if (userDelegationGroupIds.length > 0) {
          const allDepartmentGroups = await knex('department_groups')
            .where('closed', false)
            .select('id', 'checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id');
          
          const accessibleViaDelegation = allDepartmentGroups.filter(deptGroup => {
            const checkerId = deptGroup.checker_id ? Number(deptGroup.checker_id) : null;
            const approver1Id = deptGroup.approver_1_id ? Number(deptGroup.approver_1_id) : null;
            const approver2Id = deptGroup.approver_2_id ? Number(deptGroup.approver_2_id) : null;
            const approver3Id = deptGroup.approver_3_id ? Number(deptGroup.approver_3_id) : null;

            return userDelegationGroupIds.includes(checkerId) ||
                   userDelegationGroupIds.includes(approver1Id) ||
                   userDelegationGroupIds.includes(approver2Id) ||
                   userDelegationGroupIds.includes(approver3Id);
          });
          
          accessibleViaDelegationGroupIds = accessibleViaDelegation.map(g => Number(g.id));
        }

        // 合併直接所屬和通過 delegation group 關聯的部門群組 ID
        const allAccessibleGroupIds = [...new Set([...directDepartmentGroupIds, ...accessibleViaDelegationGroupIds])];

        let hasPermission = news.is_all_employees;
        
        if (!hasPermission && allAccessibleGroupIds.length > 0) {
          // 使用 PostgreSQL 數組交集運算符檢查 group_ids 是否包含用戶可訪問的任何群組
          const userGroupIdsArray = `{${allAccessibleGroupIds.join(',')}}`;
          const matchingNews = await knex('news')
            .where('id', id)
            .whereRaw(`group_ids && '${userGroupIdsArray}'::integer[]`)
            .first();
          
          hasPermission = !!matchingNews;
        }

        if (!hasPermission) {
          return null;
        }
      }
      // 如果是 HR 成員，直接允許查看，不進行任何權限檢查
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

