const LeaveApplication = require('../database/models/LeaveApplication');
const LeaveBalance = require('../database/models/LeaveBalance');
const LeaveDocument = require('../database/models/LeaveDocument');
const LeaveType = require('../database/models/LeaveType');
const User = require('../database/models/User');
const path = require('path');

class LeaveController {
  async createApplication(req, res) {
    try {
      const { start_date, end_date, days, leave_type_id, reason, applicant_id } = req.body;
      const applied_by_id = req.user.id;

      if (!start_date || !end_date || !days || !leave_type_id) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const leaveType = await LeaveType.findById(leave_type_id);
      if (!leaveType) {
        return res.status(404).json({ message: '假期類型不存在' });
      }

      const applicantId = applicant_id || req.user.id;
      const applicant = await User.findById(applicantId);
      if (!applicant) {
        return res.status(404).json({ message: '申請人不存在' });
      }

      const currentYear = new Date().getFullYear();

      if (leaveType.requires_balance) {
        const balance = await LeaveBalance.findByUserAndType(applicantId, leave_type_id, currentYear);
        
        if (!balance || parseFloat(balance.balance) < parseFloat(days)) {
          return res.status(400).json({ message: '假期餘額不足' });
        }
      }

      const transactionId = LeaveApplication.generateTransactionId();

      const applicationData = {
        transaction_id: transactionId,
        applicant_id: applicantId,
        applied_by_id: applied_by_id === applicantId ? null : applied_by_id,
        leave_type_id,
        start_date,
        end_date,
        days: parseFloat(days),
        reason: reason || null,
        status: 'pending',
        checker_id: applicant.checker_id,
        approver_1_id: applicant.approver_1_id,
        approver_2_id: applicant.approver_2_id,
        approver_3_id: applicant.approver_3_id
      };

      const application = await LeaveApplication.create(applicationData);

      res.status(201).json({
        message: '假期申請已提交',
        application
      });
    } catch (error) {
      console.error('Create application error:', error);
      res.status(500).json({ message: '建立申請時發生錯誤', error: error.message });
    }
  }

  async getApplications(req, res) {
    try {
      const { status, leave_type_id, transaction_id, applicant_id } = req.query;
      
      const options = {};
      if (status) options.status = status;
      if (leave_type_id) options.leave_type_id = leave_type_id;
      if (transaction_id) options.transaction_id = transaction_id;
      
      const isSystemAdmin = req.user.is_system_admin;
      const isDeptHead = req.user.is_dept_head;
      
      if (!isSystemAdmin && !isDeptHead) {
        options.applicant_id = req.user.id;
      } else if (isDeptHead && !isSystemAdmin) {
        const deptUsers = await User.findAll({ department_id: req.user.department_id });
        const deptUserIds = deptUsers.map(u => u.id);
        if (applicant_id && deptUserIds.includes(parseInt(applicant_id))) {
          options.applicant_id = applicant_id;
        } else if (!applicant_id) {
          return res.status(403).json({ message: '請指定申請人' });
        }
      } else if (applicant_id) {
        options.applicant_id = applicant_id;
      }

      if (isSystemAdmin || isDeptHead) {
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
      const application = await LeaveApplication.findById(id);

      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      const isSystemAdmin = req.user.is_system_admin;
      const isDeptHead = req.user.is_dept_head;
      const isApplicant = application.applicant_id === req.user.id;
      const isApprover = [application.checker_id, application.approver_1_id, application.approver_2_id, application.approver_3_id].includes(req.user.id);

      if (!isSystemAdmin && !isDeptHead && !isApplicant && !isApprover) {
        return res.status(403).json({ message: '無權限查看此申請' });
      }

      res.json({ application });
    } catch (error) {
      console.error('Get application error:', error);
      res.status(500).json({ message: '獲取申請詳情時發生錯誤' });
    }
  }

  async uploadDocument(req, res) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: '請選擇檔案' });
      }

      const application = await LeaveApplication.findById(id);
      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      const isApplicant = application.applicant_id === req.user.id;
      const isAppliedBy = application.applied_by_id === req.user.id;

      if (!isApplicant && !isAppliedBy) {
        return res.status(403).json({ message: '無權限上載檔案到此申請' });
      }

      const documentData = {
        leave_application_id: id,
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_by_id: req.user.id
      };

      const document = await LeaveDocument.create(documentData);

      res.status(201).json({
        message: '檔案上載成功',
        document
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({ message: '上載檔案時發生錯誤' });
    }
  }

  async getDocuments(req, res) {
    try {
      const { id } = req.params;
      const documents = await LeaveDocument.findByApplicationId(id);

      res.json({ documents });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ message: '獲取檔案列表時發生錯誤' });
    }
  }

  async getBalances(req, res) {
    try {
      const { user_id, year } = req.query;
      const userId = user_id || req.user.id;
      const currentYear = year || new Date().getFullYear();

      const isSystemAdmin = req.user.is_system_admin;
      const isDeptHead = req.user.is_dept_head;

      if (!isSystemAdmin && !isDeptHead && userId !== req.user.id.toString()) {
        return res.status(403).json({ message: '無權限查看其他用戶的假期餘額' });
      }

      const balances = await LeaveBalance.findByUser(userId, currentYear);

      res.json({ balances, year: currentYear });
    } catch (error) {
      console.error('Get balances error:', error);
      res.status(500).json({ message: '獲取假期餘額時發生錯誤' });
    }
  }
}

module.exports = new LeaveController();
