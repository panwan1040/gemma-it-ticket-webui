import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  ArrowUp,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Download,
  Edit3,
  FileText,
  Folder,
  Globe2,
  Inbox,
  Lightbulb,
  Loader2,
  Menu,
  MessageSquare,
  MoreVertical,
  PanelLeft,
  Paperclip,
  Plus,
  RefreshCcw,
  Rocket,
  Save,
  Search,
  Send,
  Settings,
  Square,
  UploadCloud,
  User,
  X
} from 'lucide-react';
import './styles.css';

const defaultConfig = {
  appName: 'Local AI Helpdesk',
  appTagline: 'รับเรื่อง แชทเอกสาร และร่างใบงานบนเครื่อง',
  appDescription: 'ช่วยเก็บรายละเอียดปัญหา สรุปข้อมูล และบันทึกใบงานสำหรับทีม IT',
  modelName: 'gemma4:e4b-it-qat'
};

const publicNavItems = [
  { path: '/', label: 'แจ้งปัญหา', description: 'รับเรื่องและร่างใบงาน', icon: ClipboardList },
  { path: '/knowledge-chat', label: 'แชท AI', description: 'ถามงานหรืออ่านเอกสาร', icon: BookOpen },
  { path: '/electricity-bills', label: 'บิลค่าไฟ', description: 'อ่าน JSON และส่งชีท', icon: Database },
  { path: '/ocr', label: 'OCR Studio', description: 'อ่านข้อความและ export', icon: FileText }
];
const routeItems = [
  ...publicNavItems,
  { path: '/admin', label: 'Tickets / Knowledge', description: 'ดู ticket และจัดการคลังความรู้', icon: Archive }
];

