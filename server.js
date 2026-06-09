import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorker } from 'tesseract.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const llmBaseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:18080/v1';
let llmModel = process.env.LLM_MODEL || 'gemma4-e4b-qat';
const sheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const localLogPath = path.join(process.cwd(), 'data', 'tickets.jsonl');
const ragIndexPath = path.join(process.cwd(), 'data', 'rag-index.json');
const staticDir = path.join(process.cwd(), 'dist');
const knowledgeDir = path.join(process.cwd(), 'knowledge');
const adminAuth = process.env.ADMIN_AUTH || 'admin:icetong';
let ocrWorkerPromise = null;


app.use(express.json({ limit: '2mb' }));
app.use(express.static(staticDir));
app.use(express.static('public'));

const systemPrompt = `You are a senior Thai IT Support Admin for an internal helpdesk.
You are the first-line intake agent for every IT-related issue users may report, including printers, computers, network, Wi-Fi, email, software, accounts, access control, CCTV/NVR, and vendor-supported systems.
You help collect incident details through a multi-turn chat and create a useful ticket for the correct support team.
Reply in Thai only. Use polite Thai ending "ครับ". Do not include markdown, code fences, hidden reasoning, or explanations outside JSON.

You may receive Relevant Knowledge from SOPs, assets, or previous incidents. Use it only when relevant to the reported category. Do not force CCTV knowledge onto printer/computer/network issues. Do not invent facts. If knowledge suggests possible causes, phrase them as possibilities.

Style:
- Clean, concise, professional.
- Accept and triage the reported issue category directly; never say you only support CCTV/NVR.
- Ask smart follow-up questions, not generic checklists.
- Ask at most 3 questions per reply.
- Prioritize questions that change urgency, routing, asset identification, or first action.
- If enough information exists, stop asking and say the ticket is ready to save.

Return exactly one JSON object:
{
  "agentReply": "Thai chat reply",
  "isReadyToSave": true,
  "missingFields": ["short missing item"],
  "ticket": {
    "ประเภท": "CCTV/NVR | Network | Computer | Printer | Access Control | Software | Other",
    "ปัญหา": "specific problem summary with affected asset/location if known",
    "ผลกระทบ": "specific business/security/user impact",
    "ข้อมูลที่ได้รับ": "detailed Thai summary: asset/location, symptom, affected users/devices, start time, evidence/error, useful knowledge hints, workaround/status",
    "ระดับความเร่งด่วน": "Low | Medium | High | Critical",
    "ทีมที่เกี่ยวข้อง": "IT Support | Network | Security | Vendor | Facilities | Other"
  }
}

Category triage priorities:
- Printer: ask printer name/location, symptom/error, affected users/devices, and whether other printers work. Team is usually IT Support or Vendor if hardware/service required.
- Computer: ask device/user, symptom, OS/app involved, start time, and impact. Team is usually IT Support.
- Network/Wi-Fi/VPN: ask location/network name, affected scope, start time, and whether internet/internal systems are affected. Team is usually Network.
- Software/Email/Account: ask app/system, account/user, error message, affected scope, and urgency. Team is usually IT Support or application owner.
- Access Control: ask door/device/location, symptom, affected users, and security impact. Team is usually IT Support/Security/Vendor.
- CCTV/NVR: ask camera name/ID or exact location, affected viewers/devices, symptom, start time, and screenshot/error if useful. For CCTV/NVR, default team is IT Support for first response; mention security impact in ผลกระทบ.

Readiness rules:
- Ready when support can take first action: category, affected asset/location, symptom, impact, and rough scope/urgency.
- Do not block saving because screenshot or exact start time is missing; list it as optional missing info.

Urgency rules:
- Critical: safety risk, site-wide outage, business stopped, NVR/all critical cameras down.
- High: multiple users/areas affected, critical-area camera down with no workaround.
- Medium: one camera/area/device affected, monitoring degraded but work continues.
- Low: minor issue, request, intermittent issue with workaround.`;

