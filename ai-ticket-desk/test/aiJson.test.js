import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAiJson } from '../src/server/aiJson.js';
import { aiTicketDraftSchema } from '../src/server/schemas.js';

const draft = {
  ticket_ready: true,
  title: 'Printer error',
  category: 'Printer / Scanner',
  priority: 'Medium',
  requester_name: null,
  requester_contact: null,
  location: null,
  affected_device: 'Printer',
  affected_system: null,
  problem_summary: 'Printer shows an error.',
  observed_evidence: ['Error visible'],
  error_messages: ['E01'],
  ai_suggested_cause: null,
  ai_suggested_next_action: ['Restart printer'],
  missing_information_questions: []
};

test('extracts AI JSON from fenced markdown', () => {
  const result = parseAiJson(`\`\`\`json\n${JSON.stringify(draft)}\n\`\`\``, aiTicketDraftSchema);
  assert.equal(result.ok, true);
  assert.equal(result.data.title, 'Printer error');
});

test('extracts AI JSON from text around JSON', () => {
  const result = parseAiJson(`Here is the ticket:\n${JSON.stringify(draft)}\nDone.`, aiTicketDraftSchema);
  assert.equal(result.ok, true);
  assert.equal(result.data.category, 'Printer / Scanner');
});
