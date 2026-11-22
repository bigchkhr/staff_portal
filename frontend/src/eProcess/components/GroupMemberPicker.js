import { useEffect, useState } from 'react';
import { api } from '../api';
import { useEp } from '../useEp';

export default function GroupMemberPicker({ ownerGroupId, onSelect, onAssignGroup, disabled = false, actionLabel }) {
  const t = useEp();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const action = actionLabel || t('picker.select');

  useEffect(() => {
    if (!ownerGroupId) {
      setGroups([]);
      setGroupId('');
      setMembers([]);
      return undefined;
    }
    let cancelled = false;
    api.get('/users/assignable-groups', { params: { owner_group_id: ownerGroupId } })
      .then(({ data }) => {
        if (cancelled) return;
        const list = data.groups || [];
        setGroups(list);
        setGroupId(list[0] ? String(list[0].id) : '');
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerGroupId]);

  useEffect(() => {
    if (!ownerGroupId || !groupId) {
      setMembers([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api.get('/users/assignable-members', {
      params: { owner_group_id: ownerGroupId, group_id: groupId },
    })
      .then(({ data }) => {
        if (!cancelled) setMembers(data.members || []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerGroupId, groupId]);

  if (!ownerGroupId) {
    return <p className="muted">{t('picker.chooseGroupFirst')}</p>;
  }

  const selectedGroup = groups.find((group) => String(group.id) === String(groupId));
  const canAssignWholeGroup = Boolean(onAssignGroup && selectedGroup && selectedGroup.id !== 'on_duty');

  return (
    <div className="form-stack">
      <label>
        {t('picker.group')}
        <select value={groupId} disabled={disabled || !groups.length} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </label>
      {canAssignWholeGroup && (
        <button
          type="button"
          className="button button-light"
          disabled={disabled}
          onClick={() => onAssignGroup(selectedGroup)}
        >
          {t('picker.assignGroup')}
        </button>
      )}
      {loading && <p className="muted">{t('picker.loadingMembers')}</p>}
      {!loading && members.length === 0 && <p className="muted">{t('picker.noMembers')}</p>}
      {members.length > 0 && (
        <div className="table-list">
          {members.map((member) => (
            <div className="table-row" key={member.id}>
              <div>
                <strong>{member.display_name || member.username}</strong>
                <span>
                  {member.username}
                  {member.position_title ? ` · ${member.position_title}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="button button-light small"
                disabled={disabled}
                onClick={() => onSelect(member)}
              >
                {action}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