function tokenize(text) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const expected = `Basic ${Buffer.from(adminAuth).toString('base64')}`;
  if (header !== expected) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Gemma Knowledge Admin"');
    res.status(401).json({ error: 'admin authentication required' });
    return;
  }
  next();
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng');
  }
  return ocrWorkerPromise;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('image must be a base64 data URL');
  const mimeType = match[1];
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mimeType)) throw new Error('OCR supports PNG, JPEG, or WebP images');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('image is too large; max 8MB');
  return { mimeType, buffer };
}

async function ocrImage(dataUrl) {
  const { buffer, mimeType } = parseDataUrl(dataUrl);
  const worker = await getOcrWorker();
  try {
    const result = await worker.recognize(buffer);
    const text = String(result.data?.text || '').trim();
    const confidence = Number(result.data?.confidence || 0);
    return { text, confidence, mimeType };
  } catch (error) {
    ocrWorkerPromise = null;
    throw new Error(`OCR failed: ${error.message || error}`);
  }
}

function slugifyFileName(name) {
  const base = String(name || 'upload')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'upload';
  return base;
}

function uploadToMarkdown(file) {
  const name = String(file.name || 'upload');
  const type = String(file.type || 'text/plain');
  const content = String(file.content || '');
  const slug = slugifyFileName(name);
  const ext = name.split('.').pop()?.toLowerCase() || 'txt';
  const now = new Date().toISOString();

  if (ext === 'md' || ext === 'markdown') {
    return { path: `Uploads/${slug}.md`, content };
  }

  if (ext === 'txt' || type.startsWith('text/')) {
    return {
      path: `Uploads/${slug}.md`,
      content: `# ${slug.replaceAll('-', ' ')}\n\nSource file: ${name}\nUploaded at: ${now}\n\n${content}`
    };
  }

  return {
    path: `Uploads/${slug}.md`,
    content: `# ${slug.replaceAll('-', ' ')}\n\nSource file: ${name}\nUploaded at: ${now}\nFile type: ${type || ext}\n\nไฟล์ชนิดนี้ถูกอัปโหลดแล้ว แต่ระบบยังไม่ได้แปลงเนื้อหาอัตโนมัติ กรุณาสรุปหรือวางเนื้อหาสำคัญลงใน note นี้เพื่อใช้เป็น knowledge สำหรับ RAG\n`
  };
}

function safeKnowledgePath(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  if (!clean || clean.includes('..') || !clean.endsWith('.md')) {
    throw new Error('path must be a markdown file inside knowledge/');
  }
  const full = path.join(knowledgeDir, clean);
  const normalizedRoot = path.resolve(knowledgeDir);
  const normalizedFull = path.resolve(full);
  if (!normalizedFull.startsWith(normalizedRoot + path.sep)) {
    throw new Error('invalid knowledge path');
  }
  return { clean, full };
}

async function walkMarkdown(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkMarkdown(full));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

async function rebuildKnowledgeIndex() {
  const files = await walkMarkdown(knowledgeDir);
  const docs = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const title = content.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
    docs.push({
      path: path.relative(process.cwd(), file),
      title,
      content,
      tokens: [...new Set(tokenize(`${title}\n${content}`))]
    });
  }
  await fs.mkdir(path.dirname(ragIndexPath), { recursive: true });
  await fs.writeFile(ragIndexPath, JSON.stringify({ generatedAt: new Date().toISOString(), docs }, null, 2));
  return { generatedAt: new Date().toISOString(), count: docs.length };
}

async function loadRagIndex() {
  try {
    return JSON.parse(await fs.readFile(ragIndexPath, 'utf8'));
  } catch {
    return { docs: [] };
  }
}

