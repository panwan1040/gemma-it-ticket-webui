import { useEffect, useState } from 'react';
import { attachmentDownloadUrl, getTicket, updateTicket } from '../lib/api.js';
import { arrayToText, formatBytes, formatDateTime, statuses } from '../lib/format.js';
import AnalysisPanel from './AnalysisPanel.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import LoadingButton from './LoadingButton.jsx';
import StatusBadge from './StatusBadge.jsx';
import TicketDraftEditor, { draftToForm, formToTicketPayload } from './TicketDraftEditor.jsx';

export default function TicketDetailPage({ id, navigate }) {
  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getTicket(id)
      .then((data) => {
        if (!alive) return;
        setTicket(data);
        setStatus(data.status);
        setForm(draftToForm({ ...data, ticket_ready: true }));
      })
      .catch((err) => {
        if (alive) setError(err.message || 'โหลด ticket ไม่สำเร็จ');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const saveStatus = async () => {
    setSavingStatus(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateTicket(id, { status });
      setTicket(updated);
      setNotice('อัปเดตสถานะแล้ว');
    } catch (err) {
      setError(err.message || 'อัปเดตสถานะไม่สำเร็จ');
    } finally {
      setSavingStatus(false);
    }
  };

  const saveFields = async (patch) => {
    setSavingFields(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateTicket(id, patch);
      setTicket(updated);
      setForm(draftToForm({ ...updated, ticket_ready: true }));
      setNotice('บันทึกการแก้ไขแล้ว');
    } catch (err) {
      setError(err.message || 'บันทึกการแก้ไขไม่สำเร็จ');
    } finally {
      setSavingFields(false);
    }
  };

  if (loading) {
    return <p className="muted">กำลังโหลด ticket...</p>;
  }

  if (!ticket) {
    return (
      <div className="content-grid">
        <ErrorMessage message={error || 'ไม่พบ ticket'} />
        <button className="secondary-button" onClick={() => navigate('/tickets')}>
          กลับไปรายการ ticket
        </button>
      </div>
    );
  }

  const analysisResult = {
    vision_result: ticket.vision_result,
    ocr_result: ticket.ocr_result,
    warnings: []
  };

  return (
    <div className="content-grid">
      <section className="section-heading">
        <div>
          <button className="text-button" onClick={() => navigate('/tickets')}>
            กลับไปรายการ ticket
          </button>
          <h1>{ticket.id}</h1>
          <p className="muted">
            สร้างเมื่อ {formatDateTime(ticket.created_at)} · แก้ไขล่าสุด {formatDateTime(ticket.updated_at)}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </section>

      <ErrorMessage message={error} />
      {notice ? <div className="success-box">{notice}</div> : null}

      <section className="card stack">
        <h2>สถานะ</h2>
        <div className="inline-form">
          <label>
            <span>สถานะ ticket</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <LoadingButton className="secondary-button" loading={savingStatus} loadingText="กำลังอัปเดต..." onClick={saveStatus} type="button">
            อัปเดตสถานะ
          </LoadingButton>
        </div>
      </section>

      <section className="card stack">
        <h2>ข้อมูล ticket</h2>
        <div className="detail-grid">
          <ReadOnly label="หัวข้อ" value={ticket.title} />
          <ReadOnly label="หมวดหมู่" value={ticket.category} />
          <ReadOnly label="ความสำคัญ" value={ticket.priority} />
          <ReadOnly label="ผู้แจ้ง" value={ticket.requester_name} />
          <ReadOnly label="ติดต่อ" value={ticket.requester_contact} />
          <ReadOnly label="สถานที่" value={ticket.location} />
          <ReadOnly label="อุปกรณ์" value={ticket.affected_device} />
          <ReadOnly label="ระบบ" value={ticket.affected_system} />
        </div>
        <ReadOnly label="สรุปปัญหา" value={ticket.problem_summary} block />
        <ReadOnly label="หลักฐานที่พบ" value={arrayToText(ticket.observed_evidence)} block />
        <ReadOnly label="ข้อความ error" value={arrayToText(ticket.error_messages)} block />
        <ReadOnly label="สาเหตุที่ AI คาดเดา" value={ticket.ai_suggested_cause} block />
        <ReadOnly label="ขั้นตอนถัดไปที่แนะนำ" value={arrayToText(ticket.ai_suggested_next_action)} block />
        <ReadOnly label="ข้อมูลที่ควรถามเพิ่ม" value={arrayToText(ticket.missing_information_questions)} block />
      </section>

      {form ? <TicketDraftEditor draft={formToTicketPayload(form)} onSave={saveFields} saving={savingFields} saveLabel="บันทึกการแก้ไข" compact /> : null}

      <section className="card stack">
        <h2>ข้อความและไฟล์ต้นทาง</h2>
        <ReadOnly label="ข้อความผู้ใช้เดิม" value={ticket.user_original_message} block />
        {ticket.attachments?.length ? (
          <ul className="file-list">
            {ticket.attachments.map((attachment) => (
              <li key={attachment.id}>
                <span>
                  <strong>{attachment.original_name}</strong>
                  <small>
                    {attachment.mime_type} · {formatBytes(attachment.size_bytes)}
                  </small>
                </span>
                <a className="secondary-button small-button" href={attachmentDownloadUrl(ticket.id, attachment.id)}>
                  ดาวน์โหลด
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">ไม่มีไฟล์แนบ</p>
        )}
      </section>

      <AnalysisPanel result={analysisResult} />
    </div>
  );
}

function ReadOnly({ label, value, block }) {
  return (
    <div className={block ? 'read-block' : 'read-item'}>
      <span>{label}</span>
      <p>{value || '-'}</p>
    </div>
  );
}
