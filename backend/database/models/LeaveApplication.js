const knex = require('../../config/database');

const APPROVAL_STAGE_CONFIG = [
  { level: 'checker', idField: 'checker_id', timestampField: 'checker_at' },
  { level: 'approver_1', idField: 'approver_1_id', timestampField: 'approver_1_at' },
  { level: 'approver_2', idField: 'approver_2_id', timestampField: 'approver_2_at' },
  { level: 'approver_3', idField: 'approver_3_id', timestampField: 'approver_3_at' }
];

const determineCurrentApprovalStage = (application = {}) => {
  for (const stage of APPROVAL_STAGE_CONFIG) {
    const hasAssignee = application[stage.idField];
    const isCompleted = Boolean(application[stage.timestampField]);
    if (hasAssignee && !isCompleted) {
      return stage.level;
    }
  }
  return 'completed';
};

const withResolvedApprovalStage = (application) => {
  if (!application) {
    return application;
  }

  const resolvedStage =
    application.current_approval_stage || determineCurrentApprovalStage(application);

  return {
    ...application,
    current_approval_stage: resolvedStage
  };
};

const formatApplication = (application) => {
  if (!application) {
    return application;
  }

  const transactionId =
    application.transaction_id ||
    `LA-${String(application.id).padStart(6, '0')}`;

  const applicantNameZh =
    application.applicant_display_name ||
    application.user_display_name ||
    null;

  const applicantEmployeeNumber =
    application.applicant_employee_number ||
    application.user_employee_number ||
    null;

  const days =
    application.days !== undefined && application.days !== null
      ? application.days
      : application.total_days !== undefined && application.total_days !== null
        ? Number(application.total_days)
        : null;

  const approvalStage =
    application.current_approval_stage || determineCurrentApprovalStage(application);

  return {
    ...application,
    transaction_id: transactionId,
    applicant_display_name: applicantNameZh,
    applicant_employee_number: applicantEmployeeNumber,
    days,
    current_approval_stage: approvalStage
  };
};

class LeaveApplication {
  static async create(applicationData) {
    const payload = {
      ...applicationData,
      current_approval_stage: determineCurrentApprovalStage(applicationData)
    };

    const [application] = await knex('leave_applications').insert(payload).returning('*');
    return await this.findById(application.id);
  }

  static async findById(id) {
    const application = await knex('leave_applications')
      .leftJoin('users', 'leave_applications.user_id', 'users.id')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .leftJoin('users as checker', 'leave_applications.checker_id', 'checker.id')
      .leftJoin('users as approver_1', 'leave_applications.approver_1_id', 'approver_1.id')
      .leftJoin('users as approver_2', 'leave_applications.approver_2_id', 'approver_2.id')
      .leftJoin('users as approver_3', 'leave_applications.approver_3_id', 'approver_3.id')
      .leftJoin('users as rejected_by', 'leave_applications.rejected_by_id', 'rejected_by.id')
      .leftJoin('users as cancelled_by', 'leave_applications.cancelled_by_id', 'cancelled_by.id')
      .select(
        'leave_applications.*',
        knex.raw('leave_applications.total_days as days'),
        knex.raw('leave_applications.id as transaction_id'),
        'users.employee_number as user_employee_number',
        'users.employee_number as applicant_employee_number',
        'users.surname as user_surname',
        'users.given_name as user_given_name',
        'users.display_name as user_display_name',
        'users.display_name as applicant_display_name',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'leave_types.requires_balance as leave_type_requires_balance',
        'checker.display_name as checker_name',
        'approver_1.display_name as approver_1_name',
        'approver_2.display_name as approver_2_name',
        'approver_3.display_name as approver_3_name',
        'rejected_by.display_name as rejected_by_name',
        'cancelled_by.display_name as cancelled_by_name'
      )
      .where('leave_applications.id', id)
      .first();
    
    if (application) {
      application.documents = await knex('leave_documents')
        .where('leave_application_id', id);
      
      // 查詢相關的 reverse transaction（銷假交易）
      // 查找所有 reversal_of_application_id 指向當前申請的銷假交易
      const reversalTransactions = await knex('leave_applications')
        .leftJoin('users', 'leave_applications.user_id', 'users.id')
        .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
        .select(
          'leave_applications.*',
          knex.raw('leave_applications.total_days as days'),
          knex.raw('leave_applications.id as transaction_id'),
          'users.employee_number as user_employee_number',
          'users.employee_number as applicant_employee_number',
          'users.surname as user_surname',
          'users.given_name as user_given_name',
          'users.name_zh as user_name_zh',
          'users.name_zh as applicant_name_zh',
          'leave_types.code as leave_type_code',
          'leave_types.name as leave_type_name',
          'leave_types.name_zh as leave_type_name_zh'
        )
        .where('leave_applications.reversal_of_application_id', id)
        .where('leave_applications.is_reversal_transaction', true)
        .orderBy('leave_applications.created_at', 'desc');
      
      application.reversal_transactions = reversalTransactions.map(app => 
        formatApplication(withResolvedApprovalStage(app))
      );
    }
    
    return formatApplication(withResolvedApprovalStage(application));
  }

