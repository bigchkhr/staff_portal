const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  await knex('leave_types').del();
  await knex('groups').del();
  await knex('positions').del();
  await knex('departments').del();
  await knex('users').del();

  // 建立部門
  const [hrDept] = await knex('departments').insert([
    { name: 'Accounting', name_zh: '會計部', description: ''},
    { name: 'B2B', name_zh: '企客業務部', description: ''},
    { name: 'Business Development', name_zh: '業務拓展部', description: ''},
    { name: 'Category', name_zh: '品類部', description: ''},
    { name: 'General Administration', name_zh: '行政部', description: ''},
    { name: 'Human Resources', name_zh: '人力資源部', description: ''},
    { name: 'IT', name_zh: '資訊科技部', description: ''},
    { name: 'Managing Director', name_zh: '董事總經理', description: ''},
    { name: 'Marketing', name_zh: '市場推廣部', description: ''},
    { name: 'Merchandising', name_zh: '採購部', description: ''},
    { name: 'Project', name_zh: '專案部', description: ''},
    { name: 'Property', name_zh: '物業部', description: ''},
    { name: 'Retail', name_zh: '零售部', description: ''},
    { name: 'Supply Chain & Logistics', name_zh: '供應鏈及物流部', description: ''}
  ]).returning('*');

  // 建立職位
  const [managerPos, staffPos] = await knex('positions').insert([
    { name: 'Manager', name_zh: '經理', description: '管理層職位' },
    { name: 'Staff', name_zh: '職員', description: '一般職員' }
  ]).returning('*');

  // 建立群組
  const [hrGroup] = await knex('groups').insert([
    { name: 'HR Group', name_zh: 'HR群組', description: '人力資源群組' }
  ]).returning('*');

  // 建立假期類型
  await knex('leave_types').insert([
    { code: 'AL', name: 'Annual Leave', name_zh: '年假', requires_balance: true },
    { code: 'BL', name: 'Birthday Leave', name_zh: '生日假', requires_balance: true },
    { code: 'CL', name: 'Compensatory Leave', name_zh: '補假', requires_balance: true },
    { code: 'PSL', name: 'Paid Sick Leave', name_zh: '全薪病假', requires_balance: true },
    { code: 'MGL', name: 'Marriage Leave', name_zh: '婚假', requires_balance: false },
    { code: 'MTL', name: 'Maternity Leave', name_zh: '產假', requires_balance: false },
    { code: 'PTL', name: 'Paternity Leave', name_zh: '侍產假', requires_balance: false },
    { code: 'JSL', name: 'Jury Lave', name_zh: '陪審團假', requires_balance: false },
    { code: 'CPL', name: 'Compassionate Leave', name_zh: '恩恤假', requires_balance: false },
    { code: 'NPSL', name: 'No Pay Sick Leave', name_zh: '無薪病假', requires_balance: false },
    { code: 'NPL', name: 'No Pay Personal Leave', name_zh: '無薪事假', requires_balance: false },
    { code: 'IL', name: 'Work Injury Leave', name_zh: '工傷病假', requires_balance: false }
  ]);

  // 建立系統管理員
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const [admin] = await knex('users').insert([
    {
      employee_number: 'admin',
      surname: 'Admin',
      given_name: 'System',
      alias: 'Admin',
      name_zh: '系統管理員',
      email: 'admin@example.com',
      password_hash: adminPasswordHash,
      department_id: hrDept.id,
      position_id: managerPos.id,
      group_id: hrGroup.id,
      is_system_admin: true,
      is_dept_head: true,
      is_active: true,
      checker_id: admin.id,
      approver_1_id: admin.id,
      approver_2_id: admin.id,
      approver_3_id: admin.id
    }
  ]).returning('*');

  // 建立測試用戶
  const userPasswordHash = await bcrypt.hash('user123', 10);
  await knex('users').insert([
    {
      employee_number: '4240001',
      surname: 'Chan',
      given_name: 'John',
      name_zh: '陳約翰',
      alias: 'John',
      email: 'john.chan@example.com',
      password_hash: userPasswordHash,
      department_id: hrDept.id,
      position_id: staffPos.id,
      is_active: true,
      checker_id: admin.id,
      approver_1_id: admin.id,
      approver_2_id: admin.id,
      approver_3_id: admin.id
    },
    {
      employee_number: '4240004',
      surname: 'Kam',
      given_name: 'Chun Kin Jason',
      name_zh: '甘晉鍵',
      alias: 'Jason',
      email: 'jason.kam@bigchk.com',
      password_hash: userPasswordHash,
      department_id: hrDept.id,
      position_id: staffPos.id,
      is_active: true,
      checker_id: admin.id,
      approver_1_id: admin.id,
      approver_2_id: admin.id,
      approver_3_id: admin.id
    }
  ]);
};

