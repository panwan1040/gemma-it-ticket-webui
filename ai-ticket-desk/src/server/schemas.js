import { z } from 'zod';
import { allowedCategories, allowedPriorities } from './prompts.js';

const nullableString = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return value;
}, z.string().max(1000).nullable());

const nullableLongString = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return value;
}, z.string().max(50000).nullable());

const stringArray = z.array(z.preprocess((value) => String(value ?? '').trim(), z.string().min(1).max(2000))).default([]);

export const aiTicketDraftSchema = z
  .object({
    ticket_ready: z.boolean().default(true),
    title: z.string().trim().min(1).max(160),
    category: z.enum(allowedCategories).catch('Other'),
    priority: z.enum(allowedPriorities).catch('Medium'),
    requester_name: nullableString,
    requester_contact: nullableString,
    location: nullableString,
    affected_device: nullableString,
    affected_system: nullableString,
    problem_summary: z.string().trim().min(1).max(4000),
    observed_evidence: stringArray,
    error_messages: stringArray,
    ai_suggested_cause: nullableString,
    ai_suggested_next_action: stringArray,
    missing_information_questions: stringArray
  })
  .strict();

export const ticketCreateSchema = aiTicketDraftSchema
  .omit({ ticket_ready: true })
  .extend({
    status: z.enum(['Draft', 'Open', 'In Progress', 'Resolved', 'Closed']).default('Open'),
    user_original_message: nullableLongString.optional(),
    vision_result: nullableLongString.optional(),
    ocr_result: nullableLongString.optional(),
    reasoning_result: z.unknown().optional(),
    attachment_ids: z.array(z.string().min(1).max(80)).default([])
  })
  .strict();

export const ticketUpdateSchema = z
  .object({
    status: z.enum(['Draft', 'Open', 'In Progress', 'Resolved', 'Closed']).optional(),
    title: z.string().trim().min(1).max(160).optional(),
    category: z.enum(allowedCategories).optional(),
    priority: z.enum(allowedPriorities).optional(),
    requester_name: nullableString.optional(),
    requester_contact: nullableString.optional(),
    location: nullableString.optional(),
    affected_device: nullableString.optional(),
    affected_system: nullableString.optional(),
    problem_summary: z.string().trim().min(1).max(4000).optional(),
    observed_evidence: stringArray.optional(),
    error_messages: stringArray.optional(),
    ai_suggested_cause: nullableString.optional(),
    ai_suggested_next_action: stringArray.optional(),
    missing_information_questions: stringArray.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const attachmentMetadataSchema = z
  .object({
    kind: z.enum(['image', 'pdf']),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    format: z.string().nullable().optional(),
    space: z.string().nullable().optional(),
    has_alpha: z.boolean().optional(),
    page_count: z.number().int().positive().nullable().optional(),
    note: z.string().optional()
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    database: z.enum(['ok', 'error']),
    attachmentsWritable: z.boolean(),
    ollama: z.object({
      reachable: z.boolean(),
      error: z.string().optional()
    }),
    models: z.object({
      vision: z.string(),
      ocr: z.string(),
      reasoning: z.string()
    })
  })
  .strict();
