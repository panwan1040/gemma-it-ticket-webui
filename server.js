import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const app = express();
const execFileAsync = promisify(execFile);
const isProduction = process.env.NODE_ENV === 'production';
const unsafeAdminAuthValues = new Set(['', 'admin:change-me', 'admin:icetong', 'admin:admin', 'admin:password']);
const configuredAdminAuth = process.env.ADMIN_AUTH || '';
if (isProduction && unsafeAdminAuthValues.has(configuredAdminAuth)) {
  throw new Error('ADMIN_AUTH must be configured to a non-default value before starting in production.');
}
const adminAuth = configuredAdminAuth || 'admin:dev-local-only';
const port = Number(process.env.PORT || 3000);
const llmBaseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:18080/v1';
let llmModel = process.env.LLM_MODEL || 'gemma4-e4b-qat';
const sheetWebhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const localLogPath = path.join(process.cwd(), 'data', 'tickets.jsonl');
const ragIndexPath = path.join(process.cwd(), 'data', 'rag-index.json');
const attachmentDir = path.join(process.cwd(), 'data', 'attachments');
const adminAuditPath = path.join(process.cwd(), 'data', 'admin-audit.jsonl');
const staticDir = path.join(process.cwd(), 'dist');
const knowledgeDir = path.join(process.cwd(), 'knowledge');
const appConfig = {
  appName: process.env.APP_NAME || 'Local AI Helpdesk',
  appTagline: process.env.APP_TAGLINE || 'AI-assisted ticket intake for internal support teams',
  appDescription: process.env.APP_DESCRIPTION || 'Collect issue details, draft tickets, and save them to your support workflow.'
};
const typhoonBaseUrl = process.env.TYPHOON_OCR_BASE_URL || 'http://127.0.0.1:11434';
const typhoonModel = process.env.TYPHOON_OCR_MODEL || 'scb10x/typhoon-ocr1.5-3b';
const typhoonMaxPdfPages = Math.max(1, Math.min(Number(process.env.TYPHOON_OCR_MAX_PDF_PAGES || 3), 10));
const typhoonMaxUploadMb = Math.max(1, Math.min(Number(process.env.TYPHOON_OCR_MAX_UPLOAD_MB || 24), 80));
const jsonBodyLimitMb = Math.max(1, Math.min(Number(process.env.JSON_BODY_LIMIT_MB || Math.max(32, typhoonMaxUploadMb + 8)), 120));
const ragMaxDocs = Math.max(1, Math.min(Number(process.env.RAG_MAX_DOCS || 4), 12));
const ragMaxCharsPerDoc = Math.max(400, Math.min(Number(process.env.RAG_MAX_CHARS_PER_DOC || 1600), 8000));
const ragMaxTotalContextChars = Math.max(1000, Math.min(Number(process.env.RAG_MAX_TOTAL_CONTEXT_CHARS || 6000), 24000));
const ollamaAppBin = '/Applications/Ollama.app/Contents/Resources/ollama';


app.use(express.json({ limit: `${jsonBodyLimitMb}mb` }));
app.use(express.static(staticDir));
app.use(express.static('public'));


function makeRateLimiter({ windowMs, max, name }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || req.socket?.remoteAddress || 'local'}:${name}`;
    const current = hits.get(key) || { count: 0, resetAt: now + windowMs };
    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }
    current.count += 1;
    hits.set(key, current);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - current.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));
    if (current.count > max) {
      res.status(429).json({ error: 'rate limit exceeded', retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) });
      return;
    }
    next();
  };
}
const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const generalLimiter = makeRateLimiter({ windowMs: rateWindowMs, max: Number(process.env.RATE_LIMIT_GENERAL_MAX || 120), name: 'general' });
const chatLimiter = makeRateLimiter({ windowMs: rateWindowMs, max: Number(process.env.RATE_LIMIT_CHAT_MAX || 30), name: 'chat' });
const uploadLimiter = makeRateLimiter({ windowMs: rateWindowMs, max: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 10), name: 'upload' });
const ticketLimiter = makeRateLimiter({ windowMs: rateWindowMs, max: Number(process.env.RATE_LIMIT_TICKET_MAX || 30), name: 'ticket' });
app.use('/api', generalLimiter);

const systemPrompt = `You are a senior Thai IT Support Admin for an internal helpdesk.
You are the first-line intake agent for every IT-related issue users may report, including printers, computers, network, Wi-Fi, email, software, accounts, access control, CCTV/NVR, and vendor-supported systems.
You help collect incident details through a multi-turn chat and draft a useful ticket for the correct support team. The UI saves the ticket only after the user clicks the save button and receives a ticket ID.
Reply in Thai only. Use polite Thai ending "ครับ". Do not include markdown, code fences, hidden reasoning, or explanations outside JSON.

You may receive Relevant Knowledge from SOPs, assets, or previous incidents. Use it only when relevant to the reported category. Do not force CCTV knowledge onto printer/computer/network issues. Do not invent facts. If knowledge suggests possible causes, phrase them as possibilities.