  static async findAll(options = {}) {
    let query = knex('leave_applications')
      .leftJoin('users', 'leave_applications.user_id', 'users.id')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .select(
        'leave_applications.*',
        knex.raw('leave_applications.total_days as days'),
        knex.raw('leave_applications.id as transaction_id'),
        'users.employee_number as user_employee_number',
        'users.employee_number as applicant_employee_number',
        'users.surname as user_surname',
        'users.given_name as user_given_name',
        'users.display_name as user_display_name',
        'users.display_name as applicant_display_name',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'leave_types.requires_balance as leave_type_requires_balance'
      );

    if (options.user_id) {
      query = query.where('leave_applications.user_id', options.user_id);
    }

    if (options.status) {
      // 如果狀態是 "reversed"，查詢已銷假的記錄（被銷假的原始申請，排除銷假交易本身）
      if (options.status === 'reversed') {
        query = query.where('leave_applications.is_reversed', true)
                     .where(function() {
                       this.where('leave_applications.is_reversal_transaction', false)
                           .orWhereNull('leave_applications.is_reversal_transaction');
                     });
      } else {
        query = query.where('leave_applications.status', options.status);
      }
    }

    if (options.leave_type_id) {
      query = query.where('leave_applications.leave_type_id', options.leave_type_id);
    }

    if (options.flow_type) {
      query = query.where('leave_applications.flow_type', options.flow_type);
    }

    if (options.approver_id) {
      query = query.where(function() {
        this.where('leave_applications.checker_id', options.approver_id)
          .orWhere('leave_applications.approver_1_id', options.approver_id)
          .orWhere('leave_applications.approver_2_id', options.approver_id)
          .orWhere('leave_applications.approver_3_id', options.approver_id);
      });
    }

    if (options.is_cancellation_request !== undefined) {
      query = query.where('leave_applications.is_cancellation_request', options.is_cancellation_request);
    }

    if (options.year) {
      query = query.where('leave_applications.year', options.year);
    }

    // 日期範圍篩選：找到所有與設定日期範圍有重疊的申請
    // 兩個日期範圍有重疊的條件：申請的開始日期 <= 設定的結束日期 且 申請的結束日期 >= 設定的開始日期
    if (options.start_date_from || options.end_date_to) {
      if (options.start_date_from && options.end_date_to) {
        // 兩個日期都設定了，找有重疊的
        query = query.where(function() {
          this.where('leave_applications.start_date', '<=', options.end_date_to)
              .andWhere('leave_applications.end_date', '>=', options.start_date_from);
        });
      } else if (options.start_date_from) {
        // 只設定了開始日期，找到結束日期 >= 開始日期的申請（即開始日期之後的申請）
        query = query.where('leave_applications.end_date', '>=', options.start_date_from);
      } else if (options.end_date_to) {
        // 只設定了結束日期，找到開始日期 <= 結束日期的申請（即結束日期之前的申請）
        query = query.where('leave_applications.start_date', '<=', options.end_date_to);
      }
    }

    // 建立計數查詢（用於獲取總數）
    let countQuery = knex('leave_applications');
    
    // 應用相同的過濾條件到計數查詢
    if (options.user_id) {
      countQuery = countQuery.where('leave_applications.user_id', options.user_id);
    }
    if (options.status) {
      if (options.status === 'reversed') {
        countQuery = countQuery.where('leave_applications.is_reversed', true)
                     .where(function() {
                       this.where('leave_applications.is_reversal_transaction', false)
                           .orWhereNull('leave_applications.is_reversal_transaction');
                     });
      } else {
        countQuery = countQuery.where('leave_applications.status', options.status);
      }
    }
    if (options.leave_type_id) {
      countQuery = countQuery.where('leave_applications.leave_type_id', options.leave_type_id);
    }
    if (options.flow_type) {
      countQuery = countQuery.where('leave_applications.flow_type', options.flow_type);
    }
    if (options.approver_id) {
      countQuery = countQuery.where(function() {
        this.where('leave_applications.checker_id', options.approver_id)
          .orWhere('leave_applications.approver_1_id', options.approver_id)
          .orWhere('leave_applications.approver_2_id', options.approver_id)
          .orWhere('leave_applications.approver_3_id', options.approver_id);
      });
    }
    if (options.is_cancellation_request !== undefined) {
      countQuery = countQuery.where('leave_applications.is_cancellation_request', options.is_cancellation_request);
    }
    if (options.year) {
      countQuery = countQuery.where('leave_applications.year', options.year);
    }
    if (options.start_date_from || options.end_date_to) {
      if (options.start_date_from && options.end_date_to) {
        countQuery = countQuery.where(function() {
          this.where('leave_applications.start_date', '<=', options.end_date_to)
              .andWhere('leave_applications.end_date', '>=', options.start_date_from);
        });
      } else if (options.start_date_from) {
        countQuery = countQuery.where('leave_applications.end_date', '>=', options.start_date_from);
      } else if (options.end_date_to) {
        countQuery = countQuery.where('leave_applications.start_date', '<=', options.end_date_to);
      }
    }

    // 獲取總數
    const totalCount = await countQuery.count('leave_applications.id as count').first();
    const countValue = totalCount?.count;
    const total = typeof countValue === 'string' ? parseInt(countValue, 10) : (countValue || 0);

    // 分頁支持
    if (options.page && options.limit) {
      const offset = (options.page - 1) * options.limit;
      query = query.limit(options.limit).offset(offset);
    }

    const applications = await query.orderBy('leave_applications.created_at', 'desc');
    const formattedApplications = applications.map(app => formatApplication(withResolvedApprovalStage(app)));

    return {
      applications: formattedApplications,
      total,
      page: options.page || 1,
      limit: options.limit || total,
      totalPages: options.limit ? Math.ceil(total / options.limit) : 1
    };
  }

