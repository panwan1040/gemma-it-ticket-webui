import fs from 'node:fs';
import { getDb, generateTicketId } from './db.js';
import { assertSafeStoredAttachmentPath } from './storage.js';
import { ticketCreateSchema, ticketUpdateSchema } from './schemas.js';
import { auditLog } from './audit.js';

const jsonFields = [
  'observed_evidence',
  'error_messages',
  'ai_suggested_next_action',
  'missing_information_questions'
];

export function createTicket(input, ip = null) {
  const data = ticketCreateSchema.parse(input);
  const db = getDb();
  const now = new Date().toISOString();

  const created = db.transaction(() => {
    const id = generateTicketId(db, new Date());
    db.prepare(`
      INSERT INTO tickets (
        id, created_at, updated_at, status, title, category, priority,
        requester_name, requester_contact, location, affected_device, affected_system,
        problem_summary, observed_evidence_json, error_messages_json,
        ai_suggested_cause, ai_suggested_next_action_json, missing_information_questions_json,
        user_original_message, vision_result, ocr_result, reasoning_result_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      now,
      now,
      data.status,
      data.title,
      data.category,
      data.priority,
      data.requester_name,
      data.requester_contact,
      data.location,
      data.affected_device,
      data.affected_system,
      data.problem_summary,
      JSON.stringify(data.observed_evidence),
      JSON.stringify(data.error_messages),
      data.ai_suggested_cause,
      JSON.stringify(data.ai_suggested_next_action),
      JSON.stringify(data.missing_information_questions),
      data.user_original_message ?? null,
      data.vision_result ?? null,
      data.ocr_result ?? null,
      JSON.stringify(data.reasoning_result ?? data)
    );

    for (const attachmentId of data.attachment_ids) {
      db.prepare('UPDATE attachments SET ticket_id = ? WHERE id = ? AND ticket_id IS NULL').run(id, attachmentId);
    }
    return getTicketById(id, db);
  })();

  auditLog({ action: 'ticket.create', targetType: 'ticket', targetId: created.id, success: true, ip });
  return created;
}

export function listTickets() {
  return getDb()
    .prepare(`
      SELECT id, created_at, updated_at, status, title, category, priority,
             requester_name, requester_contact, location, affected_device, affected_system,
             problem_summary
      FROM tickets
      ORDER BY created_at DESC
    `)
    .all();
}

export function listTicketsForExport() {
  return getDb()
    .prepare(`
      SELECT id, created_at, status, title, category, priority,
             requester_name, requester_contact, location, affected_device, affected_system,
             problem_summary
      FROM tickets
      ORDER BY created_at DESC
    `)
    .all();
}

export function getTicketById(id, database = getDb()) {
  const row = database.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!row) return null;
  const attachments = database.prepare('SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC').all(id);
  return {
    ...mapTicket(row),
    attachments: attachments.map(mapAttachment)
  };
}

export function updateTicket(id, input, ip = null) {
  const data = ticketUpdateSchema.parse(input);
  const db = getDb();
  const existing = getTicketById(id, db);
  if (!existing) return null;

  const columns = [];
  const values = [];
  for (const [key, value] of Object.entries(data)) {
    if (jsonFields.includes(key)) {
      columns.push(`${key}_json = ?`);
      values.push(JSON.stringify(value));
    } else {
      columns.push(`${key} = ?`);
      values.push(value);
    }
  }
  columns.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  db.prepare(`UPDATE tickets SET ${columns.join(', ')} WHERE id = ?`).run(...values);
  auditLog({ action: 'ticket.update', targetType: 'ticket', targetId: id, success: true, ip });
  return getTicketById(id, db);
}

export function getAttachmentForTicket(ticketId, attachmentId) {
  const row = getDb()
    .prepare('SELECT * FROM attachments WHERE id = ? AND ticket_id = ?')
    .get(attachmentId, ticketId);
  if (!row) return null;
  const safePath = assertSafeStoredAttachmentPath(row.storage_path);
  fs.accessSync(safePath, fs.constants.R_OK);
  return { ...mapAttachment(row), storage_path: safePath };
}

export function ticketToJson(ticket) {
  return JSON.stringify(ticket, null, 2);
}

export function ticketsToCsv(tickets) {
  const headers = [
    'id',
    'created_at',
    'status',
    'title',
    'category',
    'priority',
    'requester_name',
    'requester_contact',
    'location',
    'affected_device',
    'affected_system',
    'problem_summary'
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...tickets.map((ticket) => headers.map((header) => escape(ticket[header])).join(','))].join('\n');
}

function mapTicket(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    title: row.title,
    category: row.category,
    priority: row.priority,
    requester_name: row.requester_name,
    requester_contact: row.requester_contact,
    location: row.location,
    affected_device: row.affected_device,
    affected_system: row.affected_system,
    problem_summary: row.problem_summary,
    observed_evidence: JSON.parse(row.observed_evidence_json),
    error_messages: JSON.parse(row.error_messages_json),
    ai_suggested_cause: row.ai_suggested_cause,
    ai_suggested_next_action: JSON.parse(row.ai_suggested_next_action_json),
    missing_information_questions: JSON.parse(row.missing_information_questions_json),
    user_original_message: row.user_original_message,
    vision_result: row.vision_result,
    ocr_result: row.ocr_result,
    reasoning_result: JSON.parse(row.reasoning_result_json)
  };
}

function mapAttachment(row) {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    created_at: row.created_at,
    original_name: row.original_name,
    stored_name: row.stored_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    sha256: row.sha256,
    page_count: row.page_count,
    metadata: JSON.parse(row.metadata_json)
  };
}
