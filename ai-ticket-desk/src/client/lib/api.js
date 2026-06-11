const authStorageKey = 'ai-ticket-desk-basic-auth';

function getAuthHeader() {
  const token = window.sessionStorage.getItem(authStorageKey);
  return token ? { authorization: `Basic ${token}` } : {};
}

function askForCredentials() {
  const username = window.prompt('ชื่อผู้ใช้สำหรับ AI Ticket Desk');
  if (!username) return false;
  const password = window.prompt('รหัสผ่านสำหรับ AI Ticket Desk');
  if (password === null) return false;
  window.sessionStorage.setItem(authStorageKey, btoa(`${username}:${password}`));
  return true;
}

async function request(path, options = {}, retryAuth = true) {
  const headers =
    options.body instanceof FormData
      ? { ...(options.protected ? getAuthHeader() : {}) }
      : { 'content-type': 'application/json', ...(options.protected ? getAuthHeader() : {}) };
  const response = await fetch(path, {
    headers,
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && options.protected && retryAuth && askForCredentials()) {
      return request(path, options, false);
    }
    let message =
      typeof body === 'object' && body?.message ? body.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
    if ([502, 503, 504].includes(response.status)) {
      message = 'เรียกใช้งาน AI ผ่าน Ollama ไม่สำเร็จ กรุณาตรวจสอบว่า Ollama เปิดอยู่และมีโมเดลที่ตั้งค่าไว้';
    }
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export function analyzeIntake({ message, files }) {
  const formData = new FormData();
  formData.append('message', message ?? '');
  for (const file of files ?? []) {
    formData.append('files[]', file);
  }
  return request('/api/intake/analyze', {
    method: 'POST',
    body: formData
  });
}

export function createTicket(payload) {
  return request('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
    protected: true
  });
}

export async function listTickets({ search = '', status = '' } = {}) {
  const data = await request('/api/tickets', { protected: true });
  const query = search.trim().toLowerCase();
  const tickets = data.tickets ?? [];
  return tickets.filter((ticket) => {
    const matchesStatus = status ? ticket.status === status : true;
    const matchesSearch = query
      ? [ticket.id, ticket.title, ticket.category, ticket.priority, ticket.problem_summary]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      : true;
    return matchesStatus && matchesSearch;
  });
}

export function getTicket(id) {
  return request(`/api/tickets/${encodeURIComponent(id)}`, { protected: true });
}

export function updateTicket(id, patch) {
  return request(`/api/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    protected: true
  });
}

export function attachmentDownloadUrl(ticketId, attachmentId) {
  return `/api/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function health() {
  return request('/api/health');
}