const urgencyOptions = ['Low', 'Medium', 'High', 'Critical'];
const ticketStatusOptions = ['New', 'In Progress', 'Waiting User', 'Resolved', 'Closed'];
const documentCategories = ['เอกสารทั้งหมด', 'คู่มือการใช้งาน', 'แก้ไขปัญหา', 'นโยบาย / ระเบียบ', 'บริการ / ระบบ', 'ติดต่อ / ข้อมูลอ้างอิง', 'อื่น ๆ'];
const optionalFields = [
  ['requesterName', 'ชื่อผู้แจ้ง'],
  ['department', 'แผนก/หน่วยงาน'],
  ['location', 'สถานที่'],
  ['contact', 'ช่องทางติดต่อ'],
  ['assetName', 'อุปกรณ์/ระบบ'],
  ['occurredAt', 'เวลาเริ่มเกิดปัญหา']
];
const emptyTicket = {
  requesterName: '',
  department: '',
  location: '',
  contact: '',
  assetName: '',
  occurredAt: '',
  ประเภท: '',
  ปัญหา: '',
  ผลกระทบ: '',
  ข้อมูลที่ได้รับ: '',
  ระดับความเร่งด่วน: 'Medium',
  ทีมที่เกี่ยวข้อง: ''
};
const statusCopy = {
  ready: 'พร้อมรับเรื่อง',
  thinking: 'กำลังประมวลผล',
  done: 'พร้อมรับเรื่อง',
  error: 'เกิดข้อผิดพลาด',
  'local-gemma': 'พร้อมรับเรื่อง',
  'ollama-stream': 'พร้อมรับเรื่อง',
  'fallback-rules': 'ระบบสำรองพร้อมใช้งาน',
  'fallback-rag': 'ใช้การค้นหาแบบสำรอง',
  'empty-knowledge': 'ยังไม่มีเอกสารในคลัง',
  'detailed-gemma': 'ตอบละเอียดแล้ว'
};

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
function friendlyStatus(mode) {
  return statusCopy[mode] || mode || 'พร้อมใช้งาน';
}
function friendlyKnowledgeStatus(mode) {
  const copy = {
    ready: 'พร้อมตอบคำถาม',
    thinking: 'กำลังประมวลผล',
    done: 'พร้อมตอบคำถาม',
    error: 'เกิดข้อผิดพลาด',
    'local-gemma': 'พร้อมตอบคำถาม',
    'detailed-gemma': 'ตอบละเอียดแล้ว',
    'fallback-rag': 'ใช้การค้นหาแบบสำรอง',
    'empty-knowledge': 'ยังไม่มีเอกสารในคลัง'
  };
  return copy[mode] || mode || 'พร้อมตอบคำถาม';
}
function formatBytes(size = 0) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function attachmentStatusLabel(file = {}) {
  if (file.uploadState === 'selected') return 'เลือกไฟล์แล้ว';
  if (file.uploadState === 'uploading') return 'กำลังอัปโหลด...';
  if (file.uploadState === 'processing') return file.statusText || (isImageAttachment(file) ? 'กำลังอ่านรูปภาพ...' : 'กำลังทำ OCR...');
  if (file.uploadState === 'ready') return file.statusText || 'พร้อมส่งให้โมเดล';
  if (file.uploadState === 'error') return 'อัปโหลดไม่สำเร็จ';
  if (file.visionText) return 'เก็บไฟล์แล้ว · เข้าใจรูปได้';
  if (file.ocrStatus === 'readable' || file.ocrOk) return file.textReadable ? 'เก็บไฟล์แล้ว · อ่านข้อความได้' : 'เก็บไฟล์แล้ว · OCR อ่านได้';
  if (file.ocrStatus === 'unreadable' || file.ocrError) return 'เก็บไฟล์แล้ว · อ่านข้อความไม่ได้';
  if (file.ocrStatus === 'not-supported') return 'เก็บไฟล์แล้ว · ใช้เป็นหลักฐาน';
  return 'เก็บไฟล์แล้ว';
}
function attachmentStatusTone(file = {}) {
  if (file.uploadState === 'ready') return 'ok';
  if (file.uploadState === 'error') return 'warning';
  if (['selected', 'uploading', 'processing'].includes(file.uploadState)) return 'info';
  if (file.visionText || file.ocrStatus === 'readable' || file.ocrOk) return 'ok';
  if (file.ocrStatus === 'unreadable' || file.ocrError) return 'warning';
  return 'neutral';
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('cannot read file'));
    reader.readAsDataURL(file);
  });
}
function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function normalizeAttachmentList(items = []) {
  const seen = new Set();
  return items.filter(Boolean).filter((item) => {
    const key = item.localId || item.id || item.path || item.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function collectConversationAttachments(messages = []) {
  return normalizeAttachmentList(messages.flatMap((item) => item.attachments || []));
}
function sanitizeAttachmentsForApi(items = []) {
  return items.map(({ previewUrl, file, uploadState, statusText, error, ...item }) => {
    const clean = { ...item };
    if (clean.id || clean.path) delete clean.base64;
    return clean;
  });
}
function isImageAttachment(file = {}) {
  return String(file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(String(file.name || ''));
}
function createLocalAttachment(file) {
  return {
    localId: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    file,
    previewUrl: isImageAttachment(file) ? URL.createObjectURL(file) : '',
    uploadState: 'selected',
    statusText: 'เลือกไฟล์แล้ว'
  };
}
async function readSseStream(response, onEvent) {
  if (!response.body) throw new Error('stream not available');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = (block) => {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
    const dataText = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
    if (!dataText) return;
    try {
      onEvent(event, JSON.parse(dataText));
    } catch {
      onEvent(event, { delta: dataText });
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() || '';
    blocks.forEach(flush);
  }
  if (buffer.trim()) flush(buffer);
}
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function exportOcrRowsToExcel(rows) {
  const htmlRows = rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.size)}</td><td>${escapeHtml(row.structured)}</td><td>${escapeHtml(row.text)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>File</th><th>Status</th><th>Size</th><th>Structured Review</th><th>OCR Text</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
  downloadBlob(`ocr-export-${new Date().toISOString().slice(0, 10)}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
}
function looksLikeTicketIntent(text) {
  return /(เปิด|สร้าง|บันทึก|แจ้ง)(\s*)(ticket|ทิกเก็ต|เคส|ใบงาน|ปัญหา)|ช่วยเปิด|ส่งให้ IT|ส่งให้ทีม IT|แจ้งซ่อม|แจ้งไอที/i.test(String(text || ''));
}
function goToTicketIntake(payload) {
  sessionStorage.setItem('ticket-handoff', JSON.stringify(payload));
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}
function goToKnowledgeChat(payload) {
  sessionStorage.setItem('ocr-handoff', JSON.stringify(payload));
  window.history.pushState({}, '', '/knowledge-chat');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return <motion.button
    whileTap={{ scale: 0.985 }}
    className={cn('btn', `btn-${variant}`, `btn-${size}`, className)}
    {...props}
  >{children}</motion.button>;
}
function IconButton({ label, children, className = '', ...props }) {
  return <button className={cn('icon-btn', className)} aria-label={label} title={label} {...props}>{children}</button>;
}
function StatusPill({ children, tone = 'neutral', icon: Icon }) {
  return <span className={cn('status-pill', `status-${tone}`)}>{Icon ? <Icon size={13} /> : null}{children}</span>;
}
function Card({ children, className = '' }) {
  return <div className={cn('card', className)}>{children}</div>;
}
function Field({ label, value, onChange, placeholder = '', type = 'text' }) {
  return <label className="field"><span>{label}</span><input type={type} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
function TextAreaField({ label, value, onChange, placeholder = '', rows = 4 }) {
  return <label className="field"><span>{label}</span><textarea rows={rows} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
function SelectField({ label, value, onChange, options }) {
  return <label className="field"><span>{label}</span><select value={value || ''} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function EmptyState({ icon: Icon = Inbox, title, description, children }) {
  return <motion.div className="empty-state" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <div className="empty-icon"><Icon size={22} /></div>
    <h2>{title}</h2>
    <p>{description}</p>
    {children ? <div className="empty-actions">{children}</div> : null}
  </motion.div>;
}
function PageTop({ title, description, actions }) {
  return <header className="page-top">
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {actions ? <div className="page-actions">{actions}</div> : null}
  </header>;
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };
  return [path, navigate];
}

function AppShell({ config, path, navigate, children }) {
  const active = routeItems.find((item) => item.path === path) || publicNavItems[0];
  const mobileValue = publicNavItems.some((item) => item.path === active.path) ? active.path : '';
  const historyLabel = path === '/knowledge-chat' ? 'สวัสดี' : path === '/' ? 'แจ้งปัญหา IT' : active.label;
  return <main className="app-shell">
    <aside className="side-nav">
      <div className="window-dots" aria-hidden="true">
        <span /><span /><span />
        <PanelLeft size={18} />
      </div>
      <nav className="nav-list">
        <button className={cn('nav-item', path === '/' && 'active')} onClick={() => navigate('/')}>
          <Edit3 size={18} />
          <span><strong>New Chat</strong></span>
        </button>
        <button className={cn('nav-item', path === '/knowledge-chat' && 'active')} onClick={() => navigate('/knowledge-chat')}>
          <Rocket size={18} />
          <span><strong>Launch</strong></span>
        </button>
      </nav>
      <div className="today-block">
        <small>Today</small>
        <button className="history-item" onClick={() => navigate(path === '/knowledge-chat' ? '/knowledge-chat' : '/')}>{historyLabel}</button>
      </div>
      <div className="feature-links">
        <button onClick={() => navigate('/ocr')} className={path === '/ocr' ? 'active' : ''}><FileText size={15} />OCR Studio</button>
        <button onClick={() => navigate('/electricity-bills')} className={path === '/electricity-bills' ? 'active' : ''}><Database size={15} />บิลค่าไฟ</button>
        <button onClick={() => { sessionStorage.setItem('admin-tab', 'tickets'); navigate('/admin'); }} className={path === '/admin' ? 'active' : ''}><Archive size={15} />Tickets</button>
      </div>
      <div className="nav-foot">
        <span>{config.appName}</span>
        <small>{config.modelName} · Ollama</small>
      </div>
    </aside>
    <section className="work-area">
      <div className="mobile-topbar">
        <div className="brand-mini"><Menu size={18} /><span>{active.label}</span></div>
        <select value={mobileValue} onChange={(event) => navigate(event.target.value)}>
          {!mobileValue ? <option value="">{active.label}</option> : null}
          {publicNavItems.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
        </select>
      </div>
      {children}
    </section>
  </main>;
}

function normalizeMarkdown(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\n(\|[^\n]+\|\n\|[\s:|\-]+\|)/g, '$1\n\n$2')
    .replace(/```([^\n`]+)?\n([\s\S]*?)$/g, (_match, lang = '', body = '') => `\`\`\`${lang}\n${body}\n\`\`\``)
    .trim();
}
function MarkdownMessage({ children }) {
  return <div className="markdown-message">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
      table: ({ node, ...props }) => <div className="markdown-table-wrap"><table {...props} /></div>
    }}>{normalizeMarkdown(children)}</ReactMarkdown>
  </div>;
}

function StreamingMarkdown({ children }) {
  return <MarkdownMessage>{children}</MarkdownMessage>;
}

function AttachmentChip({ file, onRemove }) {
  return <span className={cn('attachment-chip', `attachment-${attachmentStatusTone(file)}`)}>
    <Paperclip size={13} />
    <span className="attachment-name">{file.name}</span>
    <small>{attachmentStatusLabel(file)}</small>
    {onRemove ? <button type="button" onClick={() => onRemove(file)} aria-label={`ลบไฟล์ ${file.name}`}><X size={12} /></button> : null}
  </span>;
}

function AttachmentPreview({ file }) {
  if (!isImageAttachment(file) || !file.previewUrl) return null;
  return <figure className="image-preview">
    <img src={file.previewUrl} alt={file.name || 'uploaded image'} />
    <figcaption>{file.name}</figcaption>
  </figure>;
}

function ImagePreview({ file }) {
  return <AttachmentPreview file={file} />;
}

function ReasoningPanel({ summary }) {
  const sections = [
    ['สิ่งที่พบ', summary?.observations],
    ['หลักฐานจากภาพ/ข้อความ', summary?.evidence],
    ['สาเหตุที่เป็นไปได้', summary?.possibleCauses],
    ['ขั้นตอนแนะนำถัดไป', summary?.nextSteps]
  ].map(([title, items]) => [title, Array.isArray(items) ? items.filter(Boolean) : []]).filter(([, items]) => items.length);
  if (!sections.length) return null;
  return <details className="reasoning-panel">
    <summary><Lightbulb size={15} />วิธีวิเคราะห์โดยสรุป</summary>
    <div className="reasoning-grid">
      {sections.map(([title, items]) => <section key={title}>
        <h4>{title}</h4>
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      </section>)}
    </div>
  </details>;
}

function ThinkingIndicator({ hasAttachments = false, status }) {
  const fallback = hasAttachments ? 'กำลังอ่านไฟล์แนบ' : 'กำลังคิดสักครู่';
  return <motion.div className="thinking-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="thinking-bulb"><Lightbulb size={17} /></div>
    <div>
      <strong>กำลังคิดสักครู่</strong>
      <span>{status || fallback}</span>
    </div>
  </motion.div>;
}

function AssistantStatus({ status, hasAttachments = false }) {
  return <ThinkingIndicator hasAttachments={hasAttachments} status={status} />;
}

function ThinkingPanel({ thinking, isStreaming }) {
  const text = String(thinking || '').trim();
  if (!text) return null;
  return <details className="thinking-panel" open={Boolean(isStreaming)}>
    <summary><Lightbulb size={15} />{isStreaming ? 'กำลังคิด' : 'Thought'}</summary>
    <pre>{text}</pre>
  </details>;
}

function ChatMessage({ item }) {
  const isUser = item.role === 'user';
  const visibleText = item.displayContent || item.content;
  const [copied, setCopied] = useState(false);
  async function copyText() {
    const text = normalizeMarkdown(visibleText || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  if (item.pending) {
    return <motion.div className="message-row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <AssistantStatus hasAttachments={Boolean(item.hasAttachments)} status={item.status} />
    </motion.div>;
  }
  return <motion.div className={cn('message-row', isUser && 'from-user')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    {!isUser && (item.isStreaming || item.status) ? <AssistantStatus hasAttachments={Boolean(item.hasAttachments)} status={item.status} /> : null}
    {!isUser && !item.isStreaming && item.content && !item.status ? <div className="thought-line"><Lightbulb size={18} />Thought for a moment</div> : null}
    <div className={cn('bubble', isUser ? 'bubble-user' : 'bubble-agent')}>
      {item.attachments?.length ? <div className="message-images">{item.attachments.map((file) => <ImagePreview key={`image-${file.localId || file.id || file.name}`} file={file} />)}</div> : null}
      {!isUser ? <ThinkingPanel thinking={item.thinking} isStreaming={item.isStreaming} /> : null}
      {visibleText ? <StreamingMarkdown>{visibleText}</StreamingMarkdown> : null}
      {item.attachments?.length ? <div className="bubble-attachments">{item.attachments.map((file) => <AttachmentChip key={file.localId || file.id || file.name} file={file} />)}</div> : null}
      {!isUser && !item.isStreaming && !item.thinking ? <ReasoningPanel summary={item.reasoningSummary} /> : null}
      {!isUser && visibleText ? <button className="bubble-copy" onClick={copyText} title="คัดลอกคำตอบ">{copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}</button> : null}
    </div>
  </motion.div>;
}

function MessageList({ messages, pending, pendingStatus, hasPendingAttachments, emptyState }) {
  const visibleMessages = pending
    ? [...messages, { role: 'assistant', pending: true, status: pendingStatus, hasAttachments: hasPendingAttachments }]
    : messages;
  return <div className="chat-stream">
    {visibleMessages.length ? visibleMessages.map((item, index) => <ChatMessage key={item.id || `${item.role}-${index}-${item.pending ? 'pending' : 'message'}`} item={item} />) : emptyState}
  </div>;
}

function ModelSelector({ model = defaultConfig.modelName }) {
  return <button className="model-pill" type="button" title="โมเดลที่ใช้งาน">{model} <ChevronRight size={14} /></button>;
}

function Composer({ value, onChange, onSend, disabled, placeholder, helper, compact = false, onFiles, onRemoveAttachment, attachments = [], uploading = false, busy = false, model = defaultConfig.modelName }) {
  const [isDragging, setIsDragging] = useState(false);
  function handleFiles(fileList) {
    if (!onFiles) return;
    onFiles(fileList);
  }
  return <div className="composer-wrap">
    <div
      className={cn('composer', compact && 'compact', isDragging && 'dragging')}
      onDragOver={(event) => {
        if (!onFiles) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        if (!onFiles) return;
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      {attachments.length ? <div className="attachment-strip">{attachments.map((item) => <AttachmentChip key={item.localId || item.id || item.name} file={item} onRemove={onRemoveAttachment} />)}</div> : null}
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (!disabled && !uploading) onSend();
        }
      }} />
      <div className="composer-row">
        <span>{uploading ? 'กำลังแนบไฟล์...' : helper}</span>
        <div className="composer-actions">
          {onFiles ? <label className="attach-btn" title="แนบไฟล์"><Plus size={20} /><input type="file" multiple onChange={(event) => { handleFiles(event.target.files); event.target.value = ''; }} /></label> : null}
          <button className="composer-tool" type="button" title="ไฟล์ รูป และ OCR"><Globe2 size={19} /></button>
          <ModelSelector model={model} />
          <Button className="send-circle" onClick={onSend} disabled={disabled}>{busy || uploading ? <Square size={15} /> : <ArrowUp size={18} />}</Button>
        </div>
      </div>
    </div>
  </div>;
}

function ChatLayout({ topActions, notice, children, composer }) {
  return <div className="page chat-page">
    {topActions ? <div className="chat-top-actions">{topActions}</div> : null}
    {notice}
    <section className="chat-canvas">{children}</section>
    {composer}
  </div>;
}

function WorkflowStrip({ items }) {
  return <div className="workflow-strip">
    {items.map((item, index) => {
      const Icon = item.icon;
      return <div className="workflow-step" key={item.title}>
        <span className="workflow-index">{index + 1}</span>
        <div>{Icon ? <Icon size={15} /> : null}<strong>{item.title}</strong><small>{item.detail}</small></div>
      </div>;
    })}
  </div>;
}

function ChatBridgeBar({ onOpenTicket }) {
  return <motion.div className="bridge-bar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div>
      <strong>ต้องการให้ทีม IT ดำเนินการต่อไหม</strong>
      <span>ส่งบทสนทนานี้ไปหน้าแจ้งปัญหาเพื่อร่างใบงานได้ทันที ยังไม่บันทึกจนกว่าจะกด “บันทึกใบงาน”</span>
    </div>
    <Button variant="secondary" size="sm" onClick={onOpenTicket}><ClipboardList size={15} />เปิดใบงานจากแชท</Button>
  </motion.div>;
}
function buildChatSummary(ticket, missingFields = [], isSaved = false, saveStatus = '') {
  const rows = [];
  if (ticket['ปัญหา']) rows.push(`- ปัญหา: ${ticket['ปัญหา']}`);
  if (ticket.assetName) rows.push(`- อุปกรณ์/ระบบ: ${ticket.assetName}`);
  if (ticket.location) rows.push(`- สถานที่: ${ticket.location}`);
  if (ticket.department) rows.push(`- แผนก: ${ticket.department}`);
  if (ticket.contact) rows.push(`- ติดต่อกลับ: ${ticket.contact}`);
  if (ticket['ผลกระทบ']) rows.push(`- ผลกระทบ: ${ticket['ผลกระทบ']}`);
  if (!rows.length) return '';
  if (ticket['ระดับความเร่งด่วน']) rows.push(`- ความเร่งด่วน: ${ticket['ระดับความเร่งด่วน']}`);
  const missing = missingFields.length ? `\n\nข้อมูลที่อาจถามเพิ่ม:\n${missingFields.map((item) => `- ${item}`).join('\n')}` : '';
  const saved = isSaved ? `\n\nสถานะ: ${saveStatus || 'บันทึกใบงานแล้ว'}` : '';
  return `สรุปข้อมูล\n${rows.join('\n')}${saved}${missing}`;
}
function nextMissingLabel(ticket, missingFields) {
  if (ticket['ปัญหา'] && !ticket.location) return 'สถานที่หรือบริเวณที่เกิดปัญหา';
  if (ticket['ปัญหา'] && !ticket.contact) return 'เบอร์ติดต่อกลับ';
  return missingFields?.[0] || 'ข้อมูลเพิ่มเติมถ้ามี';
}
function inferTicketCategoryFromText(text) {
  if (/ปริ้น|ปริน|printer|พิมพ์|เครื่องพิมพ์/i.test(text)) return 'Printer';
  if (/wifi|wi-fi|network|internet|vpn|เน็ต|ไวไฟ|lan/i.test(text)) return 'Network';
  if (/กล้อง|cctv|nvr|dvr/i.test(text)) return 'CCTV/NVR';
  if (/บัญชี|account|password|mfa|login|ล็อกอิน/i.test(text)) return 'Account';
  if (/จอ|monitor|signal|hdmi|displayport|คอม|notebook|pc|windows|mac/i.test(text)) return 'Computer';
  return 'Other';
}

function TicketSummarySheet({ open, onClose, ticket, setTicket, missingFields, saveTicket, isSaving, saveState, saveStatus, attachments = [] }) {
  const update = (field, value) => setTicket((current) => ({ ...current, [field]: value }));
  const readyItems = [
    ['ปัญหา', Boolean(ticket['ปัญหา'])],
    ['สถานที่', Boolean(ticket.location)],
    ['ผลกระทบ', Boolean(ticket['ผลกระทบ'])],
    ['ช่องทางติดต่อ', Boolean(ticket.contact)]
  ];
  return <AnimatePresence>{open ? <motion.div className="sheet-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <button className="sheet-backdrop" onClick={onClose} aria-label="ปิดสรุปข้อมูล" />
    <motion.aside className="ticket-sheet" initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 28, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 280 }}>
      <div className="sheet-head">
        <div><h2>ร่าง Ticket</h2><p>ตรวจข้อมูล แล้วกด “บันทึกใบงาน” เพื่อเปิด ticket จริง</p></div>
        <IconButton label="ปิด" onClick={onClose}><X size={18} /></IconButton>
      </div>
      <div className="ready-list">
        {readyItems.map(([label, done]) => <div key={label} className={cn('ready-item', done && 'done')}><CheckCircle2 size={15} /><span>{label}</span></div>)}
      </div>
      <div className="sheet-grid">
        {optionalFields.map(([field, label]) => <Field key={field} label={label} value={ticket[field]} onChange={(value) => update(field, value)} />)}
        <Field label="ประเภท" value={ticket['ประเภท']} onChange={(value) => update('ประเภท', value)} />
        <Field label="ทีมที่เกี่ยวข้อง" value={ticket['ทีมที่เกี่ยวข้อง']} onChange={(value) => update('ทีมที่เกี่ยวข้อง', value)} />
      </div>
      <Field label="ปัญหา" value={ticket['ปัญหา']} onChange={(value) => update('ปัญหา', value)} />
      <TextAreaField label="ผลกระทบ" value={ticket['ผลกระทบ']} onChange={(value) => update('ผลกระทบ', value)} rows={3} />
      <TextAreaField label="ข้อมูลที่ได้รับ" value={ticket['ข้อมูลที่ได้รับ']} onChange={(value) => update('ข้อมูลที่ได้รับ', value)} rows={4} />
      {attachments.length ? <div className="attachment-section">
        <div className="section-label"><strong>ไฟล์แนบ</strong><span>ไฟล์ถูกเก็บในเครื่อง และจะติดไปกับใบงานเมื่อกดบันทึก</span></div>
        <div className="attachment-list">{attachments.map((file) => <div key={file.localId || file.id || file.name} className={cn('attachment-row', `attachment-${attachmentStatusTone(file)}`)}>
          <Paperclip size={15} />
          <div><strong>{file.name}</strong><small>{attachmentStatusLabel(file)}{file.size ? ` · ${formatBytes(file.size)}` : ''}</small></div>
        </div>)}</div>
      </div> : null}
      <SelectField label="ระดับความเร่งด่วน" value={ticket['ระดับความเร่งด่วน']} onChange={(value) => update('ระดับความเร่งด่วน', value)} options={urgencyOptions} />
      {missingFields.length ? <div className="soft-note"><strong>ข้อมูลที่อาจถามเพิ่ม</strong><span>{missingFields.join(', ')}</span></div> : null}
      {saveStatus ? <div className={cn('save-note', saveState)}>{saveStatus}</div> : null}
      {!ticket['ปัญหา'] ? <div className="save-note error">กรอกช่อง “ปัญหา” อย่างน้อย 1 รายการก่อนเปิด ticket จริง</div> : null}
      <Button className="wide" disabled={!ticket['ปัญหา'] || isSaving || saveState === 'saved'} onClick={saveTicket}>{isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}{saveState === 'saved' ? 'บันทึกแล้ว' : 'บันทึกใบงาน / เปิด Ticket'}</Button>
    </motion.aside>
  </motion.div> : null}</AnimatePresence>;
}

function TicketIntakePage({ config }) {
  const [messages, setMessages] = useState([]);
  const [ticket, setTicket] = useState(emptyTicket);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ready');
  const [missingFields, setMissingFields] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [lastAgentReply, setLastAgentReply] = useState('');
  const [handoffNotice, setHandoffNotice] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('กำลังคิดสักครู่');
  const attachmentsRef = useRef([]);
  const uploadPromisesRef = useRef(new Map());
  const uploadResultsRef = useRef(new Map());
  const examples = ['เครื่องปริ้นพิมพ์ไม่ได้', 'Wi-Fi ใช้งานไม่ได้', 'คอมเปิดไม่ติด', 'กล้องดูไม่ได้', 'เข้าอีเมลไม่ได้'];
  const summary = useMemo(() => buildChatSummary(ticket, missingFields, saveState === 'saved', saveStatus), [ticket, missingFields, saveState, saveStatus]);
  const conversationAttachments = useMemo(() => normalizeAttachmentList([...attachments, ...collectConversationAttachments(messages)]), [attachments, messages]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  function patchLocalAttachment(localId, patch) {
    const applyPatch = (item) => item.localId === localId ? { ...item, ...patch } : item;
    setAttachments((current) => current.map(applyPatch));
    setMessages((current) => current.map((message) => message.attachments?.length ? { ...message, attachments: message.attachments.map(applyPatch) } : message));
  }

  async function uploadTicketFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file && file.size > 0);
    if (!files.length) return;
    const localItems = files.map(createLocalAttachment);
    setAttachments((current) => normalizeAttachmentList([...current, ...localItems]));
    setUploadingAttachment(true);

    const uploads = localItems.map((localItem) => {
      const promise = (async () => {
        try {
          patchLocalAttachment(localItem.localId, { uploadState: 'uploading', statusText: 'กำลังอัปโหลด...' });
          const base64 = await readFileAsBase64(localItem.file);
          uploadResultsRef.current.set(localItem.localId, { ...localItem, base64, uploadState: 'processing', statusText: isImageAttachment(localItem) ? 'กำลังอ่านรูปภาพ...' : 'กำลังทำ OCR...' });
          patchLocalAttachment(localItem.localId, {
            base64,
            uploadState: 'processing',
            statusText: isImageAttachment(localItem) ? 'กำลังอ่านรูปภาพ...' : 'กำลังทำ OCR...'
          });
          const response = await fetch('/api/attachments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: { name: localItem.name, type: localItem.type, base64 } })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'upload failed');
          const readyAttachment = {
            ...data.attachment,
            localId: localItem.localId,
            previewUrl: localItem.previewUrl,
            base64: '',
            uploadState: 'ready',
            statusText: 'พร้อมส่งให้โมเดล'
          };
          uploadResultsRef.current.set(localItem.localId, readyAttachment);
          patchLocalAttachment(localItem.localId, readyAttachment);
        } catch (error) {
          const failedAttachment = { ...localItem, uploadState: 'error', statusText: 'อัปโหลดไม่สำเร็จ', error: error.message };
          uploadResultsRef.current.set(localItem.localId, failedAttachment);
          patchLocalAttachment(localItem.localId, failedAttachment);
        } finally {
          uploadPromisesRef.current.delete(localItem.localId);
        }
      })();
      uploadPromisesRef.current.set(localItem.localId, promise);
      return promise;
    });
    Promise.allSettled(uploads).finally(() => setUploadingAttachment(uploadPromisesRef.current.size > 0));
  }
  function removeTicketAttachment(file) {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    const key = file.localId || file.id || file.name;
    if (file.localId) uploadResultsRef.current.delete(file.localId);
    setAttachments((current) => current.filter((item) => (item.localId || item.id || item.name) !== key));
  }

  async function submitTicketMessage(rawText, options = {}) {
    const userText = String(rawText || '').trim();
    const activeAttachments = normalizeAttachmentList(options.attachments || attachments);
    if ((!userText && !activeAttachments.length) || isThinking) return;
    const content = userText || 'ช่วยอ่านไฟล์แนบนี้และร่างใบงาน IT จากข้อมูลที่เกี่ยวข้อง';
    const displayContent = userText || 'ช่วยอ่านไฟล์แนบนี้และร่างใบงาน IT จากข้อมูลที่เกี่ยวข้อง';
    const userMessage = { id: `user-${Date.now()}`, role: 'user', content, displayContent, attachments: activeAttachments };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage = { id: assistantId, role: 'assistant', content: '', thinking: '', status: activeAttachments.length ? 'กำลังเตรียมไฟล์แนบ' : 'กำลังส่งคำถามให้โมเดล', hasAttachments: Boolean(activeAttachments.length), isStreaming: true };
    const visibleMessages = [...messages, userMessage, assistantMessage];
    const nextMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
    setMessages(visibleMessages);
    setInput('');
    setAttachments([]);
    setIsThinking(true);
    setMode('thinking');
    setSaveStatus('');
    setSaveState('idle');
    const updateAssistant = (patch) => {
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item));
    };
    try {
      const activeKeys = activeAttachments.map((item) => item.localId || item.id || item.name).filter(Boolean);
      const pendingUploads = activeKeys.map((key) => uploadPromisesRef.current.get(key)).filter(Boolean);
      if (pendingUploads.length) {
        updateAssistant({ status: 'กำลังเตรียมไฟล์แนบ' });
        await Promise.allSettled(pendingUploads);
      }
      const latestAttachments = normalizeAttachmentList(activeKeys
        .map((key) => uploadResultsRef.current.get(key) || attachmentsRef.current.find((item) => (item.localId || item.id || item.name) === key) || activeAttachments.find((item) => (item.localId || item.id || item.name) === key))
        .filter(Boolean));
      const apiAttachments = sanitizeAttachmentsForApi(latestAttachments);
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, attachments: apiAttachments })
      });
      if (!response.ok) throw new Error(`chat stream failed (${response.status})`);
      await readSseStream(response, (event, data) => {
        if (event === 'status') updateAssistant({ status: data.status || '' });
        if (event === 'thinking') updateAssistant((item) => ({ thinking: `${item.thinking || ''}${data.delta || ''}` }));
        if (event === 'content') updateAssistant((item) => ({ content: `${item.content || ''}${data.delta || ''}` }));
        if (event === 'error') updateAssistant({ status: data.message ? `เกิดข้อผิดพลาด: ${data.message}` : 'เกิดข้อผิดพลาด' });
        if (event === 'done') {
          updateAssistant({ isStreaming: false, status: '', reasoningSummary: data.reasoningSummary, ticketDraft: data.ticketDraft });
          setTicket((current) => ({ ...current, ...(data.ticket || {}) }));
          setMode(data.mode || 'done');
          setMissingFields(data.missingFields || []);
          setLastAgentReply(data.answer || data.agentReply || '');
          setHandoffNotice('AI ร่าง Ticket ให้แล้ว กด “ดูร่าง / เปิด Ticket” เพื่อตรวจและบันทึกจริง');
          if (options.openDraft) {
            setHandoffNotice('ร่างใบงานจากแชท AI แล้ว แต่ยังไม่ได้บันทึกเป็น ticket จริง จนกว่าจะกด “บันทึกใบงาน”');
            setSheetOpen(true);
          }
        }
      });
    } catch (error) {
      setMode('error');
      updateAssistant({ isStreaming: false, status: '', content: `เกิดข้อผิดพลาดครับ: ${error.message}` });
    } finally {
      setIsThinking(false);
    }
  }
  async function sendMessage() {
    await submitTicketMessage(input);
  }
  function openTicketDraft() {
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content || input.trim();
    const attachmentText = conversationAttachments.map((item) => item.name).filter(Boolean).join(', ');
    const problem = ticket['ปัญหา'] || lastUser || (attachmentText ? `ตรวจสอบไฟล์แนบ: ${attachmentText}` : '');
    if (problem) {
      setTicket((current) => ({
        ...current,
        'ประเภท': current['ประเภท'] || inferTicketCategoryFromText(problem),
        'ปัญหา': current['ปัญหา'] || problem,
        'ผลกระทบ': current['ผลกระทบ'] || 'รอทีม IT ตรวจสอบและประเมินผลกระทบ',
        'ข้อมูลที่ได้รับ': current['ข้อมูลที่ได้รับ'] || [lastUser, attachmentText ? `ไฟล์แนบ: ${attachmentText}` : ''].filter(Boolean).join('\n'),
        'ระดับความเร่งด่วน': current['ระดับความเร่งด่วน'] || 'Medium',
        'ทีมที่เกี่ยวข้อง': current['ทีมที่เกี่ยวข้อง'] || 'IT Support'
      }));
    }
    setHandoffNotice(problem
      ? 'ร่าง Ticket พร้อมตรวจแล้ว กด “บันทึกใบงาน / เปิด Ticket” เพื่อบันทึกจริง'
      : 'เปิดร่าง Ticket แล้ว กรอกช่อง “ปัญหา” อย่างน้อยก่อนบันทึกจริง');
    setSheetOpen(true);
  }
  useEffect(() => {
    const raw = sessionStorage.getItem('ticket-handoff');
    if (!raw) return;
    sessionStorage.removeItem('ticket-handoff');
    try {
      const handoff = JSON.parse(raw);
      const handoffAttachments = normalizeAttachmentList(handoff.attachments || []);
      setAttachments(handoffAttachments);
      setMessages([{ role: 'assistant', content: 'ผมย้ายมาหน้าแจ้งปัญหาให้แล้วครับ กำลังร่างใบงานจากข้อมูลที่คุณส่งมา' }]);
      setHandoffNotice('กำลังนำข้อมูลจากแชท AI มาร่างใบงาน ยังไม่ได้บันทึกเป็น ticket จริง');
      setTimeout(() => submitTicketMessage(handoff.text || '', { openDraft: true, attachments: handoffAttachments }), 50);
    } catch {}
  }, []);
  async function saveTicket() {
    setIsSaving(true);
    setSaveState('saving');
    setSaveStatus('กำลังบันทึกใบงาน...');
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMessage: messages.filter((item) => item.role === 'user').map((item) => item.content).join('\n'),
          agentReply: lastAgentReply,
          transcript: messages,
          attachments: sanitizeAttachmentsForApi(conversationAttachments),
          ticket
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'save failed');
      if (data.sheetEnabled && !data.webhookOk) {
        setSaveState('webhookFailed');
        setSaveStatus('บันทึกในเครื่องแล้ว แต่ส่ง webhook ไม่สำเร็จ');
        setMessages((current) => [...current, { role: 'assistant', content: `บันทึกในเครื่องแล้ว แต่ส่ง webhook ไม่สำเร็จครับ\n\n${buildChatSummary(ticket, [], false, '')}\n\nสามารถลองบันทึกอีกครั้งได้ครับ` }]);
      } else {
        const ticketId = data.saved?.ticketId;
        const okText = `${data.sheetEnabled ? 'บันทึกใบงานและส่งต่อเรียบร้อยแล้ว' : 'บันทึกใบงานในเครื่องแล้ว'}${ticketId ? ` (${ticketId})` : ''}`;
        setSaveState('saved');
        setSaveStatus(okText);
        setMessages((current) => [...current, { role: 'assistant', content: `เปิด Ticket เรียบร้อยแล้วครับ${ticketId ? `\n\nTicket ID: ${ticketId}` : ''}\n\nดูรายการ ticket ที่บันทึกแล้วได้จากเมนู **Tickets** ด้านซ้าย แล้วเลือก tab **Tickets**\n\n${buildChatSummary(ticket, [], true, okText)}\n\nหากมีข้อมูลเพิ่มเติม แจ้งเพิ่มได้เลยครับ` }]);
        setSheetOpen(false);
      }
    } catch (error) {
      setSaveState('error');
      setSaveStatus(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }
  function resetChat() {
    setMessages([]);
    setTicket(emptyTicket);
    setInput('');
    setMode('ready');
    setMissingFields([]);
    setIsThinking(false);
    setSaveStatus('');
    setSaveState('idle');
    setLastAgentReply('');
    setHandoffNotice('');
    attachments.forEach((file) => file.previewUrl && URL.revokeObjectURL(file.previewUrl));
    setAttachments([]);
  }

  return <ChatLayout
    topActions={<>
      <StatusPill tone={mode === 'error' ? 'danger' : mode === 'thinking' ? 'info' : 'ok'}>{friendlyStatus(mode)}</StatusPill>
      <Button variant="secondary" size="sm" onClick={openTicketDraft}><ClipboardList size={15} />ดูร่าง / เปิด Ticket</Button>
      <IconButton label="เปิดเคสใหม่" onClick={resetChat}><RefreshCcw size={17} /></IconButton>
    </>}
    notice={handoffNotice ? <div className="handoff-banner"><strong>ร่าง Ticket</strong><span>{handoffNotice}</span><Button variant="secondary" size="sm" onClick={openTicketDraft}>ดูร่าง / เปิด Ticket</Button></div> : null}
    composer={<Composer value={input} onChange={setInput} onSend={sendMessage} disabled={(!input.trim() && !attachments.length) || isThinking} placeholder="Send a message" helper="แนบ screenshot, PDF, log, txt, json หรือรูปถ่ายอุปกรณ์ได้" compact onFiles={uploadTicketFiles} onRemoveAttachment={removeTicketAttachment} attachments={attachments} uploading={uploadingAttachment} busy={isThinking} model={config.modelName} />}
  >
      <MessageList
        messages={messages}
        pending={false}
        pendingStatus={thinkingStatus}
        hasPendingAttachments={Boolean(attachments.length)}
        emptyState={<EmptyState icon={ClipboardList} title="สวัสดี" description="พิมพ์อาการที่พบ หรือแนบรูป/ไฟล์ให้ AI ช่วยอ่านและร่างใบงาน IT">
          <div className="hint-grid">
            {['อุปกรณ์/ระบบที่มีปัญหา', 'สถานที่หรือจุดติดตั้ง', 'อาการที่พบ', 'ผลกระทบ', 'เวลาเริ่มเกิดปัญหา'].map((item) => <span key={item}><CheckCircle2 size={14} />{item}</span>)}
          </div>
          <div className="chip-row">{examples.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div>
        </EmptyState>}
      />
      {summary ? <motion.button className="summary-bar" onClick={openTicketDraft} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <span><strong>ดูร่าง / เปิด Ticket</strong><small>{ticket['ปัญหา'] || `ควรถามเพิ่ม: ${nextMissingLabel(ticket, missingFields)}`}</small></span>
        <ChevronRight size={18} />
      </motion.button> : null}
    <TicketSummarySheet open={sheetOpen} onClose={() => setSheetOpen(false)} ticket={ticket} setTicket={setTicket} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveState={saveState} saveStatus={saveStatus} attachments={conversationAttachments} />
  </ChatLayout>;
}

function OcrStudioPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [documentType, setDocumentType] = useState('utility_bill');
  const [notice, setNotice] = useState('ลาก PDF/รูปภาพ/ไฟล์ข้อความมาวาง หรือกดเลือกไฟล์เพื่อ OCR');
  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const readableItems = items.filter((item) => item.ocrText?.trim());
  const selectedIsLoading = selected && ['queued', 'processing'].includes(selected.status);
  const selectedHasError = selected && ['error', 'unreadable'].includes(selected.status) && !selected.ocrText;

  function updateItem(id, patch) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  async function readOcrItem(file, id) {
    updateItem(id, { status: 'processing', error: '' });
    try {
      const textLike = /\.(txt|md|markdown|csv|json)$/i.test(file.name) || String(file.type || '').startsWith('text/');
      if (textLike) {
        const text = await file.text();
        updateItem(id, { status: 'readable', ocrText: text, attachment: null, error: '' });
        return;
      }
      const base64 = await readFileAsBase64(file);
      const response = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: { name: file.name, type: file.type, base64 } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OCR failed');
      const attachment = data.attachment;
      updateItem(id, {
        status: attachment.ocrStatus || (attachment.ocrOk ? 'readable' : 'unreadable'),
        ocrText: attachment.ocrText || '',
        error: attachment.ocrError || '',
        attachment
      });
    } catch (error) {
      updateItem(id, { status: 'error', error: error.message });
    }
  }
  async function processFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file && file.size > 0);
    if (!files.length || busy) return;
    setBusy(true);
    setNotice(`กำลังอ่านข้อความจาก ${files.length} ไฟล์...`);
    const initial = files.map((file) => ({ id: crypto.randomUUID?.() || `${Date.now()}-${file.name}`, name: file.name, size: file.size, type: file.type, sourceFile: file, status: 'queued', ocrText: '', structuredText: '', error: '' }));
    setItems((current) => [...initial, ...current]);
    setSelectedId(initial[0].id);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const id = initial[index].id;
      await readOcrItem(file, id);
    }
    setNotice('อ่านข้อความเสร็จแล้ว ตรวจผลก่อน copy หรือ export');
    setBusy(false);
  }
  function statusText(item) {
    if (!item) return '-';
    if (item.status === 'queued') return 'รอคิว';
    if (item.status === 'processing') return 'กำลังอ่าน';
    if (item.status === 'readable') return 'อ่านสำเร็จ';
    if (item.status === 'unreadable') return 'อ่านไม่ได้';
    if (item.status === 'not-supported') return 'ไม่รองรับ OCR';
    if (item.status === 'error') return 'ผิดพลาด';
    return item.status || '-';
  }
  function setSelectedText(value) {
    if (!selected) return;
    updateItem(selected.id, { ocrText: value, structuredText: '', status: value.trim() ? 'readable' : selected.status });
  }
  async function copyText(text, label) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setNotice(`คัดลอก${label}จาก ${selected?.name || 'ไฟล์'} แล้ว`);
  }
  async function copySelected() {
    if (!selected?.ocrText) return;
    await copyText(selected.ocrText, 'ข้อความ OCR');
  }
  async function structureSelected() {
    if (!selected?.ocrText || structuring) return;
    setStructuring(true);
    setNotice(`กำลังสกัดข้อมูลสำคัญจาก ${selected.name}...`);
    try {
      const response = await fetch('/api/ocr/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selected.ocrText, documentType, name: selected.name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'structure failed');
      updateItem(selected.id, { structuredText: data.structuredText || '' });
      setNotice('สกัดข้อมูลสำคัญแล้ว กรุณาตรวจทานกับไฟล์ต้นฉบับก่อนใช้งานจริง');
    } catch (error) {
      setNotice(`สกัดข้อมูลไม่สำเร็จ: ${error.message}`);
    } finally {
      setStructuring(false);
    }
  }
  function exportSelectedTxt() {
    if (!selected?.ocrText) return;
    const text = selected.structuredText ? `${selected.structuredText}\n\n--- RAW OCR ---\n\n${selected.ocrText}` : selected.ocrText;
    downloadBlob(`${selected.name.replace(/\.[^.]+$/, '') || 'ocr-result'}.txt`, text, 'text/plain;charset=utf-8');
  }
  function exportExcel() {
    const rows = items.map((item) => ({ name: item.name, status: statusText(item), size: formatBytes(item.size), structured: item.structuredText || '', text: item.ocrText || item.error || '' }));
    exportOcrRowsToExcel(rows);
  }
  function sendSelectedToAi() {
    if (!selected?.ocrText) return;
    goToKnowledgeChat({ name: selected.name, ocrText: selected.ocrText });
  }
  async function retrySelected() {
    if (!selected?.sourceFile || busy) return;
    setBusy(true);
    setNotice(`กำลังลองอ่าน ${selected.name} อีกครั้ง...`);
    await readOcrItem(selected.sourceFile, selected.id);
    setNotice('ลองอ่านไฟล์อีกครั้งแล้ว ตรวจผลด้านขวา');
    setBusy(false);
  }

  return <div className="page ocr-page">
    <PageTop
      title="OCR Studio"
      description="อ่านข้อความจาก PDF/รูปภาพ แล้ว copy หรือ export เป็น TXT/Excel"
      actions={<><StatusPill tone={busy ? 'info' : readableItems.length ? 'ok' : 'neutral'}>{busy ? 'กำลัง OCR' : `${readableItems.length}/${items.length || 0} อ่านได้`}</StatusPill><Button variant="secondary" disabled={!items.length} onClick={exportExcel}><Download size={16} />Export Excel</Button></>}
    />
    <section className="ocr-layout">
      <aside className="ocr-sidebar">
        <label className="ocr-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); processFiles(event.dataTransfer.files); }}>
          <UploadCloud size={24} />
          <strong>ลากไฟล์มาวาง</strong>
          <span>รองรับ PDF, PNG, JPG, WEBP, TXT, Markdown</span>
          <input type="file" multiple onChange={(event) => processFiles(event.target.files)} />
        </label>
        <div className="notice">{notice}</div>
        <div className="ocr-file-list">{items.length ? items.map((item) => <button key={item.id} className={cn('ocr-file', `ocr-file-${item.status || 'queued'}`, selected?.id === item.id && 'active')} onClick={() => setSelectedId(item.id)}>
          {item.status === 'processing' ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
          <span><strong>{item.name}</strong><small>{statusText(item)} · {formatBytes(item.size)}</small></span>
        </button>) : <EmptyState icon={FileText} title="ยังไม่มีไฟล์" description="ลากไฟล์มาวาง หรือเลือกไฟล์เพื่อเริ่ม OCR" />}</div>
      </aside>
      <main className="ocr-result">
        {selected ? <Card className="ocr-editor">
          <div className="sheet-head ocr-editor-head"><div><h2>{selected.name}</h2><p>{statusText(selected)}{selected.error ? ` · ${selected.error}` : ''}</p></div><StatusPill tone={selected.status === 'readable' ? 'ok' : selected.status === 'processing' ? 'info' : selected.status === 'error' || selected.status === 'unreadable' ? 'warning' : 'neutral'}>{statusText(selected)}</StatusPill></div>
          <div className="ocr-tools">
            <label><span>ประเภทเอกสาร</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              <option value="utility_bill">บิล/ใบแจ้งหนี้</option>
              <option value="general">เอกสารทั่วไป</option>
            </select></label>
            <Button variant="secondary" disabled={!selected.ocrText || structuring} onClick={structureSelected}>{structuring ? <Loader2 className="spin" size={16} /> : <Database size={16} />}สกัดข้อมูลสำคัญ</Button>
          </div>
          <div className="ocr-text-panel">
            {selectedIsLoading ? <div className="ocr-panel-state">
              <Loader2 className="spin" size={28} />
              <strong>กำลังอ่านข้อความจากไฟล์...</strong>
              <span>อาจใช้เวลาสักครู่ ขึ้นอยู่กับขนาดไฟล์</span>
            </div> : selectedHasError ? <div className="ocr-panel-state ocr-panel-error">
              <AlertCircle size={28} />
              <strong>อ่านไฟล์ไม่สำเร็จ</strong>
              <span>{selected.error || 'ระบบยังอ่านข้อความจากไฟล์นี้ไม่ได้'}</span>
              <Button variant="secondary" disabled={!selected.sourceFile || busy} onClick={retrySelected}><RefreshCcw size={16} />ลองใหม่</Button>
            </div> : <textarea aria-label="ผลลัพธ์ OCR" value={selected.ocrText || ''} onChange={(event) => setSelectedText(event.target.value)} placeholder="ผล OCR จะแสดงที่นี่ และสามารถแก้ไขก่อน export ได้" />}
          </div>
          {selected.structuredText ? <div className="ocr-structured">
            <div className="section-label"><strong>ข้อมูลสำคัญที่สกัดได้</strong><span>ใช้เป็น draft เท่านั้น ต้องตรวจทานกับไฟล์ต้นฉบับก่อนนำไปใช้งานจริง</span></div>
            <MarkdownMessage>{selected.structuredText}</MarkdownMessage>
          </div> : null}
          <div className="ocr-actions">
            <Button variant="secondary" disabled={!selected.ocrText} onClick={copySelected}><Copy size={16} />Copy</Button>
            <Button variant="secondary" disabled={!selected.structuredText} onClick={() => copyText(selected.structuredText, 'ข้อมูลสำคัญ')}><Copy size={16} />Copy สรุป</Button>
            <Button variant="secondary" disabled={!selected.ocrText} onClick={exportSelectedTxt}><Download size={16} />TXT</Button>
            <Button variant="secondary" disabled={!selected.ocrText} onClick={sendSelectedToAi}><BookOpen size={16} />ส่งไปแชท AI</Button>
          </div>
        </Card> : <div className="ocr-empty-workspace"><EmptyState icon={FileText} title="ยังไม่มีไฟล์" description="ลากไฟล์มาวาง หรือเลือกไฟล์เพื่อเริ่ม OCR" /></div>}
      </main>
    </section>
  </div>;
}

function validationText(value) {
  if (value === true) return 'ผ่าน';
  if (value === false) return 'ไม่ตรง';
  return 'ข้อมูลไม่พอ';
}
function validationTone(value) {
  if (value === true) return 'ok';
  if (value === false) return 'danger';
  return 'warning';
}
function ElectricityBillPage() {
  const [fileName, setFileName] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [invoiceText, setInvoiceText] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('เลือก PDF/รูปใบแจ้งค่าไฟ PEA เพื่อสกัดเป็น JSON ก่อนส่ง Google Sheet');
  const [saveState, setSaveState] = useState('');
  const invoiceError = useMemo(() => {
    if (!invoiceText.trim()) return '';
    try {
      JSON.parse(invoiceText);
      return '';
    } catch (error) {
      return error.message;
    }
  }, [invoiceText]);

  function setInvoiceFromObject(nextInvoice) {
    setInvoice(nextInvoice);
    setInvoiceText(JSON.stringify(nextInvoice, null, 2));
  }
  async function extractFiles(fileList) {
    const file = Array.from(fileList || [])[0];
    if (!file || busy) return;
    setBusy(true);
    setSaveState('');
    setFileName(file.name);
    setNotice(`กำลัง OCR และสกัด JSON จาก ${file.name}...`);
    try {
      const base64 = await readFileAsBase64(file);
      const response = await fetch('/api/electricity-bills/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: { name: file.name, type: file.type, base64 } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'extract failed');
      setOcrText(data.ocrText || '');
      setInvoiceFromObject(data.invoice);
      setNotice(data.sheetEnabled ? 'สกัด JSON แล้ว ตรวจข้อมูลก่อนกดบันทึก Google Sheet' : 'สกัด JSON แล้ว แต่ยังไม่ได้ตั้งค่า ELECTRICITY_BILL_WEBHOOK_URL จึงบันทึกได้เฉพาะในเครื่อง');
    } catch (error) {
      setNotice(`อ่านบิลไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }
  function applyJsonEdit(value) {
    setInvoiceText(value);
    try {
      setInvoice(JSON.parse(value));
    } catch {}
  }
  async function copyJson() {
    if (!invoiceText) return;
    await navigator.clipboard.writeText(invoiceText).catch(() => {});
    setNotice('คัดลอก JSON แล้ว');
  }
  function downloadJson() {
    if (!invoiceText) return;
    downloadBlob(`${fileName.replace(/\.[^.]+$/, '') || 'electricity-invoice'}.json`, invoiceText, 'application/json;charset=utf-8');
  }
  async function saveBill() {
    if (!invoice || invoiceError || saving) return;
    setSaving(true);
    setSaveState('กำลังบันทึก...');
    try {
      const response = await fetch('/api/electricity-bills/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceName: fileName, invoice, ocrText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'save failed');
      if (data.sheetEnabled && !data.webhookOk) {
        setSaveState(`บันทึกในเครื่องแล้ว แต่ส่ง Google Sheet ไม่สำเร็จ: ${data.webhookError || 'unknown error'}`);
      } else {
        setSaveState(data.sheetEnabled ? 'บันทึกในเครื่องและส่ง Google Sheet แล้ว' : 'บันทึกในเครื่องแล้ว ยังไม่ได้ตั้งค่า Google Sheet webhook');
      }
    } catch (error) {
      setSaveState(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }
  const validations = invoice?.validation || {};
  const confidence = invoice?.confidence?.overall;
  const lowFields = invoice?.confidence?.low_confidence_fields || [];
  return <div className="page bill-page">
    <PageTop
      title="อ่านบิลค่าไฟ"
      description="OCR ใบแจ้งค่าไฟ PEA เป็น JSON ตรวจทานได้ แล้วบันทึกลง Google Sheet"
      actions={<><StatusPill tone={busy ? 'info' : invoice ? 'ok' : 'neutral'}>{busy ? 'กำลังอ่านบิล' : invoice ? `Confidence ${Math.round((confidence || 0) * 100)}%` : 'รอไฟล์'}</StatusPill><Button variant="secondary" disabled={!invoiceText} onClick={downloadJson}><Download size={16} />JSON</Button></>}
    />
    <section className="bill-layout">
      <aside className="bill-sidebar">
        <label className="ocr-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); extractFiles(event.dataTransfer.files); }}>
          <UploadCloud size={24} />
          <strong>ลากบิลค่าไฟมาวาง</strong>
          <span>รองรับ PDF, PNG, JPG, WEBP จาก PEA และให้ตรวจ JSON ก่อนส่งชีท</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => extractFiles(event.target.files)} />
        </label>
        <div className="notice">{notice}</div>
        {fileName ? <Card className="bill-file-card"><FileText size={17} /><div><strong>{fileName}</strong><small>{ocrText ? `${ocrText.length.toLocaleString()} OCR chars` : 'ยังไม่มี OCR text'}</small></div></Card> : null}
        {invoice ? <Card className="bill-summary-card">
          <h3>ข้อมูลหลัก</h3>
          <dl>
            <dt>CA/Ref.No.1</dt><dd>{invoice.customer_info?.ca_ref_no || '-'}</dd>
            <dt>Invoice No.</dt><dd>{invoice.customer_info?.invoice_no || '-'}</dd>
            <dt>รอบบิล</dt><dd>{invoice.billing_info?.bill_period || '-'}</dd>
            <dt>Due date</dt><dd>{invoice.billing_info?.due_date || '-'}</dd>
            <dt>หน่วยรวม</dt><dd>{invoice.energy?.total_kwh ?? '-'}</dd>
            <dt>ยอดรวม</dt><dd>{invoice.amounts?.grand_total ?? '-'}</dd>
          </dl>
        </Card> : null}
      </aside>
      <main className="bill-main">
        {invoice ? <>
          <div className="validation-grid">
            {[
              ['base_plus_ft_minus_discount_equals_subtotal', 'ฐาน + Ft - ส่วนลด = Subtotal'],
              ['subtotal_plus_vat_equals_grand_total', 'Subtotal + VAT = Grand total'],
              ['energy_sum_equals_total_kwh', 'ผลรวมหน่วย = หน่วยรวม']
            ].map(([key, label]) => <Card key={key} className="validation-card">
              <StatusPill tone={validationTone(validations[key])}>{validationText(validations[key])}</StatusPill>
              <strong>{label}</strong>
            </Card>)}
          </div>
          {lowFields.length ? <div className="notice warning">ช่องที่ควรตรวจทาน: {lowFields.slice(0, 14).join(', ')}{lowFields.length > 14 ? ` และอีก ${lowFields.length - 14} ช่อง` : ''}</div> : null}
          <Card className="json-card">
            <div className="sheet-head"><div><h2>Electricity invoice JSON</h2><p>แก้ไขได้ก่อนบันทึก ระบบจะส่ง JSON และ flat fields ไปยัง webhook</p></div>{invoiceError ? <StatusPill tone="danger">JSON ไม่ถูกต้อง</StatusPill> : <StatusPill tone="ok">JSON valid</StatusPill>}</div>
            <textarea className="json-editor" value={invoiceText} onChange={(event) => applyJsonEdit(event.target.value)} spellCheck="false" />
            {invoiceError ? <div className="notice danger">{invoiceError}</div> : null}
            <div className="ocr-actions">
              <Button variant="secondary" onClick={copyJson}><Copy size={16} />Copy JSON</Button>
              <Button variant="secondary" onClick={downloadJson}><Download size={16} />Download JSON</Button>
              <Button disabled={Boolean(invoiceError) || saving} onClick={saveBill}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}{saving ? 'กำลังบันทึก' : 'บันทึกลง Sheet'}</Button>
            </div>
            {saveState ? <div className={cn('save-note', saveState.includes('ไม่สำเร็จ') ? 'error' : saveState.includes('webhook') ? 'webhookFailed' : 'saved')}>{saveState}</div> : null}
          </Card>
        </> : <EmptyState icon={Database} title="ยังไม่มี JSON บิลค่าไฟ" description="อัปโหลดไฟล์ PDF หรือรูปบิลค่าไฟ ระบบจะอ่าน OCR แล้วสกัดข้อมูลเป็น JSON ตาม schema ที่กำหนด">
          <div className="hint-grid">
            {['เลข CA/Ref.No.1 และ Invoice', 'รอบบิลและวันครบกำหนด', 'หน่วยการใช้ไฟฟ้า', 'ยอด Ft, VAT และยอดรวม'].map((item) => <span key={item}><CheckCircle2 size={14} />{item}</span>)}
          </div>
        </EmptyState>}
      </main>
    </section>
  </div>;
}

function KnowledgeChatPage({ config = defaultConfig }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('พร้อมตอบคำถาม');
  const [mode, setMode] = useState('ready');
  const [sources, setSources] = useState([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  const [processStep, setProcessStep] = useState('พร้อมรับคำถาม');
  const [isThinking, setIsThinking] = useState(false);
  const prompts = ['ช่วยสรุปไฟล์นี้ให้หน่อย', 'อธิบายเรื่องนี้แบบเข้าใจง่าย', 'ช่วยร่างอีเมลตอบกลับให้หน่อย'];

  useEffect(() => {
    const raw = sessionStorage.getItem('ocr-handoff');
    if (!raw) return;
    sessionStorage.removeItem('ocr-handoff');
    try {
      const handoff = JSON.parse(raw);
      if (handoff?.ocrText) {
        setAttachments([{ id: `ocr-${Date.now()}`, name: handoff.name || 'ocr-result.txt', type: 'text/markdown', size: handoff.ocrText.length, ocrStatus: 'readable', ocrOk: true, ocrText: handoff.ocrText }]);
        setInput('ช่วยสรุปข้อความ OCR นี้ให้หน่อย');
      }
    } catch {}
  }, []);

  async function uploadKnowledgeFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file && file.size > 0);
    if (!files.length) return;
    setUploadingAttachment(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const base64 = await readFileAsBase64(file);
        const previewUrl = isImageAttachment(file) ? `data:${file.type || 'image/jpeg'};base64,${base64}` : '';
        const response = await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: { name: file.name, type: file.type, base64 } })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'upload failed');
        uploaded.push({ ...data.attachment, previewUrl });
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: `แนบไฟล์ไม่สำเร็จครับ: ${error.message}` }]);
    } finally {
      setUploadingAttachment(false);
    }
  }
  function removeKnowledgeAttachment(file) {
    setAttachments((current) => current.filter((item) => (item.id || item.name) !== (file.id || file.name)));
  }
  async function sendMessage() {
    const userText = input.trim();
    if ((!userText && !attachments.length) || isThinking) return;
    const content = userText || 'ช่วยอ่านและสรุปไฟล์แนบนี้ให้หน่อยครับ';
    const displayContent = userText || 'ช่วยอ่านและสรุปไฟล์แนบนี้ให้หน่อยครับ';
    const visibleNext = [...messages, { role: 'user', content, displayContent, attachments }];
    const apiAttachments = sanitizeAttachmentsForApi(attachments);
    const next = [...visibleNext.map(({ role, content }) => ({ role, content }))];
    if (looksLikeTicketIntent(userText)) {
      setMessages([...visibleNext, { role: 'assistant', content: 'ได้ครับ ผมจะย้ายไปหน้าแจ้งปัญหาเพื่อร่างใบงานจากข้อมูลนี้ให้ก่อนนะครับ ยังไม่ถือว่าบันทึก ticket จริงจนกว่าจะกด “บันทึกใบงาน”' }]);
      setInput('');
      setTimeout(() => goToTicketIntake({ text: content, attachments }), 350);
      return;
    }
    setMessages(visibleNext);
    setInput('');
    setIsThinking(true);
    setStatus(detailedMode ? 'กำลังวิเคราะห์แบบละเอียด...' : 'กำลังค้นเอกสาร...');
    setProcessStep(attachments.length ? 'กำลังอ่านข้อความจากไฟล์แนบ' : 'กำลังค้นเอกสารที่เกี่ยวข้อง');
    setMode('thinking');
    const stepTimer = window.setInterval(() => {
      setProcessStep((current) => {
        const steps = detailedMode
          ? ['กำลังค้นเอกสารที่เกี่ยวข้อง', 'กำลังร่างคำตอบ', 'กำลังตรวจทานเหตุผล', 'กำลังเรียบเรียงคำตอบสุดท้าย']
          : ['กำลังค้นเอกสารที่เกี่ยวข้อง', 'กำลังอ่านบริบท', 'กำลังเรียบเรียงคำตอบ'];
        const index = Math.max(0, steps.indexOf(current));
        return steps[(index + 1) % steps.length];
      });
    }, detailedMode ? 2600 : 1800);
    try {
      const res = await fetch('/api/knowledge-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, attachments: apiAttachments, detailed: detailedMode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'request failed');
      setMessages([...visibleNext, { role: 'assistant', content: data.answer, reasoningSummary: data.reasoningSummary, ticketDraft: data.ticketDraft }]);
      setSources(data.ragContext?.items || []);
      setAttachments([]);
      setMode(data.mode || 'done');
      setProcessStep('เสร็จแล้ว');
      setStatus(detailedMode ? 'ตอบละเอียดแล้ว' : friendlyKnowledgeStatus(data.mode));
    } catch (error) {
      setMode('error');
      setProcessStep('เกิดข้อผิดพลาด');
      setStatus('เกิดข้อผิดพลาด');
      setMessages([...visibleNext, { role: 'assistant', content: `ระบบค้นเอกสารยังไม่พร้อมครับ: ${error.message}` }]);
    } finally {
      window.clearInterval(stepTimer);
      setIsThinking(false);
    }
  }
  function openTicketFromConversation() {
    const transcript = messages.map((item) => `${item.role === 'user' ? 'User' : 'AI'}: ${item.displayContent || item.content}`).join('\n\n');
    goToTicketIntake({ text: `ช่วยร่างใบงานจากบทสนทนาแชท AI นี้\n\n${transcript}`, attachments: collectConversationAttachments(messages) });
  }

  return <ChatLayout
    topActions={<>
      <label className="detail-toggle"><input type="checkbox" checked={detailedMode} onChange={(event) => setDetailedMode(event.target.checked)} />คิดละเอียด</label>
      <StatusPill tone={mode === 'error' ? 'danger' : mode === 'thinking' ? 'info' : 'ok'}>{status}</StatusPill>
      <IconButton label={`แหล่งอ้างอิง ${sources.length}`} onClick={() => setSourceOpen(true)}><BookOpen size={17} /></IconButton>
    </>}
    composer={<Composer value={input} onChange={setInput} onSend={sendMessage} disabled={(!input.trim() && !attachments.length) || isThinking || uploadingAttachment} placeholder="Send a message" helper="ลากไฟล์มาวางได้ รองรับรูป/PDF/TXT/JSON/CSV/log" compact onFiles={uploadKnowledgeFiles} onRemoveAttachment={removeKnowledgeAttachment} attachments={attachments} uploading={uploadingAttachment} busy={isThinking} model={config.modelName} />}
  >
      <MessageList
        messages={messages}
        pending={isThinking}
        pendingStatus={processStep}
        hasPendingAttachments={Boolean(attachments.length)}
        emptyState={<EmptyState icon={BookOpen} title="สวัสดี" description="คุยกับ AI หรือแนบไฟล์ให้ช่วยอ่าน สรุป และส่งต่อเป็นใบงานได้">
            <div className="chip-row">{prompts.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div>
          </EmptyState>}
      />
      {messages.length && !isThinking ? <ChatBridgeBar onOpenTicket={openTicketFromConversation} /> : null}
      <SourcePanel open={sourceOpen} onClose={() => setSourceOpen(false)} sources={sources} />
  </ChatLayout>;
}
function ProcessingCard({ detailed, step }) {
  const steps = detailed ? ['ค้นเอกสาร', 'ร่างคำตอบ', 'ตรวจทาน', 'เรียบเรียง'] : ['ค้นเอกสาร', 'อ่านบริบท', 'เรียบเรียง'];
  return <motion.div className="processing-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="processing-orbit"><span /><span /><span /></div>
    <div><strong>{step}</strong><p>{detailed ? 'โหมดละเอียดใช้เวลานานขึ้น เพราะมีการร่างและตรวจทาน ถ้านานเกินไปจะแจ้งให้ลองใหม่' : 'ระบบกำลังประมวลผล ถ้านานเกินไปจะใช้โหมดสำรอง'}</p><div className="process-steps">{steps.map((item) => <span key={item}>{item}</span>)}</div></div>
  </motion.div>;
}

function SourcePanel({ open, onClose, sources }) {
  return <AnimatePresence>{open ? <motion.div className="source-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <button className="sheet-backdrop" onClick={onClose} aria-label="ปิดแหล่งอ้างอิง" />
    <motion.aside className="source-panel" initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}>
      <div className="sheet-head"><div><h2>แหล่งอ้างอิง</h2><p>เอกสารที่ใช้ประกอบคำตอบล่าสุด</p></div><IconButton label="ปิด" onClick={onClose}><X size={18} /></IconButton></div>
      <div className="source-list">{sources.length ? sources.map((item, index) => <Card key={`${item.path}-${index}`} className="source-card"><strong>{item.title || item.path}</strong><small>{item.path}</small><p>{item.snippet}</p></Card>) : <EmptyState icon={BookOpen} title="ยังไม่มีแหล่งอ้างอิง" description="ถามคำถามก่อน หรือเพิ่มเอกสารที่หน้าจัดการคลังความรู้" />}</div>
    </motion.aside>
  </motion.div> : null}</AnimatePresence>;
}

function DocumentLibraryPage() {
  const [auth, setAuth] = useState('');
  const [stats, setStats] = useState({ folders: 0, files: 0, chunks: 0, updatedAt: '' });
  const [tree, setTree] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('Uploads');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileText, setFileText] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('เอกสารทั้งหมด');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ tone: 'neutral', text: 'ลากไฟล์มาวางเพื่อเพิ่มเข้าคลังความรู้ได้เลย' });
  const [ocr, setOcr] = useState({ available: false, detail: 'ยังไม่ได้ตรวจสอบการอ่านข้อความจากไฟล์' });
  const [adminTab, setAdminTab] = useState(() => {
    const requested = sessionStorage.getItem('admin-tab');
    sessionStorage.removeItem('admin-tab');
    return requested === 'tickets' ? 'tickets' : 'knowledge';
  });

  const authHeaders = () => (auth ? { Authorization: `Basic ${btoa(auth)}` } : {});
  async function api(path, options = {}) {
    const headers = {
      ...authHeaders(),
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `request failed (${res.status})`);
    return data;
  }
  const showNotice = (text, tone = 'neutral') => setNotice({ text, tone });
  async function refresh() {
    try {
      const [summary, ocrStatus] = await Promise.all([
        api('/api/admin/knowledge/summary'),
        api('/api/admin/ocr/status').catch(() => null)
      ]);
      setStats(summary.stats || {});
      setTree(summary.tree || []);
      if (summary.tree?.length && !summary.tree.some((folder) => folder.name === selectedFolder)) setSelectedFolder(summary.tree[0].name);
      if (ocrStatus) setOcr(ocrStatus);
    } catch (error) {
      showNotice(error.message, 'danger');
    }
  }
  useEffect(() => { refresh(); }, []);

  const currentFolder = tree.find((folder) => folder.name === selectedFolder) || { files: [] };
  const allFiles = tree.flatMap((folder) => folder.files.map((file) => ({ ...file, folder: folder.name })));
  const visibleFiles = (selectedFolder === 'เอกสารทั้งหมด' ? allFiles : allFiles.filter((file) => file.folder === selectedFolder)).filter((file) => {
    const haystack = `${file.name} ${file.folder}`.toLowerCase();
    return !searchText.trim() || haystack.includes(searchText.trim().toLowerCase());
  });
  const folders = ['เอกสารทั้งหมด', ...tree.map((folder) => folder.name)];

  async function ensureReader() {
    if (ocr.available) return true;
    showNotice('กำลังเปิดระบบอ่านข้อความจากไฟล์...', 'neutral');
    const data = await api('/api/admin/ocr/start', { method: 'POST' });
    setOcr(data);
    if (!data.available) throw new Error(data.detail || 'ระบบอ่านข้อความจากไฟล์ยังไม่พร้อม');
    showNotice('ระบบอ่านข้อความจากไฟล์พร้อมใช้งาน', 'success');
    return true;
  }
  async function uploadFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((file) => file && file.size > 0);
    if (!incoming.length) {
      showNotice('ยังไม่ได้เลือกไฟล์ หรือไฟล์ว่างเปล่า', 'warning');
      return;
    }
    const targetFolder = selectedFolder === 'เอกสารทั้งหมด' ? 'Uploads' : selectedFolder;
    setBusy(true);
    try {
      const files = [];
      for (const file of incoming) {
        const lower = file.name.toLowerCase();
        const textLike = /\.(md|markdown|txt|csv|json)$/i.test(lower) || (file.type || '').startsWith('text/');
        const needsReader = /\.(pdf|png|jpe?g|webp)$/i.test(lower) || /^(image\/|application\/pdf)/.test(file.type || '');
        if (textLike) {
          files.push({ name: file.name, type: file.type || 'text/plain', content: await file.text() });
        } else if (needsReader) {
          await ensureReader();
          showNotice(`กำลังอ่านข้อความจาก ${file.name}...`, 'neutral');
          const base64 = await readFileAsBase64(file);
          if (!base64) throw new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`);
          const parsed = await api('/api/admin/knowledge/parse-ocr', {
            method: 'POST',
            body: JSON.stringify({ file: { name: file.name, type: file.type || (lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), base64 } })
          });
          files.push({ name: parsed.file?.name || `${file.name}-ocr.md`, type: 'text/markdown', content: parsed.file?.content || '' });
        } else {
          throw new Error(`ไฟล์ ${file.name} ยังไม่รองรับ`);
        }
      }
      await api('/api/admin/knowledge/upload', { method: 'POST', body: JSON.stringify({ folder: targetFolder, files }) });
      showNotice(`เพิ่มเอกสารสำเร็จ ${files.length} ไฟล์`, 'success');
      await refresh();
    } catch (error) {
      showNotice(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  }
  async function loadFile(file) {
    setSelectedFile(file);
    try {
      const data = await api(`/api/admin/knowledge/file?folder=${encodeURIComponent(file.folder)}&name=${encodeURIComponent(file.name)}`);
      setFileText(data.content || '');
      showNotice(`เปิดเอกสาร ${file.name}`, 'success');
    } catch (error) {
      setFileText('');
      showNotice(error.message, 'danger');
    }
  }
  async function saveFile() {
    if (!selectedFile) return;
    setBusy(true);
    try {
      await api('/api/admin/knowledge/file', { method: 'PUT', body: JSON.stringify({ folder: selectedFile.folder, name: selectedFile.name, content: fileText }) });
      showNotice('บันทึกเอกสารแล้ว', 'success');
      await refresh();
    } catch (error) {
      showNotice(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  }
  async function deleteFile(file = selectedFile) {
    if (!file) return;
    setBusy(true);
    try {
      await api('/api/admin/knowledge/file', { method: 'DELETE', body: JSON.stringify({ folder: file.folder, name: file.name }) });
      if (selectedFile?.name === file.name && selectedFile?.folder === file.folder) {
        setSelectedFile(null);
        setFileText('');
      }
      showNotice('ลบเอกสารแล้ว', 'success');
      await refresh();
    } catch (error) {
      showNotice(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  }
  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api('/api/admin/knowledge/folder', { method: 'POST', body: JSON.stringify({ name }) });
      setNewFolderName('');
      setSelectedFolder(name);
      showNotice('สร้างหมวดหมู่แล้ว', 'success');
      await refresh();
    } catch (error) {
      showNotice(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  }
  async function reindex() {
    setBusy(true);
    try {
      const data = await api('/api/admin/knowledge/reindex', { method: 'POST' });
      showNotice(`เอกสารพร้อมให้ AI ใช้อ้างอิงแล้ว (${data.stats?.chunks || 0} ส่วนข้อมูล)`, 'success');
      await refresh();
    } catch (error) {
      showNotice(error.message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  return <div className="page admin-page">
    <PageTop
      title="จัดการคลังความรู้"
      description="เพิ่มเอกสาร แยกหมวดหมู่ และเตรียมข้อมูลให้ AI ใช้อ้างอิง"
      actions={<><StatusPill tone={ocr.available ? 'ok' : 'warning'}>{ocr.available ? 'อ่านข้อความจากไฟล์พร้อม' : 'อ่านข้อความจากไฟล์ยังไม่พร้อม'}</StatusPill><Button variant="secondary" onClick={refresh}><RefreshCcw size={16} />รีเฟรช</Button><Button onClick={reindex} disabled={busy}><Save size={16} />อัปเดตคลังความรู้</Button></>}
    />
    <div className="admin-tabs">{[['knowledge', 'คลังความรู้'], ['tickets', 'Tickets'], ['setup', 'สถานะระบบ']].map(([id, label]) => <button key={id} className={cn(adminTab === id && 'active')} onClick={() => setAdminTab(id)}>{label}</button>)}</div>
    {adminTab === 'tickets' ? <AdminTicketsPanel /> : adminTab === 'setup' ? <SetupStatusPanel /> : <section className="library-wrap">
      <aside className="library-sidebar">
        <label className="upload-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); uploadFiles(event.dataTransfer.files); }}>
          <UploadCloud size={22} />
          <strong>อัปโหลดเอกสาร</strong>
          <span>ลากไฟล์มาวาง หรือคลิกเลือกไฟล์</span>
          <input id="knowledge-upload" type="file" multiple onChange={(event) => uploadFiles(event.target.files)} />
        </label>
        <div className="category-list">
          <div className="side-label">หมวดหมู่</div>
          {folders.map((folder) => <button key={folder} className={cn('category-item', selectedFolder === folder && 'active')} onClick={() => setSelectedFolder(folder)}><Folder size={16} /><span>{folder}</span><small>{folder === 'เอกสารทั้งหมด' ? allFiles.length : tree.find((item) => item.name === folder)?.files.length || 0}</small></button>)}
        </div>
        <div className="new-folder"><input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="เพิ่มหมวดหมู่ใหม่" /><Button size="sm" variant="secondary" onClick={createFolder} disabled={busy}><Plus size={14} />เพิ่ม</Button></div>
      </aside>
      <main className="library-main">
        <div className={cn('notice', notice.tone)}>{notice.text}</div>
        <div className="library-toolbar">
          <div className="search-box"><Search size={17} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="ค้นหาเอกสาร ชื่อไฟล์ หรือหมวดหมู่..." /></div>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>{documentCategories.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="stat-grid">
          <Card><span>เอกสารทั้งหมด</span><strong>{stats.files || 0}</strong></Card>
          <Card><span>หมวดหมู่</span><strong>{stats.folders || tree.length || 0}</strong></Card>
          <Card><span>พร้อมอ้างอิง</span><strong>{stats.chunks || 0}</strong></Card>
        </div>
        <div className="document-table">
          <div className="table-head"><span>ชื่อเอกสาร</span><span>หมวดหมู่</span><span>สถานะ</span><span>ขนาด</span><span></span></div>
          {visibleFiles.length ? visibleFiles.map((file) => <div key={`${file.folder}/${file.name}`} className="table-row" role="button" tabIndex={0} onClick={() => loadFile(file)} onKeyDown={(event) => { if (event.key === 'Enter') loadFile(file); }}>
            <span><FileText size={16} /><strong>{file.name}</strong></span>
            <span>{file.folder}</span>
            <span><StatusPill tone={file.reviewed ? 'ok' : 'warning'}>{file.reviewed ? 'พร้อมใช้งาน' : 'รอ review'}</StatusPill></span>
            <span>{formatBytes(file.size)}</span>
            <IconButton label="จัดการ" onClick={(event) => { event.stopPropagation(); loadFile(file); }}><MoreVertical size={17} /></IconButton>
          </div>) : <EmptyState icon={FileText} title="ยังไม่มีเอกสาร" description="ลากไฟล์เข้ามาเพื่อเริ่มสร้างคลังความรู้" />}
        </div>
      </main>
      <aside className="editor-drawer">
        <div className="sheet-head"><div><h2>{selectedFile?.name || 'รายละเอียดเอกสาร'}</h2><p>{selectedFile ? selectedFile.folder : 'เลือกเอกสารเพื่อดูและแก้ไข'}</p></div>{selectedFile ? <IconButton label="ลบเอกสาร" onClick={() => deleteFile()}><X size={18} /></IconButton> : null}</div>
        <textarea className="doc-editor" value={fileText} onChange={(event) => setFileText(event.target.value)} placeholder="ตัวอย่างเนื้อหาจะปรากฏที่นี่หลังเลือกเอกสาร" />
        <Button className="wide" onClick={saveFile} disabled={!selectedFile || busy}><Save size={16} />บันทึกเอกสาร</Button>
      </aside>
    </section>}
  </div>;
}

function AdminTicketsPanel() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ q: '', status: '', urgency: '', category: '', team: '' });
  const [notice, setNotice] = useState('');
  const query = () => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  async function loadTickets() {
    const res = await fetch(`/api/admin/tickets?${query()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'load tickets failed');
    setTickets(data.tickets || []);
    if (!selected && data.tickets?.[0]) setSelected(data.tickets[0]);
  }
  useEffect(() => { loadTickets().catch((error) => setNotice(error.message)); }, []);
  async function updateStatus(ticketId, status) {
    const res = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'update failed');
    setSelected(data.ticket);
    setTickets((current) => current.map((item) => item.ticketId === ticketId ? data.ticket : item));
    setNotice('อัปเดตสถานะแล้ว');
  }
  const exportUrl = `/api/admin/tickets/export.csv?${query()}`;
  return <section className="ticket-admin">
    <div className="admin-filterbar"><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="ค้นหา ticket, ข้อความ, ผู้แจ้ง..." /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">ทุกสถานะ</option>{ticketStatusOptions.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.urgency} onChange={(event) => setFilters({ ...filters, urgency: event.target.value })}><option value="">ทุกความเร่งด่วน</option>{urgencyOptions.map((item) => <option key={item}>{item}</option>)}</select><Button variant="secondary" onClick={() => loadTickets().catch((error) => setNotice(error.message))}>ค้นหา</Button><a className="btn btn-secondary btn-md" href={exportUrl}>Export CSV</a></div>
    {notice ? <div className="notice success">{notice}</div> : null}
    <div className="ticket-admin-grid"><div className="ticket-list">{tickets.length ? tickets.map((ticket) => <button key={ticket.ticketId} className={cn('ticket-row', selected?.ticketId === ticket.ticketId && 'active')} onClick={() => setSelected(ticket)}><strong>{ticket.ticketId || '(no id)'}</strong><span>{ticket['ปัญหา'] || '-'}</span><small>{ticket.status || 'New'} · {ticket['ระดับความเร่งด่วน'] || '-'}</small></button>) : <EmptyState icon={ClipboardList} title="ยังไม่มี ticket" description="เมื่อผู้ใช้บันทึกใบงาน รายการจะแสดงที่นี่" />}</div><Card className="ticket-detail">{selected ? <><div className="sheet-head"><div><h2>{selected.ticketId}</h2><p>{selected.timestamp}</p></div><select value={selected.status || 'New'} onChange={(event) => updateStatus(selected.ticketId, event.target.value)}>{ticketStatusOptions.map((item) => <option key={item}>{item}</option>)}</select></div><dl>{['ปัญหา','ประเภท','ผลกระทบ','ข้อมูลที่ได้รับ','ระดับความเร่งด่วน','ทีมที่เกี่ยวข้อง','requesterName','department','location','contact','ไฟล์แนบ'].map((key) => <React.Fragment key={key}><dt>{key}</dt><dd>{String(selected[key] || '-')}</dd></React.Fragment>)}</dl></> : <EmptyState title="เลือก ticket" description="เลือกรายการด้านซ้ายเพื่อดูรายละเอียด" />}</Card></div>
  </section>;
}

function SetupStatusPanel() {
  const [checks, setChecks] = useState([]);
  const [notice, setNotice] = useState('');
  async function api(path, options = {}) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'request failed');
    return data;
  }
  async function refresh() {
    const data = await api('/api/admin/setup/status');
    setChecks(data.checks || []);
  }
  useEffect(() => { refresh().catch((error) => setNotice(error.message)); }, []);
  async function action(kind) {
    try {
      if (kind === 'reindex') await api('/api/admin/knowledge/reindex', { method: 'POST' });
      if (kind === 'ocr') await api('/api/admin/ocr/start', { method: 'POST' });
      if (kind === 'sheet') await api('/api/admin/setup/test-sheet', { method: 'POST' });
      if (kind === 'llm') await api('/api/admin/setup/test-llm', { method: 'POST' });
      setNotice('ดำเนินการแล้ว');
      await refresh();
    } catch (error) { setNotice(error.message); }
  }
  return <section className="setup-panel">
    <div className="setup-actions"><Button variant="secondary" onClick={refresh}>รีเฟรช</Button><Button variant="secondary" onClick={() => action('reindex')}>Reindex knowledge</Button><Button variant="secondary" onClick={() => action('ocr')}>Start OCR</Button><Button variant="secondary" onClick={() => action('sheet')}>Test Sheet</Button><Button variant="secondary" onClick={() => action('llm')}>Test LLM</Button></div>
    {notice ? <div className="notice">{notice}</div> : null}
    <div className="check-grid">{checks.map((check) => <Card key={check.id} className="check-card"><StatusPill tone={check.state === 'pass' ? 'ok' : check.state === 'warn' ? 'warning' : 'danger'}>{check.state}</StatusPill><h3>{check.label}</h3><p>{check.detail}</p>{check.ready ? null : <small>{check.nextStep}</small>}</Card>)}</div>
  </section>;
}

function App() {
  const [path, navigate] = useRoute();
  const [config, setConfig] = useState(defaultConfig);
  useEffect(() => {
    fetch('/api/config').then((res) => res.json()).then((data) => setConfig({ ...defaultConfig, ...data })).catch(() => setConfig(defaultConfig));
  }, []);
  const page = path === '/knowledge-chat' ? <KnowledgeChatPage config={config} /> : path === '/electricity-bills' ? <ElectricityBillPage /> : path === '/ocr' ? <OcrStudioPage /> : path === '/admin' ? <DocumentLibraryPage /> : <TicketIntakePage config={config} />;
  return <AppShell config={config} path={path} navigate={navigate}>{page}</AppShell>;
}

createRoot(document.getElementById('root')).render(<App />);
