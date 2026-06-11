import { useEffect, useState } from 'react';
import { arrayToText, categories, nullableText, priorities, textToArray } from '../lib/format.js';
import LoadingButton from './LoadingButton.jsx';

const initialDraft = {
  ticket_ready: true,
  title: '',
  category: 'Other',
  priority: 'Medium',
  requester_name: '',
  requester_contact: '',
  location: '',
  affected_device: '',
  affected_system: '',
  problem_summary: '',
  observed_evidence: '',
  error_messages: '',
  ai_suggested_cause: '',
  ai_suggested_next_action: '',
  missing_information_questions: ''
};

export function draftToForm(draft = {}) {
  return {
    ...initialDraft,
    ...draft,
    requester_name: draft.requester_name ?? '',
    requester_contact: draft.requester_contact ?? '',
    location: draft.location ?? '',
    affected_device: draft.affected_device ?? '',
    affected_system: draft.affected_system ?? '',
    ai_suggested_cause: draft.ai_suggested_cause ?? '',
    observed_evidence: arrayToText(draft.observed_evidence),
    error_messages: arrayToText(draft.error_messages),
    ai_suggested_next_action: arrayToText(draft.ai_suggested_next_action),
    missing_information_questions: arrayToText(draft.missing_information_questions)
  };
}

export function formToTicketPayload(form) {
  return {
    title: form.title.trim(),
    category: form.category,
    priority: form.priority,
    requester_name: nullableText(form.requester_name),
    requester_contact: nullableText(form.requester_contact),
    location: nullableText(form.location),
    affected_device: nullableText(form.affected_device),
    affected_system: nullableText(form.affected_system),
    problem_summary: form.problem_summary.trim(),
    observed_evidence: textToArray(form.observed_evidence),
    error_messages: textToArray(form.error_messages),
    ai_suggested_cause: nullableText(form.ai_suggested_cause),
    ai_suggested_next_action: textToArray(form.ai_suggested_next_action),
    missing_information_questions: textToArray(form.missing_information_questions)
  };
}

export default function TicketDraftEditor({ draft, onSave, saveLabel = 'บันทึก ticket', saving = false, compact = false }) {
  const [form, setForm] = useState(() => draftToForm(draft));

  useEffect(() => {
    setForm(draftToForm(draft));
  }, [draft]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    onSave(formToTicketPayload(form), form);
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <h2>{compact ? 'แก้ไข ticket' : 'ร่าง ticket'}</h2>
        {!form.ticket_ready ? (
          <div className="warning-box">AI ยังคิดว่าข้อมูลไม่ครบ กรุณาตรวจสอบหรือถามผู้ใช้เพิ่มก่อนบันทึก</div>
        ) : null}
      </div>

      <div className="grid two">
        <label className="span-2">
          <span>หัวข้อ</span>
          <input value={form.title} onChange={(event) => update('title', event.target.value)} required />
        </label>
        <label>
          <span>หมวดหมู่</span>
          <select value={form.category} onChange={(event) => update('category', event.target.value)}>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>ความสำคัญ</span>
          <select value={form.priority} onChange={(event) => update('priority', event.target.value)}>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <label>
          <span>ชื่อผู้แจ้ง</span>
          <input value={form.requester_name} onChange={(event) => update('requester_name', event.target.value)} />
        </label>
        <label>
          <span>ช่องทางติดต่อ</span>
          <input value={form.requester_contact} onChange={(event) => update('requester_contact', event.target.value)} />
        </label>
        <label>
          <span>สถานที่</span>
          <input value={form.location} onChange={(event) => update('location', event.target.value)} />
        </label>
        <label>
          <span>อุปกรณ์ที่เกี่ยวข้อง</span>
          <input value={form.affected_device} onChange={(event) => update('affected_device', event.target.value)} />
        </label>
        <label className="span-2">
          <span>ระบบที่เกี่ยวข้อง</span>
          <input value={form.affected_system} onChange={(event) => update('affected_system', event.target.value)} />
        </label>
      </div>

      <label>
        <span>สรุปปัญหา</span>
        <textarea rows={4} value={form.problem_summary} onChange={(event) => update('problem_summary', event.target.value)} required />
      </label>

      <div className="grid two">
        <label>
          <span>หลักฐานที่พบ (หนึ่งรายการต่อหนึ่งบรรทัด)</span>
          <textarea rows={5} value={form.observed_evidence} onChange={(event) => update('observed_evidence', event.target.value)} />
        </label>
        <label>
          <span>ข้อความ error (หนึ่งรายการต่อหนึ่งบรรทัด)</span>
          <textarea rows={5} value={form.error_messages} onChange={(event) => update('error_messages', event.target.value)} />
        </label>
        <label>
          <span>สาเหตุที่ AI คาดเดา</span>
          <textarea rows={4} value={form.ai_suggested_cause} onChange={(event) => update('ai_suggested_cause', event.target.value)} />
        </label>
        <label>
          <span>ขั้นตอนถัดไปที่แนะนำ (หนึ่งรายการต่อหนึ่งบรรทัด)</span>
          <textarea
            rows={4}
            value={form.ai_suggested_next_action}
            onChange={(event) => update('ai_suggested_next_action', event.target.value)}
          />
        </label>
        <label className="span-2">
          <span>ข้อมูลที่ควรถามเพิ่ม (หนึ่งรายการต่อหนึ่งบรรทัด)</span>
          <textarea
            rows={4}
            value={form.missing_information_questions}
            onChange={(event) => update('missing_information_questions', event.target.value)}
          />
        </label>
      </div>

      <div className="actions">
        <LoadingButton className="primary-button" loading={saving} loadingText="กำลังบันทึก...">
          {saveLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
