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
    `EWH-${String(application.id).padStart(6, '0')}`;

  const applicantNameZh =
    application.applicant_display_name ||
    application.user_display_name ||
    null;

  const applicantEmployeeNumber =
    application.applicant_employee_number ||
    application.user_employee_number ||
    null;

  const approvalStage =
    application.current_approval_stage || determineCurrentApprovalStage(application);

  return {
    ...application,
    transaction_id: transactionId,
    applicant_display_name: applicantNameZh,
    applicant_employee_number: applicantEmployeeNumber,
    current_approval_stage: approvalStage
  };
};

class ExtraWorkingHoursApplication {
  static async create(applicationData) {
    const payload = {
      ...applicationData,
      current_approval_stage: determineCurrentApprovalStage(applicationData)
    };

    const [application] = await knex('extra_working_hours_applications').insert(payload).returning('*');
    return await this.findById(application.id);
  }

  static async findById(id) {
    const application = await knex('extra_working_hours_applications')
      .leftJoin('users', 'extra_working_hours_applications.user_id', 'users.id')
      .leftJoin('users as checker', 'extra_working_hours_applications.checker_id', 'checker.id')
      .leftJoin('users as approver_1', 'extra_working_hours_applications.approver_1_id', 'approver_1.id')
      .leftJoin('users as approver_2', 'extra_working_hours_applications.approver_2_id', 'approver_2.id')
      .leftJoin('users as approver_3', 'extra_working_hours_applications.approver_3_id', 'approver_3.id')
      .leftJoin('users as rejected_by', 'extra_working_hours_applications.rejected_by_id', 'rejected_by.id')
      .select(
        'extra_working_hours_applications.*',
        knex.raw('extra_working_hours_applications.id as transaction_id'),
        'users.employee_number as user_employee_number',
        'users.employee_number as applicant_employee_number',
        'users.surname as user_surname',
        'users.given_name as user_given_name',
        'users.display_name as user_display_name',
        'users.display_name as applicant_display_name',
        'checker.display_name as checker_name',
        'approver_1.display_name as approver_1_name',
        'approver_2.display_name as approver_2_name',
        'approver_3.display_name as approver_3_name',
        'rejected_by.display_name as rejected_by_name'
      )
      .where('extra_working_hours_applications.id', id)
      .first();
    
    return formatApplication(withResolvedApprovalStage(application));
  }

  static async findAll(options = {}) {
    let query = knex('extra_working_hours_applications')
      .leftJoin('users', 'extra_working_hours_applications.user_id', 'users.id')
      .select(
        'extra_working_hours_applications.*',
        knex.raw('extra_working_hours_applications.id as transaction_id'),
        'users.employee_number as user_employee_number',
        'users.employee_number as applicant_employee_number',
        'users.surname as user_surname',
        'users.given_name as user_given_name',
        'users.display_name as user_display_name',
        'users.display_name as applicant_display_name'
      );

    if (options.user_id) {
      query = query.where('extra_working_hours_applications.user_id', options.user_id);
    }

    if (options.status) {
      query = query.where('extra_working_hours_applications.status', options.status);
    }

    if (options.flow_type) {
      query = query.where('extra_working_hours_applications.flow_type', options.flow_type);
    }

    if (options.approver_id) {
      query = query.where(function() {
        this.where('extra_working_hours_applications.checker_id', options.approver_id)
          .orWhere('extra_working_hours_applications.approver_1_id', options.approver_id)
          .orWhere('extra_working_hours_applications.approver_2_id', options.approver_id)
          .orWhere('extra_working_hours_applications.approver_3_id', options.approver_id);
      });
    }

    // 日期範圍篩選
    if (options.start_date_from || options.end_date_to) {
      if (options.start_date_from && options.end_date_to) {
        query = query.where(function() {
          this.where('extra_working_hours_applications.start_date', '<=', options.end_date_to)
              .andWhere('extra_working_hours_applications.end_date', '>=', options.start_date_from);
        });
      } else if (options.start_date_from) {
        query = query.where('extra_working_hours_applications.end_date', '>=', options.start_date_from);
      } else if (options.end_date_to) {
        query = query.where('extra_working_hours_applications.start_date', '<=', options.end_date_to);
      }
    }

    const applications = await query.orderBy('extra_working_hours_applications.created_at', 'desc');
    return applications.map(app => formatApplication(withResolvedApprovalStage(app)));
  }

