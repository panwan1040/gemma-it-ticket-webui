import React, { Suspense, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, MeshTransmissionMaterial, OrbitControls, Sparkles } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bot, CheckCircle2, DatabaseZap, Loader2, Radar, RefreshCcw, Send, ShieldCheck, Sparkle, User, WifiOff } from 'lucide-react';
import './styles.css';
import { designSystem, fieldLabels } from './lib/design';

const urgencyOptions = ['Low', 'Medium', 'High', 'Critical'];
const emptyTicket = {
  'ประเภท': '',
  'ปัญหา': '',
  'ผลกระทบ': '',
  'ข้อมูลที่ได้รับ': '',
  'ระดับความเร่งด่วน': 'Medium',
  'ทีมที่เกี่ยวข้อง': ''
};

function IncidentCore() {
  const group = useRef();
  const ring = useRef();
  const nodes = useMemo(() => [
    [-1.9, 0.35, 0],
    [-0.9, 1.25, -0.7],
    [0.35, 0.35, 0.5],
    [1.45, 1.1, -0.15],
    [2.05, -0.15, 0.25]
  ], []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.22) * 0.28;
    group.current.rotation.x = Math.cos(t * 0.18) * 0.08;
    ring.current.rotation.z = t * 0.14;
  });

  return (
    <group ref={group}>
      <Float speed={1.25} rotationIntensity={0.55} floatIntensity={0.7}>
        <mesh position={[0, 0.35, 0]}>
          <icosahedronGeometry args={[1.05, 1]} />
          <MeshTransmissionMaterial
            transmission={0.72}
            thickness={0.35}
            roughness={0.22}
            chromaticAberration={0.04}
            color="#c9f7da"
          />
        </mesh>
      </Float>
      <mesh ref={ring} position={[0, 0.35, 0]}>
        <torusGeometry args={[1.55, 0.012, 16, 128]} />
        <meshStandardMaterial color="#78f0b1" emissive="#2f6f4e" emissiveIntensity={1.4} />
      </mesh>
      {nodes.map((point, index) => (
        <Float key={index} speed={1 + index * 0.08} floatIntensity={0.35}>
          <mesh position={point}>
            <sphereGeometry args={[0.08, 24, 24]} />
            <meshStandardMaterial color={index === 2 ? '#d6a04f' : '#78f0b1'} emissive={index === 2 ? '#d6a04f' : '#78f0b1'} emissiveIntensity={1.1} />
          </mesh>
        </Float>
      ))}
      <Line points={nodes} color="#9af7c1" lineWidth={1.2} transparent opacity={0.48} />
      <Sparkles count={55} scale={[5.2, 2.8, 2.5]} size={2.2} speed={0.25} color="#fff4df" />
    </group>
  );
}

function Hero3D() {
  return (
    <div className="hero-stage">
      <Canvas camera={{ position: [0, 0.5, 5.4], fov: 38 }} dpr={[1, 1.6]}>
        <color attach="background" args={['#101714']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff4df" />
        <pointLight position={[-3, 0.5, 2]} intensity={5} color="#78f0b1" />
        <Suspense fallback={null}>
          <IncidentCore />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.35} />
      </Canvas>
      <div className="hero-overlay" />
    </div>
  );
}