Style:
- Clean, concise, professional.
- Use short bullet points when listing known details or questions.
- Avoid long paragraphs. Keep each paragraph under 2 short sentences.
- Accept and triage the reported issue category directly; never say you only support CCTV/NVR.
- Ask smart follow-up questions, not generic checklists.
- Ask one question per reply by default. Ask at most 2 only when the questions are tightly related.
- Never ask a long checklist.
- Prefer natural concise questions such as asking for callback phone, exact building/area, department, affected device, and whether there is anything else to add.
- Prioritize questions that change urgency, routing, asset identification, or first action.
- If enough information exists, stop asking, say IT has enough information to draft the ticket, mention that IT will contact the requester back after the ticket is saved, summarize known details as bullets, and ask if there is anything else to add.
- If the user only attaches a file/image/PDF or OCR text without clearly describing the issue, acknowledge the attachment briefly and ask exactly one question: what issue should IT check from this file? Do not say you are unsure whether it is related to IT. Do not list example questions.

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
- If missing only contact, exact sub-location, department, or optional evidence, ask briefly instead of producing a long explanation.
- If an attachment is present, treat it as supporting evidence and include it in ข้อมูลที่ได้รับ. If OCR text is unclear or unrelated, say only that the file was received and ask for the issue in one short question.
- If the user does not know technical details, do not press them for model names. Ask for observable symptoms and location instead.

Urgency rules:
- Critical: safety risk, site-wide outage, business stopped, NVR/all critical cameras down.
- High: multiple users/areas affected, critical-area camera down with no workaround.
- Medium: one camera/area/device affected, monitoring degraded but work continues.
- Low: minor issue, request, intermittent issue with workaround.`;

function tokenize(text) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
}


async function auditAdmin(req, action, target, success, detail = '') {
  const row = {
    timestamp: new Date().toISOString(),
    action,
    target: String(target || ''),
    success: Boolean(success),
    ip: req.ip || req.socket?.remoteAddress || '',
    detail: String(detail || '').slice(0, 240)
  };
  await fs.mkdir(path.dirname(adminAuditPath), { recursive: true });
  await fs.appendFile(adminAuditPath, `${JSON.stringify(row)}\n`, 'utf8').catch(() => {});
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

function safeAttachmentName(name) {
  const original = String(name || 'attachment');
  const ext = original.includes('.') ? original.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  const base = slugifyFileName(original) || 'attachment';
  return `${randomUUID()}-${base}.${ext || 'bin'}`;
}

function safeAttachmentPath(day, filename) {
  const safeDay = String(day || '');
  const safeFile = String(filename || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDay) || safeFile.includes('/') || safeFile.includes('..')) {
    throw new Error('invalid attachment path');
  }
  const full = path.resolve(attachmentDir, safeDay, safeFile);
  const root = path.resolve(attachmentDir);
  if (!full.startsWith(root + path.sep)) throw new Error('invalid attachment path');
  return full;
}

function summarizeAttachments(attachments = []) {
  return attachments.map((item, index) => {
    const lines = [`${index + 1}. ${item.name || 'attachment'}`];
    if (item.path) lines.push(`ไฟล์: ${item.path}`);
    if (item.ocrText) lines.push(`ข้อความที่อ่านได้: ${String(item.ocrText).slice(0, 1200)}`);
    return lines.join(' | ');
  }).join('\n');
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

function isOcrSupportedFile(name, type = '') {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext) || /^image\/(png|jpe?g|webp)$/i.test(type);
}

function stripDataUrl(value) {
  return String(value || '').replace(/^data:[^;]+;base64,/, '');
}

function ocrPrompt(pageLabel) {
  return `Extract all text from this ${pageLabel}.

Instructions:
- Return only clean Markdown.
- Preserve Thai and English text exactly when possible.
- Include all visible document information.
- Tables must be rendered as GitHub-Flavored Markdown tables, not HTML.
- If there are figures, charts, stamps, logos, or photos, wrap a short Thai description in <figure>...</figure>.
- If text is unclear, mark it as [อ่านไม่ชัด] instead of guessing.
- Do not include explanations outside the extracted Markdown.`;
}

async function writeTempUpload(file) {
  const name = String(file.name || 'upload');
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemma-ocr-'));
  const full = path.join(dir, `upload.${safeExt}`);
  const base64 = stripDataUrl(file.base64);
  const sizeMb = Buffer.byteLength(base64, 'base64') / 1024 / 1024;
  if (!base64 || sizeMb > typhoonMaxUploadMb) {
    throw new Error(`OCR upload must be base64 and <= ${typhoonMaxUploadMb}MB`);
  }
  await fs.writeFile(full, Buffer.from(base64, 'base64'));
  return { dir, full, ext: safeExt };
}

async function pdfToImages(pdfPath, outDir) {
  await execFileAsync('pdfinfo', [pdfPath], { timeout: 15000 });
  const prefix = path.join(outDir, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '160', '-f', '1', '-l', String(typhoonMaxPdfPages), pdfPath, prefix], { timeout: 120000 });
  const entries = await fs.readdir(outDir);
  return entries
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => path.join(outDir, name));
}

async function callTyphoonOcr(imagePath, pageLabel) {
  const imageBase64 = await fs.readFile(imagePath, 'base64');
  const response = await fetch(`${typhoonBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: typhoonModel,
      prompt: ocrPrompt(pageLabel),
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.6,
        repeat_penalty: 1.2,
        num_ctx: 8192
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Typhoon OCR HTTP ${response.status}: ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  return String(data.response || '').trim();
}