  static async update(id, updateData) {
    await knex('extra_working_hours_applications').where('id', id).update(updateData);
    await this.syncCurrentApprovalStage(id);
    return await this.findById(id);
  }

  static async syncCurrentApprovalStage(id) {
    const application = await knex('extra_working_hours_applications')
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
      await knex('extra_working_hours_applications')
        .where('id', id)
        .update({ current_approval_stage: resolvedStage });
    }

    return resolvedStage;
  }

  // 取得待批核的申請（針對特定使用者）
  static async getPendingApprovals(userId) {
    const DepartmentGroup = require('./DepartmentGroup');
    const DelegationGroup = require('./DelegationGroup');

    // 獲取所有待批核的申請
    const allApplications = await knex('extra_working_hours_applications')
      .leftJoin('users', 'extra_working_hours_applications.user_id', 'users.id')
      .select(
        'extra_working_hours_applications.*',
        knex.raw('extra_working_hours_applications.id as transaction_id'),
        'users.employee_number as user_employee_number',
        'users.employee_number as applicant_employee_number',
        'users.surname as user_surname',
        'users.given_name as user_given_name',
        'users.display_name as user_display_name',
        'users.display_name as applicant_display_name'
      )
      .where('extra_working_hours_applications.status', 'pending')
      .orderBy('extra_working_hours_applications.created_at', 'asc');

    // 獲取當前用戶所屬的所有授權群組 ID
    const userDelegationGroups = await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('id');

    const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

    // 過濾出當前用戶有權限批核的申請
    const filteredApplications = [];

    for (const app of allApplications) {
      let canApprove = false;

      // 方法1：檢查是否直接設置為批核者
      if (app.checker_id === userId ||
          app.approver_1_id === userId ||
          app.approver_2_id === userId ||
          app.approver_3_id === userId) {
        canApprove = true;
      } 
      // 方法2：檢查是否屬於對應的授權群組
      if (!canApprove) {
        const departmentGroups = await DepartmentGroup.findByUserId(app.user_id);
        
        if (departmentGroups && departmentGroups.length > 0 && userDelegationGroupIds.length > 0) {
          const deptGroup = departmentGroups[0];
          const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
          
          for (const step of approvalFlow) {
            if (step.delegation_group_id && userDelegationGroupIds.includes(Number(step.delegation_group_id))) {
              let stepIsSet = false;
              
              if (step.level === 'checker') {
                stepIsSet = !!(app.checker_id);
              } else if (step.level === 'approver_1') {
                stepIsSet = !!(app.approver_1_id);
              } else if (step.level === 'approver_2') {
                stepIsSet = !!(app.approver_2_id);
              } else if (step.level === 'approver_3') {
                stepIsSet = !!(app.approver_3_id);
              }

              if (stepIsSet) {
                canApprove = true;
                break;
              }
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
    const app = await knex('extra_working_hours_applications')
      .where('id', applicationId)
      .first();
    
    if (!app) {
      return null;
    }

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
    
    return null;
  }

  // 批核申請
  static async approve(applicationId, approverId, level, remarks = null) {
    const updateData = {};
    updateData[`${level}_at`] = knex.fn.now();
    updateData[`${level}_id`] = approverId;
    if (remarks) {
      updateData[`${level}_remarks`] = remarks;
    }

    await knex('extra_working_hours_applications')
      .where('id', applicationId)
      .update(updateData);

    const nextApprover = await this.getNextApprover(applicationId);
    const stageUpdate = nextApprover ? nextApprover.level : 'completed';

    if (!nextApprover) {
      await knex('extra_working_hours_applications')
        .where('id', applicationId)
        .update({
          status: 'approved',
          current_approval_stage: stageUpdate
        });
    } else {
      await knex('extra_working_hours_applications')
        .where('id', applicationId)
        .update({ current_approval_stage: stageUpdate });
    }

    return await this.findById(applicationId);
  }

  // 拒絕申請
  static async reject(applicationId, rejectorId, reason) {
    await knex('extra_working_hours_applications')
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
}

module.exports = ExtraWorkingHoursApplication;

