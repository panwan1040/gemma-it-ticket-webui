import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { config } from './config.js';
import { assertPathInside, sanitizeOriginalName, validateMimeType } from './security.js';

export function ensureDataDirs() {
  fs.mkdirSync(config.paths.dataDir, { recursive: true });
  fs.mkdirSync(config.paths.attachmentDir, { recursive: true });
}

export function makeStoredName({ originalName, mimeType }) {
  const extFromMime = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  }[mimeType];
  const originalExt = path.extname(sanitizeOriginalName(originalName)).toLowerCase();
  const ext = extFromMime || originalExt || '.bin';
  return `${nanoid(18)}${ext}`;
}

export async function storeUpload(file) {
  if (!file) throw Object.assign(new Error('Missing uploaded file.'), { status: 400 });
  if (!validateMimeType(file.mimetype)) {
    throw Object.assign(new Error('Unsupported file type.'), { status: 400, code: 'UNSUPPORTED_MIME' });
  }

  ensureDataDirs();
  const createdAt = new Date();
  const day = createdAt.toISOString().slice(0, 10);
  const dir = assertPathInside(config.paths.attachmentDir, path.join(config.paths.attachmentDir, day));
  fs.mkdirSync(dir, { recursive: true });

  const storedName = makeStoredName({ originalName: file.originalname, mimeType: file.mimetype });
  const storagePath = assertPathInside(dir, path.join(dir, storedName));
  await fs.promises.writeFile(storagePath, file.buffer);

  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const metadata = await getFileMetadata(file);

  return {
    id: nanoid(16),
    created_at: createdAt.toISOString(),
    original_name: sanitizeOriginalName(file.originalname),
    stored_name: storedName,
    mime_type: file.mimetype,
    size_bytes: file.size,
    sha256,
    storage_path: storagePath,
    page_count: metadata.page_count ?? null,
    metadata
  };
}

async function getFileMetadata(file) {
  if (file.mimetype.startsWith('image/')) {
    try {
      const image = sharp(file.buffer, { failOn: 'none' });
      const meta = await image.metadata();
      return {
        kind: 'image',
        width: meta.width ?? null,
        height: meta.height ?? null,
        format: meta.format ?? null,
        space: meta.space ?? null,
        has_alpha: Boolean(meta.hasAlpha)
      };
    } catch (error) {
      throw Object.assign(new Error('ไม่สามารถอ่านไฟล์ภาพได้ กรุณาตรวจสอบไฟล์แล้วลองใหม่'), {
        status: 400,
        code: 'IMAGE_METADATA_FAILED',
        cause: error
      });
    }
  }
  return {
    kind: 'pdf',
    page_count: null,
    note: 'PDF page counting and PDF-to-image conversion are not implemented yet.'
  };
}

export function insertAttachmentRecord(db, attachment) {
  db.prepare(`
    INSERT INTO attachments (
      id, ticket_id, created_at, original_name, stored_name, mime_type, size_bytes,
      sha256, storage_path, page_count, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    attachment.id,
    attachment.ticket_id ?? null,
    attachment.created_at,
    attachment.original_name,
    attachment.stored_name,
    attachment.mime_type,
    attachment.size_bytes,
    attachment.sha256,
    attachment.storage_path,
    attachment.page_count ?? null,
    JSON.stringify(attachment.metadata ?? {})
  );
}

export function assertSafeStoredAttachmentPath(storagePath) {
  return assertPathInside(config.paths.attachmentDir, storagePath);
}
