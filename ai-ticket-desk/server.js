import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/server/config.js';
import { getDb } from './src/server/db.js';
import { ensureDataDirs } from './src/server/storage.js';
import { healthRouter } from './src/server/routes/health.js';
import { intakeRouter } from './src/server/routes/intake.js';
import { ticketExportRouter, ticketsRouter } from './src/server/routes/tickets.js';
import { requireBasicAuth } from './src/server/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

ensureDataDirs();
getDb();
if (config.isProduction) {
  fs.accessSync(config.paths.dataDir, fs.constants.W_OK);
  fs.accessSync(config.paths.attachmentDir, fs.constants.W_OK);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/intake', intakeRouter);
app.use('/api', ticketExportRouter);
app.use('/api/tickets', ticketsRouter);

const distDir = path.join(__dirname, 'dist');
if (config.isProduction || fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use('/tickets', requireBasicAuth);
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'ไม่พบ endpoint ที่ต้องการ' });
});

app.use((error, _req, res, _next) => {
  const knownMessages = {
    AI_JSON_INVALID: 'AI ส่ง JSON ที่ไม่ถูกต้อง กรุณาลองใหม่หรือตรวจสอบโมเดลที่ตั้งค่าไว้',
    IMAGE_READ_FAILED: 'ไม่สามารถอ่านไฟล์ภาพที่อัปโหลดได้ กรุณาลองใหม่',
    IMAGE_METADATA_FAILED: 'ไม่สามารถอ่านไฟล์ภาพได้ กรุณาตรวจสอบไฟล์แล้วลองใหม่'
  };
  if (error?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'FILE_TOO_LARGE', message: `ไฟล์ใหญ่เกิน ${config.upload.maxMb} MB` });
    return;
  }
  if (error?.code === 'UNSUPPORTED_MIME') {
    res.status(400).json({ error: 'UNSUPPORTED_MIME', message: 'รองรับเฉพาะ PNG, JPEG, WebP และ PDF' });
    return;
  }
  if (error?.name === 'ZodError') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
      issues: error.issues
    });
    return;
  }
  if (error?.message?.includes('Ollama is unreachable')) {
    res.status(502).json({ error: 'OLLAMA_UNREACHABLE', message: 'เชื่อมต่อ Ollama ไม่ได้ กรุณาตรวจสอบว่า Ollama เปิดอยู่' });
    return;
  }
  if (error?.message?.includes('model') && error?.message?.includes('not found')) {
    res.status(502).json({ error: 'OLLAMA_MODEL_MISSING', message: 'ไม่พบโมเดล Ollama ที่ตั้งค่าไว้ กรุณาติดตั้งโมเดลก่อนใช้งาน' });
    return;
  }
  if (error?.message?.includes('Ollama model call failed')) {
    res.status(502).json({ error: 'OLLAMA_CALL_FAILED', message: 'เรียกใช้งานโมเดลผ่าน Ollama ไม่สำเร็จ กรุณาตรวจสอบโมเดลและลองใหม่' });
    return;
  }
  const status = Number(error?.status) || 500;
  res.status(status).json({
    error: error?.code || (status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST'),
    message: knownMessages[error?.code] || error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`${config.appName} API listening on http://127.0.0.1:${config.port}`);
  });
}

export { app };
