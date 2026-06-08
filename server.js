import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 3000);
const llmBaseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1';
const llmModel = process.env.LLM_MODEL || 'gemma4-12b-qat';
const sheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const localLogPath = path.join(process.cwd(), 'data', 'tickets.jsonl');

app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const systemPrompt = `You are a Thai IT support triage agent for CCTV/NVR, network, computer, printer, access control, and software incidents.
Reply in Thai only. Do not include hidden reasoning, markdown, explanation, or code fences.
When the user reports a problem, do two things:
1. Ask concise follow-up questions needed for support.
2. Extract a structured ticket as strict JSON.

Return exactly one minified JSON object with this schema:
{
  "agentReply": "Thai message to user",
  "ticket": {
    "ประเภท": "CCTV/NVR | Network | Computer | Printer | Access Control | Software | Other",
    "ปัญหา": "short problem summary",
    "ผลกระทบ": "business/user impact",
    "ข้อมูลที่ได้รับ": "facts already received",
    "ระดับความเร่งด่วน": "Low | Medium | High | Critical",
    "ทีมที่เกี่ยวข้อง": "IT Support | Network | Security | Vendor | Facilities | Other"
  }
}

Urgency rules:
- Critical: safety, site-wide outage, business stopped, security blind spot in critical area.
- High: multiple users/areas affected or important service unavailable.
- Medium: one area/device affected but work can continue with workaround.
- Low: minor issue, request, or cosmetic problem.

For vague CCTV/NVR reports, ask for camera name/area, who is affected, when it started, and screenshot/error.`;

function fallbackTriage(message) {
  const text = message.trim();
  const isCctv = /กล้อง|cctv|nvr|dvr|โกดัง|warehouse/i.test(text);
  const type = isCctv ? 'CCTV/NVR' : 'Other';
  const team = isCctv ? 'IT Support' : 'IT Support';
  const impact = isCctv
    ? 'เจ้าหน้าที่รักษาความปลอดภัยตรวจสอบพื้นที่ไม่ได้'
    : 'ต้องรอข้อมูลเพิ่มเติมเพื่อประเมินผลกระทบ';

  return {
    agentReply: 'ขอข้อมูลเพิ่มครับ\n1. ชื่อกล้องหรือบริเวณที่มีปัญหา\n2. ดูไม่ได้ทุกเครื่องหรือเฉพาะเครื่องคุณ\n3. เริ่มมีปัญหาตั้งแต่เมื่อไหร่\n4. มีรูปหน้าจอ error ไหม',
    ticket: {
      'ประเภท': type,
      'ปัญหา': text || 'ยังไม่ได้ระบุปัญหา',
      'ผลกระทบ': impact,
      'ข้อมูลที่ได้รับ': text || '-',
      'ระดับความเร่งด่วน': 'Medium',
      'ทีมที่เกี่ยวข้อง': team
    }
  };
}

async function callLocalGemma(message) {
  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmModel,
      temperature: 0,
      max_tokens: 350,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${message}\n\nตอบกลับเป็น JSON object เท่านั้น ห้ามใส่ markdown ห้ามอธิบายเพิ่ม` }
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
  const jsonText = content.slice(start, end + 1);
  return JSON.parse(jsonText);
}

async function saveTicket(ticket, sourceMessage, agentReply) {
  const row = {
    timestamp: new Date().toISOString(),
    sourceMessage,
    agentReply,
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
      throw new Error(`Google Sheet webhook HTTP ${response.status}`);
    }
  }

  return row;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llmBaseUrl, llmModel, sheetEnabled: Boolean(sheetWebhookUrl) });
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
    result = await callLocalGemma(message);
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

  if (!ticket || typeof ticket !== 'object') {
    res.status(400).json({ error: 'ticket is required' });
    return;
  }

  try {
    const saved = await saveTicket(ticket, sourceMessage, agentReply);
    res.json({ ok: true, saved, sheetEnabled: Boolean(sheetWebhookUrl) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Gemma IT Ticket WebUI: http://127.0.0.1:${port}`);
});
