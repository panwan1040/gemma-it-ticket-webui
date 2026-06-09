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
  Database,
  FileText,
  Folder,
  Inbox,
  Loader2,
  Menu,
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
  appTagline: 'AI-assisted ticket intake for internal support teams',
  appDescription: 'Collect issue details, draft tickets, and save them to your support workflow.'
};

const publicNavItems = [
  { path: '/', label: 'แจ้งปัญหา', description: 'รับเรื่องและสร้างใบงาน', icon: ClipboardList },
  { path: '/knowledge-chat', label: 'ถาม/สรุปเอกสาร', description: 'ถามคลังความรู้หรือไฟล์แนบ', icon: BookOpen }
];
const routeItems = [
  ...publicNavItems,
  { path: '/admin', label: 'จัดการคลังความรู้', description: 'เพิ่มเอกสารให้ AI อ้างอิง', icon: Archive }
];

const urgencyOptions = ['Low', 'Medium', 'High', 'Critical'];
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
  'empty-knowledge': 'ยังไม่มีเอกสารในคลัง'
};

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
function friendlyStatus(mode) {
  return statusCopy[mode] || mode || 'พร้อมใช้งาน';
}
function formatBytes(size = 0) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('cannot read file'));
    reader.readAsDataURL(file);
  });
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
  return <main className="app-shell">
    <aside className="side-nav">
      <div className="brand-block">
        <div className="brand-mark"><ClipboardList size={18} /></div>
        <div>
          <strong>{config.appName}</strong>
          <span>{config.appTagline}</span>
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
        <span>Local-first</span>
        <small>ข้อมูลทำงานบนเครื่อง และเชื่อม webhook ได้เมื่อพร้อม</small>
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
  return <motion.div className={cn('message-row', isUser && 'from-user')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    {!isUser ? <div className="avatar muted"><Bot size={15} /></div> : null}
    <div className={cn('bubble', isUser ? 'bubble-user' : 'bubble-agent')}>
      {visibleText ? <MarkdownMessage>{visibleText}</MarkdownMessage> : null}
      {item.attachments?.length ? <div className="bubble-attachments">{item.attachments.map((file) => <span key={file.id || file.name}><Paperclip size={13} />{file.name}</span>)}</div> : null}
    </div>
    {isUser ? <div className="avatar"><User size={15} /></div> : null}
  </motion.div>;
}
function ChatComposer({ value, onChange, onSend, disabled, placeholder, helper, compact = false, onFiles, attachments = [], uploading = false }) {
  return <div className="composer-wrap">
    <div className={cn('composer', compact && 'compact')}>
      {attachments.length ? <div className="attachment-strip">{attachments.map((item) => <span key={item.id || item.name}><Paperclip size={13} />{item.name}{item.ocrOk ? <small>อ่านข้อความแล้ว</small> : null}</span>)}</div> : null}
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSend();
        }
      }} />
      <div className="composer-row">
        <span>{uploading ? 'กำลังแนบไฟล์...' : helper}</span>
        <div className="composer-actions">
          {onFiles ? <label className="attach-btn"><Paperclip size={16} />แนบไฟล์<input type="file" multiple onChange={(event) => onFiles(event.target.files)} /></label> : null}
          <Button onClick={onSend} disabled={disabled}><Send size={16} />ส่งข้อความ</Button>
        </div>
      </div>
    </div>
  </div>;
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

