const LeaveApplication = require('../database/models/LeaveApplication');
const LeaveBalance = require('../database/models/LeaveBalance');
const User = require('../database/models/User');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const DelegationGroup = require('../database/models/DelegationGroup');
const emailService = require('../utils/emailService');
const knex = require('../config/database');

class ApprovalController {
  async approve(req, res) {
    try {
      const { id } = req.params;
      const { remarks, action, level } = req.body;

      const application = await LeaveApplication.findById(id);
      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      if (application.status !== 'pending') {
        return res.status(400).json({ message: '此申請已處理' });
      }

      // 拒絕申請
      if (action === 'reject') {
        // 確定當前申請處於哪個階段
        let currentLevel = application.current_approval_stage;
        if (!currentLevel || currentLevel === 'completed') {
          if (!application.checker_at && application.checker_id) {
            currentLevel = 'checker';
          } else if (!application.approver_1_at && application.approver_1_id) {
            currentLevel = 'approver_1';
          } else if (!application.approver_2_at && application.approver_2_id) {
            currentLevel = 'approver_2';
          } else if (!application.approver_3_at && application.approver_3_id) {
            currentLevel = 'approver_3';
          } else {
            currentLevel = 'completed';
          }
        }

        // 檢查是否有權限拒絕
        let canReject = false;
        
        // 方法1：直接檢查是否是 HR Group 獲授權人（ID: 1, 29, 31），且在 checker、approver_1、approver_2 階段
        const userId = Number(req.user.id);
        const hrGroupUserIds = [1, 29, 31]; // HR Group 成員 ID
        const isHRMember = hrGroupUserIds.includes(userId);
        const allowedStages = ['checker', 'approver_1', 'approver_2'];
        
        console.log('[Reject] User ID:', userId, 'isHRMember:', isHRMember, 'currentLevel:', currentLevel);
        
        if (isHRMember && allowedStages.includes(currentLevel)) {
          canReject = true;
          console.log('[Reject] HR Member can reject at stage:', currentLevel);
        } else {
          console.log('[Reject] HR Member check failed - isHRMember:', isHRMember, 'currentLevel:', currentLevel, 'allowed levels:', allowedStages);
        }
        
        // 方法2：如果方法1不滿足，檢查是否有權限批核（只有當前階段的批核者才能拒絕）
        if (!canReject) {
          const canApproveResult = await User.canApprove(userId, id);
          console.log('[Reject] canApprove result:', canApproveResult);
          canReject = canApproveResult;
        }
        
        console.log('[Reject] Final canReject:', canReject);
        
        if (!canReject) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }
        
        await LeaveApplication.reject(id, req.user.id, remarks || '已拒絕');
        
        // 發送拒絕通知給申請者
        try {
          const rejectedApplication = await LeaveApplication.findById(id);
          if (rejectedApplication) {
            await emailService.sendRejectionNotification(
              rejectedApplication, 
              rejectedApplication.rejection_reason || remarks || '已拒絕'
            );
          }
        } catch (error) {
          // Email 發送失敗不應該影響拒絕流程
          console.error('[ApprovalController] 發送拒絕通知失敗:', error);
        }

        // 如果是 HR Group 成員拒絕的 e-flow 申請，發送通知給 HR Group 其他成員
        try {
          const rejectedApplication = await LeaveApplication.findById(id);
          if (rejectedApplication && rejectedApplication.flow_type === 'e-flow') {
            const isHRMember = await User.isHRMember(req.user.id);
            if (isHRMember) {
              await emailService.sendHRRejectionNotification(
                rejectedApplication,
                rejectedApplication.rejection_reason || remarks || '已拒絕',
                req.user.id
              );
            }
          }
        } catch (error) {
          // Email 發送失敗不應該影響拒絕流程
          console.error('[ApprovalController] 發送 HR Group 拒絕通知失敗:', error);
        }
        
        return res.json({ message: '申請已拒絕' });
      }

      // 批准申請：檢查使用者是否有權限批核
      const canApprove = await User.canApprove(req.user.id, id);
      if (!canApprove) {
        return res.status(403).json({ message: '無權限進行此操作' });
      }

      // 批准申請
      if (action === 'approve') {
        // 按照正常流程確定當前階段
        // 優先使用 current_approval_stage，如果沒有則根據批核狀態確定
        let currentLevel = application.current_approval_stage;
        
        if (!currentLevel || currentLevel === 'completed') {
          // 如果沒有 current_approval_stage，按照正常流程確定當前階段
          if (!application.checker_at && application.checker_id) {
            currentLevel = 'checker';
          } else if (!application.approver_1_at && application.approver_1_id) {
            currentLevel = 'approver_1';
          } else if (!application.approver_2_at && application.approver_2_id) {
            currentLevel = 'approver_2';
          } else if (!application.approver_3_at && application.approver_3_id) {
            currentLevel = 'approver_3';
          } else {
            currentLevel = 'completed';
          }
        }

        // 如果提供了 level 參數，驗證是否匹配當前階段（可選，用於前端驗證）
        if (level && level !== currentLevel) {
          return res.status(400).json({ 
            message: `批核層級不匹配，當前需要批核的階段是：${currentLevel}` 
          });
        }

        if (!currentLevel) {
          return res.status(400).json({ message: '找不到需要批核的階段' });
        }

        // 執行批核（使用自動確定的階段）
        const updatedApplication = await LeaveApplication.approve(id, req.user.id, currentLevel, remarks);

        // 發送 email 通知
        try {
          // 如果申請已完成，發送完成通知給申請者
          if (updatedApplication.status === 'approved') {
            await emailService.sendApprovalCompleteNotification(updatedApplication);
          } 
          // 如果還有下一階段，發送通知給下一階段的批核群組成員
          else if (updatedApplication.status === 'pending' && updatedApplication.current_approval_stage !== 'completed') {
            const nextStage = updatedApplication.current_approval_stage;
            
            // 獲取申請人所屬的部門群組
            const departmentGroups = await DepartmentGroup.findByUserId(updatedApplication.user_id);
            
            if (departmentGroups && departmentGroups.length > 0) {
              const deptGroup = departmentGroups[0];
              const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
              const nextStep = approvalFlow.find(step => step.level === nextStage);
              
              if (nextStep && nextStep.delegation_group_id) {
                // 獲取下一階段授權群組的所有成員
                const approvers = await DelegationGroup.getMembers(nextStep.delegation_group_id);
                
                if (approvers && approvers.length > 0) {
                  // 發送通知給下一階段的所有批核群組成員
                  await emailService.sendApprovalNotification(updatedApplication, approvers, nextStage);
                }
              }
            }
          }
        } catch (error) {
          // Email 發送失敗不應該影響批核流程
          console.error('[ApprovalController] 發送 email 通知失敗:', error);
        }

        // 當申請完全批准（status === 'approved'）時，處理餘額扣除或發還
        // 注意：餘額處理失敗不應該影響批核成功的響應，因為申請已經成功核准
        if (updatedApplication.status === 'approved') {
          try {
            const LeaveType = require('../database/models/LeaveType');
            const leaveType = await LeaveType.findById(updatedApplication.leave_type_id);
            
            // 使用申請的year字段來處理對應年份的quota
            const applicationYear = updatedApplication.year || new Date(updatedApplication.start_date).getFullYear();
            const daysToProcess = parseFloat(updatedApplication.total_days || 0);
            
            if (leaveType && leaveType.requires_balance && daysToProcess > 0) {
              // 處理取消申請：退回餘額
              if (updatedApplication.is_cancellation_request) {
                // 取消原始申請
                await LeaveApplication.cancel(
                  updatedApplication.original_application_id,
                  req.user.id,
                  updatedApplication.reason
                );
                
                // 退回餘額（因為取消申請意味著退回已扣除的假期）
                // 注意：餘額會從 leave_applications 表自動計算，這裡只做驗證
                await LeaveBalance.incrementBalance(
                  updatedApplication.user_id,
                  updatedApplication.leave_type_id,
                  applicationYear,
                  daysToProcess,
                  '取消假期申請，退回餘額',
                  updatedApplication.start_date,
                  updatedApplication.end_date
                );
              } 
              // 處理銷假申請：發還餘額
              else if (updatedApplication.is_reversal_transaction) {
                await LeaveApplication.finalizeReversal(updatedApplication);
                // finalizeReversal 內部會處理餘額發還
              } 
              // 處理正常假期申請：扣除餘額
              else {
                // 驗證餘額是否足夠並扣除
                // 注意：餘額是動態計算的（從 leave_applications 表計算已批准的申請）
                // 這裡主要驗證餘額是否足夠，實際扣除會通過查詢 leave_applications 表反映
                await LeaveBalance.decrementBalance(
                  updatedApplication.user_id,
                  updatedApplication.leave_type_id,
                  applicationYear,
                  daysToProcess,
                  '假期申請已批准，扣除餘額',
                  updatedApplication.start_date,
                  updatedApplication.end_date
                );
              }
            }
          } catch (balanceError) {
            // 餘額處理失敗不應該影響批核成功的響應，因為申請已經成功核准
            // 記錄錯誤但不中斷流程
            console.error('[ApprovalController] 餘額處理失敗（申請已成功核准）:', balanceError);
            console.error('[ApprovalController] 申請ID:', id, '錯誤詳情:', balanceError.message);
            // 不拋出錯誤，繼續返回批核成功的響應
          }
        }

        return res.json({
          message: updatedApplication.status === 'approved' ? '申請已完全批准' : '批核成功，等待下一層級批核',
          application: updatedApplication
        });
      }

      return res.status(400).json({ message: '無效的操作' });
    } catch (error) {
      console.error('Approve error:', error);
      res.status(500).json({ message: '批核時發生錯誤', error: error.message });
    }
  }

  async getPendingApprovals(req, res) {
    try {
      const applications = await LeaveApplication.getPendingApprovals(req.user.id);
      res.json({ applications });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ message: '獲取待批核申請時發生錯誤' });
    }
  }

  // 臨時測試 API - 診斷 HR 權限
  async testHRPermission(req, res) {
    try {
      const userId = Number(req.user.id);
      const hrGroupUserIds = [1, 29, 31];
      const isHRMember = hrGroupUserIds.includes(userId);
      
      res.json({
        userId: userId,
        userType: typeof userId,
        isHRMember: isHRMember,
        hrGroupUserIds: hrGroupUserIds,
        message: isHRMember ? 'User is HR Group member' : 'User is NOT HR Group member'
      });
    } catch (error) {
      console.error('Test HR permission error:', error);
      res.status(500).json({ message: '測試時發生錯誤', error: error.message });
    }
  }

  async getApprovalHistory(req, res) {
    try {
      const { 
        status, 
        leave_type_id, 
        flow_type, 
        year, 
        month,
        department_group_id,
        start_date_from, 
        end_date_to 
      } = req.query;
      const userId = req.user.id;
      
      // 獲取所有已處理的申請（不包括待批核的）
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
        )
        .where('leave_applications.status', '!=', 'pending');

      // 狀態篩選
      if (status && status !== 'all') {
        // 如果狀態是 "reversed"，查詢已銷假的記錄
        if (status === 'reversed') {
          query = query.where('leave_applications.is_reversed', true)
                       .where(function() {
                         this.where('leave_applications.is_reversal_transaction', false)
                             .orWhereNull('leave_applications.is_reversal_transaction');
                       });
        } else {
          query = query.where('leave_applications.status', status);
        }
      }

      // 假期類型篩選
      if (leave_type_id) {
        query = query.where('leave_applications.leave_type_id', leave_type_id);
      }

      // 流程類型篩選
      if (flow_type) {
        query = query.where('leave_applications.flow_type', flow_type);
      }

      // 部門群組篩選：找到所有屬於該部門群組的用戶的申請
      if (department_group_id) {
        const deptGroupId = parseInt(department_group_id);
        if (!isNaN(deptGroupId) && deptGroupId > 0) {
          const DepartmentGroup = require('../database/models/DepartmentGroup');
          const group = await DepartmentGroup.findById(deptGroupId);
          if (group && group.user_ids && group.user_ids.length > 0) {
            query = query.whereIn('leave_applications.user_id', group.user_ids);
          } else {
            // 如果部門群組沒有成員，返回空結果
            query = query.where('1', '=', '0'); // 永遠為 false 的條件
          }
        }
      }

      // 年份篩選
      if (year) {
        const yearNum = parseInt(year);
        if (!isNaN(yearNum) && yearNum > 0) {
          // 確保年份比較使用整數類型，使用 where 直接比較整數
          query = query.where('leave_applications.year', yearNum);
        }
      }

      // 月份篩選：如果提供了月份，計算該月份的第一天和最後一天
      if (month) {
        const monthNum = parseInt(month);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          const yearForMonth = year ? parseInt(year) : new Date().getFullYear();
          if (!isNaN(yearForMonth) && yearForMonth > 0) {
            // 計算該月份的第一天和最後一天
            const monthStart = `${yearForMonth}-${String(monthNum).padStart(2, '0')}-01`;
            // 計算該月份的最後一天
            const lastDay = new Date(yearForMonth, monthNum, 0).getDate();
            const monthEnd = `${yearForMonth}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            
            // 找到所有與該月份有重疊的申請
            query = query.where(function() {
              this.where('leave_applications.start_date', '<=', monthEnd)
                  .andWhere('leave_applications.end_date', '>=', monthStart);
            });
          }
        }
      }

      // 日期範圍篩選：找到所有與設定日期範圍有重疊的申請
      if (start_date_from || end_date_to) {
        if (start_date_from && end_date_to) {
          query = query.where(function() {
            this.where('leave_applications.start_date', '<=', end_date_to)
                .andWhere('leave_applications.end_date', '>=', start_date_from);
          });
        } else if (start_date_from) {
          query = query.where('leave_applications.end_date', '>=', start_date_from);
        } else if (end_date_to) {
          query = query.where('leave_applications.start_date', '<=', end_date_to);
        }
      }

      const allApplications = await query.orderBy('leave_applications.created_at', 'desc');
      
      // 獲取用戶所屬的授權群組
      const userDelegationGroups = await knex('delegation_groups')
        .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
        .select('id');
      
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));
      
      // 過濾出用戶批核過的申請
      const DepartmentGroup = require('../database/models/DepartmentGroup');
      const User = require('../database/models/User');
      const isHRMember = await User.isHRMember(userId);
      const processedApplications = [];
      
      console.log(`[getApprovalHistory] 開始處理，總申請數: ${allApplications.length}, 用戶ID: ${userId}, 是否HR成員: ${isHRMember}`);
      
      // 調試：檢查是否有 paper-flow 申請
      const paperFlowApps = allApplications.filter(app => app.is_paper_flow === true || app.flow_type === 'paper-flow');
      console.log(`[getApprovalHistory] 發現 ${paperFlowApps.length} 個 paper-flow 申請:`, 
        paperFlowApps.map(app => ({
          id: app.id,
          transaction_id: app.transaction_id,
          is_paper_flow: app.is_paper_flow,
          flow_type: app.flow_type,
          status: app.status
        }))
      );
      
      for (const app of allApplications) {
        let isApprover = false;
        let userApprovalStage = null; // 記錄用戶在哪個階段批核的
        
        // 方法1：檢查是否直接設置為批核者
        if (app.checker_id === userId && app.checker_at) {
          isApprover = true;
          userApprovalStage = 'checker';
        } else if (app.approver_1_id === userId && app.approver_1_at) {
          isApprover = true;
          userApprovalStage = 'approver_1';
        } else if (app.approver_2_id === userId && app.approver_2_at) {
          isApprover = true;
          userApprovalStage = 'approver_2';
        } else if (app.approver_3_id === userId && app.approver_3_at) {
          isApprover = true;
          userApprovalStage = 'approver_3';
        } else if (app.rejected_by_id === userId) {
          isApprover = true;
          userApprovalStage = 'rejected';
        }
        
        // 方法2：檢查是否為 paper-flow 且用戶是 HR Group 成員
        // paper-flow 申請由 HR Group 獲授權人提交後自動批准，應該顯示在批核記錄中
        // 同時檢查 is_paper_flow 欄位和 flow_type 欄位（以防欄位未正確設置）
        const isPaperFlow = app.is_paper_flow === true || app.flow_type === 'paper-flow';
        
        // 調試：記錄所有 paper-flow 申請
        if (isPaperFlow) {
          console.log(`[getApprovalHistory] 發現 paper-flow 申請:`, {
            applicationId: app.id,
            transaction_id: app.transaction_id,
            is_paper_flow: app.is_paper_flow,
            flow_type: app.flow_type,
            status: app.status,
            userId,
            isHRMember,
            currentIsApprover: isApprover
          });
        }
        
        if (!isApprover && isPaperFlow && app.status === 'approved' && isHRMember) {
          isApprover = true;
          userApprovalStage = 'paper_flow';
          console.log(`[getApprovalHistory] Paper-flow 申請匹配並加入批核記錄:`, {
            applicationId: app.id,
            transaction_id: app.transaction_id,
            is_paper_flow: app.is_paper_flow,
            flow_type: app.flow_type,
            status: app.status,
            userId,
            isHRMember
          });
        }
        
        // 方法2.5：檢查是否為 paper-flow 且用戶屬於申請人的 eflow 的 checker、approver1、approver2 群組
        if (!isApprover && isPaperFlow && app.status === 'approved') {
          try {
            // 獲取申請人所屬的部門群組
            const applicantDepartmentGroups = await DepartmentGroup.findByUserId(app.user_id);
            
            if (applicantDepartmentGroups && applicantDepartmentGroups.length > 0) {
              const applicantDeptGroup = applicantDepartmentGroups[0];
              // 獲取該部門群組的 eflow（批核流程）
              const approvalFlow = await DepartmentGroup.getApprovalFlow(applicantDeptGroup.id);
              
              // 檢查用戶是否屬於 checker、approver1、approver2 群組
              const relevantLevels = ['checker', 'approver_1', 'approver_2'];
              for (const step of approvalFlow) {
                if (relevantLevels.includes(step.level) && step.delegation_group_id) {
                  const isMember = await DelegationGroup.hasUser(step.delegation_group_id, userId);
                  if (isMember) {
                    isApprover = true;
                    userApprovalStage = `paper_flow_${step.level}`;
                    console.log(`[getApprovalHistory] Paper-flow 申請匹配（eflow 群組成員）:`, {
                      applicationId: app.id,
                      transaction_id: app.transaction_id,
                      applicantUserId: app.user_id,
                      applicantDeptGroupId: applicantDeptGroup.id,
                      stepLevel: step.level,
                      delegationGroupId: step.delegation_group_id,
                      userId
                    });
                    break;
                  }
                }
              }
            }
          } catch (error) {
            // 如果檢查過程中出錯，記錄但不影響其他邏輯
            console.error(`[getApprovalHistory] 檢查 paper-flow eflow 群組成員時出錯:`, error);
          }
        }
        
        // 方法3：檢查是否通過授權群組批核過
        if (!isApprover && userDelegationGroupIds.length > 0) {
          const departmentGroups = await DepartmentGroup.findByUserId(app.user_id);
          if (departmentGroups && departmentGroups.length > 0) {
            const deptGroup = departmentGroups[0];
            const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
            
            for (const step of approvalFlow) {
              if (step.delegation_group_id && userDelegationGroupIds.includes(Number(step.delegation_group_id))) {
                // 檢查該階段是否已批核
                let stepApproved = false;
                if (step.level === 'checker' && app.checker_at) {
                  stepApproved = true;
                  userApprovalStage = 'checker';
                } else if (step.level === 'approver_1' && app.approver_1_at) {
                  stepApproved = true;
                  userApprovalStage = 'approver_1';
                } else if (step.level === 'approver_2' && app.approver_2_at) {
                  stepApproved = true;
                  userApprovalStage = 'approver_2';
                } else if (step.level === 'approver_3' && app.approver_3_at) {
                  stepApproved = true;
                  userApprovalStage = 'approver_3';
                }
                
                if (stepApproved) {
                  isApprover = true;
                  break;
                }
              }
            }
          }
        }
        
        if (isApprover) {
          // 添加用戶批核階段信息到申請對象
          app.user_approval_stage = userApprovalStage;
          processedApplications.push(app);
        }
      }

      // 格式化申請數據並添加相關的 reverse transaction
      const LeaveApplicationModel = require('../database/models/LeaveApplication');
      const formattedApplications = [];
      
      for (const app of processedApplications) {
        const isPaperFlow = app.is_paper_flow === true || app.flow_type === 'paper-flow';
        
        // 查詢與此申請相關的 reverse transaction
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
          .where('leave_applications.reversal_of_application_id', app.id)
          .where('leave_applications.is_reversal_transaction', true)
          .orderBy('leave_applications.created_at', 'desc');
        
        const formattedApp = {
          ...app,
          transaction_id: app.transaction_id || `LA-${String(app.id).padStart(6, '0')}`,
          applicant_display_name: app.applicant_display_name || app.user_display_name,
          days: app.days !== undefined && app.days !== null ? app.days : app.total_days,
          is_paper_flow: isPaperFlow, // 確保前端能正確識別
          user_approval_stage: app.user_approval_stage || null, // 記錄用戶在哪個階段批核的
          reversal_transactions: reversalTransactions.map(rev => ({
            ...rev,
            transaction_id: rev.transaction_id || `LA-${String(rev.id).padStart(6, '0')}`,
            applicant_display_name: rev.applicant_display_name || rev.user_display_name,
            days: rev.days !== undefined && rev.days !== null ? rev.days : rev.total_days
          }))
        };
        
        formattedApplications.push(formattedApp);
      }

      console.log(`[getApprovalHistory] 最終返回 ${formattedApplications.length} 個申請，其中 paper-flow: ${formattedApplications.filter(a => a.is_paper_flow).length} 個`);

      res.json({ applications: formattedApplications });
    } catch (error) {
      console.error('Get approval history error:', error);
      res.status(500).json({ message: '獲取批核記錄時發生錯誤' });
    }
  }
}

module.exports = new ApprovalController();
