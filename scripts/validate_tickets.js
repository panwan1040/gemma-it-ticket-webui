import fs from 'node:fs/promises';

const file = process.argv[2] || 'data/tickets.jsonl';
const raw = await fs.readFile(file, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '';
  throw error;
});

let malformed = 0;
let valid = 0;

raw.split('\n').forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const row = JSON.parse(line);
    valid += 1;
    const warnings = [];
    if (!row.ticketId) warnings.push('missing ticketId');
    if (!row.timestamp) warnings.push('missing timestamp');
    if (!row['ปัญหา']) warnings.push('missing problem');
    if (warnings.length) console.log(`line ${index + 1}: warning: ${warnings.join(', ')}`);
  } catch (error) {
    malformed += 1;
    console.log(`line ${index + 1}: malformed JSON: ${error.message}`);
  }
});

console.log(JSON.stringify({ file, valid, malformed }, null, 2));
if (malformed) process.exitCode = 1;
