const DepartmentGroup = require('./DepartmentGroup');

/**
 * 為申請詳情附加申請人所屬部門群組名稱（中／英），供批核頁顯示。
 * 職位由 findById 查詢內 leftJoin positions 提供 applicant_position_name / applicant_position_name_zh。
 */
async function attachApplicantDepartmentGroups(application) {
  if (!application?.user_id) return;
  const groups = await DepartmentGroup.findByUserId(application.user_id);
  application.applicant_groups_label_zh = groups
    .map((g) => g.name_zh || g.name)
    .filter(Boolean)
    .join('、');
  application.applicant_groups_label_en = groups
    .map((g) => g.name || g.name_zh)
    .filter(Boolean)
    .join(', ');
}

module.exports = { attachApplicantDepartmentGroups };
