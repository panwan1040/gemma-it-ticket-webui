const userMessage = document.querySelector('#userMessage');
const triageBtn = document.querySelector('#triageBtn');
const sampleBtn = document.querySelector('#sampleBtn');
const saveBtn = document.querySelector('#saveBtn');
const agentReply = document.querySelector('#agentReply');
const modeBadge = document.querySelector('#modeBadge');
const statusText = document.querySelector('#status');
const fields = [...document.querySelectorAll('[data-field]')];

let currentTicket = null;
let currentAgentReply = '';

function setTicket(ticket) {
  currentTicket = ticket;
  for (const field of fields) {
    const key = field.dataset.field;
    field.value = ticket?.[key] || '';
  }
  saveBtn.disabled = !ticket;
}

function readTicket() {
  return Object.fromEntries(fields.map((field) => [field.dataset.field, field.value.trim()]));
}

sampleBtn.addEventListener('click', () => {
  userMessage.value = 'กล้องหน้าโกดังดูไม่ได้';
  userMessage.focus();
});

triageBtn.addEventListener('click', async () => {
  const message = userMessage.value.trim();
  if (!message) return;

  triageBtn.disabled = true;
  saveBtn.disabled = true;
  modeBadge.textContent = 'thinking';
  agentReply.textContent = 'กำลังวิเคราะห์...';
  statusText.textContent = 'ยังไม่ได้บันทึก';

  try {
    const response = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'triage failed');

    currentAgentReply = data.agentReply || '';
    agentReply.textContent = currentAgentReply;
    modeBadge.textContent = data.mode || 'done';
    setTicket(data.ticket);
  } catch (error) {
    modeBadge.textContent = 'error';
    agentReply.textContent = error.message;
    setTicket(null);
  } finally {
    triageBtn.disabled = false;
  }
});

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  statusText.textContent = 'กำลังบันทึก...';

  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceMessage: userMessage.value.trim(),
        agentReply: currentAgentReply,
        ticket: readTicket()
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'save failed');
    statusText.textContent = data.sheetEnabled
      ? 'บันทึกลง Google Sheet และ local log แล้ว'
      : 'บันทึกลง local log แล้ว ยังไม่ได้ตั้งค่า Google Sheet webhook';
  } catch (error) {
    statusText.textContent = `บันทึกไม่สำเร็จ: ${error.message}`;
  } finally {
    saveBtn.disabled = false;
  }
});
