import { useEffect, useState } from 'react';
import axios from 'axios';

const MONTHLY_MANAGER_FIELDS = ['checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id'];

export function useCanManageMonthlyRecords(user) {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        setCanManage(false);
        return;
      }
      if (user.is_system_admin || user.is_hr_member) {
        setCanManage(true);
        return;
      }

      try {
        const response = await axios.get('/api/groups/department');
        const groups = response.data.groups || [];
        const ids = (user.delegation_groups || []).map((group) => Number(group.id));
        const allowed = groups.some((group) =>
          MONTHLY_MANAGER_FIELDS.some((field) => group[field] && ids.includes(Number(group[field])))
        );
        if (!cancelled) setCanManage(allowed);
      } catch (error) {
        if (!cancelled) setCanManage(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return canManage;
}
