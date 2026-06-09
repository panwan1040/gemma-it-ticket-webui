import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Download,
  FileText,
  Folder,
  Inbox,
  Loader2,
  Menu,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings,
  UploadCloud,
  User,
  X
} from 'lucide-react';
import './styles.css';

const defaultConfig = {
  appName: 'Local AI Helpdesk',
  appTagline: 'รับเรื่อง แชทเอกสาร และร่างใบงานบนเครื่อง',
  appDescription: 'ช่วยเก็บรายละเอียดปัญหา สรุปข้อมูล และบันทึกใบงานสำหรับทีม IT'
};

const publicNavItems = [
  { path: '/', label: 'แจ้งปัญหา', description: 'รับเรื่องและร่างใบงาน', icon: ClipboardList },
  { path: '/knowledge-chat', label: 'แชท AI', description: 'ถามงานหรืออ่านเอกสาร', icon: BookOpen },
  { path: '/ocr', label: 'OCR Studio', description: 'อ่านข้อความและ export', icon: FileText }
];
const routeItems = [
  ...publicNavItems,
  { path: '/admin', label: 'จัดการคลังความรู้', description: 'เพิ่มเอกสารให้ AI อ้างอิง', icon: Archive }
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
  if (file.ocrStatus === 'readable' || file.ocrOk) return 'เก็บไฟล์แล้ว · OCR อ่านได้';
  if (file.ocrStatus === 'unreadable' || file.ocrError) return 'เก็บไฟล์แล้ว · OCR อ่านไม่ได้';
  if (file.ocrStatus === 'not-supported') return 'เก็บไฟล์แล้ว · ไม่ต้อง OCR';
  return 'เก็บไฟล์แล้ว';
}
function attachmentStatusTone(file = {}) {
  if (file.ocrStatus === 'readable' || file.ocrOk) return 'ok';
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
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function exportOcrRowsToExcel(rows) {
  const htmlRows = rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.size)}</td><td>${escapeHtml(row.text)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>File</th><th>Status</th><th>Size</th><th>OCR Text</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
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
  const defaultEnglishTagline = 'AI-assisted ticket intake for internal support teams';
  const brandTagline = config.appTagline === defaultEnglishTagline ? defaultConfig.appTagline : config.appTagline;
  return <main className="app-shell">
    <aside className="side-nav">
      <div className="brand-block">
        <div className="brand-mark"><ClipboardList size={18} /></div>
        <div>
          <strong>{config.appName}</strong>
          <span>{brandTagline}</span>
        </div>
      </div>
      <nav className="nav-list">
        {publicNavItems.map((item) => {
          const Icon = item.icon;
          const activeItem = item.path === active.path;
          return <button key={item.path} className={cn('nav-item', activeItem && 'active')} onClick={() => navigate(item.path)}>
            <Icon size={17} />
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
          </button>;
        })}
      </nav>
      <div className="nav-foot">
        <span>ทำงานบนเครื่อง</span>
        <small>ข้อมูลอยู่ในเครื่องก่อน และส่ง webhook ได้เมื่อพร้อม</small>
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
function ChatBubble({ item }) {
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
  return <motion.div className={cn('message-row', isUser && 'from-user')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    {!isUser ? <div className="avatar muted"><Bot size={15} /></div> : null}
    <div className={cn('bubble', isUser ? 'bubble-user' : 'bubble-agent')}>
      {!isUser && visibleText ? <button className="bubble-copy" onClick={copyText} title="คัดลอกคำตอบ">{copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button> : null}
      {visibleText ? <MarkdownMessage>{visibleText}</MarkdownMessage> : null}
      {item.attachments?.length ? <div className="bubble-attachments">{item.attachments.map((file) => <span key={file.id || file.name}><Paperclip size={13} />{file.name}<small>{attachmentStatusLabel(file)}</small></span>)}</div> : null}
    </div>
    {isUser ? <div className="avatar"><User size={15} /></div> : null}
  </motion.div>;
}
function ChatComposer({ value, onChange, onSend, disabled, placeholder, helper, compact = false, onFiles, attachments = [], uploading = false }) {
  return <div className="composer-wrap">
    <div className={cn('composer', compact && 'compact')}>
      {attachments.length ? <div className="attachment-strip">{attachments.map((item) => <span key={item.id || item.name} className={cn('attachment-chip', `attachment-${attachmentStatusTone(item)}`)}><Paperclip size={13} />{item.name}<small>{attachmentStatusLabel(item)}</small></span>)}</div> : null}
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSend();
        }
      }} />
      <div className="composer-row">
        <span>{uploading ? 'กำลังแนบไฟล์...' : helper}</span>
        <div className="composer-actions">
          {onFiles ? <label className="attach-btn" title="แนบไฟล์"><Paperclip size={16} /><span className="attach-text">แนบไฟล์</span><input type="file" multiple onChange={(event) => onFiles(event.target.files)} /></label> : null}
          <Button onClick={onSend} disabled={disabled}><Send size={16} />ส่งข้อความ</Button>
        </div>
      </div>
    </div>
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
  if (ticket['ระดับความเร่งด่วน']) rows.push(`- ความเร่งด่วน: ${ticket['ระดับความเร่งด่วน']}`);
  if (!rows.length) return '';
  const missing = missingFields.length ? `\n\nข้อมูลที่อาจถามเพิ่ม:\n${missingFields.map((item) => `- ${item}`).join('\n')}` : '';
  const saved = isSaved ? `\n\nสถานะ: ${saveStatus || 'บันทึกใบงานแล้ว'}` : '';
  return `สรุปข้อมูล\n${rows.join('\n')}${saved}${missing}`;
}
function nextMissingLabel(ticket, missingFields) {
  if (ticket['ปัญหา'] && !ticket.location) return 'สถานที่หรือบริเวณที่เกิดปัญหา';
  if (ticket['ปัญหา'] && !ticket.contact) return 'เบอร์ติดต่อกลับ';
  return missingFields?.[0] || 'ข้อมูลเพิ่มเติมถ้ามี';
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
        <div><h2>สรุปข้อมูล</h2><p>ตรวจและแก้ไขก่อนบันทึกใบงาน</p></div>
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
        <div className="attachment-list">{attachments.map((file) => <div key={file.id || file.name} className={cn('attachment-row', `attachment-${attachmentStatusTone(file)}`)}>
          <Paperclip size={15} />
          <div><strong>{file.name}</strong><small>{attachmentStatusLabel(file)}{file.size ? ` · ${formatBytes(file.size)}` : ''}</small></div>
        </div>)}</div>
      </div> : null}
      <SelectField label="ระดับความเร่งด่วน" value={ticket['ระดับความเร่งด่วน']} onChange={(value) => update('ระดับความเร่งด่วน', value)} options={urgencyOptions} />
      {missingFields.length ? <div className="soft-note"><strong>ข้อมูลที่อาจถามเพิ่ม</strong><span>{missingFields.join(', ')}</span></div> : null}
      {saveStatus ? <div className={cn('save-note', saveState)}>{saveStatus}</div> : null}
      <Button className="wide" disabled={!ticket['ปัญหา'] || isSaving || saveState === 'saved'} onClick={saveTicket}>{isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}{saveState === 'saved' ? 'บันทึกแล้ว' : 'บันทึกใบงาน'}</Button>
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
  const examples = ['เครื่องปริ้นพิมพ์ไม่ได้', 'Wi-Fi ใช้งานไม่ได้', 'คอมเปิดไม่ติด', 'กล้องดูไม่ได้', 'เข้าอีเมลไม่ได้'];
  const summary = useMemo(() => buildChatSummary(ticket, missingFields, saveState === 'saved', saveStatus), [ticket, missingFields, saveState, saveStatus]);

  async function submitTicketMessage(rawText, options = {}) {
    const userText = String(rawText || '').trim();
    if (!userText || isThinking) return;
    const visibleMessages = [...messages, { role: 'user', content: userText, displayContent: userText }];
    const nextMessages = [...visibleMessages.map(({ role, content }) => ({ role, content }))];
    setMessages(visibleMessages);
    setInput('');
    setIsThinking(true);
    setMode('thinking');
    setSaveStatus('');
    setSaveState('idle');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'chat failed');
      const reply = data.agentReply || 'รับทราบครับ ขอข้อมูลเพิ่มเติมอีกนิดครับ';
      const sourceNote = data.ragContext?.items?.length ? `\n\nข้อมูลอ้างอิงที่ใช้:\n${data.ragContext.items.map((item) => `- ${item.title || item.path}`).join('\n')}` : '';
      setMessages([...visibleMessages, { role: 'assistant', content: `${reply}${sourceNote}` }]);
      setTicket((current) => ({ ...current, ...(data.ticket || {}) }));
      setMode(data.mode || 'done');
      setMissingFields(data.missingFields || []);
      setLastAgentReply(reply);
      if (options.openDraft) {
        setHandoffNotice('ร่างใบงานจากแชท AI แล้ว แต่ยังไม่ได้บันทึกเป็น ticket จริง จนกว่าจะกด “บันทึกใบงาน”');
        setSheetOpen(true);
      }
    } catch (error) {
      setMode('error');
      setMessages([...visibleMessages, { role: 'assistant', content: `เกิดข้อผิดพลาดครับ: ${error.message}` }]);
    } finally {
      setIsThinking(false);
    }
  }
  async function sendMessage() {
    await submitTicketMessage(input);
  }
  useEffect(() => {
    const raw = sessionStorage.getItem('ticket-handoff');
    if (!raw) return;
    sessionStorage.removeItem('ticket-handoff');
    try {
      const handoff = JSON.parse(raw);
      setMessages([{ role: 'assistant', content: 'ผมย้ายมาหน้าแจ้งปัญหาให้แล้วครับ กำลังร่างใบงานจากข้อมูลที่คุณส่งมา' }]);
      setHandoffNotice('กำลังนำข้อมูลจากแชท AI มาร่างใบงาน ยังไม่ได้บันทึกเป็น ticket จริง');
      setTimeout(() => submitTicketMessage(handoff.text || '', { openDraft: true }), 50);
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
          attachments: [],
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
        setMessages((current) => [...current, { role: 'assistant', content: `ทางทีม IT ได้ข้อมูลครบถ้วนแล้วครับ จะเปิดใบงานและติดต่อกลับอีกครั้ง${ticketId ? `\n\nTicket ID: ${ticketId}` : ''}\n\n${buildChatSummary(ticket, [], true, okText)}\n\nหากมีข้อมูลเพิ่มเติม แจ้งเพิ่มได้เลยครับ` }]);
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
  }

  return <div className="page chat-page">
    <PageTop
      title="แจ้งปัญหา IT"
      description="พิมพ์อาการสั้นๆ ได้เลย ระบบจะถามต่อเท่าที่จำเป็น แล้วช่วยร่างใบงานให้ทีม IT"
      actions={<><StatusPill tone={mode === 'error' ? 'danger' : mode === 'thinking' ? 'info' : 'ok'}>{friendlyStatus(mode)}</StatusPill><Button variant="secondary" onClick={resetChat}><RefreshCcw size={16} />เปิดเคสใหม่</Button></>}
    />
    {!messages.length ? <WorkflowStrip items={[
      { title: 'แจ้งอาการ', detail: 'บอกระบบ/อุปกรณ์และจุดที่มีปัญหา', icon: MessageSquare },
      { title: 'ถามต่อเท่าที่จำเป็น', detail: 'AI เก็บสถานที่ ผลกระทบ และช่องทางติดต่อ', icon: Bot },
      { title: 'ตรวจร่างใบงาน', detail: 'แก้ไขก่อนกดบันทึกเพื่อรับ Ticket ID', icon: ClipboardList }
    ]} /> : null}
    {handoffNotice ? <div className="handoff-banner"><strong>ร่างใบงาน</strong><span>{handoffNotice}</span><Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>ดูร่างใบงาน</Button></div> : null}
    <section className="chat-canvas">
      <div className="chat-stream">
        {messages.length ? messages.map((item, index) => <ChatBubble key={`${item.role}-${index}`} item={item} />) : <EmptyState icon={ClipboardList} title="เริ่มจากอาการที่พบ" description="ตัวอย่าง: เครื่องปริ้นพิมพ์ไม่ได้, Wi‑Fi ใช้งานไม่ได้, คอมเปิดไม่ติด หรือกล้องดูไม่ได้">
          <div className="hint-grid">
            {['อุปกรณ์/ระบบที่มีปัญหา', 'สถานที่หรือจุดติดตั้ง', 'อาการที่พบ', 'ผลกระทบ', 'เวลาเริ่มเกิดปัญหา'].map((item) => <span key={item}><CheckCircle2 size={14} />{item}</span>)}
          </div>
          <div className="chip-row">{examples.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div>
        </EmptyState>}
        {isThinking ? <div className="thinking"><Loader2 className="spin" size={15} />กำลังอ่านข้อมูลและเตรียมคำถามถัดไป...</div> : null}
      </div>
      {summary ? <motion.button className="summary-bar" onClick={() => setSheetOpen(true)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <span><strong>สรุปข้อมูล</strong><small>{ticket['ปัญหา'] || `ควรถามเพิ่ม: ${nextMissingLabel(ticket, missingFields)}`}</small></span>
        <ChevronRight size={18} />
      </motion.button> : null}
    </section>
    <ChatComposer value={input} onChange={setInput} onSend={sendMessage} disabled={!input.trim() || isThinking} placeholder="พิมพ์ปัญหาที่ต้องการแจ้ง IT..." helper="แจ้งอาการ สถานที่ ผลกระทบ หรือเบอร์ติดต่อกลับได้เลย" compact />
    <TicketSummarySheet open={sheetOpen} onClose={() => setSheetOpen(false)} ticket={ticket} setTicket={setTicket} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveState={saveState} saveStatus={saveStatus} />
  </div>;
}

function OcrStudioPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('ลาก PDF/รูปภาพ/ไฟล์ข้อความมาวาง หรือกดเลือกไฟล์เพื่อ OCR');
  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const readableItems = items.filter((item) => item.ocrText?.trim());

  function updateItem(id, patch) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  async function processFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file && file.size > 0);
    if (!files.length || busy) return;
    setBusy(true);
    setNotice(`กำลังอ่านข้อความจาก ${files.length} ไฟล์...`);
    const initial = files.map((file) => ({ id: crypto.randomUUID?.() || `${Date.now()}-${file.name}`, name: file.name, size: file.size, type: file.type, status: 'queued', ocrText: '', error: '' }));
    setItems((current) => [...initial, ...current]);
    setSelectedId(initial[0].id);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const id = initial[index].id;
      updateItem(id, { status: 'processing' });
      try {
        const textLike = /\.(txt|md|markdown|csv|json)$/i.test(file.name) || String(file.type || '').startsWith('text/');
        if (textLike) {
          const text = await file.text();
          updateItem(id, { status: 'readable', ocrText: text, attachment: null });
          continue;
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
    updateItem(selected.id, { ocrText: value, status: value.trim() ? 'readable' : selected.status });
  }
  async function copySelected() {
    if (!selected?.ocrText) return;
    try {
      await navigator.clipboard.writeText(selected.ocrText);
    } catch {
      const area = document.createElement('textarea');
      area.value = selected.ocrText;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setNotice(`คัดลอกข้อความจาก ${selected.name} แล้ว`);
  }
  function exportSelectedTxt() {
    if (!selected?.ocrText) return;
    downloadBlob(`${selected.name.replace(/\.[^.]+$/, '') || 'ocr-result'}.txt`, selected.ocrText, 'text/plain;charset=utf-8');
  }
  function exportExcel() {
    const rows = items.map((item) => ({ name: item.name, status: statusText(item), size: formatBytes(item.size), text: item.ocrText || item.error || '' }));
    exportOcrRowsToExcel(rows);
  }
  function sendSelectedToAi() {
    if (!selected?.ocrText) return;
    goToKnowledgeChat({ name: selected.name, ocrText: selected.ocrText });
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
        <div className="ocr-file-list">{items.length ? items.map((item) => <button key={item.id} className={cn('ocr-file', selected?.id === item.id && 'active')} onClick={() => setSelectedId(item.id)}>
          <FileText size={16} />
          <span><strong>{item.name}</strong><small>{statusText(item)} · {formatBytes(item.size)}</small></span>
        </button>) : <EmptyState icon={FileText} title="ยังไม่มีไฟล์" description="เลือกไฟล์เพื่อเริ่ม OCR แล้วผลลัพธ์จะแสดงด้านขวา" />}</div>
      </aside>
      <main className="ocr-result">
        {selected ? <Card className="ocr-editor">
          <div className="sheet-head"><div><h2>{selected.name}</h2><p>{statusText(selected)}{selected.error ? ` · ${selected.error}` : ''}</p></div><StatusPill tone={selected.status === 'readable' ? 'ok' : selected.status === 'processing' ? 'info' : selected.status === 'error' || selected.status === 'unreadable' ? 'warning' : 'neutral'}>{statusText(selected)}</StatusPill></div>
          <textarea value={selected.ocrText || ''} onChange={(event) => setSelectedText(event.target.value)} placeholder="ผล OCR จะแสดงที่นี่ และสามารถแก้ไขก่อน export ได้" />
          <div className="ocr-actions">
            <Button variant="secondary" disabled={!selected.ocrText} onClick={copySelected}><Copy size={16} />Copy</Button>
            <Button variant="secondary" disabled={!selected.ocrText} onClick={exportSelectedTxt}><Download size={16} />TXT</Button>
            <Button variant="secondary" disabled={!selected.ocrText} onClick={sendSelectedToAi}><BookOpen size={16} />ส่งไปแชท AI</Button>
          </div>
        </Card> : <EmptyState icon={FileText} title="เลือกไฟล์เพื่อ OCR" description="ผลลัพธ์จะแสดงเป็นข้อความที่ copy, แก้ไข และ export ได้" />}
      </main>
    </section>
  </div>;
}

function KnowledgeChatPage() {
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
        const response = await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: { name: file.name, type: file.type, base64 } })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'upload failed');
        uploaded.push(data.attachment);
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: `แนบไฟล์ไม่สำเร็จครับ: ${error.message}` }]);
    } finally {
      setUploadingAttachment(false);
    }
  }
  async function sendMessage() {
    const userText = input.trim();
    if ((!userText && !attachments.length) || isThinking) return;
    const content = userText || 'ช่วยอ่านและสรุปไฟล์แนบนี้ให้หน่อยครับ';
    const displayContent = userText || 'ช่วยอ่านและสรุปไฟล์แนบนี้ให้หน่อยครับ';
    const visibleNext = [...messages, { role: 'user', content, displayContent, attachments }];
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
        body: JSON.stringify({ messages: next, attachments, detailed: detailedMode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'request failed');
      setMessages([...visibleNext, { role: 'assistant', content: data.answer }]);
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
    goToTicketIntake({ text: `ช่วยร่างใบงานจากบทสนทนาแชท AI นี้\n\n${transcript}` });
  }

  return <div className="page knowledge-page">
    <PageTop
      title="แชท AI"
      description="ถามงานทั่วไป สรุปเอกสาร หรือใช้เป็นพื้นที่คิดก่อนส่งต่อเป็นใบงาน"
      actions={<><label className="detail-toggle"><input type="checkbox" checked={detailedMode} onChange={(event) => setDetailedMode(event.target.checked)} />ตอบละเอียดขึ้น</label><StatusPill tone={mode === 'error' ? 'danger' : mode === 'thinking' ? 'info' : 'ok'}>{status}</StatusPill><Button variant="secondary" onClick={() => setSourceOpen(true)}><BookOpen size={16} />แหล่งอ้างอิง ({sources.length})</Button></>}
    />
    {!messages.length ? <WorkflowStrip items={[
      { title: 'ถามหรือแนบไฟล์', detail: 'คุยทั่วไป อธิบายงาน หรือสรุปเอกสาร', icon: MessageSquare },
      { title: 'อ้างอิงเมื่อมีข้อมูล', detail: 'ถ้ามีเอกสารในคลัง ระบบจะแสดงแหล่งอ้างอิง', icon: BookOpen },
      { title: 'ส่งต่อเป็นใบงาน', detail: 'เปิดใบงานจากบทสนทนาได้เมื่อเป็นเรื่องที่ต้องให้ IT ทำต่อ', icon: ClipboardList }
    ]} /> : null}
    <section className="knowledge-layout">
      <div className="chat-canvas flat">
        <div className="chat-stream">
          {messages.length ? messages.map((item, index) => <ChatBubble key={`${item.role}-${index}`} item={item} />) : <EmptyState icon={BookOpen} title="คุยกับ AI หรือแนบไฟล์ให้อ่าน" description="ถามทั่วไปได้เหมือน chatbot ปกติ และถ้ามีไฟล์แนบหรือเอกสารในคลัง ระบบจะใช้อ้างอิงให้">
            <div className="chip-row">{prompts.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div>
          </EmptyState>}
          {isThinking ? <ProcessingCard detailed={detailedMode} step={processStep} /> : null}
          {messages.length && !isThinking ? <ChatBridgeBar onOpenTicket={openTicketFromConversation} /> : null}
        </div>
      </div>
      <SourcePanel open={sourceOpen} onClose={() => setSourceOpen(false)} sources={sources} />
    </section>
    <ChatComposer value={input} onChange={setInput} onSend={sendMessage} disabled={(!input.trim() && !attachments.length) || isThinking || uploadingAttachment} placeholder="ถามอะไรก็ได้ หรือแนบไฟล์เพื่อให้ช่วยอ่าน..." helper="คุยทั่วไปได้ ถ้าต้องการเปิดใบงานให้พิมพ์ว่าเปิด ticket หรือไปหน้าแจ้งปัญหา" compact onFiles={uploadKnowledgeFiles} attachments={attachments} uploading={uploadingAttachment} />
  </div>;
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
  const [adminTab, setAdminTab] = useState('knowledge');

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
  const page = path === '/knowledge-chat' ? <KnowledgeChatPage /> : path === '/ocr' ? <OcrStudioPage /> : path === '/admin' ? <DocumentLibraryPage /> : <TicketIntakePage config={config} />;
  return <AppShell config={config} path={path} navigate={navigate}>{page}</AppShell>;
}

createRoot(document.getElementById('root')).render(<App />);