  static async update(id, updateData) {
    await knex('leave_applications').where('id', id).update(updateData);
    await this.syncCurrentApprovalStage(id);
    return await this.findById(id);
  }

  static async syncCurrentApprovalStage(id) {
    const application = await knex('leave_applications')
      .select(
        'id',
        'checker_id',
        'checker_at',
        'approver_1_id',
        'approver_1_at',
        'approver_2_id',
        'approver_2_at',
        'approver_3_id',
        'approver_3_at',
        'current_approval_stage'
      )
      .where('id', id)
      .first();

    if (!application) {
      return null;
    }

    const resolvedStage = determineCurrentApprovalStage(application);

    if (application.current_approval_stage !== resolvedStage) {
      await knex('leave_applications')
        .where('id', id)
        .update({ current_approval_stage: resolvedStage });
    }

    return resolvedStage;
  }

  // 取得待批核的申請（針對特定使用者）
  static async getPendingApprovals(userId) {
    const DepartmentGroup = require('./DepartmentGroup');
    const DelegationGroup = require('./DelegationGroup');
    const User = require('./User');

    // 檢查是否為 HR Group 成員
    const isHRMember = await User.isHRMember(userId);

    // 獲取所有待批核的申請
    const allApplications = await knex('leave_applications')
      .leftJoin('users', 'leave_applications.user_id', 'users.id')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .select(
        'leave_applications.*',
        knex.raw('leave_applications.total_days as days'),
        knex.raw('leave_applications.id as transaction_id'),
        'users.employee_number as user_employee_number',
        'users.employee_number as applicant_employee_number',
        'users.surname as user_surname',
        'users.given_name as user_given_name',
        'users.display_name as user_display_name',
        'users.display_name as applicant_display_name',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh'
      )
      .where('leave_applications.status', 'pending')
      .orderBy('leave_applications.created_at', 'asc');

    // 如果是 HR Group 成員，使用 canViewApplication 來檢查權限（可以看到所有有權限的申請）
    if (isHRMember) {
      const filteredApplications = [];
      for (const app of allApplications) {
        const canView = await User.canViewApplication(userId, app.id);
        if (canView) {
          filteredApplications.push(app);
        }
      }
      return filteredApplications.map(formatApplication);
    }

    // 非 HR 成員：只返回當前階段輪到該用戶批核的申請
    // 獲取當前用戶所屬的所有授權群組 ID
    const userDelegationGroups = await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('id');

    const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

    // 過濾出當前階段輪到該用戶批核的申請
    const filteredApplications = [];

    for (const app of allApplications) {
      // 確定當前批核階段
      let currentStage = app.current_approval_stage;
      if (!currentStage || currentStage === 'completed') {
        currentStage = determineCurrentApprovalStage(app);
      }

      // 如果已經完成所有批核階段，跳過
      if (currentStage === 'completed') {
        continue;
      }

      let canApprove = false;

      // 方法1：檢查是否直接設置為當前階段的批核者，且該階段尚未批核
      if (currentStage === 'checker' && app.checker_id === userId && !app.checker_at) {
        canApprove = true;
      } else if (currentStage === 'approver_1' && app.approver_1_id === userId && !app.approver_1_at) {
        canApprove = true;
      } else if (currentStage === 'approver_2' && app.approver_2_id === userId && !app.approver_2_at) {
        canApprove = true;
      } else if (currentStage === 'approver_3' && app.approver_3_id === userId && !app.approver_3_at) {
        canApprove = true;
      }
      
      // 方法2：檢查是否通過授權群組屬於當前階段的批核者
      if (!canApprove) {
        // 獲取申請人所屬的部門群組
        const departmentGroups = await DepartmentGroup.findByUserId(app.user_id);
        
        if (departmentGroups && departmentGroups.length > 0 && userDelegationGroupIds.length > 0) {
          // 使用第一個部門群組（與創建申請時的邏輯一致）
          const deptGroup = departmentGroups[0];
          
          // 獲取該部門群組的批核流程
          const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
          
          // 找到當前階段的配置
          const currentStep = approvalFlow.find(step => step.level === currentStage);
          
          if (currentStep && currentStep.delegation_group_id && userDelegationGroupIds.includes(Number(currentStep.delegation_group_id))) {
            // 檢查該階段是否尚未批核
            let stepIsPending = false;
            
            if (currentStage === 'checker') {
              stepIsPending = !!(app.checker_id && !app.checker_at);
            } else if (currentStage === 'approver_1') {
              stepIsPending = !!(app.approver_1_id && !app.approver_1_at);
            } else if (currentStage === 'approver_2') {
              stepIsPending = !!(app.approver_2_id && !app.approver_2_at);
            } else if (currentStage === 'approver_3') {
              stepIsPending = !!(app.approver_3_id && !app.approver_3_at);
            }

            if (stepIsPending) {
              canApprove = true;
            }
          }
        }
      }

      if (canApprove) {
        filteredApplications.push(app);
      }
    }

    return filteredApplications.map(formatApplication);
  }

