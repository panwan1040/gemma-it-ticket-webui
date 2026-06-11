export const categories = [
  'Login / Account',
  'Network / Internet',
  'Printer / Scanner',
  'Hardware',
  'Software / Application',
  'Email',
  'Security',
  'Document / Form',
  'Other'
];

export const priorities = ['Low', 'Medium', 'High', 'Urgent'];
export const statuses = ['Draft', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function arrayToText(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

export function textToArray(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function nullableText(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function friendlyStatus(status) {
  const map = {
    Draft: 'ร่าง',
    Open: 'เปิด',
    'In Progress': 'กำลังดำเนินการ',
    Resolved: 'แก้ไขแล้ว',
    Closed: 'ปิดแล้ว'
  };
  return map[status] ?? status;
}
