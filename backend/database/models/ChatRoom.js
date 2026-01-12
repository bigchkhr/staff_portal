const knex = require('../../config/database');

class ChatRoom {
  static async findAll(userId = null) {
    let query = knex('chat_rooms')
      .select(
        'chat_rooms.*',
        knex.raw('(SELECT COUNT(*) FROM chat_room_members WHERE chat_room_members.chat_room_id = chat_rooms.id) as member_count')
      )
      .orderBy('chat_rooms.created_at', 'desc');

    // 如果提供了 userId，只返回該用戶加入的聊天室
    if (userId) {
      query = query
        .innerJoin('chat_room_members', 'chat_rooms.id', 'chat_room_members.chat_room_id')
        .where('chat_room_members.user_id', userId)
        .groupBy('chat_rooms.id');
    }

    return await query;
  }

  static async findById(id) {
    return await knex('chat_rooms').where('id', id).first();
  }

  static async create(roomData) {
    const [room] = await knex('chat_rooms').insert(roomData).returning('*');
    return room;
  }

  static async update(id, roomData) {
    await knex('chat_rooms').where('id', id).update(roomData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('chat_rooms').where('id', id).delete();
  }

  // 檢查用戶是否為聊天室成員
  static async isMember(roomId, userId) {
    const member = await knex('chat_room_members')
      .where('chat_room_id', roomId)
      .where('user_id', userId)
      .first();
    return !!member;
  }

  // 檢查用戶是否為聊天室管理員（HR Group 成員）
  static async isAdmin(roomId, userId) {
    const member = await knex('chat_room_members')
      .where('chat_room_id', roomId)
      .where('user_id', userId)
      .where('is_admin', true)
      .first();
    return !!member;
  }

  // 獲取聊天室的所有成員
  static async getMembers(roomId) {
    return await knex('chat_room_members')
      .where('chat_room_id', roomId)
      .innerJoin('users', 'chat_room_members.user_id', 'users.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'chat_room_members.*',
        'users.id as user_id',
        'users.employee_number',
        'users.surname',
        'users.given_name',
        'users.display_name',
        'users.email',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      )
      .orderBy('chat_room_members.is_admin', 'desc')
      .orderBy('users.display_name', 'asc');
  }

  // 添加成員到聊天室
  static async addMember(roomId, userId, isAdmin = false) {
    const [member] = await knex('chat_room_members')
      .insert({
        chat_room_id: roomId,
        user_id: userId,
        is_admin: isAdmin
      })
      .returning('*');
    return member;
  }

  // 從聊天室移除成員
  static async removeMember(roomId, userId) {
    return await knex('chat_room_members')
      .where('chat_room_id', roomId)
      .where('user_id', userId)
      .delete();
  }

  // 更新用戶最後讀取時間
  static async updateLastReadAt(roomId, userId) {
    return await knex('chat_room_members')
      .where('chat_room_id', roomId)
      .where('user_id', userId)
      .update({ last_read_at: knex.fn.now() });
  }

  // 獲取用戶的未讀訊息數量（所有聊天室）
  static async getUnreadCount(userId) {
    const rooms = await knex('chat_room_members')
      .where('user_id', userId)
      .select('chat_room_id', 'last_read_at');

    let totalUnread = 0;
    for (const room of rooms) {
      const lastReadAt = room.last_read_at;
      const query = knex('chat_messages')
        .where('chat_room_id', room.chat_room_id)
        .where('user_id', '!=', userId); // 只計算別人發送的訊息

      if (lastReadAt) {
        query.where('created_at', '>', lastReadAt);
      }

      const count = await query.count('* as count').first();
      const unreadCount = parseInt(count.count) || 0;
      totalUnread += unreadCount;
    }

    return totalUnread;
  }

  // 獲取用戶每個聊天室的未讀訊息數量
  static async getUnreadCountsByRoom(userId) {
    const rooms = await knex('chat_room_members')
      .where('user_id', userId)
      .select('chat_room_id', 'last_read_at');

    const unreadCounts = {};
    for (const room of rooms) {
      const lastReadAt = room.last_read_at;
      const query = knex('chat_messages')
        .where('chat_room_id', room.chat_room_id)
        .where('user_id', '!=', userId); // 只計算別人發送的訊息

      if (lastReadAt) {
        query.where('created_at', '>', lastReadAt);
      }

      const count = await query.count('* as count').first();
      unreadCounts[room.chat_room_id] = parseInt(count.count) || 0;
    }

    return unreadCounts;
  }
}

module.exports = ChatRoom;

