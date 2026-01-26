const bcrypt = require('bcryptjs');

const APPROVAL_STAGE_CONFIG = [
  { level: 'checker', idField: 'checker_id', timestampField: 'checker_at' },
  { level: 'approver_1', idField: 'approver_1_id', timestampField: 'approver_1_at' },
  { level: 'approver_2', idField: 'approver_2_id', timestampField: 'approver_2_at' },
  { level: 'approver_3', idField: 'approver_3_id', timestampField: 'approver_3_at' }
];

const determineSeedApprovalStage = (application = {}) => {
  for (const stage of APPROVAL_STAGE_CONFIG) {
    const hasAssignee = application[stage.idField];
    const isCompleted = Boolean(application[stage.timestampField]);
    if (hasAssignee && !isCompleted) {
      return stage.level;
    }
  }
  return 'completed';
};

const syncLeaveApplicationStages = async (knex) => {
  const applications = await knex('leave_applications').select(
    'id',
    'start_date',
    'checker_id',
    'checker_at',
    'approver_1_id',
    'approver_1_at',
    'approver_2_id',
    'approver_2_at',
    'approver_3_id',
    'approver_3_at',
    'current_approval_stage',
    'year'
  );

  if (!applications.length) {
    return;
  }

  for (const application of applications) {
    const updates = {};
    
    // 同步批核階段
    const resolvedStage = determineSeedApprovalStage(application);
    if (application.current_approval_stage !== resolvedStage) {
      updates.current_approval_stage = resolvedStage;
    }
    
    // 如果year字段為null或未設置，從start_date計算年份
    if (!application.year && application.start_date) {
      const year = new Date(application.start_date).getFullYear();
      updates.year = year;
    } else if (!application.year) {
      // 如果沒有start_date，使用當前年份
      updates.year = new Date().getFullYear();
    }
    
    // 如果有需要更新的字段，執行更新
    if (Object.keys(updates).length > 0) {
      await knex('leave_applications')
        .where('id', application.id)
        .update(updates);
    }
  }
};

