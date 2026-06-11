import test from 'node:test';
import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { getDb } from '../src/server/db.js';
import { createTicket, getTicketById, ticketsToCsv, updateTicket } from '../src/server/ticketService.js';

function ticketPayload(suffix = nanoid(4)) {
  return {
    title: `Ticket ${suffix}`,
    category: 'Other',
    priority: 'Medium',
    requester_name: 'User',
    requester_contact: 'user@example.com',
    location: 'HQ',
    affected_device: null,
    affected_system: null,
    problem_summary: 'Problem summary',
    observed_evidence: ['Evidence'],
    error_messages: ['Error'],
    ai_suggested_cause: null,
    ai_suggested_next_action: ['Next'],
    missing_information_questions: [],
    attachment_ids: []
  };
}

test('ticket create/read/update works', () => {
  const created = createTicket(ticketPayload(), 'test');
  try {
    assert.match(created.id, /^IT-\d{8}-\d{4}$/);
    const read = getTicketById(created.id);
    assert.equal(read.title, created.title);
    const updated = updateTicket(created.id, { status: 'Resolved', title: 'Updated title' }, 'test');
    assert.equal(updated.status, 'Resolved');
    assert.equal(updated.title, 'Updated title');
  } finally {
    getDb().prepare('DELETE FROM tickets WHERE id = ?').run(created.id);
  }
});

test('CSV export escapes quotes and includes required columns', () => {
  const csv = ticketsToCsv([
    {
      id: 'IT-20260611-0001',
      created_at: '2026-06-11T00:00:00.000Z',
      status: 'Open',
      title: 'Printer "A"',
      category: 'Hardware',
      priority: 'High',
      requester_name: 'User',
      requester_contact: 'u@example.com',
      location: 'Office',
      affected_device: 'Printer',
      affected_system: '',
      problem_summary: 'Paper jam'
    }
  ]);
  assert.match(csv.split('\n')[0], /requester_name,requester_contact,location/);
  assert.match(csv, /"Printer ""A"""/);
});

test('ticket creation links analyzed attachment IDs', () => {
  const db = getDb();
  const attachmentId = `att_${nanoid(8)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO attachments (
      id, ticket_id, created_at, original_name, stored_name, mime_type, size_bytes,
      sha256, storage_path, page_count, metadata_json
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(
    attachmentId,
    now,
    'screen.png',
    'stored.png',
    'image/png',
    10,
    '0'.repeat(64),
    path.join(config.paths.attachmentDir, 'test', 'stored.png'),
    JSON.stringify({ kind: 'image' })
  );

  const created = createTicket({ ...ticketPayload(), attachment_ids: [attachmentId] }, 'test');
  try {
    const read = getTicketById(created.id);
    assert.equal(read.attachments.length, 1);
    assert.equal(read.attachments[0].id, attachmentId);
  } finally {
    db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
    db.prepare('DELETE FROM tickets WHERE id = ?').run(created.id);
  }
});
