import express from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { analyzeIntake } from '../intakePipeline.js';
import { createRateLimiter, validateMimeType } from '../security.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxBytes,
    files: 8
  },
  fileFilter: (_req, file, cb) => {
    if (!validateMimeType(file.mimetype)) {
      cb(Object.assign(new Error('Unsupported file type.'), { status: 400, code: 'UNSUPPORTED_MIME' }));
      return;
    }
    cb(null, true);
  }
});

export const intakeRouter = express.Router();

intakeRouter.post(
  '/analyze',
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimit.analyzePer15m,
    action: 'intake.analyze'
  }),
  upload.array('files[]'),
  async (req, res, next) => {
    try {
      const result = await analyzeIntake({
        text: req.body.message,
        files: req.files ?? [],
        ip: req.ip
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