  // 取得下一個批核者
  static async getNextApprover(applicationId) {
    const app = await knex('leave_applications')
      .where('id', applicationId)
      .first();
    
    if (!app) {
      return null;
    }

    // 檢查批核流程
    if (!app.checker_at && app.checker_id) {
      return { level: 'checker', user_id: app.checker_id };
    }
    
    if (!app.approver_1_at && app.approver_1_id) {
      return { level: 'approver_1', user_id: app.approver_1_id };
    }
    
    if (!app.approver_2_at && app.approver_2_id) {
      return { level: 'approver_2', user_id: app.approver_2_id };
    }
    
    if (!app.approver_3_at && app.approver_3_id) {
      return { level: 'approver_3', user_id: app.approver_3_id };
    }
    
    return null; // 所有批核已完成
  }

  // 批核申請
  static async approve(applicationId, approverId, level, remarks = null) {
    const updateData = {};
    updateData[`${level}_at`] = knex.fn.now();
    // 更新批核者ID為實際批核的用戶，確保記錄正確的批核者
    updateData[`${level}_id`] = approverId;
    if (remarks) {
      updateData[`${level}_remarks`] = remarks;
    }

    await knex('leave_applications')
      .where('id', applicationId)
      .update(updateData);

    // 檢查是否所有批核都已完成
    const nextApprover = await this.getNextApprover(applicationId);
    const stageUpdate = nextApprover ? nextApprover.level : 'completed';

    if (!nextApprover) {
      // 所有批核完成
      await knex('leave_applications')
        .where('id', applicationId)
        .update({
          status: 'approved',
          current_approval_stage: stageUpdate
        });
    } else {
      await knex('leave_applications')
        .where('id', applicationId)
        .update({ current_approval_stage: stageUpdate });
    }

    return await this.findById(applicationId);
  }

