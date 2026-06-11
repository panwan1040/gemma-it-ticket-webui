import { useState } from 'react';
import { analyzeIntake, createTicket } from '../lib/api.js';
import IntakeForm from './IntakeForm.jsx';
import AnalysisPanel from './AnalysisPanel.jsx';
import TicketDraftEditor from './TicketDraftEditor.jsx';
import ErrorMessage from './ErrorMessage.jsx';

export default function IntakePage({ navigate }) {
  const [analysis, setAnalysis] = useState(null);
  const [originalMessage, setOriginalMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async ({ message, files }) => {
    setError('');
    setLoading(true);
    setAnalysis(null);
    setOriginalMessage(message);
    try {
      const result = await analyzeIntake({ message, files });
      setAnalysis(result);
    } catch (err) {
      setError(err.message || 'วิเคราะห์ข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (draftPayload) => {
    setError('');
    setSaving(true);
    try {
      const ticket = await createTicket({
        ...draftPayload,
        user_original_message: originalMessage,
        vision_result: analysis?.vision_result ?? null,
        ocr_result: analysis?.ocr_result ?? null,
        reasoning_result: analysis?.reasoning_result ?? analysis?.draft ?? null,
        attachment_ids: analysis?.attachments?.map((attachment) => attachment.id) ?? []
      });
      navigate(`/tickets/${encodeURIComponent(ticket.id)}`);
    } catch (err) {
      setError(err.message || 'บันทึก ticket ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-grid">
      <section className="hero-copy">
        <h1>สร้าง ticket จากหลักฐานที่มี</h1>
        <p>พิมพ์ปัญหา แนบภาพหน้าจอ รูปถ่าย หรือ PDF แล้วให้ AI ช่วยจัดร่าง ticket ที่ตรวจแก้ได้ก่อนบันทึก</p>
      </section>

      <IntakeForm onAnalyze={handleAnalyze} loading={loading} />
      <ErrorMessage message={error} />

      {analysis ? (
        <>
          <AnalysisPanel result={analysis} />
          <TicketDraftEditor draft={analysis.draft} onSave={handleSave} saving={saving} />
        </>
      ) : null}
    </div>
  );
}