function inferCategory(text) {
  if (/ปริ้น|ปริน|printer|พิมพ์|เครื่องพิมพ์/i.test(text)) return 'Printer';
  if (/กล้อง|cctv|nvr|dvr|โกดัง|warehouse|no signal|offline/i.test(text)) return 'CCTV/NVR';
  if (/wifi|wi-fi|network|internet|vpn|เน็ต|ไวไฟ|lan/i.test(text)) return 'Network';
  if (/คอม|notebook|pc|windows|mac|เครื่องช้า|เปิดไม่ติด/i.test(text)) return 'Computer';
  return 'Other';
}

function categoryDocBoost(category, doc) {
  const haystack = `${doc.path} ${doc.title} ${doc.content}`.toLowerCase();
  if (category === 'Printer') return /printer|ปริ้น|ปริน|เครื่องพิมพ์|พิมพ์/.test(haystack) ? 12 : /cctv|nvr|กล้อง/.test(haystack) ? -8 : 0;
  if (category === 'CCTV/NVR') return /cctv|nvr|กล้อง|camera/.test(haystack) ? 12 : /printer|เครื่องพิมพ์/.test(haystack) ? -8 : 0;
  if (category === 'Network') return /network|wifi|wi-fi|vpn|switch|internet|lan/.test(haystack) ? 10 : 0;
  if (category === 'Computer') return /computer|windows|mac|notebook|pc/.test(haystack) ? 10 : 0;
  return 0;
}

async function searchKnowledge(query, limit = 4) {
  const index = await loadRagIndex();
  const category = inferCategory(query);
  const queryTokens = tokenize(query);
  if (!index.docs?.length) return { count: 0, items: [], context: '' };

  const scored = index.docs
    .map((doc) => {
      const docTokens = new Set(doc.tokens || tokenize(`${doc.title}\n${doc.content}`));
      const lexicalScore = queryTokens.reduce((sum, token) => sum + (docTokens.has(token) ? 3 : (doc.content || '').toLowerCase().includes(token) ? 1 : 0), 0);
      const score = lexicalScore + categoryDocBoost(category, doc);
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((doc) => ({
      path: doc.path,
      title: doc.title,
      score: doc.score,
      snippet: (doc.content || '').replace(/\s+/g, ' ').slice(0, 320),
      content: (doc.content || '').slice(0, 1600)
    }));

  const context = scored.map((doc, index) => `Knowledge ${index + 1}: ${doc.title}\nPath: ${doc.path}\n${doc.content}`).join('\n\n');
  return { count: index.docs.length, items: scored.map(({ content, ...doc }) => doc), context };
}

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
  const isCctv = /กล้อง|cctv|nvr|dvr|โกดัง|warehouse|no signal|offline/i.test(allText);
  const isPrinter = /ปริ้น|ปริน|printer|พิมพ์|เครื่องพิมพ์/i.test(allText);
  const category = isCctv ? 'CCTV/NVR' : isPrinter ? 'Printer' : 'Other';
  const reply = isPrinter
    ? 'รับทราบครับ รบกวนขอข้อมูลเพิ่ม 3 จุดครับ: 1. ชื่อหรือจุดติดตั้งเครื่องปริ้นเตอร์ 2. อาการหรือ error ที่ขึ้น 3. เป็นทุกเครื่องหรือเฉพาะเครื่องของคุณครับ'
    : isCctv
      ? 'รับทราบครับ รบกวนขอข้อมูลเพิ่ม 3 จุดครับ: 1. ชื่อกล้องหรือบริเวณที่มีปัญหา 2. ดูไม่ได้ทุกเครื่องหรือเฉพาะเครื่องคุณ 3. อาการเป็นภาพดำ/no signal/offline/ภาพค้างแบบไหนครับ'
      : 'รับทราบครับ รบกวนขอข้อมูลเพิ่ม 3 จุดครับ: 1. อุปกรณ์หรือระบบที่มีปัญหา 2. อาการหรือ error ที่พบ 3. กระทบผู้ใช้กี่คนหรือเริ่มเป็นตั้งแต่เมื่อไหร่ครับ';
  return {
    agentReply: reply,
    isReadyToSave: false,
    missingFields: ['ชื่อกล้อง/บริเวณ', 'ขอบเขตผู้ได้รับผลกระทบ', 'อาการที่พบ'],
    ticket: {
      'ประเภท': category,
      'ปัญหา': allText || 'ยังไม่ได้ระบุปัญหา',
      'ผลกระทบ': isCctv ? 'การตรวจสอบพื้นที่ผ่านระบบ CCTV อาจได้รับผลกระทบ' : isPrinter ? 'ผู้ใช้อาจไม่สามารถพิมพ์เอกสารได้ตามปกติ' : 'ต้องรอข้อมูลเพิ่มเติมเพื่อประเมินผลกระทบ',
      'ข้อมูลที่ได้รับ': allText || '-',
      'ระดับความเร่งด่วน': 'Medium',
      'ทีมที่เกี่ยวข้อง': 'IT Support'
    }
  };
}

async function callLocalGemma(messages) {
  const history = messages.filter((item) => item.role === 'user' || item.role === 'assistant');
  const latestUser = [...history].reverse().find((item) => item.role === 'user')?.content || '';
  const conversationText = history.map((item) => `${item.role}: ${item.content}`).join('\n');
  const rag = await searchKnowledge(conversationText || latestUser);
  const fallback = fallbackTriage(latestUser, history);

  const userInstruction = `${rag.context ? `Relevant Knowledge:\n${rag.context}\n\n` : ''}Conversation so far:\n${conversationText}\n\nอัปเดต ticket จากบริบททั้งหมดด้านบน ตอบกลับเป็น JSON object เท่านั้น`;

  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmModel,
      temperature: 0,
      max_tokens: 720,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInstruction }
      ]
    })
  });

  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error(`LLM returned non-JSON content: ${content.slice(0, 160)}`);

  const parsed = JSON.parse(content.slice(start, end + 1));
  return {
    agentReply: parsed.agentReply || fallback.agentReply,
    isReadyToSave: Boolean(parsed.isReadyToSave),
    missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : fallback.missingFields,
    ticket: normalizeTicket(parsed.ticket, fallback.ticket),
    ragContext: { count: rag.count, items: rag.items }
  };
}

