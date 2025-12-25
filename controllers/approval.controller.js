const LeaveApplication = require('../database/models/LeaveApplication');
const LeaveBalance = require('../database/models/LeaveBalance');

class ApprovalController {
  async approve(req, res) {
    try {
      const { id } = req.params;
      const { comment, action, stage } = req.body;

      const application = await LeaveApplication.findById(id);
      if (!application) {
        return res.status(404).json({ message: '申請不存在' });
      }

      if (application.status !== 'pending') {
        return res.status(400).json({ message: '此申請已處理' });
      }

      if (action === 'reject') {
        await LeaveApplication.update(id, {
          status: 'rejected',
          rejected_at: new Date(),
          rejected_by_id: req.user.id,
          rejection_reason: comment || '已拒絕'
        });

        return res.json({ message: '申請已拒絕' });
      }

      const currentYear = new Date().getFullYear();
      let updateData = {};

      if (stage === 'checker') {
        if (application.checker_id !== req.user.id) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }
        updateData = {
          checker_comment: comment || null,
          checked_at: new Date(),
          status: application.approver_1_id ? 'pending' : application.approver_2_id ? 'pending' : application.approver_3_id ? 'pending' : 'approved'
        };
      } else if (stage === 'approver_1') {
        if (application.approver_1_id !== req.user.id) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }
        if (!application.checked_at) {
          return res.status(400).json({ message: '尚未通過檢查階段' });
        }
        updateData = {
          approver_1_comment: comment || null,
          approved_1_at: new Date(),
          status: application.approver_2_id ? 'pending' : application.approver_3_id ? 'pending' : 'approved'
        };
      } else if (stage === 'approver_2') {
        if (application.approver_2_id !== req.user.id) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }
        if (!application.approved_1_at) {
          return res.status(400).json({ message: '尚未通過第一批核階段' });
        }
        updateData = {
          approver_2_comment: comment || null,
          approved_2_at: new Date(),
          status: application.approver_3_id ? 'pending' : 'approved'
        };
      } else if (stage === 'approver_3') {
        if (application.approver_3_id !== req.user.id) {
          return res.status(403).json({ message: '無權限進行此操作' });
        }
        if (!application.approved_2_at) {
          return res.status(400).json({ message: '尚未通過第二批核階段' });
        }
        updateData = {
          approver_3_comment: comment || null,
          approved_3_at: new Date(),
          status: 'approved'
        };
      } else {
        return res.status(400).json({ message: '無效的批核階段' });
      }

      const updatedApplication = await LeaveApplication.update(id, updateData);

      if (updatedApplication.status === 'approved') {
        const leaveType = await require('../database/models/LeaveType').findById(application.leave_type_id);
        
        if (leaveType && leaveType.requires_balance) {
          await LeaveBalance.decrementBalance(
            application.applicant_id,
            application.leave_type_id,
            currentYear,
            application.days
          );
        }
      }

      res.json({
        message: '批核成功',
        application: updatedApplication
      });
    } catch (error) {
      console.error('Approve error:', error);
      res.status(500).json({ message: '批核時發生錯誤', error: error.message });
    }
  }

  async getPendingApprovals(req, res) {
    try {
      const applications = await LeaveApplication.findAll({ 
        status: 'pending',
        approver_id: req.user.id 
      });

      res.json({ applications });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ message: '獲取待批核申請時發生錯誤' });
    }
  }
}

module.exports = new ApprovalController();

