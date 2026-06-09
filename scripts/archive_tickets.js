import fs from 'node:fs/promises';
import path from 'node:path';
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = ''] = arg.split('=');
  return [key.replace(/^--/, ''), value || '1'];
}));
const before = args.get('before');
const apply = args.has('apply');
const source = args.get('file') || 'data/tickets.jsonl';
if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
  console.error('Usage: node scripts/archive_tickets.js --before=YYYY-MM-DD [--apply] [--file=data/tickets.jsonl]');
  process.exit(1);
}
const raw = await fs.readFile(source, 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error));
const rows = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
const archive = [];
const keep = [];
for (const row of rows) {
  const day = String(row.timestamp || '').slice(0, 10);
  if (day && day < before) archive.push(row); else keep.push(row);
}
console.log(JSON.stringify({ source, before, archiveCount: archive.length, keepCount: keep.length, apply }, null, 2));
if (!apply) {
  console.log('Dry run only. Re-run with --apply to write archive and compact tickets.jsonl.');
  process.exit(0);
}
await fs.mkdir('data/archive', { recursive: true });
const archivePath = path.join('data/archive', `tickets-before-${before}.jsonl`);
await fs.writeFile(archivePath, archive.map((row) => JSON.stringify(row)).join('\n') + (archive.length ? '\n' : ''), 'utf8');
await fs.writeFile(source, keep.map((row) => JSON.stringify(row)).join('\n') + (keep.length ? '\n' : ''), 'utf8');
console.log(`Archived to ${archivePath}`);
