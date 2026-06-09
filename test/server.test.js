
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gemma-tests-'));
process.chdir(tmp);
process.env.NODE_ENV = 'test';
process.env.ADMIN_AUTH = 'admin:test-secret';
process.env.GOOGLE_SHEET_WEBHOOK_URL = '';
process.env.RATE_LIMIT_GENERAL_MAX = '1000';
process.env.RATE_LIMIT_CHAT_MAX = '1000';
process.env.RATE_LIMIT_UPLOAD_MAX = '1000';
process.env.RATE_LIMIT_TICKET_MAX = '1000';
await fs.mkdir('knowledge', { recursive: true });
await fs.mkdir('data', { recursive: true });

const mod = await import(`../server.js?test=${Date.now()}`);

test('safeKnowledgePath prevents path traversal', () => {
  const safe = mod.safeKnowledgePath('Policies/example.md');
  assert.equal(safe.clean, 'Policies/example.md');
  assert.throws(() => mod.safeKnowledgePath('../secret.md'), /path|invalid/i);
  assert.throws(() => mod.safeKnowledgePath('not-markdown.txt'), /markdown/i);
});

test('attachment filenames use random prefixes and safe extensions', () => {
  const a = mod.safeAttachmentName('error screen.png');
  const b = mod.safeAttachmentName('error screen.png');
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f-]{36}-error-screen\.png$/);
});

test('ticket IDs increment per day', async () => {
  await fs.writeFile('data/tickets.jsonl', JSON.stringify({ ticketId: 'IT-20260609-0001' }) + '\n');
  const id = await mod.generateTicketId(new Date('2026-06-09T10:00:00Z'));
  assert.equal(id, 'IT-20260609-0002');
});

test('fallback triage detects printer category', () => {
  const result = mod.fallbackTriage('เครื่องปริ้นพิมพ์ไม่ได้', []);
  assert.equal(result.ticket['ประเภท'], 'Printer');
  assert.match(result.agentReply, /เครื่องปริ้น|บริเวณ/);
});

test('RAG search scores relevant docs and filters unrelated docs', async () => {
  await fs.writeFile('data/rag-index.json', JSON.stringify({ docs: [
    { path: 'knowledge/Printer/fix.md', title: 'Printer fix', content: 'วิธีแก้เครื่องปริ้น paper jam printer', tokens: ['printer', 'เครื่องปริ้น', 'paper', 'jam'] },
    { path: 'knowledge/CCTV/cam.md', title: 'CCTV', content: 'กล้อง nvr cctv', tokens: ['กล้อง', 'nvr', 'cctv'] }
  ] }));
  const result = await mod.searchKnowledge('printer พิมพ์ไม่ได้');
  assert.ok(result.items.length >= 1);
  assert.equal(result.items[0].title, 'Printer fix');
});

test('protected admin endpoints require auth', async () => {
  const server = http.createServer(mod.app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const unauth = await fetch(`http://127.0.0.1:${port}/api/models`);
  assert.equal(unauth.status, 401);
  const auth = await fetch(`http://127.0.0.1:${port}/api/models`, {
    headers: { Authorization: `Basic ${Buffer.from('admin:test-secret').toString('base64')}` }
  });
  assert.equal(auth.status, 200);
  server.close();
});
