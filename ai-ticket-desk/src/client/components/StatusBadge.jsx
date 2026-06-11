import { friendlyStatus } from '../lib/format.js';

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${String(status || '').toLowerCase().replaceAll(' ', '-')}`}>{friendlyStatus(status)}</span>;
}
