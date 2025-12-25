const LeaveApplication = require('../database/models/LeaveApplication');
const LeaveBalance = require('../database/models/LeaveBalance');
const LeaveDocument = require('../database/models/LeaveDocument');
const LeaveType = require('../database/models/LeaveType');
const User = require('../database/models/User');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const DelegationGroup = require('../database/models/DelegationGroup');
const emailService = require('../utils/emailService');
const path = require('path');

class LeaveController {
  async createApplication(req, res) {
    try {
      const { start_date, start_session, end_date, end_session, total_days, leave_type_id, reason, user_id, flow_type, year, application_date } = req.body;
      const applied_by_id = req.user.id;

      if (!start_date || !start_session || !end_date || !end_session || !total_days || !leave_type_id) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      // 驗證 session 值必須是 'AM' 或 'PM'
      if (start_session !== 'AM' && start_session !== 'PM') {
        return res.status(400).json({ message: '開始時段必須是上午(AM)或下午(PM)' });
      }
      if (end_session !== 'AM' && end_session !== 'PM') {
        return res.status(400).json({ message: '結束時段必須是上午(AM)或下午(PM)' });
      }

      // 如果是 paper-flow，檢查權限
      if (flow_type === 'paper-flow') {
        const isHRMember = await User.isHRMember(applied_by_id);
        if (!isHRMember) {
          return res.status(403).json({ message: '只有系統管理員可以使用 Paper Flow' });
        }
        if (!user_id) {
          return res.status(400).json({ message: 'Paper Flow 必須指定申請人' });
        }
      }

      const leaveType = await LeaveType.findById(leave_type_id);
      if (!leaveType) {
        return res.status(404).json({ message: '假期類型不存在' });
      }

      const applicantId = user_id || req.user.id;
      const applicant = await User.findById(applicantId);
      if (!applicant) {
        return res.status(404).json({ message: '申請人不存在' });
      }

      // 決定流程類型：明確指定 paper-flow 才使用，否則一律走 e-flow
      const actualFlowType = flow_type === 'paper-flow' ? 'paper-flow' : 'e-flow';

      // 優先使用前端發送的year參數，如果沒有則從start_date計算
      const applicationYear = year ? parseInt(year) : new Date(start_date).getFullYear();

      // 對於 e-flow 申請，如果沒有提供申請日期，自動設置為當前日期
      let finalApplicationDate = application_date;
      if (actualFlowType === 'e-flow' && !finalApplicationDate) {
        finalApplicationDate = new Date().toISOString().split('T')[0]; // 格式：YYYY-MM-DD
      }

      let balanceRecord = null;

      // 檢查假期餘額和有效期
      if (leaveType.requires_balance) {
        const LeaveBalanceTransaction = require('../database/models/LeaveBalanceTransaction');
        
        // 使用申請的年份來檢查對應年份的餘額
        balanceRecord = await LeaveBalance.findByUserAndType(applicantId, leave_type_id, applicationYear);
        
        if (!balanceRecord || parseFloat(balanceRecord.balance) < parseFloat(total_days)) {
          return res.status(400).json({ message: '假期餘額不足' });
        }
        
        // 檢查申請日期是否在選擇年份的有效餘額期間內
        // 使用 applicationYear 確保檢查的是選擇年份的餘額有效期，而不是申請日期所在年份
        const validBalance = await LeaveBalanceTransaction.getValidBalanceForPeriod(
          applicantId,
          leave_type_id,
          start_date,
          end_date,
          applicationYear  // 傳入選擇的年份，而不是從日期推斷的年份
        );
        
        if (validBalance < parseFloat(total_days)) {
          return res.status(400).json({ 
            message: `申請日期不在${applicationYear}年假期餘額有效期範圍內，或該期間可用餘額不足。請檢查您的假期餘額有效期限。` 
          });
        }
      }

      const applicationData = {
        user_id: applicantId,
        leave_type_id,
        application_date: finalApplicationDate || null, // e-flow 必須有申請日期，paper-flow 可留空
        start_date,
        start_session,
        end_date,
        end_session,
        year: applicationYear, // 設置假期所屬年份
        total_days: parseFloat(total_days),
        reason: reason || null,
        status: actualFlowType === 'paper-flow' ? 'approved' : 'pending',
        flow_type: actualFlowType,
        is_paper_flow: actualFlowType === 'paper-flow' // 標記是否為 paper-flow
      };

      // 如果是 e-flow，設定批核流程
      if (actualFlowType === 'e-flow') {
        // 取得使用者所屬的部門群組
        const departmentGroups = await DepartmentGroup.findByUserId(applicantId);
        
        if (departmentGroups && departmentGroups.length > 0) {
          const deptGroup = departmentGroups[0]; // 使用第一個部門群組
          
          // 取得批核流程
          const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
          
          if (approvalFlow.length === 0) {
            // 如果沒有設定任何批核者，自動批准
            applicationData.status = 'approved';
          } else {
            // 從每個 delegation group 中選擇第一個成員作為批核者
            for (const step of approvalFlow) {
              const delegationGroupId = step.delegation_group_id;
              if (delegationGroupId) {
                const members = await DelegationGroup.getMembers(delegationGroupId);
                if (members && members.length > 0) {
                  // 選擇第一個成員作為批核者
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
          // 如果使用者不屬於任何部門群組，自動批准
          applicationData.status = 'approved';
        }
      }

      const application = await LeaveApplication.create(applicationData);

      // 如果是 e-flow 申請，發送通知給當前批核階段的批核群組成員
      if (actualFlowType === 'e-flow' && application.status === 'pending') {
        try {
          const currentStage = application.current_approval_stage || 'checker';
          
          // 重新獲取使用者所屬的部門群組（因為 departmentGroups 變數可能不在作用域內）
          const departmentGroupsForEmail = await DepartmentGroup.findByUserId(applicantId);
          
          // 獲取當前批核階段的授權群組
          if (departmentGroupsForEmail && departmentGroupsForEmail.length > 0) {
            const deptGroup = departmentGroupsForEmail[0];
            const approvalFlow = await DepartmentGroup.getApprovalFlow(deptGroup.id);
            const currentStep = approvalFlow.find(step => step.level === currentStage);
            
            if (currentStep && currentStep.delegation_group_id) {
              // 獲取該授權群組的所有成員
              const approvers = await DelegationGroup.getMembers(currentStep.delegation_group_id);
              
              if (approvers && approvers.length > 0) {
                // 發送通知給所有批核群組成員
                await emailService.sendApprovalNotification(application, approvers, currentStage);
              }
            }
          }
        } catch (error) {
          // Email 發送失敗不應該影響申請創建
          console.error('[LeaveController] 發送 email 通知失敗:', error);
        }
      }

      // 處理上傳的檔案（如果有的話）
      // 注意：檔案上傳需要在創建申請後進行，因為需要 application.id
      // 檔案應該在請求中作為 files 陣列傳遞
      const uploadedDocuments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const documentData = {
            leave_application_id: application.id,
            file_name: file.originalname,
            file_path: file.path,
            file_type: file.mimetype,
            file_size: file.size,
            uploaded_by_id: req.user.id
          };
          const document = await LeaveDocument.create(documentData);
          uploadedDocuments.push(document);
        }
      }

      // 如果是 paper-flow 已批准的申請，立即更新假期餘額
      if (application.status === 'approved' && actualFlowType === 'paper-flow' && leaveType.requires_balance) {
        if (!balanceRecord) {
          throw new Error('找不到假期餘額紀錄');
        }

        // 使用申請的year字段來扣除對應年份的quota
        await LeaveBalance.decrementBalance(
          applicantId,
          leave_type_id,
          applicationYear,
          parseFloat(total_days),
          '假期申請已批准，扣除餘額',
          start_date,
          end_date
        );
      }
      
      // e-flow 申請會在批核完成後才扣除餘額

      res.status(201).json({
        message: '假期申請已提交',
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
        leave_type_id,
        flow_type,
        user_id,
        applicant_id,
        include_approver,
        year,
        start_date_from,
        start_date_to,
        end_date_from,
        end_date_to
      } = req.query;
      
      const options = {};
      if (status) options.status = status;
      if (leave_type_id) options.leave_type_id = leave_type_id;
      if (flow_type) options.flow_type = flow_type;
      if (year) {
        const yearNum = parseInt(year);
        if (!isNaN(yearNum) && yearNum > 0) {
          options.year = yearNum;
        }
      }
      if (start_date_from) options.start_date_from = start_date_from;
      if (start_date_to) options.start_date_to = start_date_to;
      if (end_date_from) options.end_date_from = end_date_from;
      if (end_date_to) options.end_date_to = end_date_to;
      
      // 檢查是否為 HR 成員
      const isHRMember = await User.isHRMember(req.user.id);
      const requestedUserId = user_id || applicant_id;
      const includeApproverView = include_approver === 'true';
      
      if (requestedUserId) {
        options.user_id = requestedUserId;
      } else if (!isHRMember) {
        // 一般使用者預設僅能查看自己的申請
        options.user_id = req.user.id;
      }

      if (includeApproverView) {
        options.approver_id = req.user.id;
      }

      const applications = await LeaveApplication.findAll(options);

      res.json({ applications });
    } catch (error) {
      console.error('Get applications error:', error);
      res.status(500).json({ message: '獲取申請列表時發生錯誤' });
    }
  }

  async getApplicationById(req, res) {
    try {
      const { id } = req.params;
      // console.log(`[getApplicationById] 請求 ID: ${id}, 用戶 ID: ${req.user.id}`);
      
      const application = await LeaveApplication.findById(id);
      // console.log(`[getApplicationById] 查詢結果:`, application ? `找到申請 ID: ${application.id}` : '申請不存在');

      if (!application) {
        // console.log(`[getApplicationById] 返回 404: 申請不存在`);
        return res.status(404).json({ message: '申請不存在' });
      }

      // 檢查權限：使用統一的權限檢查方法
      const canView = await User.canViewApplication(req.user.id, id);
      // console.log(`[getApplicationById] 權限檢查結果: canView=${canView}, userId=${req.user.id}, applicationId=${id}`);

      if (!canView) {
        console.log(`[getApplicationById] 返回 403: 無權限查看此申請`);
        return res.status(403).json({ message: '無權限查看此申請' });
      }

      console.log(`[getApplicationById] 通過權限檢查，返回申請`);
      return res.json({ application });
    } catch (error) {
      console.error('Get application error:', error);
      res.status(500).json({ message: '獲取申請詳情時發生錯誤' });
    }
  }

  async uploadDocument(req, res) {
    try {
      const { id } = req.params;
      const files = req.files || (req.file ? [req.file] : []);

      if (!files || files.length === 0) {
        return res.status(400).json({ message: '請選擇檔案' });
      }

      const application = await LeaveApplication.findById(id);
      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      // 檢查權限：申請人、批核者、HR Group 獲授權人都可以上傳檔案
      const isApplicant = application.user_id === req.user.id;
      const canApprove = await User.canApprove(req.user.id, id);
      const isHRMember = await User.isHRMember(req.user.id);
      const isSystemAdmin = req.user.is_system_admin;

      // 允許條件：
      // 1. 申請人、批核者、系統管理員（任何狀態）
      // 2. HR Group 獲授權人（任何狀態，包括已批核）
      // 3. 待批核狀態（任何人都可以上傳）
      const canUpload = isApplicant || canApprove || isHRMember || isSystemAdmin || application.status === 'pending';

      if (!canUpload) {
        return res.status(403).json({ message: '無權限上載檔案到此申請' });
      }

      const uploadedDocuments = [];
      for (const file of files) {
        const documentData = {
          leave_application_id: id,
          file_name: file.originalname,
          file_path: file.path,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_by_id: req.user.id
        };

        const document = await LeaveDocument.create(documentData);
        uploadedDocuments.push(document);
      }

      res.status(201).json({
        message: `成功上載 ${uploadedDocuments.length} 個檔案`,
        documents: uploadedDocuments
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({ message: '上載檔案時發生錯誤', error: error.message });
    }
  }

  async getDocuments(req, res) {
    try {
      const { id } = req.params;
      const documents = await LeaveDocument.findByApplicationId(id);

      // 將檔案路徑轉換為可訪問的 URL
      const documentsWithUrl = documents.map(doc => ({
        ...doc,
        file_url: `/api/leaves/documents/${doc.id}/download`
      }));

      res.json({ documents: documentsWithUrl });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ message: '獲取檔案列表時發生錯誤' });
    }
  }

  async downloadDocument(req, res) {
    try {
      const { id } = req.params;
      const { view } = req.query; // 如果 view=true，在瀏覽器中查看；否則下載
      const document = await LeaveDocument.findById(id);

      if (!document) {
        return res.status(404).json({ message: '檔案不存在' });
      }

      // 檢查權限：只有申請人或批核者可以查看
      const application = await LeaveApplication.findById(document.leave_application_id);
      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      const isApplicant = application.user_id === req.user.id;
      const canApprove = await User.canApprove(req.user.id, application.id);
      const isHRMember = await User.isHRMember(req.user.id);
      const isSystemAdmin = req.user.is_system_admin;
      const isDeptHead = req.user.is_dept_head;

      // 允許申請人、批核者、HR 成員、系統管理員和部門主管查看
      if (!isApplicant && !canApprove && !isHRMember && !isSystemAdmin && !isDeptHead) {
        return res.status(403).json({ message: '無權限查看此檔案' });
      }

      const fs = require('fs');
      const filePath = document.file_path;

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: '檔案不存在於伺服器' });
      }

      // 如果是圖片或 PDF，在瀏覽器中查看；否則下載
      const isImage = document.file_type && document.file_type.startsWith('image/');
      const isPDF = document.file_type === 'application/pdf' || document.file_name?.toLowerCase().endsWith('.pdf');
      
      if (view === 'true' || isImage || isPDF) {
        // 設置適當的 Content-Type
        const contentType = document.file_type || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.file_name)}"`);
        
        // 讀取並發送文件
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } else {
        // 下載文件
        res.download(filePath, document.file_name);
      }
    } catch (error) {
      console.error('Download document error:', error);
      res.status(500).json({ message: '查看檔案時發生錯誤' });
    }
  }

  async deleteDocument(req, res) {
    try {
      // 支援兩種參數名稱：documentId 或 id（與下載路由保持一致）
      const documentId = req.params.documentId || req.params.id;
      console.log(`[deleteDocument] 收到刪除請求，documentId: ${documentId}, userId: ${req.user.id}`);
      
      if (!documentId) {
        return res.status(400).json({ message: '缺少檔案 ID' });
      }

      const document = await LeaveDocument.findById(documentId);
      console.log(`[deleteDocument] 查詢檔案結果:`, document ? `找到檔案 ID: ${document.id}` : '檔案不存在');

      if (!document) {
        return res.status(404).json({ message: '檔案不存在' });
      }

      const application = await LeaveApplication.findById(document.leave_application_id);
      console.log(`[deleteDocument] 查詢申請結果:`, application ? `找到申請 ID: ${application.id}, 狀態: ${application.status}` : '申請不存在');

      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      // 檢查權限：只有 HR Group 獲授權人可以刪除已批核申請的檔案
      const isHRMember = await User.isHRMember(req.user.id);
      const isSystemAdmin = req.user.is_system_admin;
      console.log(`[deleteDocument] 權限檢查: isHRMember=${isHRMember}, isSystemAdmin=${isSystemAdmin}`);

      // 只有 HR Group 獲授權人或系統管理員可以刪除已批核申請的檔案
      if (!isHRMember && !isSystemAdmin) {
        console.log(`[deleteDocument] 權限不足，拒絕刪除`);
        return res.status(403).json({ message: '只有 HR Group 獲授權人可以刪除已批核申請的檔案' });
      }

      // 只有已批核的申請才能被 HR Group 獲授權人刪除檔案
      if (application.status !== 'approved') {
        console.log(`[deleteDocument] 申請狀態不是已批核，當前狀態: ${application.status}`);
        return res.status(403).json({ message: '只能刪除已批核申請的檔案' });
      }

      // 只刪除資料庫記錄，不刪除實體檔案
      const deleteResult = await LeaveDocument.delete(documentId);
      console.log(`[deleteDocument] 資料庫記錄刪除結果:`, deleteResult);

      if (deleteResult === 0) {
        return res.status(404).json({ message: '檔案記錄不存在或已被刪除' });
      }

      res.json({
        message: '檔案已刪除',
        documentId: documentId
      });
    } catch (error) {
      console.error('[deleteDocument] 刪除檔案時發生錯誤:', error);
      console.error('[deleteDocument] 錯誤堆疊:', error.stack);
      res.status(500).json({ 
        message: '刪除檔案時發生錯誤', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getBalances(req, res) {
    try {
      const { user_id, year } = req.query;
      const userId = user_id ? parseInt(user_id) : req.user.id;
      const currentYear = year || new Date().getFullYear();

      // 檢查權限：只有 HR 成員可以查看其他用戶的餘額，一般用戶只能查看自己的
      const isHRMember = await User.isHRMember(req.user.id);
      const isSystemAdmin = req.user.is_system_admin;

      if (!isHRMember && !isSystemAdmin && userId !== req.user.id) {
        return res.status(403).json({ message: '無權限查看其他用戶的假期餘額' });
      }

      const balances = await LeaveBalance.findByUser(userId, currentYear);

      res.json({ balances, year: currentYear });
    } catch (error) {
      console.error('Get balances error:', error);
      res.status(500).json({ message: '獲取假期餘額時發生錯誤' });
    }
  }

  // 申請取消假期
  async requestCancellation(req, res) {
    try {
      const { application_id, reason } = req.body;

      if (!application_id || !reason) {
        return res.status(400).json({ message: '請提供原始申請 ID 和取消原因' });
      }

      const cancellationRequest = await LeaveApplication.createCancellationRequest(
        application_id,
        req.user.id,
        reason
      );

      res.status(201).json({
        message: '取消假期申請已提交',
        application: cancellationRequest
      });
    } catch (error) {
      console.error('Request cancellation error:', error);
      res.status(500).json({ 
        message: error.message || '建立取消申請時發生錯誤',
        error: error.message 
      });
    }
  }

  // 銷假申請
  async requestReversal(req, res) {
    try {
      const { application_id } = req.body;

      if (!application_id) {
        return res.status(400).json({ message: '請提供原始申請 ID' });
      }

      const originalApplication = await LeaveApplication.findById(application_id);
      if (!originalApplication) {
        return res.status(404).json({ message: '申請不存在' });
      }

      const isHRMember = await User.isHRMember(req.user.id);
      const isSystemAdmin = req.user.is_system_admin;
      const isApplicant = originalApplication.user_id === req.user.id;
      
      // 檢查是否為 paper-flow 申請
      const isPaperFlow = originalApplication.is_paper_flow === true || originalApplication.flow_type === 'paper-flow';

      // 如果是 paper-flow，只有 HR 成員可以進行銷假
      if (isPaperFlow) {
        if (!isHRMember && !isSystemAdmin) {
          return res.status(403).json({ message: '只有 HR 成員可以對紙本申請進行銷假' });
        }
      } else {
        // e-flow 申請，申請者本人可以進行銷假
        if (!isApplicant && !isHRMember && !isSystemAdmin) {
          return res.status(403).json({ message: '只有申請人或 HR 才能進行銷假' });
        }
      }

      // 對於 paper-flow，使用原始申請的 user_id；對於 e-flow，使用申請者本人的 user_id
      const userIdForReversal = isPaperFlow ? originalApplication.user_id : (isApplicant ? req.user.id : originalApplication.user_id);

      // 如果是 HR 成員或系統管理員操作，直接批准銷假申請（無需批核流程）
      // 無論原始申請是 paper-flow 還是 e-flow，HR 成員的銷假都直接批准
      const isHRDirectApproval = isHRMember || isSystemAdmin;

      console.log('[requestReversal] HR 直接批准檢查:', {
        isHRMember,
        isSystemAdmin,
        isHRDirectApproval,
        isPaperFlow,
        application_id
      });

      const reversalRequest = await LeaveApplication.createReversalRequest(
        application_id,
        userIdForReversal,
        req.user.id,
        isHRDirectApproval
      );

      console.log('[requestReversal] 銷假申請創建結果:', {
        id: reversalRequest.id,
        status: reversalRequest.status,
        is_reversal_transaction: reversalRequest.is_reversal_transaction
      });

      // HR 成員或系統管理員的銷假申請會直接批准並完成
      const message = isHRDirectApproval && reversalRequest.status === 'approved' 
        ? '銷假申請已完成' 
        : reversalRequest.status === 'approved'
        ? '銷假申請已完成'
        : '銷假申請已提交，等待批核';

      res.status(201).json({
        message,
        application: reversalRequest
      });
    } catch (error) {
      console.error('Request reversal error:', error);
      res.status(500).json({
        message: error.message || '建立銷假申請時發生錯誤',
        error: error.message
      });
    }
  }

  // 取得待批核的申請
  async getPendingApprovals(req, res) {
    try {
      const applications = await LeaveApplication.getPendingApprovals(req.user.id);
      res.json({ applications });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ message: '獲取待批核申請時發生錯誤' });
    }
  }

  // 獲取用戶有權限查看的部門群組及其成員的假期餘額
  async getDepartmentGroupBalances(req, res) {
    try {
      const { year } = req.query;
      const currentYear = year || new Date().getFullYear();
      const userId = req.user.id;

      // 獲取用戶所屬的授權群組
      const userDelegationGroups = await User.getDelegationGroups(userId);
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      if (userDelegationGroupIds.length === 0) {
        return res.json({ departmentGroups: [] });
      }

      // 獲取所有部門群組
      const allDepartmentGroups = await DepartmentGroup.findAll();

      // 過濾出用戶有權限查看的部門群組
      // 用戶有權限如果該部門群組的任一授權群組（checker_id, approver_1_id, approver_2_id, approver_3_id）包含用戶
      const accessibleGroups = allDepartmentGroups.filter(deptGroup => {
        const checkerId = deptGroup.checker_id ? Number(deptGroup.checker_id) : null;
        const approver1Id = deptGroup.approver_1_id ? Number(deptGroup.approver_1_id) : null;
        const approver2Id = deptGroup.approver_2_id ? Number(deptGroup.approver_2_id) : null;
        const approver3Id = deptGroup.approver_3_id ? Number(deptGroup.approver_3_id) : null;

        return userDelegationGroupIds.includes(checkerId) ||
               userDelegationGroupIds.includes(approver1Id) ||
               userDelegationGroupIds.includes(approver2Id) ||
               userDelegationGroupIds.includes(approver3Id);
      });

      // 為每個部門群組獲取成員及其假期餘額
      const result = await Promise.all(
        accessibleGroups.map(async (deptGroup) => {
          // 獲取部門群組的成員
          const members = await DepartmentGroup.getMembers(deptGroup.id);

          // 為每個成員獲取假期餘額
          const membersWithBalances = await Promise.all(
            members.map(async (member) => {
              const balances = await LeaveBalance.findByUser(member.id, currentYear);
              return {
                ...member,
                balances
              };
            })
          );

          return {
            ...deptGroup,
            members: membersWithBalances
          };
        })
      );

      res.json({ 
        departmentGroups: result,
        year: currentYear
      });
    } catch (error) {
      console.error('Get department group balances error:', error);
      res.status(500).json({ message: '獲取部門群組假期餘額時發生錯誤', error: error.message });
    }
  }
}

module.exports = new LeaveController();