async function parseWithTyphoonOcr(file) {
  if (!isOcrSupportedFile(file.name, file.type)) {
    throw new Error('OCR supports PDF, PNG, JPG, JPEG, and WEBP only');
  }

  const temp = await writeTempUpload(file);
  try {
    const imagePaths = temp.ext === 'pdf' ? await pdfToImages(temp.full, temp.dir) : [temp.full];
    if (!imagePaths.length) throw new Error('PDF conversion produced no pages');

    const pages = [];
    for (let index = 0; index < imagePaths.length; index += 1) {
      const pageLabel = temp.ext === 'pdf' ? `PDF page ${index + 1}` : 'image';
      const markdown = await callTyphoonOcr(imagePaths[index], pageLabel);
      pages.push(`## Page ${index + 1}\n\n${markdown || '[Typhoon OCR returned empty output]'}`);
    }

    const slug = slugifyFileName(file.name);
    const now = new Date().toISOString();
    return {
      path: `Uploads/${slug}-ocr.md`,
      content: `# ${slug.replaceAll('-', ' ')} OCR\n\nSource file: ${file.name}\nParsed by: Typhoon OCR 1.5 3B via Ollama\nParsed at: ${now}\nReview status: Needs human review before production use\n\n${pages.join('\n\n---\n\n')}\n`
    };
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getTyphoonOcrStatus() {
  let available = false;
  let reachable = false;
  let detail = 'Ollama/Typhoon OCR ยังไม่เปิด';
  try {
    const response = await fetch(`${typhoonBaseUrl}/api/tags`);
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    reachable = response.ok;
    available = reachable && models.some((model) => String(model.name || '').startsWith(typhoonModel));
    detail = available ? 'Typhoon OCR พร้อมใช้งาน' : `Ollama เปิดอยู่ แต่ยังไม่มีโมเดล ${typhoonModel}`;
  } catch {}

  return {
    available,
    reachable,
    baseUrl: typhoonBaseUrl,
    model: typhoonModel,
    maxPdfPages: typhoonMaxPdfPages,
    maxUploadMb: typhoonMaxUploadMb,
    detail,
    installCommand: 'scripts/install_typhoon_ocr.sh'
  };
}

async function startTyphoonOcrWorker() {
  const before = await getTyphoonOcrStatus();
  if (before.available) return { started: false, status: before };

  let bin = process.env.OLLAMA_BIN || '';
  if (!bin && process.platform === 'darwin') {
    bin = await fs.access(ollamaAppBin).then(() => ollamaAppBin).catch(() => '');
  }
  if (!bin) {
    bin = await execFileAsync('/bin/zsh', ['-lc', 'command -v ollama'], { timeout: 5000 })
      .then(({ stdout }) => stdout.trim())
      .catch(() => '');
  }
  if (!bin) {
    throw new Error('ยังไม่พบ Ollama ในเครื่อง กรุณารัน scripts/install_typhoon_ocr.sh ก่อนครับ');
  }

  const child = spawn(bin, ['serve'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      OLLAMA_HOST: typhoonBaseUrl.replace(/^https?:\/\//, '')
    }
  });
  child.unref();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const status = await getTyphoonOcrStatus();
    if (status.reachable) return { started: true, status };
  }

  return { started: true, status: await getTyphoonOcrStatus() };
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

function extractKnowledgeMetadata(content, file) {
  const get = (name) => content.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))?.[1]?.trim() || '';
  const title = content.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
  const tags = get('tags').split(',').map((item) => item.trim()).filter(Boolean);
  return { title, category: get('category') || path.basename(path.dirname(file)), tags, source: get('source'), lastReviewedAt: get('lastReviewedAt') };
}

