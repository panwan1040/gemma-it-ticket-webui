import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  Loader2,
  Menu,
  Plus,
  RefreshCcw,
  Save,
  Send,
  User,
  WifiOff,
  X
} from 'lucide-react';
import './styles.css';

const defaultConfig = {
  appName: 'Local AI Helpdesk',
  appTagline: 'AI-assisted ticket intake for internal support teams',
  appDescription: 'Collect issue details, draft tickets, and save them to your support workflow.'
};

const urgencyOptions = ['Low', 'Medium', 'High', 'Critical'];
const ticketFields = ['ประเภท', 'ปัญหา', 'ผลกระทบ', 'ข้อมูลที่ได้รับ', 'ระดับความเร่งด่วน', 'ทีมที่เกี่ยวข้อง'];
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

const modeLabels = {
  'local-gemma': 'AI พร้อมใช้งาน',
  'fallback-rules': 'โหมดสำรอง',
  thinking: 'กำลังประมวลผล',
  error: 'เกิดข้อผิดพลาด',
  ready: 'พร้อมรับเรื่อง',
  done: 'AI พร้อมใช้งาน'
};

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function modeLabel(mode) {
  return modeLabels[mode] || mode || 'พร้อมรับเรื่อง';
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
  };
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2', variants[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

function StatusBadge({ children, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-600',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700'
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', tones[tone])}>{Icon ? <Icon size={13} /> : null}{children}</span>;
}

function Card({ children, className = '' }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input type={type} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100" value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onChange, minHeight = 'min-h-24' }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <textarea className={cn('w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100', minHeight)} value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100" value={value || ''} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ReadinessChecklist({ ticket, missingFields }) {
  const checks = [
    ['มีประเภทงาน', Boolean(ticket['ประเภท'])],
    ['มีสรุปปัญหา', Boolean(ticket['ปัญหา'])],
    ['มีผลกระทบ', Boolean(ticket['ผลกระทบ'])],
    ['มีข้อมูลสำหรับเริ่มตรวจสอบ', Boolean(ticket['ข้อมูลที่ได้รับ'])],
    ['ระบุความเร่งด่วนแล้ว', Boolean(ticket['ระดับความเร่งด่วน'])],
    ['ระบุทีมที่เกี่ยวข้องแล้ว', Boolean(ticket['ทีมที่เกี่ยวข้อง'])]
  ];
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-slate-950">ความพร้อมของร่างใบงาน</div>
      <div className="mt-3 space-y-2">
        {checks.map(([label, done]) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            {done ? <CheckCircle2 className="text-emerald-600" size={16} /> : <AlertCircle className="text-amber-500" size={16} />}
            <span className={done ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="text-xs font-medium text-slate-500">ข้อมูลที่ควรถามเพิ่ม</div>
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
          {(missingFields.length ? missingFields : ['ข้อมูลครบพอสำหรับส่งต่อทีม support แล้ว']).map((item) => <li key={item} className="flex gap-2"><ChevronRight className="mt-1 text-slate-300" size={14} />{item}</li>)}
        </ul>
      </div>
    </Card>
  );
}

function SystemStatusStrip({ mode, knowledgeCount, sheetEnabled, saveState }) {
  const modeTone = mode === 'fallback-rules' ? 'warn' : mode === 'error' ? 'error' : mode === 'thinking' ? 'info' : 'ok';
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
      <StatusBadge tone={modeTone} icon={mode === 'fallback-rules' ? WifiOff : CheckCircle2}>{modeLabel(mode)}</StatusBadge>
      <StatusBadge tone={knowledgeCount ? 'ok' : 'neutral'} icon={BookOpen}>{knowledgeCount || 0} เอกสารในคลังความรู้</StatusBadge>
      <StatusBadge tone={sheetEnabled ? 'ok' : 'warn'} icon={Database}>{sheetEnabled ? 'Webhook พร้อมใช้งาน' : 'ยังไม่ตั้งค่า webhook'}</StatusBadge>
      {saveState === 'saved' ? <StatusBadge tone="ok" icon={Save}>บันทึกแล้ว</StatusBadge> : null}
      {saveState === 'webhookFailed' ? <StatusBadge tone="warn" icon={AlertCircle}>บันทึกในเครื่องแล้ว webhook ไม่สำเร็จ</StatusBadge> : null}
    </div>
  );
}

function Sidebar({ config, resetChat, mode, knowledgeCount, models = [], selectedModel, selectModel, sheetEnabled }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-4 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white"><ClipboardList size={18} /></div>
        <div>
          <div className="text-sm font-semibold text-slate-950">{config.appName}</div>
          <div className="text-xs text-slate-500">{config.appTagline}</div>
        </div>
      </div>

      <Button className="mt-5 w-full" onClick={resetChat}><Plus size={16} /> เปิดเคสใหม่</Button>

      <nav className="mt-5 space-y-1">
        <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-950"><ClipboardList size={16} /> รับแจ้งปัญหา</div>
        <a href="/knowledge-chat" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950"><BookOpen size={16} /> ถามคลังความรู้</a>
        <a href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950"><FileText size={16} /> จัดการเอกสาร</a>
      </nav>

      <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">สถานะระบบ</span><StatusBadge tone={mode === 'fallback-rules' ? 'warn' : mode === 'error' ? 'error' : 'ok'}>{modeLabel(mode)}</StatusBadge></div>
        <div className="mt-4 grid gap-2 text-xs text-slate-600">
          <div className="rounded-lg bg-white p-3 shadow-sm"><span className="font-semibold text-slate-950">{knowledgeCount || 0}</span> เอกสารในคลังความรู้</div>
          <div className="rounded-lg bg-white p-3 shadow-sm">{sheetEnabled ? 'Webhook พร้อมใช้งาน' : 'ยังไม่ตั้งค่า webhook'}</div>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">โมเดล</span>
          <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none" value={selectedModel || ''} onChange={(event) => selectModel(event.target.value)}>
            {models.map((model) => <option key={model.id} value={model.id}>{model.exists ? 'พร้อม' : 'ยังไม่มี'} · {model.label}</option>)}
          </select>
        </label>
      </div>
    </aside>
  );
}

function ChatBubble({ item }) {
  const isUser = item.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Bot size={16} /></div>}
      <div className={cn('max-w-[88%] rounded-xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[76%]', isUser ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-800')}><p className="whitespace-pre-wrap">{item.content}</p></div>
      {isUser && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600"><User size={16} /></div>}
    </motion.div>
  );
}

function IntakeGuide({ setInput }) {
  const chips = ['เครื่องปริ้นพิมพ์ไม่ได้', 'Wi-Fi ใช้งานไม่ได้', 'คอมเปิดไม่ติด', 'กล้องดูไม่ได้', 'เข้าอีเมลไม่ได้'];
  const info = ['อุปกรณ์/ระบบที่มีปัญหา', 'สถานที่หรือจุดติดตั้ง', 'อาการที่พบ', 'ผลกระทบ', 'เวลาเริ่มเกิดปัญหา', 'รูปภาพหรือ error ถ้ามี'];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-2xl">
      <Card className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"><ClipboardList size={21} /></div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-950">แจ้งปัญหาเพื่อสร้างใบงาน support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{defaultConfig.appDescription} เริ่มจากบอกปัญหาสั้นๆ แล้วระบบจะช่วยถามข้อมูลที่จำเป็นต่อไป</p>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {info.map((item) => <div key={item} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><CheckCircle2 className="text-slate-400" size={15} />{item}</div>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((chip) => <button key={chip} onClick={() => setInput(chip)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">{chip}</button>)}
        </div>
      </Card>
    </motion.div>
  );
}

function buildChatSummary(ticket, missingFields, isSaved, saveStatus) {
  const lines = [];
  if (ticket['ปัญหา']) lines.push(`- ปัญหา: ${ticket['ปัญหา']}`);
  if (ticket.assetName) lines.push(`- อุปกรณ์/ระบบ: ${ticket.assetName}`);
  if (ticket.location) lines.push(`- สถานที่: ${ticket.location}`);
  if (ticket.department) lines.push(`- แผนก: ${ticket.department}`);
  if (ticket.contact) lines.push(`- ติดต่อกลับ: ${ticket.contact}`);
  if (ticket['ผลกระทบ']) lines.push(`- ผลกระทบ: ${ticket['ผลกระทบ']}`);
  if (ticket['ระดับความเร่งด่วน']) lines.push(`- ความเร่งด่วน: ${ticket['ระดับความเร่งด่วน']}`);
  if (!lines.length) return '';
  const status = isSaved ? `\n\nสถานะ: ${saveStatus || 'บันทึกใบงานแล้ว'}` : '';
  const missing = missingFields?.length ? `\n\nข้อมูลที่อาจถามเพิ่ม:\n${missingFields.map((item) => `- ${item}`).join('\n')}` : '';
  return `สรุปร่างใบงาน\n${lines.join('\n')}${status}${missing}`;
}

function ChatPane({ config, messages, input, setInput, sendMessage, isThinking, resetChat, mode, openMobileDraft }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-base font-semibold text-slate-950">{config.appName}</h1>
          <p className="text-xs text-slate-500">{config.appDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="2xl:hidden" onClick={openMobileDraft}><Menu size={16} /> ร่างใบงาน</Button>
          <Button variant="ghost" className="h-10 w-10 px-0" onClick={resetChat} aria-label="เปิดเคสใหม่"><RefreshCcw size={16} /></Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <AnimatePresence>
            {messages.length ? messages.map((item, index) => <ChatBubble key={`${index}-${item.role}`} item={item} />) : <IntakeGuide setInput={setInput} />}
          </AnimatePresence>
          {isThinking && <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm"><Loader2 className="spin text-slate-700" size={14} /> กำลังประมวลผลและค้นข้อมูลอ้างอิง...</div>}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-5">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-100">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} className="min-h-24 w-full resize-none border-0 bg-transparent text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400" placeholder="พิมพ์รายละเอียดปัญหา หรือข้อมูลเพิ่มเติม..." />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">หน้านี้ใช้สร้างใบงาน support หากต้องการถามเอกสารให้ไปหน้า “ถามคลังความรู้”</p>
            <Button onClick={sendMessage} disabled={!input.trim() || isThinking}>{isThinking ? <Loader2 className="spin" size={16} /> : <Send size={16} />} ส่งข้อความ</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketFields({ ticket, setTicket }) {
  const update = (field, value) => setTicket((current) => ({ ...current, [field]: value }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {optionalFields.map(([field, label]) => <Field key={field} label={label} value={ticket[field]} onChange={(value) => update(field, value)} />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ประเภท" value={ticket['ประเภท']} onChange={(value) => update('ประเภท', value)} />
        <Field label="ทีมที่เกี่ยวข้อง" value={ticket['ทีมที่เกี่ยวข้อง']} onChange={(value) => update('ทีมที่เกี่ยวข้อง', value)} />
      </div>
      <Field label="ปัญหา" value={ticket['ปัญหา']} onChange={(value) => update('ปัญหา', value)} />
      <TextAreaField label="ผลกระทบ" value={ticket['ผลกระทบ']} onChange={(value) => update('ผลกระทบ', value)} />
      <TextAreaField label="ข้อมูลที่ได้รับ" value={ticket['ข้อมูลที่ได้รับ']} onChange={(value) => update('ข้อมูลที่ได้รับ', value)} minHeight="min-h-32" />
      <SelectField label="ระดับความเร่งด่วน" value={ticket['ระดับความเร่งด่วน']} onChange={(value) => update('ระดับความเร่งด่วน', value)} options={urgencyOptions} />
    </div>
  );
}

function ReferenceCard({ ragContext }) {
  const items = ragContext?.items || [];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><BookOpen size={16} className="text-slate-500" /> ข้อมูลอ้างอิงที่ใช้</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.path} className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-900">{item.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{item.snippet}</div>
          </div>
        )) : <p className="text-sm text-slate-500">ยังไม่มีข้อมูลอ้างอิงจากคลังความรู้</p>}
      </div>
    </Card>
  );
}

function SaveResult({ saveStatus, saveState, retrySave }) {
  if (!saveStatus) return <p className="text-center text-sm leading-6 text-slate-500">กดบันทึกเมื่อข้อมูลครบพอ ระบบจะบันทึก local log และส่ง webhook ถ้าตั้งค่าไว้</p>;
  return (
    <div className={cn('rounded-lg border p-3 text-sm leading-6', saveState === 'webhookFailed' ? 'border-amber-200 bg-amber-50 text-amber-800' : saveState === 'saved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700')}>
      <div>{saveStatus}</div>
      {saveState === 'webhookFailed' ? <Button variant="secondary" className="mt-2" onClick={retrySave}>ลองส่ง webhook อีกครั้ง</Button> : null}
    </div>
  );
}

function TicketDraftPanel({ ticket, setTicket, missingFields, saveTicket, isSaving, saveStatus, saveState, ragContext, retrySave }) {
  return (
    <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white 2xl:block">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-950">ร่างใบงาน</h2>
        <p className="text-xs text-slate-500">ตรวจแก้ก่อนบันทึกใบงานได้</p>
      </div>
      <div className="space-y-5 p-5">
        <ReadinessChecklist ticket={ticket} missingFields={missingFields} />
        <TicketFields ticket={ticket} setTicket={setTicket} />
        <ReferenceCard ragContext={ragContext} />
        <Button className="w-full" onClick={saveTicket} disabled={!ticket['ปัญหา'] || isSaving || saveState === 'saved'}>{isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} {saveState === 'saved' ? 'บันทึกแล้ว' : 'บันทึกใบงาน'}</Button>
        <SaveResult saveStatus={saveStatus} saveState={saveState} retrySave={retrySave} />
      </div>
    </aside>
  );
}

function MobileTicketDrawer({ open, onClose, ticket, setTicket, missingFields, saveTicket, isSaving, saveStatus, saveState, retrySave, ragContext }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 2xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-slate-950/35" onClick={onClose} aria-label="ปิดร่างใบงาน" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-base font-semibold text-slate-950">ร่างใบงาน</h2><p className="text-xs text-slate-500">ดูและแก้ไขบนมือถือได้ก่อนบันทึก</p></div>
              <Button variant="ghost" className="h-10 w-10 px-0" onClick={onClose}><X size={18} /></Button>
            </div>
            <div className="space-y-5">
              <ReadinessChecklist ticket={ticket} missingFields={missingFields} />
              <TicketFields ticket={ticket} setTicket={setTicket} />
              <ReferenceCard ragContext={ragContext} />
              <Button className="w-full" onClick={saveTicket} disabled={!ticket['ปัญหา'] || isSaving || saveState === 'saved'}>{isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} {saveState === 'saved' ? 'บันทึกแล้ว' : 'บันทึกใบงาน'}</Button>
              <SaveResult saveStatus={saveStatus} saveState={saveState} retrySave={retrySave} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [messages, setMessages] = useState([]);
  const [ticket, setTicket] = useState(emptyTicket);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ready');
  const [missingFields, setMissingFields] = useState(['ยังไม่มีบทสนทนา']);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [lastAgentReply, setLastAgentReply] = useState('');
  const [ragContext, setRagContext] = useState({ items: [], count: 0 });
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [sheetEnabled, setSheetEnabled] = useState(false);
  const [mobileDraftOpen, setMobileDraftOpen] = useState(false);

  const knowledgeCount = useMemo(() => ragContext.count || 0, [ragContext]);
  const chatSummary = useMemo(() => buildChatSummary(ticket, missingFields, saveState === 'saved', saveStatus), [ticket, missingFields, saveState, saveStatus]);

  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig({ ...defaultConfig, ...data });
    } catch {}
  }

  async function loadHealth() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setSheetEnabled(Boolean(data.sheetEnabled));
    } catch {}
  }

  async function loadModels() {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      setModels(data.models || []);
      setSelectedModel(data.selected || '');
    } catch {}
  }

  async function selectModel(model) {
    setSelectedModel(model);
    await fetch('/api/models/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
    await loadModels();
  }

  useEffect(() => { loadConfig(); loadHealth(); loadModels(); }, []);

  async function sendMessage() {
    const content = input.trim();
    if (!content || isThinking) return;
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);
    setSaveStatus('');
    setSaveState('idle');
    setMode('thinking');

    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: nextMessages }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'chat failed');
      const reply = data.agentReply || 'รับทราบครับ';
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      setTicket((current) => ({ ...current, ...(data.ticket || {}) }));
      setMode(data.mode || 'done');
      setMissingFields(data.missingFields || []);
      setLastAgentReply(reply);
      setRagContext(data.ragContext || { items: [], count: 0 });
    } catch (error) {
      setMode('error');
      setMessages([...nextMessages, { role: 'assistant', content: `เกิดข้อผิดพลาด: ${error.message}` }]);
    } finally {
      setIsThinking(false);
    }
  }

  async function saveTicket() {
    setIsSaving(true);
    setSaveStatus('กำลังบันทึกใบงาน...');
    setSaveState('saving');
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceMessage: messages.filter((item) => item.role === 'user').map((item) => item.content).join('\n'), agentReply: lastAgentReply, transcript: messages, ticket })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'save failed');
      if (data.sheetEnabled && !data.webhookOk) {
        setSaveState('webhookFailed');
        setSaveStatus('บันทึกในเครื่องแล้ว แต่ส่ง webhook ไม่สำเร็จ');
        setMessages((current) => [...current, { role: 'assistant', content: `บันทึกในเครื่องแล้ว แต่ส่ง webhook ไม่สำเร็จครับ\n\n${buildChatSummary(ticket, [], false, '')}\n\nต้องการให้ลองส่ง webhook อีกครั้งไหมครับ` }]);
      } else {
        setSaveState('saved');
        setSaveStatus(data.sheetEnabled ? 'บันทึกใบงานและส่ง webhook แล้ว' : 'บันทึกใบงานในเครื่องแล้ว');
        setMessages((current) => [...current, { role: 'assistant', content: `ทางทีม IT ได้ข้อมูลครบถ้วนแล้วครับ จะเปิด ticket และติดต่อกลับอีกครั้งครับ\n\n${buildChatSummary(ticket, [], true, data.sheetEnabled ? 'บันทึกใบงานและส่ง webhook แล้ว' : 'บันทึกใบงานในเครื่องแล้ว')}\n\nหากมีข้อมูลเพิ่มเติม แจ้งเพิ่มได้เลยครับ` }]);
      }
      await loadHealth();
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
    setMissingFields(['ยังไม่มีบทสนทนา']);
    setSaveStatus('เปิดเคสใหม่แล้ว');
    setSaveState('idle');
    setLastAgentReply('');
    setRagContext({ items: [], count: 0 });
  }

  return (
    <main className="flex h-screen overflow-hidden bg-slate-50 text-slate-950">
      <Sidebar config={config} resetChat={resetChat} mode={mode} knowledgeCount={knowledgeCount} models={models} selectedModel={selectedModel} selectModel={selectModel} sheetEnabled={sheetEnabled} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SystemStatusStrip mode={mode} knowledgeCount={knowledgeCount} sheetEnabled={sheetEnabled} saveState={saveState} />
        <div className="flex min-h-0 flex-1">
          <ChatPane config={config} messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} isThinking={isThinking} resetChat={resetChat} mode={mode} openMobileDraft={() => setMobileDraftOpen(true)} />
          <TicketDraftPanel ticket={ticket} setTicket={setTicket} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveStatus={saveStatus} saveState={saveState} ragContext={ragContext} retrySave={saveTicket} />
        </div>
        {chatSummary ? (
          <div className="hidden border-t border-slate-200 bg-white px-4 py-3 xl:block 2xl:hidden">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">ร่างใบงานพร้อมดูเพิ่มเติม</div>
                <div className="truncate text-xs text-slate-500">{ticket['ปัญหา'] || 'ยังไม่มีสรุปปัญหา'}</div>
              </div>
              <Button variant="secondary" onClick={() => setMobileDraftOpen(true)}>ดู/แก้ร่างใบงาน</Button>
            </div>
          </div>
        ) : null}
      </div>
      <MobileTicketDrawer open={mobileDraftOpen} onClose={() => setMobileDraftOpen(false)} ticket={ticket} setTicket={setTicket} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveStatus={saveStatus} saveState={saveState} retrySave={saveTicket} ragContext={ragContext} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
