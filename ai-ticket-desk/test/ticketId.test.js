import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { generateTicketId, migrate } from '../src/server/db.js';

test('ticket ID uses date format and daily sequence', () => {
  const db = new Database(':memory:');
  migrate(db);
  const date = new Date('2026-06-11T09:30:00+07:00');

  assert.equal(generateTicketId(db, date), 'IT-20260611-0001');

  db.prepare(`
    INSERT INTO tickets (
      id, created_at, updated_at, status, title, category, priority,
      problem_summary, observed_evidence_json, error_messages_json,
      ai_suggested_next_action_json, missing_information_questions_json, reasoning_result_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'IT-20260611-0001',
    date.toISOString(),
    date.toISOString(),
    'Open',
    'Test',
    'Other',
    'Medium',
    'Problem',
    '[]',
    '[]',
    '[]',
    '[]',
    '{}'
  );

  assert.equal(generateTicketId(db, date), 'IT-20260611-0002');
  assert.equal(generateTicketId(db, new Date('2026-06-12T00:01:00+07:00')), 'IT-20260612-0001');
  db.close();
});
