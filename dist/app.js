const userMessage = document.querySelector('#userMessage');
const sendBtn = document.querySelector('#sendBtn');
const sampleBtn = document.querySelector('#sampleBtn');
const resetBtn = document.querySelector('#resetBtn');
const saveBtn = document.querySelector('#saveBtn');
const chatLog = document.querySelector('#chatLog');
const modeBadge = document.querySelector('#modeBadge');
const readyText = document.querySelector('#readyText');
const missingList = document.querySelector('#missingList');
const statusText = document.querySelector('#status');
const fields = [...document.querySelectorAll('[data-field]')];

let messages = [];
let currentTicket = null;
let currentAgentReply = '';
let isReadyToSave = false;

function renderChat() {
  chatLog.innerHTML = '';
  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'เริ่มจากแจ้งปัญหาสั้นๆ แล้ว Agent จะถามต่อเพื่อเก็บข้อมูลให้ครบ';
    chatLog.append(empty);
    return;
  }

  for (const item of messages) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${item.role}`;
    bubble.textContent = item.content;
    chatLog.append(bubble);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setTicket(ticket, ready = false, missingFields = []) {
  currentTicket = ticket;
  isReadyToSave = ready;

  for (const field of fields) {
    const key = field.dataset.field;
    field.value = ticket?.[key] || '';
  }

  saveBtn.disabled = !ticket;
  readyText.textContent = ready ? 'พร้อมบันทึก' : 'ยังรอข้อมูล';
  readyText.className = ready ? 'badge ready' : 'badge muted';

  missingList.innerHTML = '';
  const items = missingFields.length ? missingFields : ready ? ['ครบพอสำหรับบันทึกแล้ว'] : ['รอ Agent วิเคราะห์'];
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    missingList.append(li);
  }
}

function readTicket() {
  return Object.fromEntries(fields.map((field) => [field.dataset.field, field.value.trim()]));
}

async function sendMessage() {
  const content = userMessage.value.trim();
  if (!content) return;

  messages.push({ role: 'user', content });
  userMessage.value = '';
  renderChat();

  sendBtn.disabled = true;
  saveBtn.disabled = true;
  modeBadge.textContent = 'thinking';
  statusText.textContent = 'กำลังให้ Agent วิเคราะห์บริบท...';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'chat failed');

    currentAgentReply = data.agentReply || '';
    messages.push({ role: 'assistant', content: currentAgentReply });
    modeBadge.textContent = data.mode || 'done';
    setTicket(data.ticket, Boolean(data.isReadyToSave), data.missingFields || []);
    statusText.textContent = data.isReadyToSave
      ? 'ข้อมูลน่าจะครบแล้ว สามารถตรวจ draft แล้วกดบันทึกได้'
      : 'ยังคุยต่อเพื่อเติมข้อมูลได้ หรือกดบันทึก draft นี้ได้ถ้าต้องการ';
    renderChat();
  } catch (error) {
    modeBadge.textContent = 'error';
    messages.push({ role: 'assistant', content: `เกิดข้อผิดพลาด: ${error.message}` });
    renderChat();
  } finally {
    sendBtn.disabled = false;
    saveBtn.disabled = !currentTicket;
    userMessage.focus();
  }
}

sampleBtn.addEventListener('click', () => {
  userMessage.value = 'กล้องหน้าโกดังดูไม่ได้';
  userMessage.focus();
});

sendBtn.addEventListener('click', sendMessage);

userMessage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

resetBtn.addEventListener('click', () => {
  messages = [];
  currentTicket = null;
  currentAgentReply = '';
  setTicket(null, false, ['ยังไม่มีบทสนทนา']);
  statusText.textContent = 'เริ่มบทสนทนาใหม่แล้ว';
  modeBadge.textContent = 'ready';
  renderChat();
});

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  statusText.textContent = 'กำลังบันทึก...';

  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceMessage: messages.filter((item) => item.role === 'user').map((item) => item.content).join('\n'),
        agentReply: currentAgentReply,
        transcript: messages,
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
    saveBtn.disabled = !currentTicket;
  }
});

renderChat();
setTicket(null, false, ['ยังไม่มีบทสนทนา']);