  // 拒絕申請
  static async reject(applicationId, rejectorId, reason) {
    await knex('leave_applications')
      .where('id', applicationId)
      .update({
        status: 'rejected',
        rejected_by_id: rejectorId,
        rejected_at: knex.fn.now(),
        rejection_reason: reason,
        current_approval_stage: 'completed'
      });

    return await this.findById(applicationId);
  }

  // 取消申請
  static async cancel(applicationId, cancelledById, reason) {
    await knex('leave_applications')
      .where('id', applicationId)
      .update({
        status: 'cancelled',
        cancelled_by_id: cancelledById,
        cancelled_at: knex.fn.now(),
        cancellation_reason: reason,
        current_approval_stage: 'completed'
      });

    return await this.findById(applicationId);
  }

  // 建立取消假期的申請
  static async createCancellationRequest(originalApplicationId, userId, reason) {
    const originalApp = await this.findById(originalApplicationId);
    if (!originalApp) {
      throw new Error('原始假期申請不存在');
    }

    if (originalApp.status !== 'approved') {
      throw new Error('只能取消已批准的假期');
    }

    // 取得使用者的部門群組和批核流程
    const DepartmentGroup = require('./DepartmentGroup');
    const userGroups = await DepartmentGroup.findByUserId(userId);
    
    let approvalFlow = null;
    if (userGroups && userGroups.length > 0) {
      approvalFlow = await DepartmentGroup.getApprovalFlow(userGroups[0].id);
    }

    // 使用原始申請的year字段
    const cancellationYear = originalApp.year || (originalApp.start_date ? new Date(originalApp.start_date).getFullYear() : new Date().getFullYear());
    
    const cancellationData = {
      user_id: userId,
      leave_type_id: originalApp.leave_type_id,
      application_date: null, // 取消申請不需要申請日期
      start_date: originalApp.start_date,
      end_date: originalApp.end_date,
      year: cancellationYear, // 使用原始申請的年份
      total_days: originalApp.total_days,
      reason: reason,
      status: 'pending',
      flow_type: 'e-flow',
      is_cancellation_request: true,
      original_application_id: originalApplicationId
    };

    // 設定批核流程
    if (approvalFlow && approvalFlow.length > 0) {
      // 這裡需要根據 delegation groups 來分配具體的批核者
      // 暫時先設定為 null，實際使用時需要根據業務邏輯來分配
      for (const step of approvalFlow) {
        if (step.level === 'checker') {
          // 需要從 delegation group 中選擇一個批核者
          cancellationData.checker_id = null;
        } else {
          cancellationData[`${step.level}_id`] = null;
        }
      }
    }

    return await this.create(cancellationData);
  }

