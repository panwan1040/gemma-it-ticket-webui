import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const boolFromString = z
  .string()
  .default('false')
  .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_NAME: z.string().min(1).default('AI Ticket Desk'),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  VISION_MODEL: z.string().min(1).default('gemma3:12b'),
  OCR_MODEL: z.string().min(1).default('scb10x/typhoon-ocr1.5-3b'),
  REASONING_MODEL: z.string().min(1).default('gemma3:12b'),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  AI_TOP_P: z.coerce.number().min(0).max(1).default(0.9),
  AI_NUM_CTX: z.coerce.number().int().positive().default(8192),
  AI_NUM_PREDICT: z.coerce.number().int().positive().default(1200),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  AI_DEBUG: boolFromString,
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(24),
  PDF_MAX_PAGES: z.coerce.number().int().positive().default(3),
  ADMIN_AUTH: z.string().default('admin:change-me'),
  RATE_LIMIT_ANALYZE_PER_15M: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_SAVE_PER_15M: z.coerce.number().int().positive().default(60),
  DATA_DIR: z.string().min(1).default('data'),
  ATTACHMENT_DIR: z.string().min(1).default('data/attachments'),
  DB_PATH: z.string().min(1).default('data/app.db')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid configuration: ${message}`);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && (!env.ADMIN_AUTH || env.ADMIN_AUTH === 'admin:change-me')) {
  throw new Error('ADMIN_AUTH must be set to a non-default value in production.');
}

const rootDir = process.cwd();

export const config = Object.freeze({
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  appName: env.APP_NAME,
  ollamaBaseUrl: env.OLLAMA_BASE_URL.replace(/\/$/, ''),
  models: {
    vision: env.VISION_MODEL,
    ocr: env.OCR_MODEL,
    reasoning: env.REASONING_MODEL
  },
  ai: {
    temperature: env.AI_TEMPERATURE,
    topP: env.AI_TOP_P,
    numCtx: env.AI_NUM_CTX,
    numPredict: env.AI_NUM_PREDICT,
    timeoutMs: env.AI_TIMEOUT_MS,
    debug: env.AI_DEBUG
  },
  upload: {
    maxMb: env.MAX_UPLOAD_MB,
    maxBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    pdfMaxPages: env.PDF_MAX_PAGES
  },
  adminAuth: env.ADMIN_AUTH,
  rateLimit: {
    analyzePer15m: env.RATE_LIMIT_ANALYZE_PER_15M,
    savePer15m: env.RATE_LIMIT_SAVE_PER_15M
  },
  paths: {
    rootDir,
    dataDir: path.resolve(rootDir, env.DATA_DIR),
    attachmentDir: path.resolve(rootDir, env.ATTACHMENT_DIR),
    dbPath: path.resolve(rootDir, env.DB_PATH)
  }
});
