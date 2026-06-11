import fs from 'node:fs';
import { config } from './config.js';
import { getDb } from './db.js';
import { insertAttachmentRecord, storeUpload } from './storage.js';
import { generateText as ollamaGenerateText, generateWithImages as ollamaGenerateWithImages } from './ollamaClient.js';
import { buildTicketReasoningPrompt, ocrPrompt, visionPrompt } from './prompts.js';
import { parseAiJson } from './aiJson.js';
import { aiTicketDraftSchema } from './schemas.js';
import { auditLog } from './audit.js';

export async function analyzeIntake({ text = '', files = [], ip = null, aiClient = {} }) {
  const message = String(text ?? '').trim();
  if (!message && files.length === 0) {
    throw Object.assign(new Error('กรุณาระบุรายละเอียดปัญหาหรือแนบไฟล์อย่างน้อยหนึ่งไฟล์'), { status: 400 });
  }

  auditLog({
    action: 'intake.analyze.started',
    success: true,
    ip,
    detail: { file_count: files.length, has_text: Boolean(message) }
  });

  const generateText = aiClient.generateText ?? ollamaGenerateText;
  const generateWithImages = aiClient.generateWithImages ?? ollamaGenerateWithImages;
  const db = getDb();
  const warnings = [];
  const storedAttachments = [];

  try {
    for (const file of files) {
      const attachment = await storeUpload(file);
      insertAttachmentRecord(db, attachment);
      storedAttachments.push(attachment);
      if (attachment.mime_type === 'application/pdf') {
        warnings.push('PDF OCR image conversion is not yet available. The PDF was stored and included as metadata only.');
      }
    }

    const images = storedAttachments.filter((item) => item.mime_type.startsWith('image/'));
    const imageBase64List = await Promise.all(
      images.map(async (item) => {
        try {
          return (await fs.promises.readFile(item.storage_path)).toString('base64');
        } catch (error) {
          throw Object.assign(new Error('ไม่สามารถอ่านไฟล์ภาพที่อัปโหลดได้ กรุณาลองใหม่'), {
            status: 400,
            code: 'IMAGE_READ_FAILED',
            cause: error
          });
        }
      })
    );

    let visionResult = '';
    let ocrResult = '';

    if (imageBase64List.length > 0) {
      visionResult = await generateWithImages({
        model: config.models.vision,
        prompt: visionPrompt,
        imageBase64List
      });
      ocrResult = await generateWithImages({
        model: config.models.ocr,
        prompt: ocrPrompt,
        imageBase64List
      });
    }

    const publicAttachmentMetadata = storedAttachments.map(toPublicAttachment);
    const reasoningPrompt = buildTicketReasoningPrompt({
      text: message,
      visionResult,
      ocrResult,
      attachments: publicAttachmentMetadata
    });
    const reasoningResult = await generateText({
      model: config.models.reasoning,
      prompt: reasoningPrompt,
      format: 'json'
    });
    const parsed = parseAiJson(reasoningResult, aiTicketDraftSchema);
    if (!parsed.ok) {
      auditLog({
        action: 'intake.analyze.failed',
        success: false,
        ip,
        detail: { reason: parsed.error, attachment_count: storedAttachments.length }
      });
      throw Object.assign(new Error('AI ส่ง JSON ที่ไม่ถูกต้อง กรุณาลองใหม่หรือตรวจสอบโมเดลที่ตั้งค่าไว้'), {
        status: 502,
        code: 'AI_JSON_INVALID',
        details: parsed
      });
    }

    auditLog({
      action: 'intake.analyze.completed',
      success: true,
      ip,
      detail: { attachment_count: storedAttachments.length, image_count: images.length }
    });

    return {
      draft: parsed.data,
      vision_result: visionResult,
      ocr_result: ocrResult,
      reasoning_result: parsed.data,
      attachments: publicAttachmentMetadata,
      warnings,
      ...(config.ai.debug
        ? {
            debug: {
              models: config.models,
              reasoning_json_cleaned: parsed.cleaned,
              prompt_lengths: {
                reasoning: reasoningPrompt.length,
                vision: visionPrompt.length,
                ocr: ocrPrompt.length
              }
            }
          }
        : {})
    };
  } catch (error) {
    if (error.code !== 'AI_JSON_INVALID') {
      auditLog({
        action: 'intake.analyze.failed',
        success: false,
        ip,
        detail: { reason: error.code || error.message, attachment_count: storedAttachments.length }
      });
    }
    throw error;
  }
}

function toPublicAttachment(attachment) {
  return {
    id: attachment.id,
    created_at: attachment.created_at,
    original_name: attachment.original_name,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    sha256: attachment.sha256,
    page_count: attachment.page_count,
    metadata: attachment.metadata
  };
}
