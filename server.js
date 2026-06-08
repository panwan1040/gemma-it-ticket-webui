import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 3000);
const llmBaseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:18080/v1';
const llmModel = process.env.LLM_MODEL || 'gemma4-e4b-qat';
const sheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const localLogPath = path.join(process.cwd(), 'data', 'tickets.jsonl');

app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const systemPrompt = `You are a senior Thai IT support triage agent for an internal helpdesk.
You help collect incident details through a multi-turn chat and create a useful ticket for the next support team.
Reply in Thai only. Do not include markdown, code fences, hidden reasoning, or explanations outside JSON.

Style:
- Warm, concise, professional. Use polite Thai ending "ครับ", not "ค่ะ/คะ".
- Ask smart follow-up questions, not a generic checklist every time.
- Ask at most 3 questions per reply unless the user explicitly asks for a checklist.
- Prioritize questions that change urgency, routing, or first action.
- If the user already gave enough information, stop asking and say the ticket is ready to save.

Your job:
1. Continue the chat naturally and ask only for the most important missing information.
2. Maintain a detailed structured ticket from all conversation context.
3. Infer impact, urgency, and responsible team conservatively.
4. Tell whether the ticket has enough information to save.
5. If ready, briefly summarize what will be saved and ask whether the user wants to add anything else.

Return exactly one JSON object:
{
  "agentReply": "Thai chat reply",
  "isReadyToSave": true,
  "missingFields": ["short missing item"],
  "ticket": {
    "ประเภท": "CCTV/NVR | Network | Computer | Printer | Access Control | Software | Other",
    "ปัญหา": "specific problem summary with affected asset/location if known",
    "ผลกระทบ": "specific business/security/user impact, not vague if inferable",
    "ข้อมูลที่ได้รับ": "bullet-like Thai summary in one string: asset/location, symptom, affected users/devices, start time, evidence/error, workaround/status",
    "ระดับความเร่งด่วน": "Low | Medium | High | Critical",
    "ทีมที่เกี่ยวข้อง": "IT Support | Network | Security | Vendor | Facilities | Other"
  }
}

Good ticket detail rules:
- ปัญหา should be concise but specific, e.g. "กล้อง CAM-WH-01 หน้าโกดังดูไม่ได้ทุกเครื่อง".
- ผลกระทบ should explain operational consequence, e.g. "รปภ. ไม่สามารถตรวจสอบพื้นที่หน้าโกดังจากระบบ CCTV ได้".
- ข้อมูลที่ได้รับ should preserve all useful facts, including unknowns as "ยังไม่ทราบ" only for important missing facts.
- Do not invent camera names, exact times, error messages, or affected users.
- If a field is unknown but not essential, infer a reasonable summary and keep missingFields short.

CCTV/NVR triage priorities:
- Ask camera name/ID or exact location if missing.
- Ask whether it fails for everyone/all devices or only one viewer if missing.
- Ask symptom: black screen, no signal, offline, image frozen, login/playback issue, or app cannot connect.
- Ask start time/recent change if missing.
- Ask for screenshot/error only if symptom is unclear.
- If all cameras fail, route may be Network or Vendor and urgency likely High/Critical.
- If one critical-area camera fails and security monitoring is affected, urgency is usually Medium or High depending coverage.

Other routing hints:
- Network: internet/Wi-Fi/VPN/switch/connectivity across users or devices.
- Vendor: hardware failure, NVR/camera replacement, warranty, or external provider required.
- For CCTV/NVR incidents, default ทีมที่เกี่ยวข้อง to "IT Support" for first response unless the user clearly says the security operations team must own it. Mention security impact in ผลกระทบ instead.
- Security: physical security/access control operations when the task is operational monitoring, policy, or guard team action rather than technical troubleshooting.
- Facilities: power, physical obstruction, cable/power adapter, environment.

Readiness rules:
- Ready when there is enough information for support to take first action: category, affected asset/location, symptom, impact, and rough scope or urgency.
- Not ready if the problem is too vague to identify asset/location or symptom.
- Do not block saving just because screenshot or exact start time is missing; list it as optional missing info.

Urgency rules:
- Critical: safety risk, site-wide outage, business stopped, multiple critical cameras/security blind spot, NVR down for entire site.
- High: multiple users/areas affected, important service unavailable, critical-area camera down with no workaround.
- Medium: one camera/area/device affected, monitoring degraded but business can continue.
- Low: minor issue, request, cosmetic issue, intermittent issue with workaround.`;

function normalizeTicket(ticket, fallbackTicket) {
  const source = ticket && typeof ticket === 'object' ? ticket : {};
  return {
    'ประเภท': source['ประเภท'] || fallbackTicket['ประเภท'],
    'ปัญหา': source['ปัญหา'] || fallbackTicket['ปัญหา'],
    'ผลกระทบ': source['ผลกระทบ'] || fallbackTicket['ผลกระทบ'],
    'ข้อมูลที่ได้รับ': source['ข้อมูลที่ได้รับ'] || fallbackTicket['ข้อมูลที่ได้รับ'],
    'ระดับความเร่งด่วน': source['ระดับความเร่งด่วน'] || fallbackTicket['ระดับความเร่งด่วน'],
    'ทีมที่เกี่ยวข้อง': source['ทีมที่เกี่ยวข้อง'] || fallbackTicket['ทีมที่เกี่ยวข้อง']
  };
}

