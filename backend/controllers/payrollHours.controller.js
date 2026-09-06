const { getPayrollHours } = require('../services/payrollHours.service');

exports.getPayrollHours = async (req, res) => {
  try {
    const result = await getPayrollHours({
      employee_numbers: req.body.employee_numbers || req.body.employeeNumbers || [],
      periods: req.body.periods || []
    });
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error('[payrollHours] getPayrollHours error:', error);
    }
    res.status(status).json({ message: error.message || 'Failed to compute payroll hours' });
  }
};
