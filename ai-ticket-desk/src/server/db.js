import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(config.paths.dbPath), { recursive: true });
    db = new Database(config.paths.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

export function migrate(database = getDb()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      requester_name TEXT,
      requester_contact TEXT,
      location TEXT,
      affected_device TEXT,
      affected_system TEXT,
      problem_summary TEXT NOT NULL,
      observed_evidence_json TEXT NOT NULL,
      error_messages_json TEXT NOT NULL,
      ai_suggested_cause TEXT,
      ai_suggested_next_action_json TEXT NOT NULL,
      missing_information_questions_json TEXT NOT NULL,
      user_original_message TEXT,
      vision_result TEXT,
      ocr_result TEXT,
      reasoning_result_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      created_at TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      page_count INTEGER,
      metadata_json TEXT NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      success INTEGER NOT NULL,
      ip TEXT,
      detail_json TEXT NOT NULL
    );
  `);
}

export function generateTicketId(database = getDb(), now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `IT-${y}${m}${d}-`;
  const row = database
    .prepare('SELECT id FROM tickets WHERE id LIKE ? ORDER BY id DESC LIMIT 1')
    .get(`${prefix}%`);
  const next = row ? Number(row.id.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function checkDatabase(database = getDb()) {
  database.prepare('SELECT 1').get();
  return true;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