function StatusPill({ icon: Icon, label, tone = 'neutral' }) {
  return (
    <span className={`status-pill ${tone}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

function ChatBubble({ item }) {
  const isUser = item.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}
    >
      <div className="bubble-icon">{isUser ? <User size={16} /> : <Bot size={16} />}</div>
      <p>{item.content}</p>
    </motion.div>
  );
}

function FieldControl({ label, value, onChange }) {
  const isLong = ['ผลกระทบ', 'ข้อมูลที่ได้รับ'].includes(label);
  if (label === 'ระดับความเร่งด่วน') {
    return (
      <label className="field-control">
        <span>{label}</span>
        <select value={value || 'Medium'} onChange={(event) => onChange(event.target.value)}>
          {urgencyOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
    );
  }

  return (
    <label className="field-control">
      <span>{label}</span>
      {isLong ? (
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function TicketDraft({ ticket, setTicket, isReady, missingFields, saveTicket, isSaving, saveStatus }) {
  const filled = fieldLabels.filter((field) => ticket[field]).length;
  const completion = Math.round((filled / fieldLabels.length) * 100);

  return (
    <motion.aside className="glass-panel ticket-panel" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}>
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Live draft</span>
          <h2>Ticket Intelligence</h2>
        </div>
        <StatusPill icon={isReady ? CheckCircle2 : AlertTriangle} label={isReady ? 'พร้อมบันทึก' : 'กำลังเก็บข้อมูล'} tone={isReady ? 'ready' : 'warn'} />
      </div>

      <div className="completion-card">
        <div>
          <strong>{completion}%</strong>
          <span>field completion</span>
        </div>
        <div className="completion-track"><span style={{ width: `${completion}%` }} /></div>
      </div>

      <div className="field-grid">
        {fieldLabels.map((label) => (
          <FieldControl
            key={label}
            label={label}
            value={ticket[label]}
            onChange={(value) => setTicket((current) => ({ ...current, [label]: value }))}
          />
        ))}
      </div>

      <div className="missing-card">
        <div className="missing-title"><Radar size={15} /> Context gaps</div>
        <ul>
          {(missingFields.length ? missingFields : ['ยังไม่มีข้อมูลที่ขาด']).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>

      <motion.button className="save-button" onClick={saveTicket} disabled={!ticket['ปัญหา'] || isSaving} whileTap={{ scale: 0.98 }}>
        {isSaving ? <Loader2 className="spin" size={18} /> : <DatabaseZap size={18} />}
        บันทึกลง Google Sheet
      </motion.button>
      <p className="save-status">{saveStatus || 'ตรวจ draft แล้วกดบันทึกเมื่อบริบทครบพอ'}</p>
    </motion.aside>
  );
}

function ChatConsole({ messages, input, setInput, sendMessage, isThinking, resetChat, mode }) {
  return (
    <motion.section className="glass-panel chat-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Conversation capture</span>
          <h2>Support Chat</h2>
        </div>
        <div className="heading-actions">
          <StatusPill icon={mode === 'local-gemma' ? Sparkle : WifiOff} label={mode} tone={mode === 'local-gemma' ? 'ready' : 'warn'} />
          <button className="icon-button" onClick={resetChat} aria-label="เริ่มใหม่"><RefreshCcw size={17} /></button>
        </div>
      </div>

      <div className="chat-stream">
        <AnimatePresence>
          {messages.length ? messages.map((item, index) => <ChatBubble key={`${item.role}-${index}-${item.content}`} item={item} />) : (
            <motion.div className="empty-chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ShieldCheck size={34} />
              <h3>เริ่มจากแจ้งปัญหาสั้นๆ</h3>
              <p>Agent จะถามต่อเฉพาะจุดที่จำเป็น แล้วเติม Ticket draft ให้อัตโนมัติ</p>
            </motion.div>
          )}
        </AnimatePresence>
        {isThinking && <div className="thinking"><Loader2 className="spin" size={16} /> Gemma กำลังอ่านบริบท...</div>}
      </div>

      <div className="composer-card">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
          placeholder="เช่น กล้องหน้าโกดังดูไม่ได้"
        />
        <div className="composer-actions">
          <button className="ghost-button" onClick={() => setInput('กล้องหน้าโกดังดูไม่ได้')}>ใส่ตัวอย่าง</button>
          <motion.button className="send-button" onClick={sendMessage} disabled={!input.trim() || isThinking} whileTap={{ scale: 0.97 }}>
            {isThinking ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            ส่งข้อความ
          </motion.button>
        </div>
      </div>
    </motion.section>
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
  }

  return (
    <main className="app-shell">
      <section className="hero-grid">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <div className="product-chip"><Sparkle size={15} /> Local Gemma E4B QAT Command Desk</div>
          <h1>Premium AI triage for real-world support noise.</h1>
          <p>แชทเก็บบริบท วิเคราะห์ ticket draft และส่งเข้า Google Sheet ด้วย local model บน Apple Silicon ทั้งหมดใน UI เดียว</p>
          <div className="hero-pills">
            <StatusPill icon={ShieldCheck} label="Local-first" tone="ready" />
            <StatusPill icon={DatabaseZap} label="Sheets logging" />
            <StatusPill icon={Radar} label="Context-aware" />
          </div>
        </motion.div>
        <motion.div className="hero-visual" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
          <Hero3D />
          <div className="scene-caption">
            <span>3D incident graph</span>
            <strong>CCTV/NVR context router</strong>
          </div>
        </motion.div>
      </section>

      <section className="design-brief glass-panel">
        <div><span>Visual direction</span><p>{designSystem.visualDirection}</p></div>
        <div><span>Motion</span><p>{designSystem.animationRules}</p></div>
        <div><span>Scene</span><p>{designSystem.sceneComposition}</p></div>
      </section>

      <section className="workbench">
        <ChatConsole messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} isThinking={isThinking} resetChat={resetChat} mode={mode} />
        <TicketDraft ticket={ticket} setTicket={setTicket} isReady={isReady} missingFields={missingFields} saveTicket={saveTicket} isSaving={isSaving} saveStatus={saveStatus} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
