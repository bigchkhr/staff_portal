const OutdoorWorkApplication = require('../database/models/OutdoorWorkApplication');
const OutdoorWorkDocument = require('../database/models/OutdoorWorkDocument');
const User = require('../database/models/User');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const DelegationGroup = require('../database/models/DelegationGroup');
const emailService = require('../utils/emailService');

class OutdoorWorkController {
  async createApplication(req, res) {
    try {
      const { start_date, start_time, end_date, end_time, total_hours, start_location, end_location, transportation, expense, purpose, user_id, flow_type, application_date } = req.body;
      const applied_by_id = req.user.id;

      if (!start_date || !start_time || !end_date || !end_time || !total_hours) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      // 如果是 paper-flow，檢查權限
      if (flow_type === 'paper-flow') {
        const isHRMember = await User.isHRMember(applied_by_id);
        if (!isHRMember) {
          return res.status(403).json({ message: '只有 HR 成員可以使用 Paper Flow' });
        }
        if (!user_id) {
          return res.status(400).json({ message: 'Paper Flow 必須指定申請人' });
        }
      }

      const applicantId = user_id || req.user.id;
      const applicant = await User.findById(applicantId);
      if (!applicant) {
        return res.status(404).json({ message: '申請人不存在' });
      }

      // 決定流程類型
      const actualFlowType = flow_type === 'paper-flow' ? 'paper-flow' : 'e-flow';

      // 對於 e-flow 申請，如果沒有提供申請日期，自動設置為當前日期
      let finalApplicationDate = application_date;
      if (actualFlowType === 'e-flow' && !finalApplicationDate) {
        finalApplicationDate = new Date().toISOString().split('T')[0];
      }

      const applicationData = {
        user_id: applicantId,
        application_date: finalApplicationDate || null,
        start_date,
        start_time,
        end_date,
        end_time,
        total_hours: parseFloat(total_hours),
        start_location: start_location || null,
        end_location: end_location || null,
        transportation: transportation || null,
        expense: expense ? parseFloat(expense) : null,
        purpose: purpose || null,
        status: actualFlowType === 'paper-flow' ? 'approved' : 'pending',
        flow_type: actualFlowType,
        is_paper_flow: actualFlowType === 'paper-flow'
      };

      // 如果是 e-flow，設定批核流程
      if (actualFlowType === 'e-flow') {
        const departmentGroups = await DepartmentGroup.findByUserId(applicantId);
        
        if (departmentGroups && departmentGroups.length > 0) {
          const deptGroup = departmentGroups[0];
          const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
          
          if (approvalFlow.length === 0) {
            applicationData.status = 'approved';
          } else {
            for (const step of approvalFlow) {
              const delegationGroupId = step.delegation_group_id;
              if (delegationGroupId) {
                const members = await DelegationGroup.getMembers(delegationGroupId);
                if (members && members.length > 0) {
                  const approverId = members[0].id;
                  if (step.level === 'checker') {
                    applicationData.checker_id = approverId;
                  } else {
                    applicationData[`${step.level}_id`] = approverId;
                  }
                }
              }
            }
          }
        } else {
          applicationData.status = 'approved';
        }
      }

      const application = await OutdoorWorkApplication.create(applicationData);

      // 處理上傳的檔案（如果有的話）
      const uploadedDocuments = [];
      if (req.files && req.files.length > 0) {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const targetFolder = path.join(uploadDir, 'outdoor-work-documents', application.id.toString());
        
        // 如果目標文件夾不存在，創建它
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
        }
        
        for (const file of req.files) {
          // 如果文件在 temp 文件夾中，移動到正確的文件夾
          let finalFilePath = file.path;
          if (file.path.includes('temp')) {
            const fileName = path.basename(file.path);
            const newPath = path.join(targetFolder, fileName);
            fs.renameSync(file.path, newPath);
            finalFilePath = newPath;
          }
          
          const documentData = {
            outdoor_work_application_id: application.id,
            file_name: file.originalname,
            file_path: finalFilePath,
            file_type: file.mimetype,
            file_size: file.size,
            uploaded_by_id: req.user.id
          };
          const document = await OutdoorWorkDocument.create(documentData);
          uploadedDocuments.push(document);
        }
      }

      // 如果是 e-flow 申請，發送通知給當前批核階段的批核群組成員
      if (actualFlowType === 'e-flow' && application.status === 'pending') {
        try {
          const currentStage = application.current_approval_stage || 'checker';
          const departmentGroupsForEmail = await DepartmentGroup.findByUserId(applicantId);
          
          if (departmentGroupsForEmail && departmentGroupsForEmail.length > 0) {
            const deptGroup = departmentGroupsForEmail[0];
            const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
            const currentStep = approvalFlow.find(step => step.level === currentStage);
            
            if (currentStep && currentStep.delegation_group_id) {
              const approvers = await DelegationGroup.getMembers(currentStep.delegation_group_id);
              
              if (approvers && approvers.length > 0) {
                await emailService.sendApprovalNotification(application, approvers, currentStage);
              }
            }
          }
        } catch (error) {
          console.error('[OutdoorWorkController] 發送 email 通知失敗:', error);
        }
      }

      res.status(201).json({
        message: '外勤工作申請已提交',
        application,
        documents: uploadedDocuments
      });
    } catch (error) {
      console.error('Create application error:', error);
      res.status(500).json({ message: '建立申請時發生錯誤', error: error.message });
    }
  }

  async getApplications(req, res) {
    try {
      const {
        status,
        flow_type,
        user_id,
        applicant_id,
        include_approver,
        start_date_from,
        start_date_to,
        end_date_from,
        end_date_to
      } = req.query;
      
      const options = {};
      if (status) options.status = status;
      if (flow_type) options.flow_type = flow_type;
      if (start_date_from) options.start_date_from = start_date_from;
      if (start_date_to) options.start_date_to = start_date_to;
      if (end_date_from) options.end_date_from = end_date_from;
      if (end_date_to) options.end_date_to = end_date_to;
      
      const isHRMember = await User.isHRMember(req.user.id);
      const requestedUserId = user_id || applicant_id;
      const includeApproverView = include_approver === 'true';
      
      if (requestedUserId) {
        options.user_id = requestedUserId;
      } else if (!isHRMember) {
        options.user_id = req.user.id;
      }

      if (includeApproverView) {
        options.approver_id = req.user.id;
      }

      const applications = await OutdoorWorkApplication.findAll(options);

      res.json({ applications });
    } catch (error) {
      console.error('Get applications error:', error);
      res.status(500).json({ message: '獲取申請列表時發生錯誤' });
    }
  }

  async getApplicationById(req, res) {
    try {
      const { id } = req.params;
      
      const application = await OutdoorWorkApplication.findById(id);

      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      // 檢查權限：使用統一的權限檢查方法
      const canView = await User.canViewOutdoorWorkApplication(req.user.id, id);

      if (!canView) {
        return res.status(403).json({ message: '無權限查看此申請' });
      }

      return res.json({ application });
    } catch (error) {
      console.error('Get application error:', error);
      res.status(500).json({ message: '獲取申請詳情時發生錯誤' });
    }
  }

  async getPendingApprovals(req, res) {
    try {
      const applications = await OutdoorWorkApplication.getPendingApprovals(req.user.id);
      res.json({ applications });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ message: '獲取待批核申請時發生錯誤' });
    }
  }

  async approve(req, res) {
    try {
      const { id } = req.params;
      const { remarks, action, level } = req.body;

      const application = await OutdoorWorkApplication.findById(id);
      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      if (application.status !== 'pending') {
        return res.status(400).json({ message: '此申請已處理' });
      }

      // 拒絕申請
      if (action === 'reject') {
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
        const userId = Number(req.user.id);
        const isHRMember = await User.isHRMember(userId);
        
        // HR 成員可以在任何階段（除了已完成）拒絕
        if (isHRMember && currentLevel !== 'completed') {
          canReject = true;
        } else {
          canReject = await User.canApproveOutdoorWork(userId, id);
        }

        if (!canReject) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }

        await OutdoorWorkApplication.reject(id, req.user.id, remarks || '已拒絕');
        return res.json({ message: '申請已拒絕' });
      }

      // 批准申請
      if (action === 'approve') {
        const canApprove = await User.canApproveOutdoorWork(req.user.id, id);
        if (!canApprove) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }

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

        if (level && level !== currentLevel) {
          return res.status(400).json({ 
            message: `批核層級不匹配，當前需要批核的階段是：${currentLevel}` 
          });
        }

        if (!currentLevel) {
          return res.status(400).json({ message: '找不到需要批核的階段' });
        }

        const updatedApplication = await OutdoorWorkApplication.approve(id, req.user.id, currentLevel, remarks);

        // 發送 email 通知
        try {
          if (updatedApplication.status === 'approved') {
            await emailService.sendApprovalCompleteNotification(updatedApplication);
          } else if (updatedApplication.status === 'pending' && updatedApplication.current_approval_stage !== 'completed') {
            const nextStage = updatedApplication.current_approval_stage;
            const departmentGroups = await DepartmentGroup.findByUserId(updatedApplication.user_id);
            
            if (departmentGroups && departmentGroups.length > 0) {
              const deptGroup = departmentGroups[0];
              const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
              const nextStep = approvalFlow.find(step => step.level === nextStage);
              
              if (nextStep && nextStep.delegation_group_id) {
                const approvers = await DelegationGroup.getMembers(nextStep.delegation_group_id);
                if (approvers && approvers.length > 0) {
                  await emailService.sendApprovalNotification(updatedApplication, approvers, nextStage);
                }
              }
            }
          }
        } catch (error) {
          console.error('[OutdoorWorkController] 發送 email 通知失敗:', error);
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
}

module.exports = new OutdoorWorkController();