exports.seed = async function (knex) {
  // 清空所有表（注意順序，避免外鍵約束問題）
  await knex('leave_balance_transactions').del();
  await knex('leave_applications').del();
  await knex('outdoor_work_applications').del();
  await knex('extra_working_hours_applications').del();
  await knex('payroll_alert_items').del();
  await knex('hr_todos').del();
  await knex('user_todos').del();
  await knex('form_library').del();
  await knex('employee_documents').del();
  await knex('external_links').del();
  // 先清空排班表（在清空 users 和 department_groups 之前，避免 CASCADE 刪除時的潛在問題）
  await knex('schedules').del();
  await knex('users').del();
  await knex('stores').del();
  await knex('department_groups').del();
  await knex('delegation_groups').del();
  await knex('leave_types').del();
  await knex('public_holidays').del();
  await knex('positions').del();
  await knex('departments').del();
  await knex('system_years').del();

  // 建立系統年份
  await knex('system_years').insert([
    { year: 2023, is_active: true, display_order: 1 },
    { year: 2024, is_active: true, display_order: 2 },
    { year: 2025, is_active: true, display_order: 3 },
    { year: 2026, is_active: true, display_order: 4 }
  ]);

  // 建立部門
  await knex('departments').insert([
    { name: 'Accounting', name_zh: '會計部', description: '' },
    { name: 'B2B', name_zh: '商務部', description: '' },
    { name: 'Business Development', name_zh: '業務拓展部', description: '' },
    { name: 'Category', name_zh: '品類部', description: '' },
    { name: 'General Administration', name_zh: '行政部', description: '' },
    { name: 'Human Resources', name_zh: '人力資源部', description: '' },
    { name: 'IT', name_zh: '資訊科技部', description: '' },
    { name: 'Managing Director', name_zh: '董事總經理', description: '' },
    { name: 'Marketing', name_zh: '市場推廣部', description: '' },
    { name: 'Merchandising', name_zh: '採購部', description: '' },
    { name: 'Project', name_zh: '專案部', description: '' },
    { name: 'Property', name_zh: '物業部', description: '' },
    { name: 'Retail', name_zh: '零售部', description: '' },
    { name: 'Supply Chain & Logistics', name_zh: '供應鏈及物流部', description: '' }
  ]);

  // 建立職位
  await knex('positions').insert([
    { name: 'System', name_zh: '系統', description: '系統', employment_mode: 'FT', stream: 'Head Office', display_order: 1 },
    { name: 'Managing Director', name_zh: '董事總經理', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 2 },
    { name: 'Financial Controller', name_zh: 'Financial Controller', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 3 },
    { name: 'Assistant Accounting Manager ', name_zh: 'Assistant Accounting Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 4 },
    { name: 'Assistant Category Manager', name_zh: 'Assistant Category Manager ', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 5 },
    { name: 'Project Executive', name_zh: 'Project Executive', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 6 },
    { name: 'Senior Accounting Manager', name_zh: 'Senior Accounting Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 7 },
    { name: 'Category Manager', name_zh: 'Category Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 8 },
    { name: 'Accounting Officer', name_zh: 'Accounting Officer', description: 'Accounting Officer', employment_mode: 'FT', stream: 'Head Office', display_order: 9 },
    { name: 'Part-Time Accounting Clerk', name_zh: 'Part-Time Accounting Clerk', description: '', employment_mode: 'PT', stream: 'Head Office', display_order: 10 },
    { name: 'Accountant', name_zh: 'Accountant', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 11 },
    { name: 'Senior Category Manager', name_zh: 'Senior Category Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 12 },
    { name: 'Project Supervisor', name_zh: 'Project Supervisor', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 13 },
    { name: 'Senior Merchandiser', name_zh: 'Senior Merchandiser', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 14 },
    { name: 'Business Analyst', name_zh: 'Business Analyst', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 15 },
    { name: 'Technician', name_zh: 'Technician', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 16 },
    { name: 'Product Development Manager', name_zh: 'Product Development Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 17 },
    { name: 'Senior Accounts Clerk', name_zh: 'Senior Accounts Clerk', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 18 },
    { name: 'Commercial Manager', name_zh: 'Commercial Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 19 },
    { name: 'Assistant Merchandising Admin Manager', name_zh: 'Assistant Merchandising Admin Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 20 },
    { name: 'Senior Merchandising Manager', name_zh: 'Senior Merchandising Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 21 },
    { name: 'Senior Buyer', name_zh: 'Senior Buyer', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 22 },
    { name: 'Head of Merchandising', name_zh: 'Head of Merchandising', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 23 },
    { name: 'Office Assistant', name_zh: 'Office Assistant', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 24 },
    { name: 'General Administration Manager', name_zh: 'General Administration Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 25 },
    { name: 'Administration Officer', name_zh: 'Administration Officer', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 26 },
    { name: 'Assistant Business Development Manager', name_zh: 'Assistant Business Development Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 27 },
    { name: 'Human Resources Manager', name_zh: 'Human Resources Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 28 },
    { name: 'Assistant Merchandiser', name_zh: 'Assistant Merchandiser', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 29 },
    { name: 'Senior HR Officer', name_zh: 'Senior HR Officer', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 30 },
    { name: 'Assistant Manager (E-Business & IT)', name_zh: 'Assistant Manager (E-Business & IT)', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 31 },
    { name: 'Promoter', name_zh: 'Promoter', description: 'Promoter', employment_mode: 'FT', stream: 'Store', display_order: 32 },
    { name: 'Store Manager', name_zh: '店舖經理', description: '', employment_mode: 'FT', stream: 'Store', display_order: 2 },
    { name: 'Senior Customer Service Associate', name_zh: '高級店舖員', description: '', employment_mode: 'FT', stream: 'Store', display_order: 4 },
    { name: 'Assistant Area Manager', name_zh: 'Assistant Area Manager', description: '', employment_mode: 'FT', stream: 'Store', display_order: 35 },
    { name: 'Store Supervisor', name_zh: '店舖主任', description: '', employment_mode: 'FT', stream: 'Store', display_order: 3 },
    { name: 'Senior Store Manager', name_zh: '高級店舖經理', description: '', employment_mode: 'FT', stream: 'Store', display_order: 1 },
    { name: 'Customer Service Associate', name_zh: '店務員', description: '', employment_mode: 'FT', stream: 'Store', display_order: 5 },
    { name: 'COO - International Business North Asia & Managing Director of BigC (HK)', name_zh: 'COO - International Business North Asia & Managing Director of BigC (HK) ', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 39 },
    { name: 'Store Keeper', name_zh: 'Store Keeper', description: 'Store Keeper', employment_mode: 'FT', stream: 'Store', display_order: 40 },
    { name: 'Part Time Promoter', name_zh: 'Part Time Promoter', description: '', employment_mode: 'PT', stream: 'Store', display_order: 41 },
    { name: 'Part Time Store Supervisor', name_zh: 'Part Time Store Supervisor', description: '', employment_mode: 'PT', stream: 'Store', display_order: 42 },
    { name: 'Part Time Customer Service Associate', name_zh: '兼職店務員', description: '', employment_mode: 'PT', stream: 'Store', display_order: 6 },
    { name: 'Part Time Store Keeper', name_zh: 'Part Time Store Keeper', description: '', employment_mode: 'PT', stream: 'Store', display_order: 44 },
    { name: 'Creative Manager', name_zh: 'Creative Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 45 },
    { name: 'Retail Operation Executive', name_zh: 'Retail Operation Executive', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 46 },
    { name: 'Merchandising Assistant', name_zh: 'Merchandising Assistant ', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 47 },
    { name: 'Project Manager ', name_zh: 'Project Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 48 },
    { name: 'Accounts Clerk', name_zh: 'Accounts Clerk', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 49 },
    { name: 'IT Manager', name_zh: 'IT Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 50 },
    { name: 'Sales Admin Assistant', name_zh: 'Sales Admin Assistant', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 51 },
    { name: 'Training Manager', name_zh: 'Training Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 52 },
    { name: 'Senior Retail Operation Executive', name_zh: 'Senior Retail Operation Executive', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 53 },
    { name: 'Senior IT Officer', name_zh: 'Senior IT Officer', description: 'Senior IT Officer', employment_mode: 'FT', stream: 'Head Office', display_order: 54 },
    { name: 'Assistant Head of Operation', name_zh: 'Assistant Head of Operation', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 55 },
    { name: 'Retail Operation Manager', name_zh: 'Retail Operation Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 56 },
    { name: 'Assistant Vice President of Retail Operation', name_zh: 'Assistant Vice President of Retail Operation', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 57 },
    { name: 'Inventory Planning Manager', name_zh: 'Inventory Planning Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 58 },
    { name: 'Assistant Inventory Control Manager', name_zh: 'Assistant Inventory Control Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 59 },
    { name: 'IT Officer', name_zh: 'IT Officer', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 60 },
    { name: 'Inventory Planning Manager ', name_zh: 'Inventory Planning Manager  ', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 61 },
    { name: 'Assistant Inventory Management Manager', name_zh: 'Assistant Inventory Management Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 62 },
    { name: 'Assistant Inventory Management Manager', name_zh: 'Assistant Inventory Management Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 63 },
    { name: 'IT Support Officer', name_zh: 'IT Support Officer', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 64 },
    { name: 'Assistant Property Manager', name_zh: 'Assistant Property Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 65 },
    { name: 'E-Commerce & Business Development Manager', name_zh: 'E-Commerce & Business Development Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 66 },
    { name: 'Assistant Finance Manager', name_zh: 'Assistant Finance Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 67 },
    { name: 'Driver', name_zh: 'Driver', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 68 },
    { name: 'Assistant Project Manager', name_zh: 'Assistant Project Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 69 },
    { name: 'Part Time Retail Operation Assistant', name_zh: 'Part Time Retail Operation Assistant', description: '', employment_mode: 'PT', stream: 'Head Office', display_order: 70 },
    { name: 'Senior Supply Chain Manager', name_zh: 'Senior Supply Chain Manager', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 71 },
    { name: 'Intern Part Time Customer Service Associate', name_zh: 'Intern Part Time Customer Service Associate', description: '', employment_mode: 'PT', stream: 'Store', display_order: 72 },
    { name: 'Intern Customer Service Associate', name_zh: 'Intern Customer Service Associate', description: '', employment_mode: 'FT', stream: 'Store', display_order: 73 },
    { name: 'Sales Manager', name_zh: 'Sales Manager', description: '', employment_mode: 'FT', stream: 'Store', display_order: 74 },
    { name: 'Marketing Specialist', name_zh: 'Marketing Specialist', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 75 },
    { name: 'Assistant Accountant', name_zh: 'Assistant Accountant', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 76 },
    { name: 'Sales Executive', name_zh: 'Sales Executive', description: '', employment_mode: 'FT', stream: 'Store', display_order: 77 },
    { name: 'Area Supervisor', name_zh: 'Area Supervisor', description: '', employment_mode: 'FT', stream: 'Store', display_order: 78 },
    { name: 'Office Intern', name_zh: 'Office Intern', description: '', employment_mode: 'FT', stream: 'Head Office', display_order: 79 },
    { name: 'Part Time E-Commerce Assistant', name_zh: 'Part Time E-Commerce Assistant', description: '', employment_mode: 'PT', stream: 'Head Office', display_order: 80 },
    { name: 'Part Time Sales Consultant', name_zh: 'Part Time Sales Consultant', description: '', employment_mode: 'PT', stream: 'Head Office', display_order: 81 }
  ]);

  // 建立授權群組 (Delegation Groups)
  const delegationGroups = await knex('delegation_groups').insert([
    { name: 'HR Group', name_zh: 'HR群組', description: '', user_ids: [1, 29, 31], closed: false },
    { name: 'Accounting', name_zh: '會計部授權群組', description: '', user_ids: [3], closed: false },
    { name: 'B2B (Retailer)', name_zh: '商務部授權群組 (Retailer)', description: '', user_ids: [451], closed: false },
    { name: 'Business Development', name_zh: '業務拓展部授權群組', description: '', user_ids: [], closed: false },
    { name: 'Category', name_zh: '品類部授權群組', description: '', user_ids: [], closed: false },
    { name: 'General Administration', name_zh: '行政部授權群組', description: '', user_ids: [26], closed: false },
    { name: 'Human Resources', name_zh: '人力資源部授權群組', description: '', user_ids: [29], closed: false },
    { name: 'IT', name_zh: '資訊科技部授權群組', description: '', user_ids: [], closed: false },
    { name: 'Marketing', name_zh: '市場推廣部授權群組', description: '', user_ids: [], closed: false },
    { name: 'Merchandising', name_zh: '採購部授權群組', description: '', user_ids: [23], closed: false },
    { name: 'Project', name_zh: '專案部授權群組', description: '', user_ids: [], closed: false },
    { name: 'Retail Heads', name_zh: '零售主管部授權群組', description: '', user_ids: [284, 265, 38 ,234], closed: false },
    { name: 'Retail Checker', name_zh: '零售覆核部授權群組', description: '', user_ids: [], closed: false },
    { name: 'Supply Chain and Logistics', name_zh: '供應鏈及物流部授權群組', description: '', user_ids: [312], closed: false },
    { name: 'Retail Checker - ADM', name_zh: 'ADM覆核授權群組', description: '', user_ids: [], closed: true },
    { name: 'Retail Checker - TWS', name_zh: 'TWS覆核授權群組', description: '', user_ids: [243], closed: false },
    { name: 'Retail Checker - WTS', name_zh: 'WTS覆核授權群組', description: '', user_ids: [65], closed: false },
    { name: 'Retail Checker - LF1', name_zh: 'LF1覆核授權群組', description: '', user_ids: [236], closed: false },
    { name: 'Retail Checker - TK3', name_zh: 'TK3覆核授權群組', description: '', user_ids: [54], closed: false },
    { name: 'Retail Checker - TK4', name_zh: 'TK4覆核授權群組', description: '', user_ids: [326], closed: false },
    { name: 'Retail Checker - OC', name_zh: 'OC覆核授權群組', description: '', user_ids: [241], closed: false },
    { name: 'Retail Checker - SP1', name_zh: 'SP1覆核授權群組', description: '', user_ids: [44], closed: false },
    { name: 'Retail Checker - WPG', name_zh: 'WPG覆核授權群組', description: '', user_ids: [202], closed: false },
    { name: 'Retail Checker - MK2', name_zh: 'MK2覆核授權群組', description: '', user_ids: [140], closed: false },
    { name: 'Retail Checker - TT2', name_zh: 'TT2覆核授權群組', description: '', user_ids: [239], closed: false },
    { name: 'Retail Checker - CDW', name_zh: 'CDW覆核授權群組', description: '', user_ids: [], closed: true },
    { name: 'Retail Checker - TW2', name_zh: 'TW2覆核授權群組', description: '', user_ids: [46], closed: false },
    { name: 'Retail Checker - TY4', name_zh: 'TY4覆核授權群組', description: '', user_ids: [141], closed: false },
    { name: 'Retail Checker - TW3', name_zh: 'TW3覆核授權群組', description: '', user_ids: [], closed: true },
    { name: 'Retail Checker - FAN', name_zh: 'FAN覆核授權群組', description: '', user_ids: [328], closed: false },
    { name: 'Retail Checker - TPU', name_zh: 'TPU覆核授權群組', description: '', user_ids: [88], closed: false },
    { name: 'Retail Checker - TP2', name_zh: 'TP2覆核授權群組', description: '', user_ids: [34,42], closed: false },
    { name: 'Retail Checker - MO2', name_zh: 'MO2覆核授權群組', description: '', user_ids: [67], closed: false },
    { name: 'Retail Checker - ST1', name_zh: 'ST1覆核授權群組', description: '', user_ids: [52], closed: false },
    { name: 'Retail Checker - TM1', name_zh: 'TM1覆核授權群組', description: '', user_ids: [43], closed: false },
    { name: 'Retail Checker - YL3', name_zh: 'YL3覆核授權群組', description: '', user_ids: [], closed: true },
    { name: 'Retail Checker - YL4', name_zh: 'YL4覆核授權群組', description: '', user_ids: [316], closed: false },
    { name: 'Direct Reporting to MD', name_zh: 'Direct Reporting to MD', description: '', user_ids: [68], closed: false },
    { name: 'B2B (HoReca)', name_zh: '商務部授權群組 (HoReca)', description: '', user_ids: [450], closed: false },
  ]).returning('*');

  // 取得各授權群組的 ID
  const hrGroupId = delegationGroups.find(g => g.name === 'HR Group').id;
  const accountingDelegId = delegationGroups.find(g => g.name === 'Accounting').id;
  // 注意：B2B 沒有單一的授權群組，而是分為 'B2B (Retailer)' 和 'B2B (HoReca)'
  const bdDelegId = delegationGroups.find(g => g.name === 'Business Development').id;
  const categoryDelegId = delegationGroups.find(g => g.name === 'Category').id;
  const gaDelegId = delegationGroups.find(g => g.name === 'General Administration').id;
  const hrDelegId = delegationGroups.find(g => g.name === 'Human Resources').id;
  const itDelegId = delegationGroups.find(g => g.name === 'IT').id;
  const marketingDelegId = delegationGroups.find(g => g.name === 'Marketing').id;
  const merchandisingDelegId = delegationGroups.find(g => g.name === 'Merchandising').id;
  const projectDelegId = delegationGroups.find(g => g.name === 'Project').id;
  const retailHeadsDelegId = delegationGroups.find(g => g.name === 'Retail Heads').id;
  const retailCheckerDelegId = delegationGroups.find(g => g.name === 'Retail Checker').id;
  const scDelegId = delegationGroups.find(g => g.name === 'Supply Chain and Logistics').id;

  // 建立部門群組 (Department Groups)
  // 格式：checker為null、approver_1為對應的delegation group、approver_2為null、approver_3為HR群組
  await knex('department_groups').insert([
    {
      name: 'Accounting',
      name_zh: '會計部群組',
      description: '',
      user_ids: [4, 7, 9, 18, 348, 432],
      checker_id: null,
      approver_1_id: accountingDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'B2B (Retailer)',
      name_zh: '商務部群組 (Retailer)',
      description: '',
      user_ids: [205, 478, 489],
      checker_id: null,
      approver_1_id: 3,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    
    {
      name: 'Business Development',
      name_zh: '業務拓展部群組',
      description: '',
      user_ids: [],
      checker_id: null,
      approver_1_id: bdDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: true
    },
    {
      name: 'Category',
      name_zh: '品類部群組',
      description: '',
      user_ids: [],
      checker_id: null,
      approver_1_id: categoryDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: true
    },
    {
      name: 'General Administration',
      name_zh: '行政部群組',
      description: '',
      user_ids: [25, 290, 315],
      checker_id: null,
      approver_1_id: gaDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Human Resources',
      name_zh: '人力資源部群組',
      description: '',
      user_ids: [31],
      checker_id: null,
      approver_1_id: hrDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'IT',
      name_zh: '資訊科技部群組',
      description: '',
      user_ids: [],
      checker_id: null,
      approver_1_id: itDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Marketing',
      name_zh: '市場推廣部群組',
      description: '',
      user_ids: [],
      checker_id: null,
      approver_1_id: marketingDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Merchandising',
      name_zh: '採購部群組',
      description: '',
      user_ids: [20, 21, 154, 275, 278, 311, 318, 471, 486,491],
      checker_id: null,
      approver_1_id: merchandisingDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Project',
      name_zh: '專案部群組',
      description: '',
      user_ids: [],
      checker_id: null,
      approver_1_id: projectDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Administration',
      name_zh: '零售行政群組',
      description: '',
      user_ids: [38, 234],
      checker_id: null,
      approver_1_id: retailHeadsDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Supply Chain and Logistics',
      name_zh: '供應鏈及物流部群組',
      description: '',
      user_ids: [267, 268, 270, 271, 273],
      checker_id: null,
      approver_1_id: scDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Property',
      name_zh: '物業部群組',
      description: '',
      user_ids: [],
      checker_id: null,
      approver_1_id: scDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - ADM',
      name_zh: '零售店舖群組 - ADM',
      description: '',
      user_ids: [],
      checker_id: 15,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: true
    },
    {
      name: 'Retail Store - TWS',
      name_zh: '零售店舖群組 - TWS',
      description: '',
      user_ids: [196, 243, 295, 466, 479],
      checker_id: 16,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - WTS',
      name_zh: '零售店舖群組 - WTS',
      description: '',
      user_ids: [37, 61, 65, 124, 128, 201, 406, 429],
      checker_id: 17,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - LF1',
      name_zh: '零售店舖群組 - LF1',
      description: '',
      user_ids: [110, 155, 236, 242, 330, 392, 428, 474],
      checker_id: 18,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TK3',
      name_zh: '零售店舖群組 - TK3',
      description: '',
      user_ids: [54, 193, 258, 403, 470],
      checker_id: 19,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TK4',
      name_zh: '零售店舖群組 - TK4',
      description: '',
      user_ids: [161, 218, 326, 455, 226, 260],
      checker_id: 20,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - OC',
      name_zh: '零售店舖群組 - OC',
      description: '',
      user_ids: [164, 217, 241, 249, 297],
      checker_id: 21,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - SP1',
      name_zh: '零售店舖群組 - SP1',
      description: '',
      user_ids: [138, 303, 457, 461, 473, 44, 48],
      checker_id: 22,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - WPG',
      name_zh: '零售店舖群組 - WPG',
      description: '',
      user_ids: [82, 99, 202, 306, 411, 448, 472],
      checker_id: 23,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - MK2',
      name_zh: '零售店舖群組 - MK2',
      description: '',
      user_ids: [36, 69, 108, 136, 140, 293, 308],
      checker_id: 24,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TT2',
      name_zh: '零售店舖群組 - TT2',
      description: '',
      user_ids: [239, 400, 409, 414, 456, 477],
      checker_id: 25,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - CDW',
      name_zh: '零售店舖群組 - CDW',
      description: '',
      user_ids: [],
      checker_id: 26,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: true
    },
    {
      name: 'Retail Store - TW2',
      name_zh: '零售店舖群組 - TW2',
      description: '',
      user_ids: [46, 58, 120, 122, 175, 272, 299, 339],
      checker_id: 27,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TY4',
      name_zh: '零售店舖群組 - TY4',
      description: '',
      user_ids: [141, 169, 276, 378, 458, 464],
      checker_id: 28,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TW3',
      name_zh: '零售店舖群組 - TW3',
      description: '',
      user_ids: [],
      checker_id: 29,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: true
    },
    {
      name: 'Retail Store - FAN',
      name_zh: '零售店舖群組 - FAN',
      description: '',
      user_ids: [87, 328, 467, 468, 480, 481, 483],
      checker_id: 30,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TPU',
      name_zh: '零售店舖群組 - TPU',
      description: '',
      user_ids: [88, 89, 422, 462, 485],
      checker_id: 31,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TP2',
      name_zh: '零售店舖群組 - TP2',
      description: '',
      user_ids: [34, 42, 354, 423, 439, 443, 453, 482],
      checker_id: 32,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - MO2',
      name_zh: '零售店舖群組 - MO2',
      description: '',
      user_ids: [56, 67, 114, 387, 426, 445, 476],
      checker_id: 33,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - ST1',
      name_zh: '零售店舖群組 - ST1',
      description: '',
      user_ids: [52, 222, 300, 417, 420, 425, 452],
      checker_id: 34,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - TM1',
      name_zh: '零售店舖群組 - TM1',
      description: '',
      user_ids: [43, 75, 78, 389, 437, 444, 465, 407],
      checker_id: 35,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Retail Store - YL3',
      name_zh: '零售店舖群組 - YL3',
      description: '',
      user_ids: [],
      checker_id: 36,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: true
    },
    {
      name: 'Retail Store - YL4',
      name_zh: '零售店舖群組 - YL4',
      description: '',
      user_ids: [131, 156, 316, 376, 385, 416, 463],
      checker_id: 37,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Direct Reporting to MD',
      name_zh: 'Direct Reporting to MD',
      description: '',
      user_ids: [3, 19, 450, 451, 478, 26, 29, 412, 23, 291, 265, 284, 312],
      checker_id: null,
      approver_1_id: 38,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'Managing Director',
      name_zh: '董事總經理',
      description: '',
      user_ids: [68],
      checker_id: null,
      approver_1_id: null,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
    {
      name: 'B2B (HoReCa)',
      name_zh: '商務部群組 (HoReCa)',
      description: '',
      user_ids: [487, 490],
      checker_id: null,
      approver_1_id: 39,
      approver_2_id: null,
      approver_3_id: hrGroupId,
      closed: false
    },
  ]);

  // 建立店舖資料 (Stores)
  await knex('stores').insert([
    {
      store_code: '83008',
      store_short_name_: 'ADM',
      address_en: null,
      address_chi: null,
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83026',
      store_short_name_: 'TWS',
      address_en: 'Shop No.202A & 202B, 2/F, Tsz Wan Shan Shopping Centre, Tsz Wan Shan',
      address_chi: '慈雲山毓華街23號慈雲山中心2樓202A-202B號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83023',
      store_short_name_: 'WTS',
      address_en: 'Shop No. UG42, UG/F, Temple Mall South, Wong Tai Sin',
      address_chi: '黃大仙黃大仙中心南館地下高層UG42號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83036',
      store_short_name_: 'LF1',
      address_en: 'Shop Nos. 3129 and 3130, 3/F, Zone A, Lok Fu Place, Lok Fu',
      address_chi: '橫頭磡聯合道198號樂富廣場3樓3129及3130號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83005',
      store_short_name_: 'TK3',
      address_en: 'Shop 137, 1/F, The Lane, 15 Pui Shing Road, Hang Hau, Tseung Kwan O',
      address_chi: '將軍澳坑口培成路15號連理街商場1樓137號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83040',
      store_short_name_: 'TK4',
      address_en: 'Shop 222, 2/F, Choi Ming Shopping Centre, 1 Choi Ming Street, Tiu Keng Leng, Tseung Kwan O',
      address_chi: '將軍澳調景嶺彩明街1號彩明商場2樓222舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83020',
      store_short_name_: 'OC',
      address_en: 'Shop UG10-11, Olympian City 3, 18 Hoi Ting Road, Tai Kok Tsui',
      address_chi: '大角咀海泓道1號奧海城三期一樓UG10-11舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83044',
      store_short_name_: 'SP1',
      address_en: 'Shop L2-43, 2/F, V Walk, 28 Sham Mong Road(MTR Nam Cheong Station), Sham Shui Po',
      address_chi: '深水埗深旺道28號(港鐵南昌站)V Walk 2樓L2-43號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83004',
      store_short_name_: 'WPG',
      address_en: 'G9-10, Treasure World (Site 11), Whampoa World, 6 Shung King Street, Hung Hom',
      address_chi: '紅磡黃埔花園11期(聚寶坊)地下G09-G10號舖 ',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83033',
      store_short_name_: 'MK2',
      address_en: 'Shop 1-2, Ground Floor, Sun Kong House, Nos 2J-2Q, Sai Yeung Choi Street South, Mongkok',
      address_chi: '旺角西洋菜南街2J-2Q 新江大樓地下1-2號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83032',
      store_short_name_: 'TT2',
      address_en: 'No.13, 13A & 15 Lock Road, Tsim Sha Tsui',
      address_chi: '尖沙咀樂道13、13A及15號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83003',
      store_short_name_: 'CDW',
      address_en: null,
      address_chi: null,
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: true
    },
    {
      store_code: '83019',
      store_short_name_: 'TW2',
      address_en: 'Shop No. G005 & G006, G/F, KOLOUR, Tsuen Wan 1, 68 Chung On Street, Tsuen Wan',
      address_chi: '荃灣眾安街68號千色匯1期地下G005-006舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83006',
      store_short_name_: 'TY4',
      address_en: 'Shop 194, 1/F, Maritime Square 2, 33 Tsing King Road, Tsing Yi',
      address_chi: '青衣青敬路33號青衣城二期一樓194號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83034',
      store_short_name_: 'TW3',
      address_en: null,
      address_chi: null,
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: true
    },
    {
      store_code: '83037',
      store_short_name_: 'FAN',
      address_en: 'Shop 103 & 108, 33 San Wan Road, Fanling centre, Fanling',
      address_chi: '粉嶺新運路33號粉嶺中心103及108舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83035',
      store_short_name_: 'TPU',
      address_en: 'Shop L1-060, Uptown Plaza ,9 Nam Wan Road, Tai Po',
      address_chi: '大埔南運路9號新達廣場L1-060舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83045',
      store_short_name_: 'TP2',
      address_en: 'Shop Nos. 233-234, 2/F, Tai Wo Plaza, Tai Po',
      address_chi: '大埔太和廣場2樓233-234號舖​',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83039',
      store_short_name_: 'MO2',
      address_en: 'Shop 2318, Level 2 MOStown,18 On Luk Street, Ma On Shan',
      address_chi: '馬鞍山鞍祿街18號新港城中心2樓2318舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83047',
      store_short_name_: 'ST1',
      address_en: 'Shop Nos. 207 and 208, 2/F, Wo Che Plaza, 3 Tak Hau Street, Sha Tin',
      address_chi: '沙田德厚街3號禾輋廣場2樓207及208號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83046',
      store_short_name_: 'TM1',
      address_en: 'Shop 2198C, 2198D &2199G, 2/F, Tuen Mun Town Plaza, Phase I, Tuen Mun',
      address_chi: '屯門屯門市廣場1期2樓2198C、2198D及2199G號舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83025',
      store_short_name_: 'YL3',
      address_en: null,
      address_chi: null,
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: true
    },
    {
      store_code: '83038',
      store_short_name_: 'YL4',
      address_en: 'Shop 152, YOHO MIX, 1 Long Lok Road, Yuen Long',
      address_chi: '元朗朗樂路1號YOHO MIX元點152舖',
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83041',
      store_short_name_: 'HO',
      address_en: null,
      address_chi: null,
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    },
    {
      store_code: '83301',
      store_short_name_: 'HO',
      address_en: null,
      address_chi: null,
      tel: null,
      email: null,
      open_date: null,
      close_date: null,
      district: null,
      is_closed: false
    }
  ]);

  // 建立假期類型
  await knex('leave_types').insert([
    { code: 'AL', name: 'Annual Leave', name_zh: '年假', requires_balance: true, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'BL', name: 'Birthday Leave', name_zh: '生日假', requires_balance: true, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'CL', name: 'Compensatory Leave', name_zh: '補假', requires_balance: true, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'FPSL', name: 'Full Paid Sick Leave', name_zh: '全薪病假', requires_balance: true, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'SAL', name: 'Sick Leave (Sickness Allowance)', name_zh: '病假 (疾病津貼)', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'MGL', name: 'Marriage Leave', name_zh: '婚假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'MTL', name: 'Maternity Leave', name_zh: '產假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'PTL', name: 'Paternity Leave', name_zh: '侍產假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'JSL', name: 'Jury Service Leave', name_zh: '陪審團假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'CPL', name: 'Compassionate Leave', name_zh: '恩恤假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'NPSL', name: 'No Pay Sick Leave', name_zh: '無薪病假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'NPL', name: 'No Pay Personal Leave', name_zh: '無薪事假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'IL', name: 'Work Injury Leave', name_zh: '工傷病假', requires_balance: false, allow_schedule_input: false, is_available_in_flow: true },
    { code: 'SPL', name: 'Special Leave', name_zh: '特別假期', requires_balance: false, allow_schedule_input: true, is_available_in_flow: true },
    { code: 'AR', name: 'Accumulated Rest Day', name_zh: '累積例假', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'R1', name: 'Rest Day 1', name_zh: '例假 1', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'R2', name: 'Rest Day 2', name_zh: '例假 2', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'R3', name: 'Rest Day 3', name_zh: '例假 3', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'R4', name: 'Rest Day 4', name_zh: '例假 4', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'R5', name: 'Rest Day 5', name_zh: '例假 5', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'R6', name: 'Rest Day 6', name_zh: '例假 6', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'SH', name: 'Statutory Holiday', name_zh: '法定假期', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false },
    { code: 'ABS', name: 'Absent', name_zh: '缺勤', requires_balance: false, allow_schedule_input: true, is_available_in_flow: false}
  ]);

  // 建立群組聯絡人模板數據
  // 獲取部門群組 ID
  // 取得部門和職位 ID
  const departments = await knex('departments').select('*');
  const positions = await knex('positions').select('*');
  const hrDept = departments.find(d => d.name === 'Human Resources');
  const managerPos = positions.find(p => p.name === 'System');
  const staffPos = positions.find(p => p.name === 'Staff');

  // 建立系統管理員（HR 群組成員）
  const adminPasswordHash = await bcrypt.hash('bigc0723!', 10);
  const [admin] = await knex('users').insert([
    {
      employee_number: 'superuser',
      surname: 'Admin',
      given_name: 'System',
      alias: 'Admin',
      display_name: 'Admin',
      name_zh: '系統管理員',
      email: '',
      password_hash: adminPasswordHash,
      department_id: hrDept.id,
      position_id: managerPos.id,
      hire_date: '2020-01-01',
      deactivated: false,
      created_at: '2025-11-09 10:00:50.179784+00',
      updated_at: '2025-11-09 10:00:50.179784+00'
    },
 
  ]).returning('*');

  // 建立外部連結
  if (admin && admin.id) {
    await knex('external_links').insert([
      {
        name: 'Big C HK Website',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'https://www.bigchk.com',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 1,
        is_active: true
      },
      {
        name: 'Internal E-mail',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'https://mail.bigc.co.th/',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 2,
        is_active: true
      },
      {
        name: 'E-Learning',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'https://elearning.bigchk.com',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 3,
        is_active: true
      },
      {
        name: 'Gold System',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'http://bgcgoldv5.bigc.co.th/',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 4,
        is_active: true
      },
      {
        name: 'Symphony',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'https://bgcsymphony2.bigc.co.th/MWRSWEB/login.jsp',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 5,
        is_active: true
      },
      {
        name: 'Price Sign Printing Tool',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'https://interppst.bigc.co.th/PSTWEB/#/home',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 6,
        is_active: true
      },
      {
        name: 'AIA GROUP INSURANCE MEDICAL CLAIM FORM',
        narrative: '團體保險醫療賠償申請表',
        logo_url: 'https://tse1.mm.bing.net/th/id/OIP.2PIHMKZtcWXXydzUtsprHQHaH4?w=145&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'https://www.aia.com.hk/content/dam/hk/pdf/claims-corner/employee_benefits/GPOPCF01%200215%20OP%20Claims%20Form.pdf',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 7,
        is_active: true
      },
      {
        name: 'POS Attedance',
        narrative: '',
        logo_url: 'https://tse4.mm.bing.net/th/id/OIP.32LGb1VtSYlZ01XzqXMWKAHaHa?w=144&h=180&c=7&r=0&o=7&pid=1.7&rm=3',
        url: 'http://172.31.128.23/timeAttendancehR',
        created_by_id: 31,
        updated_by_id: 31,
        display_order: 8,
        is_active: true
      }
    ]);
  }

  // 取得假期類型
  const leaveTypes = await knex('leave_types').select('*');
  const annualLeave = leaveTypes.find(lt => lt.code === 'AL');
  const sickLeave = leaveTypes.find(lt => lt.code === 'PSL');


  // 建立個人待辦事項示例數據
  // 為前幾個用戶創建一些示例個人待辦事項
  // const sampleUsers = await knex('users').select('id').limit(5);
  
  // if (sampleUsers.length > 0) {
  //   const today = new Date();
  //   const tomorrow = new Date(today);
  //   tomorrow.setDate(tomorrow.getDate() + 1);
  //   const nextWeek = new Date(today);
  //   nextWeek.setDate(nextWeek.getDate() + 7);
    
  //   const personalTodos = [];
    
  //   sampleUsers.forEach((user, index) => {
  //     personalTodos.push({
  //       user_id: user.id,
  //       title: `個人待辦事項 ${index + 1}`,
  //       description: '這是一個示例個人待辦事項',
  //       status: index % 3 === 0 ? 'completed' : (index % 3 === 1 ? 'in_progress' : 'pending'),
  //       due_date: index % 2 === 0 ? tomorrow.toISOString().split('T')[0] : nextWeek.toISOString().split('T')[0],
  //       priority: (index % 3) + 1
  //     });
  //   });
    
  //   if (personalTodos.length > 0) {
  //     await knex('user_todos').insert(personalTodos);
  //   }
  // }

  // 建立 Payroll Alert Items 示例數據
  // 為 HR Group 成員創建一些示例 Payroll Alert Items
  // 使用 admin 用戶（ID=1）作為建立者，因為它是 HR Group 的成員
  // if (admin && admin.id) {
  //   const today = new Date();
  //   const todayStr = today.toISOString().split('T')[0];
  //   const nextMonth = new Date(today);
  //   nextMonth.setMonth(nextMonth.getMonth() + 1);
  //   const nextMonthStr = nextMonth.toISOString().split('T')[0];
    
  //   const payrollAlertItems = [
  //     {
  //       created_date: todayStr,
  //       employee_number: null,
  //       employee_name: null,
  //       start_date: null,
  //       end_date: null,
  //       details: '檢查本月薪資計算是否正確',
  //       progress: 'pending',
  //       created_by_id: admin.id
  //     },
  //     {
  //       created_date: todayStr,
  //       employee_number: '001',
  //       employee_name: '示例員工',
  //       start_date: todayStr,
  //       end_date: nextMonthStr,
  //       details: '新入職員工薪資設定',
  //       progress: 'in_progress',
  //       created_by_id: admin.id
  //     },
  //     {
  //       created_date: todayStr,
  //       employee_number: null,
  //       employee_name: null,
  //       start_date: null,
  //       end_date: null,
  //       details: '確認所有員工的銀行帳戶資料',
  //       progress: 'pending',
  //       created_by_id: admin.id
  //     }
  //   ];
    
  //   if (payrollAlertItems.length > 0) {
  //     await knex('payroll_alert_items').insert(payrollAlertItems);
  //   }
  // }

  await syncLeaveApplicationStages(knex);

  // 同步額外工作時數申報的批核階段
  const extraWorkingHoursApplications = await knex('extra_working_hours_applications').select(
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
  );

  if (extraWorkingHoursApplications.length > 0) {
    for (const application of extraWorkingHoursApplications) {
      const updates = {};
      const resolvedStage = determineSeedApprovalStage(application);
      if (application.current_approval_stage !== resolvedStage) {
        updates.current_approval_stage = resolvedStage;
      }
      
      if (Object.keys(updates).length > 0) {
        await knex('extra_working_hours_applications')
          .where('id', application.id)
          .update(updates);
      }
    }
  }

  // 同步外勤工作申請的批核階段
  const outdoorWorkApplications = await knex('outdoor_work_applications').select(
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
  );

  if (outdoorWorkApplications.length > 0) {
    for (const application of outdoorWorkApplications) {
      const updates = {};
      const resolvedStage = determineSeedApprovalStage(application);
      if (application.current_approval_stage !== resolvedStage) {
        updates.current_approval_stage = resolvedStage;
      }
      
      if (Object.keys(updates).length > 0) {
        await knex('outdoor_work_applications')
          .where('id', application.id)
          .update(updates);
      }
    }
  }
};