  static async createReversalRequest(originalApplicationId, userId, requestedByUserId = null, isHRDirectApproval = false) {
    const originalApp = await this.findById(originalApplicationId);
    if (!originalApp) {
      throw new Error('原始假期申請不存在');
    }

    if (originalApp.status !== 'approved') {
      throw new Error('只能銷假已批核的申請');
    }

    if (originalApp.is_reversed) {
      throw new Error('此申請已完成銷假');
    }

    // 檢查是否為 paper-flow 申請
    const isPaperFlow = originalApp.is_paper_flow === true || originalApp.flow_type === 'paper-flow';
    
    console.log('[createReversalRequest] 銷假申請參數:', {
      originalApplicationId,
      userId,
      isPaperFlow,
      isHRDirectApproval,
      originalStatus: originalApp.status
    });
    
    // 如果是 HR 直接批准，銷假申請直接批准（無需走批核流程）
    if (isHRDirectApproval) {
      // 使用原始申請的year字段
      const reversalYear = originalApp.year || (originalApp.start_date ? new Date(originalApp.start_date).getFullYear() : new Date().getFullYear());
      
      const reversalData = {
        user_id: originalApp.user_id, // 使用原始申請的 user_id
        leave_type_id: originalApp.leave_type_id,
        application_date: null, // 銷假申請不需要申請日期
        start_date: originalApp.start_date,
        end_date: originalApp.end_date,
        year: reversalYear, // 使用原始申請的年份
        total_days: -Math.abs(Number(originalApp.total_days || 0)),
        reason: 'Reversal',
        status: 'approved', // 直接批准
        flow_type: isPaperFlow ? 'paper-flow' : 'e-flow',
        is_paper_flow: isPaperFlow,
        is_reversal_transaction: true,
        reversal_of_application_id: originalApplicationId,
        transaction_remark: 'Reversal - 銷假'
      };

      console.log('[createReversalRequest] 創建直接批准的銷假申請:', {
        status: reversalData.status,
        flow_type: reversalData.flow_type,
        is_paper_flow: reversalData.is_paper_flow
      });

      const reversalApplication = await this.create(reversalData);
      console.log('[createReversalRequest] 銷假申請創建成功，開始完成流程:', {
        id: reversalApplication.id,
        status: reversalApplication.status
      });
      
      // 直接完成銷假流程
      return await this.finalizeReversal(reversalApplication);
    }

    // 普通用戶的銷假申請需要走批核流程
    const DepartmentGroup = require('./DepartmentGroup');
    const DelegationGroup = require('./DelegationGroup');

    const departmentGroups = await DepartmentGroup.findByUserId(userId);
    // 使用原始申請的year字段
    const reversalYear = originalApp.year || (originalApp.start_date ? new Date(originalApp.start_date).getFullYear() : new Date().getFullYear());
    
    const reversalData = {
      user_id: userId,
      leave_type_id: originalApp.leave_type_id,
      application_date: null, // 銷假申請不需要申請日期
      start_date: originalApp.start_date,
      end_date: originalApp.end_date,
      year: reversalYear, // 使用原始申請的年份
      total_days: -Math.abs(Number(originalApp.total_days || 0)),
      reason: 'Reversal',
      status: 'pending',
      flow_type: isPaperFlow ? 'paper-flow' : 'e-flow',
      is_paper_flow: isPaperFlow,
      is_reversal_transaction: true,
      reversal_of_application_id: originalApplicationId,
      transaction_remark: 'Reversal - 銷假'
    };

    if (departmentGroups && departmentGroups.length > 0) {
      const deptGroup = departmentGroups[0];
      const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);

      if (approvalFlow && approvalFlow.length > 0) {
        for (const step of approvalFlow) {
          if (!step.delegation_group_id) {
            continue;
          }
          const members = await DelegationGroup.getMembers(step.delegation_group_id);
          if (members && members.length > 0) {
            const approverId = members[0].id;
            if (step.level === 'checker') {
              reversalData.checker_id = approverId;
            } else {
              reversalData[`${step.level}_id`] = approverId;
            }
          }
        }
      } else {
        // 沒有批核流程時直接批准
        reversalData.status = 'approved';
      }
    } else {
      // 沒有部門群組時直接批准
      reversalData.status = 'approved';
    }

