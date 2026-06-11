import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getDb } from '../src/server/db.js';
import { analyzeIntake } from '../src/server/intakePipeline.js';

const draft = {
  ticket_ready: true,
  title: 'เครื่องเปิดไม่ติด',
  category: 'Hardware',
  priority: 'High',
  requester_name: null,
  requester_contact: null,
  location: null,
  affected_device: 'Dell monitor',
  affected_system: null,
  problem_summary: 'เครื่องหรือหน้าจอเปิดไม่ติดหลังไฟตก',
  observed_evidence: ['ไฟสีส้มกะพริบ'],
  error_messages: [],
  ai_suggested_cause: 'อาจเกี่ยวกับไฟเลี้ยงหรืออุปกรณ์เสียหาย',
  ai_suggested_next_action: ['ตรวจสอบสายไฟ', 'ลองปลั๊กอื่น'],
  missing_information_questions: []
};

function mockAi({ invalid = false } = {}) {
  return {
    generateText: async () => (invalid ? 'not json' : JSON.stringify(draft)),
    generateWithImages: async ({ model }) => (model.includes('typhoon') ? 'OCR TEXT' : 'VISION TEXT')
  };
}

test('intake pipeline supports text-only with mocked Ollama', async () => {
  const result = await analyzeIntake({
    text: 'เครื่องเปิดไม่ติด มีไฟสีส้มกะพริบ',
    files: [],
    ip: 'test',
    aiClient: mockAi()
  });
  assert.equal(result.draft.title, 'เครื่องเปิดไม่ติด');
  assert.equal(result.vision_result, '');
  assert.equal(result.ocr_result, '');
});

test('intake pipeline sends image through separate vision and OCR mocks', async () => {
  const file = {
    originalname: 'screen.png',
    mimetype: 'image/png',
    size: 68,
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    )
  };
  const result = await analyzeIntake({ text: '', files: [file], ip: 'test', aiClient: mockAi() });
  try {
    assert.equal(result.vision_result, 'VISION TEXT');
    assert.equal(result.ocr_result, 'OCR TEXT');
    assert.equal(result.attachments.length, 1);
  } finally {
    const ids = result.attachments.map((attachment) => attachment.id);
    const rows = ids.length
      ? getDb().prepare(`SELECT id, storage_path FROM attachments WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
      : [];
    for (const row of rows) {
      fs.rmSync(row.storage_path, { force: true });
      getDb().prepare('DELETE FROM attachments WHERE id = ?').run(row.id);
    }
  }
});

test('intake pipeline returns clear error for invalid AI JSON', async () => {
  await assert.rejects(
    analyzeIntake({ text: 'ทดสอบ', files: [], ip: 'test', aiClient: mockAi({ invalid: true }) }),
    /AI ส่ง JSON ที่ไม่ถูกต้อง/
  );
});