async function saveIncidentNote(row) {
  const safeDate = new Date().toISOString().slice(0, 10);
  const safeTitle = String(row['ปัญหา'] || 'incident').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 70) || 'incident';
  const file = path.join(process.cwd(), 'knowledge', 'Incidents', `${safeDate}-${safeTitle}.md`);
  const note = `# ${row['ปัญหา'] || 'Incident'}\n\nประเภท: ${row['ประเภท'] || ''}\nระดับความเร่งด่วน: ${row['ระดับความเร่งด่วน'] || ''}\nทีมที่เกี่ยวข้อง: ${row['ทีมที่เกี่ยวข้อง'] || ''}\n\n## ผลกระทบ\n${row['ผลกระทบ'] || ''}\n\n## ข้อมูลที่ได้รับ\n${row['ข้อมูลที่ได้รับ'] || ''}\n\n## Transcript\n${row.transcript || ''}\n`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, note, 'utf8');
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
  await saveIncidentNote(row).catch(() => {});

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

app.get('/admin', requireAdmin, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

app.get('/api/admin/knowledge', requireAdmin, async (_req, res) => {
  const files = await walkMarkdown(knowledgeDir);
  const notes = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    notes.push({
      path: path.relative(knowledgeDir, file),
      title: content.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md'),
      size: Buffer.byteLength(content),
      updatedAt: (await fs.stat(file)).mtime.toISOString()
    });
  }
  notes.sort((a, b) => a.path.localeCompare(b.path));
  res.json({ ok: true, notes });
});

