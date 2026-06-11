import { getDb } from './db.js';

export function auditLog({ action, targetType = null, targetId = null, success, ip = null, detail = {} }) {
  getDb()
    .prepare(`
      INSERT INTO audit_log (created_at, action, target_type, target_id, success, ip, detail_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(new Date().toISOString(), action, targetType, targetId, success ? 1 : 0, ip, JSON.stringify(detail));
}
