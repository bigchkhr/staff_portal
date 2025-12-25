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
  await knex('payroll_alert_items').del();
  await knex('hr_todos').del();
  await knex('user_todos').del();
  await knex('form_library').del();
  await knex('employee_documents').del();
  await knex('users').del();
  await knex('department_groups').del();
  await knex('delegation_groups').del();
  await knex('leave_types').del();
  await knex('positions').del();
  await knex('departments').del();

  // 建立部門
  await knex('departments').insert([
    { name: 'Accounting', name_zh: '會計部', description: '' },
    { name: 'B2B', name_zh: '企客業務部', description: '' },
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
    { name: 'System', name_zh: '系統', description: '系統' },
    { name: 'Managing Director', name_zh: 'Managing Director', description: 'Managing Director' },
    { name: 'Financial Controller', name_zh: 'Financial Controller', description: ' Financial Controller' },
    { name: 'Assistant Accounting Manager ', name_zh: 'Assistant Accounting Manager  ', description: 'Assistant Accounting Manager ' },
    { name: 'Assistant Category Manager', name_zh: 'Assistant Category Manager ', description: 'Assistant Category Manager' },
    { name: 'Project Executive', name_zh: 'Project Executive', description: 'Project Executive' },
    { name: 'Senior Accounting Manager', name_zh: 'Senior Accounting Manager', description: 'Senior Accounting Manager' },
    { name: 'Category Manager', name_zh: 'Category Manager', description: 'Category Manager' },
    { name: 'Accounting Officer', name_zh: 'Accounting Officer', description: 'Accounting Officer' },
    { name: 'Part-Time Accounting Clerk', name_zh: 'Part-Time Accounting Clerk', description: 'Part-Time Accounting Clerk' },
    { name: 'Accountant', name_zh: 'Accountant', description: 'Accountant' },
    { name: 'Senior Category Manager', name_zh: 'Senior Category Manager', description: 'Senior Category Manager' },
    { name: 'Project Supervisor', name_zh: 'Project Supervisor', description: 'Project Supervisor' },
    { name: 'Senior Merchandiser', name_zh: 'Senior Merchandiser', description: 'Senior Merchandiser' },
    { name: 'Business Analyst', name_zh: 'Business Analyst', description: 'Business Analyst' },
    { name: 'Technician', name_zh: 'Technician', description: 'Technician' },
    { name: 'Product Development Manager', name_zh: 'Product Development Manager', description: 'Product Development Manager' },
    { name: 'Senior Accounts Clerk', name_zh: 'Senior Accounts Clerk', description: 'Senior Accounts Clerk' },
    { name: 'Commercial Manager', name_zh: 'Commercial Manager', description: 'Commercial Manager' },
    { name: 'Assistant Merchandising Admin Manager', name_zh: 'Assistant Merchandising Admin Manager', description: 'Assistant Merchandising Admin Manager' },
    { name: 'Senior Merchandising Manager', name_zh: 'Senior Merchandising Manager', description: 'Senior Merchandising Manager' },
    { name: 'Senior Buyer', name_zh: 'Senior Buyer', description: 'Senior Buyer' },
    { name: 'Head of Merchandising', name_zh: 'Head of Merchandising', description: 'Head of Merchandising' },
    { name: 'Office Assistant', name_zh: 'Office Assistant', description: 'Office Assistant' },
    { name: 'General Administration Manager', name_zh: 'General Administration Manager', description: 'General Administration Manager' },
    { name: 'Administration Officer', name_zh: 'Administration Officer', description: 'Administration Officer' },
    { name: 'Assistant Business Development Manager', name_zh: 'Assistant Business Development Manager', description: 'Assistant Business Development Manager' },
    { name: 'Human Resources Manager', name_zh: 'Human Resources Manager', description: 'Human Resources Manager' },
    { name: 'Assistant Merchandiser', name_zh: 'Assistant Merchandiser', description: 'Assistant Merchandiser' },
    { name: 'Senior HR Officer', name_zh: 'Senior HR Officer', description: 'Senior HR Officer' },
    { name: 'Assistant Manager (E-Business & IT)', name_zh: 'Assistant Manager (E-Business & IT)', description: 'Assistant Manager (E-Business & IT)' },
    { name: 'Promoter', name_zh: 'Promoter', description: 'Promoter' },
    { name: 'Store Manager', name_zh: 'Store Manager', description: 'Store Manager' },
    { name: 'Senior Customer Service Associate', name_zh: 'Senior Customer Service Associate', description: 'Senior Customer Service Associate' },
    { name: 'Assistant Area Manager', name_zh: 'Assistant Area Manager', description: 'Assistant Area Manager' },
    { name: 'Store Supervisor', name_zh: 'Store Supervisor', description: 'Store Supervisor' },
    { name: 'Senior Store Manager', name_zh: 'Senior Store Manager', description: 'Senior Store Manager' },
    { name: 'Customer Service Associate', name_zh: 'Customer Service Associate', description: 'Customer Service Associate' },
    { name: 'COO - International Business North Asia & Managing Director of BigC (HK)', name_zh: 'COO - International Business North Asia & Managing Director of BigC (HK) ', description: ' COO - International Business North Asia & Managing Director of BigC (HK)' },
    { name: 'Store Keeper', name_zh: 'Store Keeper', description: 'Store Keeper' },
    { name: 'Part Time Promoter', name_zh: 'Part Time Promoter', description: 'Part Time Promoter' },
    { name: 'Part Time Store Supervisor', name_zh: 'Part Time Store Supervisor', description: 'Part Time Store Supervisor' },
    { name: 'Part Time Customer Service Associate', name_zh: 'Part Time Customer Service Associate', description: 'Part Time Customer Service Associate' },
    { name: 'Part Time Store Keeper', name_zh: 'Part Time Store Keeper', description: 'Part Time Store Keeper' },
    { name: 'Creative Manager', name_zh: 'Creative Manager', description: 'Creative Manager' },
    { name: 'Retail Operation Executive', name_zh: 'Retail Operation Executive', description: 'Retail Operation Executive' },
    { name: 'Merchandising Assistant', name_zh: 'Merchandising Assistant ', description: 'Merchandising Assistant' },
    { name: 'Project Manager ', name_zh: 'Project Manager', description: 'Project Manager' },
    { name: 'Accounts Clerk', name_zh: 'Accounts Clerk', description: 'Accounts Clerk' },
    { name: 'IT Manager', name_zh: 'IT Manager', description: 'IT Manager' },
    { name: 'Sales Admin Assistant', name_zh: 'Sales Admin Assistant', description: 'Sales Admin Assistant' },
    { name: 'Training Manager', name_zh: 'Training Manager', description: 'Training Manager' },
    { name: 'Senior Retail Operation Executive', name_zh: 'Senior Retail Operation Executive', description: 'Senior Retail Operation Executive' },
    { name: 'Senior IT Officer', name_zh: 'Senior IT Officer', description: 'Senior IT Officer' },
    { name: 'Assistant Head of Operation', name_zh: 'Assistant Head of Operation', description: 'Assistant Head of Operation' },
    { name: 'Retail Operation Manager', name_zh: 'Retail Operation Manager', description: 'Retail Operation Manager' },
    { name: 'Assistant Vice President of Retail Operation', name_zh: 'Assistant Vice President of Retail Operation', description: 'Assistant Vice President of Retail Operation' },
    { name: 'Inventory Planning Manager', name_zh: 'Inventory Planning Manager', description: 'Inventory Planning Manager' },
    { name: 'Assistant Inventory Control Manager', name_zh: 'Assistant Inventory Control Manager', description: 'Assistant Inventory Control Manager' },
    { name: 'IT Officer', name_zh: 'IT Officer', description: ' IT Officer' },
    { name: 'Inventory Planning Manager ', name_zh: 'Inventory Planning Manager  ', description: 'Inventory Planning Manager ' },
    { name: 'Assistant Inventory Management Manager', name_zh: 'Assistant Inventory Management Manager', description: 'Assistant Inventory Management Manager ' },
    { name: 'Assistant Inventory Management Manager', name_zh: 'Assistant Inventory Management Manager', description: 'Assistant Inventory Management Manager' },
    { name: 'IT Support Officer', name_zh: 'IT Support Officer', description: 'IT Support Officer' },
    { name: 'Assistant Property Manager', name_zh: 'Assistant Property Manager', description: 'Assistant Property Manager' },
    { name: 'E-Commerce & Business Development Manager', name_zh: 'E-Commerce & Business Development Manager', description: 'E-Commerce & Business Development Manager' },
    { name: 'Assistant Finance Manager', name_zh: 'Assistant Finance Manager', description: 'Assistant Finance Manager' },
    { name: 'Driver', name_zh: 'Driver', description: 'Driver' },
    { name: 'Assistant Project Manager', name_zh: 'Assistant Project Manager', description: 'Assistant Project Manager' },
    { name: 'Part Time Retail Operation Assistant', name_zh: 'Part Time Retail Operation Assistant', description: 'Part Time Retail Operation Assistant' },
    { name: 'Senior Supply Chain Manager', name_zh: 'Senior Supply Chain Manager', description: 'Senior Supply Chain Manager' },
    { name: 'Intern Part Time Customer Service Associate', name_zh: 'Intern Part Time Customer Service Associate', description: 'Intern Part Time Customer Service Associate' },
    { name: 'Intern Customer Service Associate', name_zh: 'Intern Customer Service Associate', description: 'Intern Customer Service Associate' },
    { name: 'Sales Manager', name_zh: 'Sales Manager', description: 'Sales Manager' },
    { name: 'Marketing Specialist', name_zh: 'Marketing Specialist', description: 'Marketing Specialist' },
    { name: 'Assistant Accountant', name_zh: 'Assistant Accountant', description: 'Assistant Accountant' },
    { name: 'Sales Executive', name_zh: 'Sales Executive', description: 'Sales Executive' },
    { name: 'Area Supervisor', name_zh: 'Area Supervisor', description: 'Area Supervisor' },
    { name: 'Office Intern', name_zh: 'Office Intern', description: 'Office Intern' },
    { name: 'Part Time E-Commerce Assistant', name_zh: 'Part Time E-Commerce Assistant', description: 'Part Time E-Commerce Assistant' }
  ]);

  // 建立授權群組 (Delegation Groups)
  const delegationGroups = await knex('delegation_groups').insert([
    { name: 'HR Group', name_zh: 'HR群組', description: '人力資源授權群組', user_ids: [1, 29, 31] },
    { name: 'Accounting', name_zh: '會計授權群組', description: '會計部授權群組', user_ids: [3] },
    { name: 'B2B', name_zh: '企客業務授權群組', description: '企客業務部授權群組', user_ids: [450,451] },
    { name: 'Business Development', name_zh: '業務拓展授權群組', description: '業務拓展部授權群組', user_ids: [] },
    { name: 'Category', name_zh: '品類授權群組', description: '品類部授權群組', user_ids: [] },
    { name: 'General Administration', name_zh: '行政授權群組', description: '行政部授權群組', user_ids: [26] },
    { name: 'Human Resources', name_zh: '人力資源授權群組', description: '人力資源部授權群組', user_ids: [29] },
    { name: 'IT', name_zh: '資訊科技授權群組', description: '資訊科技部授權群組', user_ids: [32] },
    { name: 'Marketing', name_zh: '市場推廣授權群組', description: '市場推廣部授權群組', user_ids: [] },
    { name: 'Merchandising', name_zh: '採購授權群組', description: '採購部授權群組', user_ids: [23] },
    { name: 'Project', name_zh: '專案授權群組', description: '專案部授權群組', user_ids: [] },
    { name: 'Retail Heads', name_zh: '零售主管授權群組', description: '零售部主管授權群組', user_ids: [284, 265] },
    { name: 'Retail Checker', name_zh: '零售檢查授權群組', description: '零售部檢查授權群組', user_ids: [] },
    { name: 'Supply Chain and Logistics', name_zh: '供應鏈及物流授權群組', description: '供應鏈及物流部授權群組', user_ids: [312] },
    { name: 'Retail Checker - ADM', name_zh: 'ADM零售店舖檢查授權群組', description: 'ADM零售檢查授權群組', user_ids: [38, 234, 44] },
    { name: 'Retail Checker - TWS', name_zh: 'TWS零售店舖檢查授權群組', description: 'TWS零售檢查授權群組', user_ids: [38, 234, 243] },
    { name: 'Retail Checker - WTS', name_zh: 'WTS零售店舖檢查授權群組', description: 'WTS零售檢查授權群組', user_ids: [38, 234, 65] },
    { name: 'Retail Checker - LF1', name_zh: 'LF1零售店舖檢查授權群組', description: 'LF1零售檢查授權群組', user_ids: [38, 234, 236] },
    { name: 'Retail Checker - TK3', name_zh: 'TK3零售店舖檢查授權群組', description: 'TK3零售檢查授權群組', user_ids: [38, 234, 54] },
    { name: 'Retail Checker - TK4', name_zh: 'TK4零售店舖檢查授權群組', description: 'TK4零售檢查授權群組', user_ids: [38, 234, 326] },
    { name: 'Retail Checker - OC', name_zh: 'OC零售店舖檢查授權群組', description: 'OC零售檢查授權群組', user_ids: [38, 234, 241] },
    { name: 'Retail Checker - SP1', name_zh: 'SP1零售店舖檢查授權群組', description: 'SP1零售檢查授權群組', user_ids: [38, 234, 303] },
    { name: 'Retail Checker - WPG', name_zh: 'WPG零售店舖檢查授權群組', description: 'WPG零售檢查授權群組', user_ids: [38, 234, 202] },
    { name: 'Retail Checker - MK2', name_zh: 'MK2零售店舖檢查授權群組', description: 'MK2零售檢查授權群組', user_ids: [38, 234, 140] },
    { name: 'Retail Checker - TT2', name_zh: 'TT2零售店舖檢查授權群組', description: 'TT2零售檢查授權群組', user_ids: [38, 234, 239] },
    { name: 'Retail Checker - CDW', name_zh: 'CDW零售店舖檢查授權群組', description: 'CDW零售檢查授權群組', user_ids: [38, 234, 46] },
    { name: 'Retail Checker - TW2', name_zh: 'TW2零售店舖檢查授權群組', description: 'TW2零售檢查授權群組', user_ids: [38, 234, 46] },
    { name: 'Retail Checker - TY4', name_zh: 'TY4零售店舖檢查授權群組', description: 'TY4零售檢查授權群組', user_ids: [38, 234, 141] },
    { name: 'Retail Checker - TW3', name_zh: 'TW3零售店舖檢查授權群組', description: 'TW3零售檢查授權群組', user_ids: [38, 234, 46] },
    { name: 'Retail Checker - FAN', name_zh: 'FAN零售店舖檢查授權群組', description: 'FAN零售檢查授權群組', user_ids: [38, 234, 328] },
    { name: 'Retail Checker - TPU', name_zh: 'TPU零售店舖檢查授權群組', description: 'TPU零售檢查授權群組', user_ids: [38, 234, 88] },
    { name: 'Retail Checker - TP2', name_zh: 'TP2零售店舖檢查授權群組', description: 'TP2零售檢查授權群組', user_ids: [38, 234, 34] },
    { name: 'Retail Checker - MO2', name_zh: 'MO2零售店舖檢查授權群組', description: 'MO2零售檢查授權群組', user_ids: [38, 234, 67] },
    { name: 'Retail Checker - ST1', name_zh: 'ST1零售店舖檢查授權群組', description: 'ST1零售檢查授權群組', user_ids: [38, 234, 52] },
    { name: 'Retail Checker - TM1', name_zh: 'TM1零售店舖檢查授權群組', description: 'TM1零售檢查授權群組', user_ids: [38, 234, 43] },
    { name: 'Retail Checker - YL3', name_zh: 'YL3零售店舖檢查授權群組', description: 'YL3零售檢查授權群組', user_ids: [38, 234, 42] },
    { name: 'Retail Checker - YL4', name_zh: 'YL4零售店舖檢查授權群組', description: 'YL4零售檢查授權群組', user_ids: [38, 234, 316] },
    { name: 'Direct Reporting to MD', name_zh: '管理層授權群組', description: '管理層授權群組', user_ids: [68] },
  ]).returning('*');

  // 取得各授權群組的 ID
  const hrGroupId = delegationGroups.find(g => g.name === 'HR Group').id;
  const accountingDelegId = delegationGroups.find(g => g.name === 'Accounting').id;
  const b2bDelegId = delegationGroups.find(g => g.name === 'B2B').id;
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
      description: '會計部門群組',
      user_ids: [4, 7, 9, 18, 348, 432],
      checker_id: null,
      approver_1_id: accountingDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'B2B',
      name_zh: '企客業務部群組',
      description: '企客業務部門群組',
      user_ids: [205, 478, 487],
      checker_id: null,
      approver_1_id: b2bDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Business Development',
      name_zh: '業務拓展部群組',
      description: '業務拓展部門群組',
      user_ids: [],
      checker_id: null,
      approver_1_id: bdDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Category',
      name_zh: '品類部群組',
      description: '品類部門群組',
      user_ids: [],
      checker_id: null,
      approver_1_id: categoryDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'General Administration',
      name_zh: '行政部群組',
      description: '行政部門群組',
      user_ids: [25, 290, 315],
      checker_id: null,
      approver_1_id: gaDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Human Resources',
      name_zh: '人力資源部群組',
      description: '人力資源部門群組',
      user_ids: [31],
      checker_id: null,
      approver_1_id: hrDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'IT',
      name_zh: '資訊科技部群組',
      description: '資訊科技部門群組',
      user_ids: [475],
      checker_id: null,
      approver_1_id: itDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Marketing',
      name_zh: '市場推廣部群組',
      description: '市場推廣部門群組',
      user_ids: [],
      checker_id: null,
      approver_1_id: marketingDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Merchandising',
      name_zh: '採購部群組',
      description: '採購部門群組',
      user_ids: [20, 21, 154, 275, 278, 311, 318, 471, 486],
      checker_id: null,
      approver_1_id: merchandisingDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Project',
      name_zh: '專案部群組',
      description: '專案部門群組',
      user_ids: [],
      checker_id: null,
      approver_1_id: projectDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Administration',
      name_zh: '零售行政群組',
      description: '零售行政群組',
      user_ids: [38, 234],
      checker_id: null,
      approver_1_id: retailHeadsDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Supply Chain and Logistics',
      name_zh: '供應鏈及物流部群組',
      description: '供應鏈及物流部門群組',
      user_ids: [267, 268, 270, 271, 273],
      checker_id: null,
      approver_1_id: scDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Property',
      name_zh: '物業部群組',
      description: '供物業部門群組',
      user_ids: [],
      checker_id: null,
      approver_1_id: scDelegId,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - ADM',
      name_zh: '零售店舖群組 - ADM',
      description: '',
      user_ids: [44, 48, 89, 226, 260, 308],
      checker_id: 15,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TWS',
      name_zh: '零售店舖群組 - TWS',
      description: '',
      user_ids: [196, 243, 295, 466, 479],
      checker_id: 16,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - WTS',
      name_zh: '零售店舖群組 - WTS',
      description: '',
      user_ids: [37, 61, 65, 124, 128, 201, 406, 429],
      checker_id: 17,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - LF1',
      name_zh: '零售店舖群組 - LF1',
      description: '',
      user_ids: [110, 155, 236, 330, 392, 428, 474],
      checker_id: 18,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TK3',
      name_zh: '零售店舖群組 - TK3',
      description: '',
      user_ids: [54, 193, 258, 403, 470],
      checker_id: 19,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TK4',
      name_zh: '零售店舖群組 - TK4',
      description: '',
      user_ids: [161, 218, 326, 455],
      checker_id: 20,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - OC',
      name_zh: '零售店舖群組 - OC',
      description: '',
      user_ids: [164, 217, 241, 249],
      checker_id: 21,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - SP1',
      name_zh: '零售店舖群組 - SP1',
      description: '',
      user_ids: [303, 457, 461, 473],
      checker_id: 22,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - WPG',
      name_zh: '零售店舖群組 - WPG',
      description: '',
      user_ids: [99, 202, 306, 411, 448, 472],
      checker_id: 23,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - MK2',
      name_zh: '零售店舖群組 - MK2',
      description: '',
      user_ids: [36, 69, 108, 136, 140, 293],
      checker_id: 24,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TT2',
      name_zh: '零售店舖群組 - TT2',
      description: '',
      user_ids: [239, 400, 409, 414, 456, 477],
      checker_id: 25,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - CDW',
      name_zh: '零售店舖群組 - CDW',
      description: '',
      user_ids: [122, 169, 175, 378, 402],
      checker_id: 26,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TW2',
      name_zh: '零售店舖群組 - TW2',
      description: '',
      user_ids: [46, 58, 120, 242, 272, 339],
      checker_id: 27,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TY4',
      name_zh: '零售店舖群組 - TY4',
      description: '',
      user_ids: [141, 276, 458, 464],
      checker_id: 28,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TW3',
      name_zh: '零售店舖群組 - TW3',
      description: '',
      user_ids: [138, 297, 299],
      checker_id: 29,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - FAN',
      name_zh: '零售店舖群組 - FAN',
      description: '',
      user_ids: [87, 328, 467, 468, 480, 481,483],
      checker_id: 30,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TPU',
      name_zh: '零售店舖群組 - TPU',
      description: '',
      user_ids: [88, 92, 422, 462,485],
      checker_id: 31,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TP2',
      name_zh: '零售店舖群組 - TP2',
      description: '',
      user_ids: [34, 354, 423, 439, 443, 453,482],
      checker_id: 32,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - MO2',
      name_zh: '零售店舖群組 - MO2',
      description: '',
      user_ids: [56, 67, 114, 387, 426, 445, 476],
      checker_id: 33,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - ST1',
      name_zh: '零售店舖群組 - ST1',
      description: '',
      user_ids: [52, 222, 300, 417, 420, 425, 452],
      checker_id: 34,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - TM1',
      name_zh: '零售店舖群組 - TM1',
      description: '',
      user_ids: [43, 75, 78, 389, 444, 465,407],
      checker_id: 35,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - YL3',
      name_zh: '零售店舖群組 - YL3',
      description: '',
      user_ids: [42, 55, 82, 131, 156, 437],
      checker_id: 36,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Retail Store - YL4',
      name_zh: '零售店舖群組 - YL4',
      description: '',
      user_ids: [316, 376, 385, 416, 463],
      checker_id: 37,
      approver_1_id: 12,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
    {
      name: 'Direct Reporting to MD',
      name_zh: '直接向MD匯報群組',
      description: '直接向MD匯報群組',
      user_ids: [3, 450, 451, 478, 26, 29, 32, 412, 23, 291, 265, 284, 312],
      checker_id: null,
      approver_1_id: 38,
      approver_2_id: null,
      approver_3_id: hrGroupId
    },
  ]);

  // 建立假期類型
  await knex('leave_types').insert([
    { code: 'AL', name: 'Annual Leave', name_zh: '年假', requires_balance: true },
    { code: 'BL', name: 'Birthday Leave', name_zh: '生日假', requires_balance: true },
    { code: 'CL', name: 'Compensatory Leave', name_zh: '補假', requires_balance: true },
    { code: 'FPSL', name: 'Full Paid Sick Leave', name_zh: '全薪病假', requires_balance: true },
    { code: 'SAL', name: 'Sick Leave (Sickness Allowance)', name_zh: '病假 (疾病津貼)', requires_balance: false },
    { code: 'MGL', name: 'Marriage Leave', name_zh: '婚假', requires_balance: false },
    { code: 'MTL', name: 'Maternity Leave', name_zh: '產假', requires_balance: false },
    { code: 'PTL', name: 'Paternity Leave', name_zh: '侍產假', requires_balance: false },
    { code: 'JSL', name: 'Jury Leave', name_zh: '陪審團假', requires_balance: false },
    { code: 'CPL', name: 'Compassionate Leave', name_zh: '恩恤假', requires_balance: false },
    { code: 'NPSL', name: 'No Pay Sick Leave', name_zh: '無薪病假', requires_balance: false },
    { code: 'NPL', name: 'No Pay Personal Leave', name_zh: '無薪事假', requires_balance: false },
    { code: 'IL', name: 'Work Injury Leave', name_zh: '工傷病假', requires_balance: false },
    { code: 'SPL', name: 'Special Leave', name_zh: '特別假期', requires_balance: false }
  ]);

  // 取得部門和職位 ID
  const departments = await knex('departments').select('*');
  const positions = await knex('positions').select('*');
  const hrDept = departments.find(d => d.name === 'Human Resources');
  const managerPos = positions.find(p => p.name === 'System');
  const staffPos = positions.find(p => p.name === 'Staff');

  // 建立系統管理員（HR 群組成員）
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const [admin] = await knex('users').insert([
    {
      employee_number: 'admin',
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



  // 取得假期類型
  const leaveTypes = await knex('leave_types').select('*');
  const annualLeave = leaveTypes.find(lt => lt.code === 'AL');
  const sickLeave = leaveTypes.find(lt => lt.code === 'PSL');


  // 建立個人待辦事項示例數據
  // 為前幾個用戶創建一些示例個人待辦事項
  const sampleUsers = await knex('users').select('id').limit(5);
  
  if (sampleUsers.length > 0) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const personalTodos = [];
    
    sampleUsers.forEach((user, index) => {
      personalTodos.push({
        user_id: user.id,
        title: `個人待辦事項 ${index + 1}`,
        description: '這是一個示例個人待辦事項',
        status: index % 3 === 0 ? 'completed' : (index % 3 === 1 ? 'in_progress' : 'pending'),
        due_date: index % 2 === 0 ? tomorrow.toISOString().split('T')[0] : nextWeek.toISOString().split('T')[0],
        priority: (index % 3) + 1
      });
    });
    
    if (personalTodos.length > 0) {
      await knex('user_todos').insert(personalTodos);
    }
  }

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
};
