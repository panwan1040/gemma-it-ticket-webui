import test from 'node:test';
import assert from 'node:assert/strict';
import { aiTicketDraftSchema, ticketCreateSchema, ticketUpdateSchema } from '../src/server/schemas.js';

test('AI ticket draft strips blank nullable strings and rejects unknown fields', () => {
  const parsed = aiTicketDraftSchema.parse({
    ticket_ready: false,
    title: 'Login failed',
    category: 'Login / Account',
    priority: 'High',
    requester_name: '',
    requester_contact: ' user@example.com ',
    location: null,
    affected_device: null,
    affected_system: 'SSO',
    problem_summary: 'User cannot login.',
    observed_evidence: [],
    error_messages: ['invalid password'],
    ai_suggested_cause: '',
    ai_suggested_next_action: [],
    missing_information_questions: ['Username?']
  });
  assert.equal(parsed.requester_name, null);
  assert.equal(parsed.ai_suggested_cause, null);
  assert.equal(parsed.requester_contact, 'user@example.com');

  assert.throws(() => aiTicketDraftSchema.parse({ ...parsed, extra: true }));
});

test('ticket create and update schemas validate expected fields', () => {
  const create = ticketCreateSchema.parse({
    title: 'Network down',
    category: 'Network / Internet',
    priority: 'Urgent',
    requester_name: null,
    requester_contact: null,
    location: 'Office',
    affected_device: null,
    affected_system: 'Wi-Fi',
    problem_summary: 'No connection.',
    observed_evidence: [],
    error_messages: [],
    ai_suggested_cause: null,
    ai_suggested_next_action: [],
    missing_information_questions: [],
    user_original_message: 'A'.repeat(1500),
    vision_result: 'V'.repeat(1500),
    ocr_result: 'O'.repeat(1500),
    attachment_ids: ['abc', 'def']
  });
  assert.equal(create.status, 'Open');
  assert.deepEqual(create.attachment_ids, ['abc', 'def']);

  const update = ticketUpdateSchema.parse({ status: 'Resolved', priority: 'Low' });
  assert.equal(update.status, 'Resolved');
  assert.throws(() => ticketUpdateSchema.parse({}));
});
