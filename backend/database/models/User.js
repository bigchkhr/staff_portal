const knex = require('../../config/database');

class User {
  static async findByEmail(email) {
    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      )
      .where('users.email', email)
      .first();
  }

  static async findById(id) {
    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      )
      .where('users.id', id)
      .first();
  }

  static async create(userData) {
    const [user] = await knex('users').insert(userData).returning('*');
    return await this.findById(user.id);
  }

  static async update(id, userData) {
    await knex('users').where('id', id).update(userData);
    return await this.findById(id);
  }

  static async updatePassword(id, passwordHash) {
    return await knex('users').where('id', id).update({ password_hash: passwordHash });
  }

  static async findAll(options = {}) {
    let query = knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      );

    if (options.department_id) {
      query = query.where('users.department_id', options.department_id);
    }

    if (options.search) {
      query = query.where(function() {
        this.where('users.employee_number', 'like', `%${options.search}%`)
          .orWhere('users.surname', 'like', `%${options.search}%`)
          .orWhere('users.given_name', 'like', `%${options.search}%`)
          .orWhere('users.display_name', 'like', `%${options.search}%`)
          .orWhere('users.email', 'like', `%${options.search}%`);
      });
    }

    return await query.orderBy('users.created_at', 'desc');
  }

  static async findByEmployeeNumber(employeeNumber) {
    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      )
      .whereRaw('LOWER(users.employee_number) = LOWER(?)', [employeeNumber])
      .first();
  }

  // 取得使用者所屬的部門群組
  static async getDepartmentGroups(userId) {
    const DepartmentGroup = require('./DepartmentGroup');
    return await DepartmentGroup.findByUserId(userId);
  }

  // 取得使用者所屬的授權群組
  static async getDelegationGroups(userId) {
    return await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('*');
  }

  // 檢查使用者是否為 HR 群組成員
  static async isHRMember(userId) {
    try {
      const hrGroup = await knex('delegation_groups')
        .where('name', 'HR Group')
        .first();
      
      if (!hrGroup) {
        console.log('[isHRMember] HR Group not found in delegation_groups');
        return false;
      }
      
      if (!hrGroup.user_ids) {
        console.log('[isHRMember] HR Group has no user_ids');
        return false;
      }
      
      // PostgreSQL 數組可能返回為字符串或數組，需要處理
      let userIds = hrGroup.user_ids;
      if (typeof userIds === 'string') {
        // 如果是字符串格式的數組，嘗試解析
        try {
          userIds = JSON.parse(userIds);
        } catch (e) {
          // 如果不是 JSON，可能是 PostgreSQL 數組格式，需要手動解析
          userIds = userIds.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
        }
      }
      
      if (!Array.isArray(userIds)) {
        console.log('[isHRMember] user_ids is not an array:', typeof userIds, userIds);
        return false;
      }
      
      const userIdsNum = userIds.map(id => Number(id));
      const userIdNum = Number(userId);
      const isMember = userIdsNum.includes(userIdNum);
      
      // console.log('[isHRMember] User ID:', userIdNum, 'HR Group user_ids:', userIdsNum, 'isMember:', isMember);
      
      return isMember;
    } catch (error) {
      console.error('[isHRMember] Error:', error);
      return false;
    }
  }

  // 檢查使用者是否可以批核某個假期申請
  // 檢查用戶是否可以查看申請（包括批核歷史）
  static async canViewApplication(userId, leaveApplicationId) {
    const application = await knex('leave_applications')
      .where('id', leaveApplicationId)
      .first();
    
    if (!application) {
      return false;
    }

    // 檢查是否為 HR 成員
    const isHRMember = await this.isHRMember(userId);
    if (isHRMember) {
      return true;
    }

    // 檢查是否為申請人
    if (application.user_id === userId) {
      return true;
    }

    // 檢查是否為直接批核者
    const isDirectApprover = [
      application.checker_id,
      application.approver_1_id,
      application.approver_2_id,
      application.approver_3_id
    ].includes(userId);

    if (isDirectApprover) {
      return true;
    }

    // 檢查是否屬於批核流程中任何階段的授權群組
    // 修改邏輯：只要用戶屬於批核流程中任何階段的授權群組，且該階段已設置（有對應的 approver_id），都應該能看到申請
    const DepartmentGroup = require('./DepartmentGroup');
    const userDelegationGroups = await this.getDelegationGroups(userId);
    const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

    if (userDelegationGroupIds.length === 0) {
      return false;
    }

    // 獲取申請人所屬的部門群組
    const departmentGroups = await DepartmentGroup.findByUserId(application.user_id);
    
    if (departmentGroups && departmentGroups.length > 0) {
      const deptGroup = departmentGroups[0];
      const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
      
      // 檢查用戶是否屬於批核流程中任何階段的授權群組，且該階段已設置
      for (const step of approvalFlow) {
        if (step.delegation_group_id && userDelegationGroupIds.includes(Number(step.delegation_group_id))) {
          // 檢查該階段是否已設置（有對應的 approver_id）
          let stepIsSet = false;
          
          if (step.level === 'checker') {
            stepIsSet = !!(application.checker_id);
          } else if (step.level === 'approver_1') {
            stepIsSet = !!(application.approver_1_id);
          } else if (step.level === 'approver_2') {
            stepIsSet = !!(application.approver_2_id);
          } else if (step.level === 'approver_3') {
            stepIsSet = !!(application.approver_3_id);
          }
          
          // 如果用戶屬於該階段的授權群組，且該階段已設置，允許查看
          if (stepIsSet) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static async canApprove(userId, leaveApplicationId) {
    const application = await knex('leave_applications')
      .where('id', leaveApplicationId)
      .first();
    
    if (!application) {
      return false;
    }

    // 如果申請已經完成或拒絕，不能批核
    if (application.status !== 'pending') {
      return false;
    }

    // 確定當前申請處於哪個階段（優先使用 current_approval_stage）
    let currentStage = application.current_approval_stage;
    if (!currentStage) {
      // Fallback: 如果沒有 current_approval_stage，使用舊的邏輯
      if (!application.checker_at && application.checker_id) {
        currentStage = 'checker';
      } else if (!application.approver_1_at && application.approver_1_id) {
        currentStage = 'approver_1';
      } else if (!application.approver_2_at && application.approver_2_id) {
        currentStage = 'approver_2';
      } else if (!application.approver_3_at && application.approver_3_id) {
        currentStage = 'approver_3';
      } else {
        currentStage = 'completed';
      }
    }

    // 如果已經完成所有批核階段，不能批核
    if (currentStage === 'completed') {
      return false;
    }

    // 方法1：檢查使用者是否直接設置為當前階段的批核者
    // 只檢查當前階段，未輪到的批核者不能批核
    if (currentStage === 'checker' && application.checker_id === userId && !application.checker_at) {
      return true;
    } else if (currentStage === 'approver_1' && application.approver_1_id === userId && !application.approver_1_at) {
      return true;
    } else if (currentStage === 'approver_2' && application.approver_2_id === userId && !application.approver_2_at) {
      return true;
    } else if (currentStage === 'approver_3' && application.approver_3_id === userId && !application.approver_3_at) {
      return true;
    }

    // 方法2：檢查是否屬於對應的授權群組（特定部門群組）
    const DepartmentGroup = require('./DepartmentGroup');
    
    // 獲取申請人所屬的部門群組
    const departmentGroups = await DepartmentGroup.findByUserId(application.user_id);
    
    if (departmentGroups && departmentGroups.length > 0) {
      // 使用第一個部門群組（與創建申請時的邏輯一致）
      const deptGroup = departmentGroups[0];
      
      // 獲取該部門群組的批核流程
      const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
      
      // 檢查用戶是否屬於當前階段的授權群組，且該階段尚未批核
      // 只有當前階段的批核者才能批核，未輪到的批核者不能批核
      if (currentStage && currentStage !== 'completed') {
        const currentStep = approvalFlow.find(step => step.level === currentStage);
        if (currentStep && currentStep.delegation_group_id) {
          // 檢查用戶是否屬於當前階段的授權群組
          const isInDelegationGroup = await knex('delegation_groups')
            .where('id', currentStep.delegation_group_id)
            .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
            .first();
          
          if (isInDelegationGroup) {
            // 檢查當前階段是否已設置且尚未批核
            let stepIsPending = false;
            
            if (currentStep.level === 'checker') {
              stepIsPending = !!(application.checker_id && application.checker_at == null && application.checked_at == null);
            } else if (currentStep.level === 'approver_1') {
              stepIsPending = !!(application.approver_1_id && application.approver_1_at == null && application.approved_1_at == null);
            } else if (currentStep.level === 'approver_2') {
              stepIsPending = !!(application.approver_2_id && application.approver_2_at == null && application.approved_2_at == null);
            } else if (currentStep.level === 'approver_3') {
              stepIsPending = !!(application.approver_3_id && application.approver_3_at == null && application.approved_3_at == null);
            }
            
            // 如果用戶屬於當前階段的授權群組，且該階段尚未批核，允許批核
            if (stepIsPending) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}

module.exports = User;