async function rebuildKnowledgeIndex() {
  const files = await walkMarkdown(knowledgeDir);
  const docs = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const metadata = extractKnowledgeMetadata(content, file);
    docs.push({
      path: path.relative(process.cwd(), file),
      title: metadata.title,
      metadata,
      reviewed: Boolean(metadata.lastReviewedAt),
      content,
      tokens: [...new Set(tokenize(`${metadata.title} ${metadata.category} ${metadata.tags.join(' ')}\n${content}`))]
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

async function searchKnowledge(query, limit = ragMaxDocs) {
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
    .slice(0, Math.min(limit, ragMaxDocs))
    .map((doc) => ({
      path: doc.path,
      title: doc.title,
      metadata: doc.metadata || {},
      reviewed: Boolean(doc.reviewed),
      score: doc.score,
      snippet: (doc.content || '').replace(/\s+/g, ' ').slice(0, 320),
      content: (doc.content || '').slice(0, ragMaxCharsPerDoc)
    }));

  let total = 0;
  const contextParts = [];
  for (let index = 0; index < scored.length; index += 1) {
    const doc = scored[index];
    const part = `Knowledge ${index + 1}: ${doc.title}\nPath: ${doc.path}\nCategory: ${doc.metadata?.category || ''}\nReviewed: ${doc.reviewed ? 'yes' : 'no'}\n${doc.content}`;
    if (total + part.length > ragMaxTotalContextChars) break;
    total += part.length;
    contextParts.push(part);
  }
  return { count: index.docs.length, items: scored.map(({ content, ...doc }) => doc), context: contextParts.join('\n\n'), limits: { maxDocs: ragMaxDocs, maxCharsPerDoc: ragMaxCharsPerDoc, maxTotalContextChars: ragMaxTotalContextChars } };
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
    ? 'รับทราบครับ ขอข้อมูลเพิ่มนิดนึงครับ\n\n- เครื่องปริ้นอยู่บริเวณไหนของอาคาร/ชั้นไหนครับ\n- แผนกอะไรครับ\n- ขอเบอร์โทรติดต่อกลับได้ไหมครับ'
    : isCctv
      ? 'รับทราบครับ ขอข้อมูลเพิ่มนิดนึงครับ\n\n- กล้องอยู่บริเวณไหนครับ\n- ดูไม่ได้ทุกเครื่องหรือเฉพาะเครื่องคุณครับ\n- ขอเบอร์โทรติดต่อกลับได้ไหมครับ'
      : 'รับทราบครับ ขอข้อมูลเพิ่มนิดนึงครับ\n\n- อาคาร/บริเวณไหนครับ\n- แผนกอะไรครับ\n- ขอเบอร์โทรติดต่อกลับได้ไหมครับ';
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


async function readTicketRows() {
  const raw = await fs.readFile(localLogPath, 'utf8').catch(() => '');
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
async function writeTicketRows(rows) {
  await fs.mkdir(path.dirname(localLogPath), { recursive: true });
  await fs.writeFile(localLogPath, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
}
async function generateTicketId(now = new Date()) {
  const day = now.toISOString().slice(0, 10).replaceAll('-', '');
  const rows = await readTicketRows();
  const max = rows.reduce((highest, row) => {
    const match = String(row.ticketId || '').match(new RegExp(`^IT-${day}-(\\d{4})$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `IT-${day}-${String(max + 1).padStart(4, '0')}`;
}
function normalizeTicketStatus(status) {
  const allowed = ['New', 'In Progress', 'Waiting User', 'Resolved', 'Closed'];
  return allowed.includes(status) ? status : 'New';
}

async function saveIncidentNote(row) {
  const safeDate = new Date().toISOString().slice(0, 10);
  const safeTitle = String(row['ปัญหา'] || 'incident').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 70) || 'incident';
  const file = path.join(process.cwd(), 'knowledge', 'Incidents', `${safeDate}-${safeTitle}.md`);
  const note = `# ${row.ticketId || ''} ${row['ปัญหา'] || 'Incident'}\n\nประเภท: ${row['ประเภท'] || ''}\nระดับความเร่งด่วน: ${row['ระดับความเร่งด่วน'] || ''}\nทีมที่เกี่ยวข้อง: ${row['ทีมที่เกี่ยวข้อง'] || ''}\n\n## ผลกระทบ\n${row['ผลกระทบ'] || ''}\n\n## ข้อมูลที่ได้รับ\n${row['ข้อมูลที่ได้รับ'] || ''}\n\n## Transcript\n${row.transcript || ''}\n`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, note, 'utf8');
}

async function saveTicket(ticket, sourceMessage, agentReply, transcript = [], attachments = []) {
  const attachmentSummary = summarizeAttachments(attachments);
  const timestamp = new Date().toISOString();
  const ticketId = await generateTicketId(new Date(timestamp));
  const row = {
    ticketId,
    status: normalizeTicketStatus(ticket.status),
    timestamp,
    sourceMessage,
    agentReply,
    transcript: transcript.map((item) => `${item.role}: ${item.content}`).join('\n'),
    'ไฟล์แนบ': attachmentSummary,
    attachments,
    ...ticket
  };

  if (attachmentSummary) {
    row['ข้อมูลที่ได้รับ'] = `${row['ข้อมูลที่ได้รับ'] || ''}\n\nไฟล์แนบ:\n${attachmentSummary}`.trim();
  }

  await fs.mkdir(path.dirname(localLogPath), { recursive: true });
  await fs.appendFile(localLogPath, `${JSON.stringify(row)}\n`, 'utf8');
  await saveIncidentNote(row).catch(() => {});

  const result = { row, localSaved: true, webhookEnabled: Boolean(sheetWebhookUrl), webhookOk: false, webhookError: '' };

  if (sheetWebhookUrl) {
    try {
      const response = await fetch(sheetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row)
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Google Sheet webhook HTTP ${response.status}: ${body.slice(0, 200)}`);
      }
      result.webhookOk = true;
    } catch (error) {
      result.webhookError = error.message;
    }
  }

  return result;
}

app.get('/admin', requireAdmin, (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.get('/knowledge-chat', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});


function safeKnowledgeFolderName(name) {
  const clean = String(name || '').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('..')) throw new Error('invalid folder name');
  return clean;
}
function safeKnowledgeFileFromFolder(folder, name) {
  const cleanFolder = safeKnowledgeFolderName(folder || 'Uploads');
  const cleanName = String(name || '');
  if (!cleanName.endsWith('.md') || cleanName.includes('/') || cleanName.includes('..')) throw new Error('invalid markdown filename');
  return safeKnowledgePath(`${cleanFolder}/${cleanName}`);
}
app.get('/api/admin/knowledge/summary', requireAdmin, async (_req, res) => {
  const files = await walkMarkdown(knowledgeDir);
  const folders = new Map();
  for (const file of files) {
    const relative = path.relative(knowledgeDir, file);
    const folder = path.dirname(relative) === '.' ? 'Root' : path.dirname(relative);
    const stat = await fs.stat(file);
    const content = await fs.readFile(file, 'utf8');
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push({ name: path.basename(file), size: stat.size, updatedAt: stat.mtime.toISOString(), title: content.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md'), reviewed: /^lastReviewedAt:\s*\S+/mi.test(content) });
  }
  const tree = [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, files]) => ({ name, files: files.sort((a, b) => a.name.localeCompare(b.name)) }));
  const index = await loadRagIndex();
  res.json({ ok: true, tree, stats: { folders: tree.length, files: files.length, chunks: index.docs?.length || 0, updatedAt: index.generatedAt || '' } });
});
app.post('/api/admin/knowledge/folder', requireAdmin, async (req, res) => {
  try {
    const folder = safeKnowledgeFolderName(req.body?.name);
    await fs.mkdir(path.join(knowledgeDir, folder), { recursive: true });
    await auditAdmin(req, 'knowledge.folder.create', folder, true);
    res.json({ ok: true, folder });
  } catch (error) { await auditAdmin(req, 'knowledge.folder.create', req.body?.name, false, error.message); res.status(400).json({ error: error.message }); }
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
    const target = req.query.path ? safeKnowledgePath(req.query.path) : safeKnowledgeFileFromFolder(req.query.folder, req.query.name);
    const content = await fs.readFile(target.full, 'utf8');
    res.json({ ok: true, path: target.clean, content });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/knowledge/file', requireAdmin, async (req, res) => {
  try {
    const target = req.body?.path ? safeKnowledgePath(req.body.path) : safeKnowledgeFileFromFolder(req.body?.folder, req.body?.name);
    const content = String(req.body?.content || '');
    await fs.mkdir(path.dirname(target.full), { recursive: true });
    await fs.writeFile(target.full, content, 'utf8');
    const index = await rebuildKnowledgeIndex();
    await auditAdmin(req, 'knowledge.file.update', target.clean, true);
    res.json({ ok: true, path: target.clean, index });
  } catch (error) {
    await auditAdmin(req, 'knowledge.file.update', req.body?.path || `${req.body?.folder || ''}/${req.body?.name || ''}`, false, error.message);
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
    await auditAdmin(req, 'knowledge.upload', saved.join(','), true);
    res.json({ ok: true, saved, index });
  } catch (error) {
    await auditAdmin(req, 'knowledge.upload', 'upload', false, error.message);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/ocr/status', requireAdmin, async (_req, res) => {
  res.json({ ok: true, ...await getTyphoonOcrStatus() });
});

app.get('/api/admin/setup/status', requireAdmin, async (_req, res) => {
  const knowledge = await loadRagIndex();
  const ocr = await getTyphoonOcrStatus();
  const commandExists = async (cmd) => execFileAsync('/bin/zsh', ['-lc', `command -v ${cmd}`], { timeout: 5000 }).then(() => true).catch(() => false);
  const writable = async (dir) => {
    try {
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `.write-test-${Date.now()}`);
      await fs.writeFile(file, 'ok');
      await fs.unlink(file);
      return true;
    } catch { return false; }
  };
  let modelReady = false;
  let modelDetail = `ยังไม่พบ local model server ที่ ${llmBaseUrl}`;
  try {
    const response = await fetch(`${llmBaseUrl}/models`);
    modelReady = response.ok;
    modelDetail = modelReady ? `LLM server พร้อมตอบผ่าน ${llmModel}` : modelDetail;
  } catch {}
  const pdfinfo = await commandExists('pdfinfo');
  const pdftoppm = await commandExists('pdftoppm');
  res.json({ ok: true, checks: [
    { id: 'admin_auth', label: 'Admin authentication', state: configuredAdminAuth ? 'pass' : 'warn', ready: Boolean(configuredAdminAuth), detail: configuredAdminAuth ? 'ตั้งค่า ADMIN_AUTH แล้ว' : 'ใช้ dev-only fallback เฉพาะโหมด development', nextStep: 'ตั้งค่า ADMIN_AUTH ใน .env ก่อนใช้งานจริง' },
    { id: 'model', label: 'LLM server', state: modelReady ? 'pass' : 'fail', ready: modelReady, detail: modelDetail, nextStep: 'รัน npm run local หรือ scripts/start_model.sh' },
    { id: 'knowledge', label: 'Knowledge index', state: knowledge.docs?.length ? 'pass' : 'warn', ready: Boolean(knowledge.docs?.length), detail: knowledge.docs?.length ? `มีเอกสาร ${knowledge.docs.length} รายการในดัชนี` : 'ยังไม่มีเอกสารในดัชนี', nextStep: 'อัปโหลดเอกสารแล้วกด Reindex knowledge' },
    { id: 'sheet', label: 'Google Sheet webhook', state: sheetWebhookUrl ? 'pass' : 'warn', ready: Boolean(sheetWebhookUrl), detail: sheetWebhookUrl ? 'ตั้งค่า webhook แล้ว' : 'ยังไม่ตั้งค่า webhook', nextStep: 'ใส่ GOOGLE_SHEET_WEBHOOK_URL ใน .env หากต้องการส่ง Sheet' },
    { id: 'ocr', label: 'Typhoon/Ollama OCR', state: ocr.available ? 'pass' : ocr.reachable ? 'warn' : 'fail', ready: ocr.available, detail: ocr.detail, nextStep: ocr.installCommand },
    { id: 'poppler', label: 'Poppler PDF tools', state: pdfinfo && pdftoppm ? 'pass' : 'fail', ready: pdfinfo && pdftoppm, detail: pdfinfo && pdftoppm ? 'พบ pdfinfo และ pdftoppm' : 'ยังไม่พบ Poppler tools สำหรับ PDF OCR', nextStep: 'macOS: brew install poppler | Windows: npm run setup:windows' },
    { id: 'attachments', label: 'Attachment directory', state: await writable(attachmentDir) ? 'pass' : 'fail', ready: await writable(attachmentDir), detail: 'ตรวจสอบสิทธิ์เขียน data/attachments', nextStep: 'ตรวจสิทธิ์โฟลเดอร์ data/attachments' },
    { id: 'data', label: 'Data directory', state: await writable(path.dirname(localLogPath)) ? 'pass' : 'fail', ready: await writable(path.dirname(localLogPath)), detail: 'ตรวจสอบสิทธิ์เขียน data/', nextStep: 'ตรวจสิทธิ์โฟลเดอร์ data/' }
  ] });
});

app.post('/api/admin/setup/test-sheet', requireAdmin, async (_req, res) => {
  if (!sheetWebhookUrl) return res.json({ ok: false, detail: 'GOOGLE_SHEET_WEBHOOK_URL is not configured' });
  try {
    const response = await fetch(sheetWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: new Date().toISOString(), sourceMessage: 'health check', ประเภท: 'Health Check', ปัญหา: 'Google Sheet webhook test' }) });
    res.json({ ok: response.ok, detail: response.ok ? 'Google Sheet webhook responded OK' : `HTTP ${response.status}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/admin/setup/test-llm', requireAdmin, async (_req, res) => {
  try {
    const response = await fetch(`${llmBaseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: llmModel, max_tokens: 32, messages: [{ role: 'user', content: 'ตอบคำว่า ok สั้นๆ' }] }) });
    res.json({ ok: response.ok, detail: response.ok ? 'LLM test passed' : `HTTP ${response.status}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/admin/ocr/start', requireAdmin, async (_req, res) => {
  try {
    const result = await startTyphoonOcrWorker();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/knowledge/parse-ocr', requireAdmin, uploadLimiter, async (req, res) => {
  try {
    const status = await getTyphoonOcrStatus();
    if (!status.available) {
      await startTyphoonOcrWorker();
    }
    const file = req.body?.file;
    if (!file || typeof file !== 'object') {
      res.status(400).json({ error: 'file is required' });
      return;
    }
    const note = await parseWithTyphoonOcr(file);
    await auditAdmin(req, 'ocr.parse', file.name, true);
    res.json({ ok: true, ...note, note: 'Review the OCR draft, then click Save + Reindex to add it to RAG.' });
  } catch (error) {
    await auditAdmin(req, 'ocr.parse', req.body?.file?.name || 'file', false, error.message);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/knowledge/file', requireAdmin, async (req, res) => {
  try {
    const target = req.body?.path ? safeKnowledgePath(req.body.path) : safeKnowledgeFileFromFolder(req.body?.folder, req.body?.name);
    await fs.unlink(target.full).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    const index = await rebuildKnowledgeIndex();
    await auditAdmin(req, 'knowledge.file.delete', target.clean, true);
    res.json({ ok: true, path: target.clean, index });
  } catch (error) {
    await auditAdmin(req, 'knowledge.file.delete', req.body?.path || `${req.body?.folder || ''}/${req.body?.name || ''}`, false, error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/knowledge/reindex', requireAdmin, async (_req, res) => {
  try {
    const index = await rebuildKnowledgeIndex();
    await auditAdmin(_req, 'knowledge.reindex', 'knowledge', true);
    res.json({ ok: true, index });
  } catch (error) {
    await auditAdmin(_req, 'knowledge.reindex', 'knowledge', false, error.message);
    res.status(500).json({ error: error.message });
  }
});


function filterTickets(rows, query = {}) {
  const q = String(query.q || '').toLowerCase();
  return rows.filter((row) => {
    if (query.status && row.status !== query.status) return false;
    if (query.urgency && row['ระดับความเร่งด่วน'] !== query.urgency) return false;
    if (query.category && row['ประเภท'] !== query.category) return false;
    if (query.team && row['ทีมที่เกี่ยวข้อง'] !== query.team) return false;
    if (!q) return true;
    return JSON.stringify(row).toLowerCase().includes(q);
  });
}
function ticketsToCsv(rows) {
  const headers = ['ticketId', 'status', 'timestamp', 'requesterName', 'department', 'location', 'contact', 'assetName', 'ประเภท', 'ปัญหา', 'ผลกระทบ', 'ข้อมูลที่ได้รับ', 'ระดับความเร่งด่วน', 'ทีมที่เกี่ยวข้อง', 'ไฟล์แนบ'];
  const esc = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row[header])).join(','))].join('\n');
}
app.get('/api/admin/tickets', requireAdmin, async (req, res) => {
  const rows = (await readTicketRows()).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  res.json({ ok: true, tickets: filterTickets(rows, req.query) });
});
app.get('/api/admin/tickets/export.csv', requireAdmin, async (req, res) => {
  const rows = (await readTicketRows()).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tickets.csv"');
  res.send(ticketsToCsv(filterTickets(rows, req.query)));
});
app.get('/api/admin/tickets/:ticketId', requireAdmin, async (req, res) => {
  const row = (await readTicketRows()).find((item) => item.ticketId === req.params.ticketId);
  if (!row) return res.status(404).json({ error: 'ticket not found' });
  res.json({ ok: true, ticket: row });
});
app.patch('/api/admin/tickets/:ticketId', requireAdmin, async (req, res) => {
  const rows = await readTicketRows();
  const index = rows.findIndex((item) => item.ticketId === req.params.ticketId);
  if (index === -1) return res.status(404).json({ error: 'ticket not found' });
  rows[index] = { ...rows[index], status: normalizeTicketStatus(req.body?.status), updatedAt: new Date().toISOString() };
  await writeTicketRows(rows);
  await auditAdmin(req, 'ticket.status.update', req.params.ticketId, true, rows[index].status);
  res.json({ ok: true, ticket: rows[index] });
});


app.get('/api/admin/attachments/:day/:filename', requireAdmin, async (req, res) => {
  try {
    const full = safeAttachmentPath(req.params.day, req.params.filename);
    await fs.access(full);
    await auditAdmin(req, 'attachment.download', `${req.params.day}/${req.params.filename}`, true);
    res.download(full);
  } catch (error) {
    await auditAdmin(req, 'attachment.download', `${req.params.day}/${req.params.filename}`, false, error.message);
    res.status(404).json({ error: 'attachment not found' });
  }
});

app.get('/api/models', requireAdmin, async (_req, res) => {
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

app.post('/api/models/select', requireAdmin, async (req, res) => {
  const model = String(req.body?.model || '').trim();
  const allowed = ['gemma4-e4b-qat', 'gemma4-12b-qat'];
  if (!allowed.includes(model)) {
    res.status(400).json({ error: 'unknown model' });
    return;
  }
  llmModel = model;
  await auditAdmin(req, 'model.select', model, true);
  res.json({ ok: true, selected: llmModel, note: 'Model alias updated for API calls. If llama-server is running a different model, restart it with the matching start command.' });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llmBaseUrl, llmModel, sheetEnabled: Boolean(sheetWebhookUrl) });
});

app.get('/api/config', (_req, res) => {
  res.json({ ok: true, ...appConfig });
});


app.post('/api/attachments', uploadLimiter, async (req, res) => {
  try {
    const file = req.body?.file;
    if (!file || typeof file !== 'object') {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    const base64 = stripDataUrl(file.base64);
    const sizeMb = Buffer.byteLength(base64 || '', 'base64') / 1024 / 1024;
    if (!base64 || sizeMb > typhoonMaxUploadMb) {
      res.status(400).json({ error: `attachment must be base64 and <= ${typhoonMaxUploadMb}MB` });
      return;
    }

    const day = new Date().toISOString().slice(0, 10);
    const safeName = safeAttachmentName(file.name);
    const relativePath = `${day}/${safeName}`;
    const full = path.join(attachmentDir, relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, Buffer.from(base64, 'base64'));

    let ocrText = '';
    let ocrOk = false;
    let ocrError = '';
    if (isOcrSupportedFile(file.name, file.type)) {
      try {
        const status = await getTyphoonOcrStatus();
        if (!status.available) await startTyphoonOcrWorker();
        const note = await parseWithTyphoonOcr(file);
        ocrText = String(note.content || '').slice(0, 5000);
        ocrOk = Boolean(ocrText.trim());
      } catch (error) {
        ocrError = error.message;
      }
    }

    res.json({
      ok: true,
      attachment: {
        id: `${day}/${safeName}`,
        name: String(file.name || safeName),
        type: String(file.type || 'application/octet-stream'),
        size: Math.round(sizeMb * 1024 * 1024),
        path: `data/attachments/${relativePath}`,
        downloadPath: `/api/admin/attachments/${day}/${safeName}`,
        ocrOk,
        ocrText,
        ocrError
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rag/search', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '');
  res.json(await searchKnowledge(q));
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const detailed = Boolean(req.body?.detailed);
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


async function completeKnowledgeAnswer({ conversation, ragContext, attachmentText, detailed = false }) {
  const baseSystem = `You are a helpful general Thai AI assistant with document and knowledge-base support.
Answer in Thai unless the user asks for English. You can chat naturally like a normal AI assistant.
If Attached File Text is present, use it first. If Relevant Knowledge is present, use it when relevant.
If the user asks a general question and no document/knowledge is relevant, answer normally from general knowledge and say briefly when you are not relying on local documents.
You know this app has two main user-facing capabilities: IT ticket intake at the main page and general/document AI chat here. If the user wants to open/create/save an IT ticket, tell them the app can move the conversation to the ticket intake page to draft a ticket.
If OCR/file text is unavailable but the user asks about the file, say clearly that the file was received but readable text is not available, then suggest uploading a clearer file or enabling OCR.
Do not invent local policy, asset names, contacts, or exact internal procedures that are not in the knowledge or attached text.
When useful, structure the answer with short headings, bullet points, and GitHub-Flavored Markdown tables. Do not use raw HTML tables.`;
  const context = `Attached File Text:\n${attachmentText || '(no attached readable text)'}\n\nRelevant Knowledge:\n${ragContext || '(no direct matches)'}\n\nConversation:\n${conversation}`;
  const call = async (messages, maxTokens = 2200) => {
    const response = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: llmModel, temperature: detailed ? 0.15 : 0.2, max_tokens: maxTokens, messages })
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('empty model response');
    return answer;
  };
  if (!detailed) {
    return await call([
      { role: 'system', content: baseSystem },
      { role: 'user', content: `${context}\n\nตอบคำถามล่าสุด ถ้ามีไฟล์แนบหรือคลังความรู้ให้ใช้อ้างอิงก่อน ถ้าไม่เกี่ยวข้องให้ตอบแบบผู้ช่วย AI ทั่วไป` }
    ]);
  }
  const draft = await call([
    { role: 'system', content: `${baseSystem}\nCreate a careful draft answer. Focus on coverage and evidence. Do not show hidden reasoning.` },
    { role: 'user', content: `${context}\n\nสร้างคำตอบร่างแรกที่ละเอียด ถ้ามีไฟล์แนบหรือคลังความรู้ให้ใช้อ้างอิงก่อน ถ้าเป็นคำถามทั่วไปให้ตอบตามความรู้ทั่วไป` }
  ], 2400);
  return await call([
    { role: 'system', content: `${baseSystem}\nYou are now the reviewer and final editor. Improve correctness, clarity, and usefulness. Remove unsupported claims. Keep the final answer readable with headings and bullets. Do not mention internal draft/review steps.` },
    { role: 'user', content: `${context}\n\nDraft answer:\n${draft}\n\nตรวจทานและเรียบเรียงเป็นคำตอบสุดท้ายที่ชัดเจน มีเหตุผล ไม่มั่ว และบอกให้ชัดเมื่อไม่ได้อ้างอิงเอกสาร local` }
  ], 2600);
}

app.post('/api/knowledge-chat', chatLimiter, async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const detailed = Boolean(req.body?.detailed);
  const cleanMessages = messages
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && String(item.content || '').trim())
    .slice(-20)
    .map((item) => ({ role: item.role, content: String(item.content).trim() }));

  const latestUser = [...cleanMessages].reverse().find((item) => item.role === 'user')?.content || '';
  const attachmentText = summarizeAttachments(attachments);
  if (!latestUser && !attachmentText) {
    res.status(400).json({ error: 'at least one user message is required' });
    return;
  }

  const searchText = [cleanMessages.map((item) => `${item.role}: ${item.content}`).join('\n'), attachmentText].filter(Boolean).join('\n');
  const rag = await searchKnowledge(searchText, 6);
  try {
    const conversation = cleanMessages.map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`).join('\n');
    const answer = await completeKnowledgeAnswer({ conversation, ragContext: rag.context, attachmentText, detailed });
    res.json({ mode: detailed ? 'detailed-gemma' : 'local-gemma', answer, ragContext: { count: rag.count, items: rag.items } });
  } catch {
    res.json({
      mode: 'fallback-rag',
      answer: rag.items.length
        ? `ผมเจอเอกสารที่น่าจะเกี่ยวข้องครับ แต่ตอนนี้โมเดล local ยังไม่พร้อมตอบแบบละเอียด:\n\n${rag.items.map((item, index) => `${index + 1}. ${item.title}\n${item.snippet}`).join('\n\n')}`
        : 'ตอนนี้โมเดล local ยังไม่พร้อมตอบครับ ลองถามใหม่อีกครั้ง หรือเช็กว่า local model server เปิดอยู่ครับ',
      ragContext: { count: rag.count, items: rag.items }
    });
  }
});

app.post('/api/tickets', ticketLimiter, async (req, res) => {
  const ticket = req.body?.ticket;
  const sourceMessage = String(req.body?.sourceMessage || '');
  const agentReply = String(req.body?.agentReply || '');
  const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript : [];
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

  if (!ticket || typeof ticket !== 'object') {
    res.status(400).json({ error: 'ticket is required' });
    return;
  }

  try {
    const saved = await saveTicket(ticket, sourceMessage, agentReply, transcript, attachments);
    res.json({
      ok: true,
      saved: saved.row,
      localSaved: saved.localSaved,
      sheetEnabled: saved.webhookEnabled,
      webhookOk: saved.webhookOk,
      webhookError: saved.webhookError
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  console.log(`[startup] Admin auth: ${configuredAdminAuth ? 'configured' : 'development fallback active'}${isProduction ? ' (production)' : ' (development)'}`);
  console.log(`[startup] JSON body limit: ${jsonBodyLimitMb}mb`);
  app.listen(port, () => {
    console.log(`Gemma IT Ticket WebUI: http://127.0.0.1:${port}`);
  });
}

export { app, safeKnowledgePath, safeAttachmentName, generateTicketId, fallbackTriage, inferCategory, searchKnowledge, requireAdmin };