function fallbackTriage(message, history = []) {
  const allText = [...history.map((item) => item.content), message].join('\n').trim();
  const isCctv = /กล้อง|cctv|nvr|dvr|โกดัง|warehouse/i.test(allText);
  const type = isCctv ? 'CCTV/NVR' : 'Other';
  const impact = isCctv
    ? 'เจ้าหน้าที่รักษาความปลอดภัยตรวจสอบพื้นที่ไม่ได้'
    : 'ต้องรอข้อมูลเพิ่มเติมเพื่อประเมินผลกระทบ';

  return {
    agentReply: 'ขอข้อมูลเพิ่มครับ\n1. ชื่อกล้องหรือบริเวณที่มีปัญหา\n2. ดูไม่ได้ทุกเครื่องหรือเฉพาะเครื่องคุณ\n3. เริ่มมีปัญหาตั้งแต่เมื่อไหร่\n4. มีรูปหน้าจอ error ไหม',
    isReadyToSave: false,
    missingFields: ['ชื่อกล้อง/บริเวณ', 'ผู้ได้รับผลกระทบ', 'เวลาเริ่มเกิดปัญหา', 'error หรือรูปหน้าจอ'],
    ticket: {
      'ประเภท': type,
      'ปัญหา': allText || 'ยังไม่ได้ระบุปัญหา',
      'ผลกระทบ': impact,
      'ข้อมูลที่ได้รับ': allText || '-',
      'ระดับความเร่งด่วน': 'Medium',
      'ทีมที่เกี่ยวข้อง': 'IT Support'
    }
  };
}

async function callLocalGemma(messages) {
  const history = messages.filter((item) => item.role === 'user' || item.role === 'assistant');
  const latestUser = [...history].reverse().find((item) => item.role === 'user')?.content || '';
  const fallback = fallbackTriage(latestUser, history);

  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmModel,
      temperature: 0,
      max_tokens: 650,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: 'อัปเดต ticket จากบริบททั้งหมดด้านบน ตอบกลับเป็น JSON object เท่านั้น' }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`LLM returned non-JSON content: ${content.slice(0, 160)}`);
  }

  const parsed = JSON.parse(content.slice(start, end + 1));
  return {
    agentReply: parsed.agentReply || fallback.agentReply,
    isReadyToSave: Boolean(parsed.isReadyToSave),
    missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : fallback.missingFields,
    ticket: normalizeTicket(parsed.ticket, fallback.ticket)
  };
}

async function saveTicket(ticket, sourceMessage, agentReply, transcript = []) {
  const row = {
    timestamp: new Date().toISOString(),
    sourceMessage,
    agentReply,
    transcript: transcript.map((item) => `${item.role}: ${item.content}`).join('\n'),
    ...ticket
  };

  await fs.mkdir(path.dirname(localLogPath), { recursive: true });
  await fs.appendFile(localLogPath, `${JSON.stringify(row)}\n`, 'utf8');

  if (sheetWebhookUrl) {
    const response = await fetch(sheetWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Sheet webhook HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
  }

  return row;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llmBaseUrl, llmModel, sheetEnabled: Boolean(sheetWebhookUrl) });
});

app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const cleanMessages = messages
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && String(item.content || '').trim())
    .slice(-16)
    .map((item) => ({ role: item.role, content: String(item.content).trim() }));

  if (!cleanMessages.some((item) => item.role === 'user')) {
    res.status(400).json({ error: 'at least one user message is required' });
    return;
  }

  let result;
  let mode = 'local-gemma';

  try {
    result = await callLocalGemma(cleanMessages);
  } catch (error) {
    mode = 'fallback-rules';
    const latestUser = [...cleanMessages].reverse().find((item) => item.role === 'user')?.content || '';
    result = fallbackTriage(latestUser, cleanMessages);
  }

  res.json({ mode, ...result });
});

app.post('/api/triage', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  let result;
  let mode = 'local-gemma';

  try {
    result = await callLocalGemma([{ role: 'user', content: message }]);
  } catch (error) {
    mode = 'fallback-rules';
    result = fallbackTriage(message);
  }

  res.json({ mode, ...result });
});

app.post('/api/tickets', async (req, res) => {
  const ticket = req.body?.ticket;
  const sourceMessage = String(req.body?.sourceMessage || '');
  const agentReply = String(req.body?.agentReply || '');
  const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript : [];

  if (!ticket || typeof ticket !== 'object') {
    res.status(400).json({ error: 'ticket is required' });
    return;
  }

  try {
    const saved = await saveTicket(ticket, sourceMessage, agentReply, transcript);
    res.json({ ok: true, saved, sheetEnabled: Boolean(sheetWebhookUrl) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Gemma IT Ticket WebUI: http://127.0.0.1:${port}`);
});
