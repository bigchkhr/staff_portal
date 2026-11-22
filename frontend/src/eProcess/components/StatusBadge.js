import { useEp } from '../useEp';

export default function StatusBadge({ status }) {
  const t = useEp();
  const known = t(`status.${status}`, { defaultValue: '' });
  const label = known || String(status || '').replace(/_/g, ' ');
  return <span className={`status status-${status}`}>{label}</span>;
}