app.get('/api/admin/knowledge/file', requireAdmin, async (req, res) => {
  try {
    const { clean, full } = safeKnowledgePath(req.query.path);
    const content = await fs.readFile(full, 'utf8');
    res.json({ ok: true, path: clean, content });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/knowledge/file', requireAdmin, async (req, res) => {
  try {
    const { clean, full } = safeKnowledgePath(req.body?.path);
    const content = String(req.body?.content || '');
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    const index = await rebuildKnowledgeIndex();
    res.json({ ok: true, path: clean, index });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/knowledge/upload', requireAdmin, async (req, res) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) {
      res.status(400).json({ error: 'files are required' });
      return;
    }

    const saved = [];
    for (const file of files.slice(0, 20)) {
      const note = uploadToMarkdown(file);
      const { clean, full } = safeKnowledgePath(note.path);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, note.content, 'utf8');
      saved.push(clean);
    }

    const index = await rebuildKnowledgeIndex();
    res.json({ ok: true, saved, index });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/knowledge/file', requireAdmin, async (req, res) => {
  try {
    const { clean, full } = safeKnowledgePath(req.body?.path);
    await fs.unlink(full);
    const index = await rebuildKnowledgeIndex();
    res.json({ ok: true, path: clean, index });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/knowledge/reindex', requireAdmin, async (_req, res) => {
  try {
    res.json({ ok: true, index: await rebuildKnowledgeIndex() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/models', async (_req, res) => {
  const candidates = [
    {
      id: 'gemma4-e4b-qat',
      label: 'Gemma 4 E4B QAT',
      size: '5.15GB',
      context: '8K recommended',
      localPath: 'models/gemma-4-e4b-qat/gemma-4-E4B_q4_0-it.gguf',
      startCommand: 'MODEL_SIZE=e4b CTX_SIZE=8192 HOST=0.0.0.0 LLM_PORT=18080 scripts/start_model.sh'
    },
    {
      id: 'gemma4-12b-qat',
      label: 'Gemma 4 12B QAT',
      size: '6.98GB',
      context: '16K optional, 8K safer',
      localPath: 'models/gemma-4-12b-qat/gemma-4-12b-it-qat-q4_0.gguf',
      startCommand: 'MODEL_SIZE=12b CTX_SIZE=8192 HOST=0.0.0.0 LLM_PORT=18080 scripts/start_model.sh'
    }
  ];

  const models = [];
  for (const model of candidates) {
    const exists = await fs.access(path.join(process.cwd(), model.localPath)).then(() => true).catch(() => false);
    models.push({ ...model, exists, selected: model.id === llmModel });
  }

  let serverModels = [];
  try {
    const response = await fetch(`${llmBaseUrl}/models`);
    const data = await response.json();
    serverModels = data.data || data.models || [];
  } catch {}

  res.json({ ok: true, selected: llmModel, models, serverModels });
});

app.post('/api/models/select', async (req, res) => {
  const model = String(req.body?.model || '').trim();
  const allowed = ['gemma4-e4b-qat', 'gemma4-12b-qat'];
  if (!allowed.includes(model)) {
    res.status(400).json({ error: 'unknown model' });
    return;
  }
  llmModel = model;
  res.json({ ok: true, selected: llmModel, note: 'Model alias updated for API calls. If llama-server is running a different model, restart it with the matching start command.' });
});

app.post('/api/ocr', async (req, res) => {
  try {
    const image = String(req.body?.image || '');
    const name = String(req.body?.name || 'screenshot');
    if (!image) {
      res.status(400).json({ error: 'image is required' });
      return;
    }
    const result = await ocrImage(image);
    res.json({ ok: true, name, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llmBaseUrl, llmModel, sheetEnabled: Boolean(sheetWebhookUrl) });
});

app.get('/api/rag/search', async (req, res) => {
  const q = String(req.query.q || '');
  res.json(await searchKnowledge(q));
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
  } catch {
    mode = 'fallback-rules';
    const latestUser = [...cleanMessages].reverse().find((item) => item.role === 'user')?.content || '';
    result = { ...fallbackTriage(latestUser, cleanMessages), ragContext: await searchKnowledge(latestUser) };
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

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Gemma IT Ticket WebUI: http://127.0.0.1:${port}`);
});