    const reversalApplication = await this.create(reversalData);
    if (reversalApplication.status === 'approved') {
      return await this.finalizeReversal(reversalApplication);
    }
    return reversalApplication;
  }

  static async finalizeReversal(application) {
    if (!application || !application.is_reversal_transaction) {
      return application;
    }

    const effectiveDays = Math.abs(Number(application.total_days || 0));

    if (application.reversal_of_application_id) {
      await knex('leave_applications')
        .where('id', application.reversal_of_application_id)
        .update({
          is_reversed: true,
          reversal_completed_at: knex.fn.now()
        });
    }

    if (effectiveDays > 0) {
      const LeaveBalance = require('./LeaveBalance');
      const LeaveType = require('./LeaveType');
      const leaveType = await LeaveType.findById(application.leave_type_id);

      if (leaveType && leaveType.requires_balance) {
        // 使用申請的year字段，如果沒有則從start_date計算
        const year = application.year || (application.start_date
          ? new Date(application.start_date).getFullYear()
          : new Date().getFullYear());

        await LeaveBalance.incrementBalance(
          application.user_id,
          application.leave_type_id,
          year,
          effectiveDays,
          '銷假 - Reversal',
          application.start_date,
          application.end_date
        );
      }
    }

    return await this.findById(application.id);
  }

  // 靜態方法：計算指定日期在假期申請中的時段（AM/PM/null）
  // 對於單一申請：根據 start_session 和 end_session 判斷
  // 對於跨日假期：第一天根據 start_session，最後一天根據 end_session，中間日期為全天假
  static getSessionForDate(leaveApplication, targetDateStr) {
    if (!leaveApplication || !targetDateStr) {
      return null;
    }

    // 格式化日期字符串
    const formatDate = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      if (typeof date === 'string') {
        return date.split('T')[0].substring(0, 10);
      }
      return date;
    };

    const startDateStr = formatDate(leaveApplication.start_date);
    const endDateStr = formatDate(leaveApplication.end_date);
    const startSession = leaveApplication.start_session;
    const endSession = leaveApplication.end_session;

    // 確保日期格式一致（移除可能的時間部分）
    const normalizedTargetDate = targetDateStr ? targetDateStr.split('T')[0].substring(0, 10) : null;
    const normalizedStartDate = startDateStr ? startDateStr.split('T')[0].substring(0, 10) : null;
    const normalizedEndDate = endDateStr ? endDateStr.split('T')[0].substring(0, 10) : null;

    // 確保目標日期在假期範圍內
    if (!normalizedStartDate || !normalizedEndDate || !normalizedTargetDate || 
        normalizedTargetDate < normalizedStartDate || normalizedTargetDate > normalizedEndDate) {
      return null;
    }

    // 單一申請（同一天）
    if (normalizedStartDate === normalizedEndDate) {
      // 如果 start_session 和 end_session 都是 'AM'，顯示上午假
      if (startSession === 'AM' && endSession === 'AM') {
        return 'AM';
      }
      // 如果 start_session 和 end_session 都是 'PM'，顯示下午假
      if (startSession === 'PM' && endSession === 'PM') {
        return 'PM';
      }
      // 其他情況（null-null 或 AM-PM）：全天假，不顯示 session
      return null;
    }

    // 跨日假期（一連串假期）
    if (normalizedTargetDate === normalizedStartDate) {
      // 第一天：根據 start_session 判斷
      // 如果 start_session 是 'PM'，顯示下午假
      if (startSession === 'PM') {
        return 'PM';
      }
      // 如果 start_session 是 'AM' 或 null，顯示全天假
      // 這是因為跨日假期的第一天如果是上午開始，通常意味著當天是全天假
      return null;
    } else if (normalizedTargetDate === normalizedEndDate) {
      // 最後一天：根據 end_session 判斷
      // 如果 end_session 是 'AM'，顯示上午假
      if (endSession === 'AM') {
        return 'AM';
      }
      // 如果 end_session 是 'PM' 或 null，顯示全天假
      // 這是因為跨日假期的最後一天如果是下午結束，通常意味著當天是全天假
      return null;
    } else {
      // 中間日期：全天假，不顯示 session
      return null;
    }
  }
}

module.exports = LeaveApplication;