function TicketSummarySheet({ open, onClose, ticket, setTicket, missingFields, saveTicket, isSaving, saveState, saveStatus }) {
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
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const examples = ['เครื่องปริ้นพิมพ์ไม่ได้', 'Wi-Fi ใช้งานไม่ได้', 'คอมเปิดไม่ติด', 'กล้องดูไม่ได้', 'เข้าอีเมลไม่ได้'];
  const summary = useMemo(() => buildChatSummary(ticket, missingFields, saveState === 'saved', saveStatus), [ticket, missingFields, saveState, saveStatus]);

  function attachmentContext() {
    if (!attachments.length) return '';
    return `ไฟล์แนบ:\n${attachments.map((item, index) => `${index + 1}. ${item.name}${item.ocrText ? `\nข้อความ OCR:\n${item.ocrText.slice(0, 2200)}` : `\nบันทึกไฟล์ไว้ที่ ${item.path || item.url || ''}`}`).join('\n\n')}`;
  }
  async function uploadChatFiles(fileList) {
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
    const fileContext = attachmentContext();
    if ((!userText && !fileContext) || isThinking) return;
    const content = [userText, fileContext].filter(Boolean).join('\n\n');
    const displayContent = userText || 'แนบไฟล์ให้ตรวจสอบ';
    const visibleMessages = [...messages, { role: 'user', content: displayContent, displayContent, attachments }];
    const nextMessages = [...messages.map(({ role, content }) => ({ role, content })), { role: 'user', content }];
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
      setMessages([...visibleMessages, { role: 'assistant', content: reply }]);
      setTicket((current) => ({ ...current, ...(data.ticket || {}) }));
      setMode(data.mode || 'done');
      setMissingFields(data.missingFields || []);
      setLastAgentReply(reply);
    } catch (error) {
      setMode('error');
      setMessages([...visibleMessages, { role: 'assistant', content: `เกิดข้อผิดพลาดครับ: ${error.message}` }]);
    } finally {
      setIsThinking(false);
    }
  }
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
          attachments,
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
        const okText = data.sheetEnabled ? 'บันทึกใบงานและส่งต่อเรียบร้อยแล้ว' : 'บันทึกใบงานในเครื่องแล้ว';
        setSaveState('saved');
        setSaveStatus(okText);
        setMessages((current) => [...current, { role: 'assistant', content: `ทางทีม IT ได้ข้อมูลครบถ้วนแล้วครับ จะเปิดใบงานและติดต่อกลับอีกครั้ง\n\n${buildChatSummary(ticket, [], true, okText)}\n\nหากมีข้อมูลเพิ่มเติม แจ้งเพิ่มได้เลยครับ` }]);
        setAttachments([]);
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
    setAttachments([]);
  }

  return <div className="page chat-page">
    <PageTop
      title="แจ้งปัญหา IT"
      description="พิมพ์ปัญหาสั้นๆ ได้เลย ระบบจะช่วยถามต่อทีละข้อจนพอเปิดใบงาน"
      actions={<><StatusPill tone={mode === 'error' ? 'danger' : mode === 'thinking' ? 'info' : 'ok'}>{friendlyStatus(mode)}</StatusPill><Button variant="secondary" onClick={resetChat}><RefreshCcw size={16} />เปิดเคสใหม่</Button></>}
    />
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
    <ChatComposer value={input} onChange={setInput} onSend={sendMessage} disabled={(!input.trim() && !attachments.length) || isThinking || uploadingAttachment} placeholder="พิมพ์ปัญหา หรือแนบรูป/PDF เพิ่มเติม..." helper="กด Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่" compact onFiles={uploadChatFiles} attachments={attachments} uploading={uploadingAttachment} />
    <TicketSummarySheet open={sheetOpen} onClose={() => setSheetOpen(false)} ticket={ticket} setTicket={setTicket} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveState={saveState} saveStatus={saveStatus} />
  </div>;
}

function KnowledgeChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('พร้อมค้นเอกสาร');
  const [mode, setMode] = useState('ready');
  const [sources, setSources] = useState([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  const [processStep, setProcessStep] = useState('พร้อมรับคำถาม');
  const [isThinking, setIsThinking] = useState(false);
  const prompts = ['สรุปขั้นตอนแก้ปัญหา printer', 'มีคู่มือ Wi‑Fi อะไรบ้าง', 'ค้นหา SOP เกี่ยวกับบัญชีผู้ใช้'];

  function attachmentContext() {
    if (!attachments.length) return '';
    return `ไฟล์แนบสำหรับวิเคราะห์:\n${attachments.map((item, index) => `${index + 1}. ${item.name}${item.ocrText ? `\nข้อความจากไฟล์:\n${item.ocrText.slice(0, 5000)}` : `\nระบบบันทึกไฟล์ไว้ที่ ${item.path || item.url || ''} แต่ยังอ่านข้อความจากไฟล์ไม่ได้`}`).join('\n\n')}`;
  }
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
    const fileContext = attachmentContext();
    if ((!userText && !fileContext) || isThinking) return;
    const content = [userText || 'ช่วยอ่านและสรุปไฟล์แนบนี้ให้หน่อยครับ', fileContext].filter(Boolean).join('\n\n');
    const displayContent = userText || 'ช่วยอ่านและสรุปไฟล์แนบนี้ให้หน่อยครับ';
    const visibleNext = [...messages, { role: 'user', content: displayContent, displayContent, attachments }];
    const next = [...messages.map(({ role, content }) => ({ role, content })), { role: 'user', content }];
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
      setStatus(detailedMode ? 'ตอบละเอียดแล้ว' : friendlyStatus(data.mode));
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

  return <div className="page knowledge-page">
    <PageTop
      title="ถามคลังความรู้"
      description="ใช้ถามคลังความรู้ หรือแนบไฟล์เพื่อให้ช่วยอ่าน สรุป และอธิบายเอกสาร ไม่สร้างใบงาน"
      actions={<><label className="detail-toggle"><input type="checkbox" checked={detailedMode} onChange={(event) => setDetailedMode(event.target.checked)} />ตอบละเอียด</label><StatusPill tone={mode === 'error' ? 'danger' : mode === 'thinking' ? 'info' : 'ok'}>{status}</StatusPill><Button variant="secondary" onClick={() => setSourceOpen(true)}><BookOpen size={16} />แหล่งอ้างอิง ({sources.length})</Button></>}
    />
    <section className="knowledge-layout">
      <div className="chat-canvas flat">
        <div className="chat-stream">
          {messages.length ? messages.map((item, index) => <ChatBubble key={`${item.role}-${index}`} item={item} />) : <EmptyState icon={BookOpen} title="ถามจากเอกสาร หรือแนบไฟล์ให้อ่าน" description="ถามเป็นภาษาปกติได้เลย หรือแนบ PDF/รูปภาพเพื่อให้ช่วยสรุปและอธิบายเนื้อหา">
            <div className="chip-row">{prompts.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div>
          </EmptyState>}
          {isThinking ? <ProcessingCard detailed={detailedMode} step={processStep} /> : null}
        </div>
      </div>
      <SourcePanel open={sourceOpen} onClose={() => setSourceOpen(false)} sources={sources} />
    </section>
    <ChatComposer value={input} onChange={setInput} onSend={sendMessage} disabled={(!input.trim() && !attachments.length) || isThinking || uploadingAttachment} placeholder="ถามเกี่ยวกับเอกสาร หรือแนบไฟล์เพื่อให้ช่วยสรุป..." helper="หน้านี้เหมาะกับการอ่าน/สรุปเอกสาร ไม่บันทึกใบงาน" compact onFiles={uploadKnowledgeFiles} attachments={attachments} uploading={uploadingAttachment} />
  </div>;
}
function ProcessingCard({ detailed, step }) {
  const steps = detailed ? ['ค้นเอกสาร', 'ร่างคำตอบ', 'ตรวจทาน', 'เรียบเรียง'] : ['ค้นเอกสาร', 'อ่านบริบท', 'เรียบเรียง'];
  return <motion.div className="processing-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="processing-orbit"><span /><span /><span /></div>
    <div><strong>{step}</strong><p>{detailed ? 'โหมดละเอียดใช้เวลานานขึ้นเล็กน้อย เพราะมีการร่างและตรวจทานคำตอบ' : 'ระบบกำลังประมวลผล กรุณารอสักครู่'}</p><div className="process-steps">{steps.map((item) => <span key={item}>{item}</span>)}</div></div>
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
    <section className="library-wrap">
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
            <span><StatusPill tone="ok">พร้อมใช้งาน</StatusPill></span>
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
    </section>
  </div>;
}

function App() {
  const [path, navigate] = useRoute();
  const [config, setConfig] = useState(defaultConfig);
  useEffect(() => {
    fetch('/api/config').then((res) => res.json()).then((data) => setConfig({ ...defaultConfig, ...data })).catch(() => setConfig(defaultConfig));
  }, []);
  const page = path === '/knowledge-chat' ? <KnowledgeChatPage /> : path === '/admin' ? <DocumentLibraryPage /> : <TicketIntakePage config={config} />;
  return <AppShell config={config} path={path} navigate={navigate}>{page}</AppShell>;
}

createRoot(document.getElementById('root')).render(<App />);
