import express from 'express';
import fs from 'node:fs';
import { config } from '../config.js';
import { checkDatabase } from '../db.js';
import { pingOllama } from '../ollamaClient.js';
import { ensureDataDirs } from '../storage.js';

export const healthRouter = express.Router();

healthRouter.get('/', async (_req, res) => {
  let database = 'ok';
  let attachmentsWritable = false;
  try {
    checkDatabase();
  } catch {
    database = 'error';
  }

  try {
    ensureDataDirs();
    await fs.promises.access(config.paths.attachmentDir, fs.constants.W_OK);
    attachmentsWritable = true;
  } catch {
    attachmentsWritable = false;
  }

  const ollama = await pingOllama();
  const status = database === 'ok' && attachmentsWritable ? 'ok' : 'degraded';

  res.json({
    status,
    database,
    attachmentsWritable,
    ollama,
    models: config.models
  });
});
