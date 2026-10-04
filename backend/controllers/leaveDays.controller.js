const { getLeaveDays } = require('../services/leaveDays.service');

exports.getLeaveDays = async (req, res) => {
  try {
    const result = await getLeaveDays({
      employee_number: req.body.employee_number || req.body.employeeNumber,
      start_date: req.body.start_date || req.body.startDate,
      end_date: req.body.end_date || req.body.endDate
    });
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error('[leaveDays] getLeaveDays error:', error);
    }
    res.status(status).json({ message: error.message || 'Failed to compute leave days' });
  }
};
