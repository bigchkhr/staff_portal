const { getScheduleHeadcount } = require('../services/scheduleHeadcount.service');

exports.getScheduleHeadcount = async (req, res) => {
  try {
    const result = await getScheduleHeadcount({
      date: req.body?.date,
      store_codes: req.body?.store_codes || req.body?.storeCodes || []
    });
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('[scheduleHeadcount] error:', error);
    res.status(status).json({ message: error.message || 'Failed to count schedule headcount' });
  }
};
