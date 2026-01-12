const knex = require('../../config/database');

class ChatMessage {
  static async findByRoomId(roomId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    let query = knex('chat_messages')
      .where('chat_room_id', roomId)
      .innerJoin('users', 'chat_messages.user_id', 'users.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'chat_messages.*',
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
      .orderBy('chat_messages.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return await query;
  }

  static async findById(id) {
    try {
      const message = await knex('chat_messages')
        .where('chat_messages.id', id)
        .innerJoin('users', 'chat_messages.user_id', 'users.id')
        .leftJoin('departments', 'users.department_id', 'departments.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .select(
          'chat_messages.*',
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
        .first();
      
      return message;
    } catch (error) {
      console.error('[ChatMessage.findById] Error:', error);
      // 如果 join 失敗，嘗試返回基本訊息
      const basicMessage = await knex('chat_messages')
        .where('id', id)
        .first();
      return basicMessage;
    }
  }

  static async create(messageData) {
    const [message] = await knex('chat_messages').insert(messageData).returning('*');
    if (!message || !message.id) {
      throw new Error('Failed to create chat message');
    }
    // 嘗試獲取完整訊息（包含用戶信息），如果失敗則返回基本訊息
    try {
      return await this.findById(message.id);
    } catch (error) {
      console.warn('Failed to fetch full message details, returning basic message:', error);
      return message;
    }
  }

  static async delete(id) {
    return await knex('chat_messages').where('id', id).delete();
  }

  // 獲取聊天室的訊息總數
  static async countByRoomId(roomId) {
    const result = await knex('chat_messages')
      .where('chat_room_id', roomId)
      .count('* as count')
      .first();
    return parseInt(result.count);
  }
}

module.exports = ChatMessage;

