import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

export const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

export function validateMimeType(mimeType) {
  return allowedMimeTypes.has(mimeType);
}

export function sanitizeOriginalName(name) {
  const base = path.basename(String(name || 'attachment'));
  return base.replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 160) || 'attachment';
}

export function assertPathInside(parentDir, targetPath) {
  const parent = path.resolve(parentDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(parent, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw Object.assign(new Error('Invalid storage path.'), { status: 400 });
  }
  return target;
}

export function parseBasicAuth(header) {
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export function isValidBasicAuth(header, expected = config.adminAuth) {
  if (!expected) return false;
  const parsed = parseBasicAuth(header);
  if (!parsed) return false;
  const supplied = `${parsed.username}:${parsed.password}`;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function requireBasicAuth(req, res, next) {
  if (isValidBasicAuth(req.headers.authorization)) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="AI Ticket Desk"');
  return res.status(401).json({
    error: 'UNAUTHORIZED',
    message: 'กรุณาเข้าสู่ระบบด้วย Basic Auth'
  });
}

export function createRateLimiter({ windowMs, max, action }) {
  const hits = new Map();
  return createMemoryRateLimiter({ windowMs, max, action, hits });
}

export function createMemoryRateLimiter({ windowMs, max, action, hits = new Map() }) {
  const middleware = function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${action}:${ip}`;
    const entry = hits.get(key) ?? { count: 0, resetAt: now + windowMs };
    if (entry.resetAt <= now) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
      });
    }
    return next();
  };
  middleware._hits = hits;
  return middleware;
}
