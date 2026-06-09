import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ClipboardList,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Sparkles,
  User,
  WifiOff
} from 'lucide-react';
import './styles.css';

const urgencyOptions = ['Low', 'Medium', 'High', 'Critical'];
const fieldLabels = ['ประเภท', 'ปัญหา', 'ผลกระทบ', 'ข้อมูลที่ได้รับ', 'ระดับความเร่งด่วน', 'ทีมที่เกี่ยวข้อง'];
const emptyTicket = {
  ประเภท: '',
  ปัญหา: '',
  ผลกระทบ: '',
  ข้อมูลที่ได้รับ: '',
  ระดับความเร่งด่วน: 'Medium',
  ทีมที่เกี่ยวข้อง: ''
};

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-zinc-950 text-white hover:bg-zinc-800 disabled:bg-zinc-300',
    secondary: 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
    ghost: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950'
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2', variants[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

function Pill({ children, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'border-zinc-200 bg-white text-zinc-600',
    active: 'border-brand-100 bg-brand-50 text-brand-700',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700'
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', tones[tone])}>{Icon ? <Icon size={13} /> : null}{children}</span>;
}

function Sidebar({ resetChat, mode, knowledgeCount, models = [], selectedModel, selectModel }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-white p-4 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-950 text-white"><ClipboardList size={17} /></div>
        <div>
          <div className="text-sm font-semibold text-zinc-950">IT Service Desk</div>
          <div className="text-xs text-zinc-500">Create tickets for IT team</div>
        </div>
      </div>

      <Button className="mt-5 w-full" onClick={resetChat}><Plus size={16} /> New ticket chat</Button>

      <nav className="mt-5 space-y-1">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-medium text-zinc-950">
          <ClipboardList size={16} /> แจ้งปัญหา IT
        </div>
        <a href="/knowledge-chat" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700">
          <BookOpen size={16} /> ถามคลังความรู้
        </a>
        <a href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950">
          <FileText size={16} /> จัดการเอกสาร
        </a>
      </nav>

      <div className="mt-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Runtime</span>
          <Pill tone={mode === 'local-gemma' ? 'ok' : mode === 'fallback-rules' ? 'warn' : 'neutral'} icon={mode === 'fallback-rules' ? WifiOff : CheckCircle2}>{mode}</Pill>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">Model</span>
          <select
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none"
            value={selectedModel || ''}
            onChange={(event) => selectModel(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.exists ? '●' : '○'} {model.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-zinc-500">ถ้าเลือกคนละโมเดลกับที่ llama-server เปิดอยู่ ให้ restart ด้วย command ของโมเดลนั้น</p>
        </label>

        <div className="mt-4 space-y-2">
          {models.filter((model) => model.id === selectedModel).map((model) => (
            <div key={model.id} className="rounded-xl bg-white p-3 text-xs shadow-sm">
              <div className="font-semibold text-zinc-950">{model.size} · {model.context}</div>
              <div className="mt-1 break-words text-zinc-500">{model.startCommand}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-white p-3 text-sm shadow-sm">
          <div className="font-semibold text-zinc-950">{knowledgeCount}</div>
          <div className="text-xs text-zinc-500">RAG notes</div>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({ item }) {
  const isUser = item.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Bot size={16} /></div>}
      <div className={cn('max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[74%]', isUser ? 'bg-zinc-950 text-white' : 'border border-zinc-200 bg-white text-zinc-800')}>
        <p className="whitespace-pre-wrap">{item.content}</p>
      </div>
      {isUser && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600"><User size={16} /></div>}
    </motion.div>
  );
}

function ChatPane({ messages, input, setInput, sendMessage, isThinking, resetChat, mode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-blue-50/40">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-blue-100 bg-white px-4 sm:px-6">
        <div>
          <h1 className="text-base font-semibold text-zinc-950">แจ้งปัญหา IT และสร้าง Ticket</h1>
          <p className="text-xs text-zinc-500">หน้านี้ใช้เก็บข้อมูลเคสและบันทึกลง Google Sheet ไม่ใช่แชทถามเอกสารทั่วไป</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={mode === 'local-gemma' ? 'ok' : mode === 'fallback-rules' ? 'warn' : 'neutral'}>{mode}</Pill>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={resetChat}><RefreshCcw size={16} /></Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <AnimatePresence>
            {messages.length ? messages.map((item, index) => <ChatBubble key={`${index}-${item.role}`} item={item} />) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-16 max-w-md text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-950 text-white shadow-sm ring-1 ring-blue-100"><ClipboardList size={22} /></div>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-zinc-950">เริ่มจากแจ้งปัญหาที่ต้องการให้ IT ช่วย</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">เช่น “เครื่องปริ้นชั้น 2 พิมพ์ไม่ได้” แล้ว AI จะถามข้อมูลที่จำเป็นเพื่อสร้าง ticket ให้ทีม IT</p>
                <a href="/knowledge-chat" className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">ถ้าต้องการถามเอกสาร ไป Knowledge Chat</a>
              </motion.div>
            )}
          </AnimatePresence>
          {isThinking && <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-500 shadow-sm"><Loader2 className="spin text-brand-600" size={14} /> Gemma กำลังอ่านบริบทและค้น knowledge...</div>}
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-white p-4 sm:p-5">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-soft focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-50">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            className="min-h-24 w-full resize-none border-0 bg-transparent text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400"
            placeholder="พิมพ์ปัญหาที่ต้องการแจ้ง IT หรือข้อมูลเพิ่มเติม..."
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {['เครื่องปริ้นพิมพ์ไม่ได้', 'คอมเปิดไม่ติด', 'กล้องหน้าโกดังดูไม่ได้'].map((sample) => (
                <button key={sample} onClick={() => setInput(sample)} className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50">{sample}</button>
              ))}
            </div>
            <Button onClick={sendMessage} disabled={!input.trim() || isThinking}>{isThinking ? <Loader2 className="spin" size={16} /> : <Send size={16} />} Send</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketPanel({ ticket, setTicket, isReady, missingFields, saveTicket, isSaving, saveStatus, ragContext }) {
  const completion = Math.round((fieldLabels.filter((field) => ticket[field]).length / fieldLabels.length) * 100);
  const contextItems = ragContext?.items || [];

  return (
    <aside className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-zinc-200 bg-white xl:block">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">Ticket draft</h2>
            <p className="text-xs text-zinc-500">ตรวจแก้ก่อนบันทึกได้</p>
          </div>
          <Pill tone={isReady ? 'ok' : 'warn'}>{isReady ? 'Ready' : 'Collecting'}</Pill>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-zinc-950">{completion}%</div>
              <div className="text-xs text-zinc-500">completion</div>
            </div>
            <DatabaseZap className="text-brand-600" size={22} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200"><motion.div className="h-full bg-brand-600" animate={{ width: `${completion}%` }} /></div>
        </div>

        <div className="space-y-3">
          {fieldLabels.map((field) => (
            <label key={field} className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">{field}</span>
              {field === 'ระดับความเร่งด่วน' ? (
                <select className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-50" value={ticket[field] || 'Medium'} onChange={(event) => setTicket((current) => ({ ...current, [field]: event.target.value }))}>
                  {urgencyOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              ) : ['ผลกระทบ', 'ข้อมูลที่ได้รับ'].includes(field) ? (
                <textarea className="min-h-24 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-50" value={ticket[field] || ''} onChange={(event) => setTicket((current) => ({ ...current, [field]: event.target.value }))} />
              ) : (
                <input className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-50" value={ticket[field] || ''} onChange={(event) => setTicket((current) => ({ ...current, [field]: event.target.value }))} />
              )}
            </label>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><Search size={16} className="text-brand-600" /> Knowledge used</div>
          <div className="mt-3 space-y-2">
            {contextItems.length ? contextItems.map((item) => (
              <div key={item.path} className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs font-semibold text-zinc-900">{item.title}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{item.snippet}</div>
              </div>
            )) : <p className="text-sm text-zinc-500">ยังไม่มี context จาก knowledge vault</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-4">
          <div className="text-sm font-semibold text-zinc-950">ยังขาดอะไร</div>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-500">
            {(missingFields.length ? missingFields : ['ครบพอสำหรับบันทึกแล้ว']).map((item) => <li key={item} className="flex gap-2"><ChevronRight className="mt-1 text-zinc-300" size={14} />{item}</li>)}
          </ul>
        </div>

        <Button className="w-full" onClick={saveTicket} disabled={!ticket['ปัญหา'] || isSaving}>{isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} บันทึกลง Sheet</Button>
        <p className="text-center text-sm leading-6 text-zinc-500">{saveStatus || 'กดบันทึกเมื่อข้อมูลครบพอ'}</p>
      </div>
    </aside>
  );
}

function MobileTicketBar({ ticket, saveTicket, isSaving }) {
  return (
    <div className="border-t border-zinc-200 bg-white p-3 xl:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-950">{ticket['ปัญหา'] || 'ยังไม่มี ticket draft'}</div>
          <div className="text-xs text-zinc-500">{ticket['ประเภท'] || 'รอข้อมูล'}</div>
        </div>
        <Button onClick={saveTicket} disabled={!ticket['ปัญหา'] || isSaving}>{isSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save</Button>
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [ticket, setTicket] = useState(emptyTicket);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ready');
  const [missingFields, setMissingFields] = useState(['ยังไม่มีบทสนทนา']);
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [lastAgentReply, setLastAgentReply] = useState('');
  const [ragContext, setRagContext] = useState({ items: [], count: 0 });
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

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
    await fetch('/api/models/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    });
    await loadModels();
  }

  useEffect(() => { loadModels(); }, []);

  async function sendMessage() {
    const content = input.trim();
    if (!content || isThinking) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);
    setSaveStatus('');
    setMode('thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'chat failed');

      const reply = data.agentReply || 'รับทราบครับ';
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      setTicket({ ...emptyTicket, ...(data.ticket || {}) });
      setMode(data.mode || 'done');
      setMissingFields(data.missingFields || []);
      setIsReady(Boolean(data.isReadyToSave));
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
    setSaveStatus('กำลังส่งข้อมูลเข้า Google Sheet...');
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMessage: messages.filter((item) => item.role === 'user').map((item) => item.content).join('\n'),
          agentReply: lastAgentReply,
          transcript: messages,
          ticket
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'save failed');
      setSaveStatus(data.sheetEnabled ? 'บันทึกลง Google Sheet และ local log แล้ว' : 'บันทึกลง local log แล้ว');
    } catch (error) {
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
    setIsReady(false);
    setSaveStatus('เริ่ม session ใหม่แล้ว');
    setLastAgentReply('');
    setRagContext({ items: [], count: 0 });
  }

  return (
    <main className="flex h-screen overflow-hidden bg-slate-50 text-zinc-950">
      <Sidebar resetChat={resetChat} mode={mode} knowledgeCount={ragContext.count || 0} models={models} selectedModel={selectedModel} selectModel={selectModel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <ChatPane messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} isThinking={isThinking} resetChat={resetChat} mode={mode} />
          <TicketPanel ticket={ticket} setTicket={setTicket} isReady={isReady} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveStatus={saveStatus} ragContext={ragContext} />
        </div>
        <MobileTicketBar ticket={ticket} saveTicket={saveTicket} isSaving={isSaving} />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
