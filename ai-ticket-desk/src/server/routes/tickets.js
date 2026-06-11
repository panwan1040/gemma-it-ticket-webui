import express from 'express';
import path from 'node:path';
import { config } from '../config.js';
import {
  createTicket,
  getAttachmentForTicket,
  getTicketById,
  listTickets,
  listTicketsForExport,
  ticketsToCsv,
  updateTicket
} from '../ticketService.js';
import { auditLog } from '../audit.js';
import { createRateLimiter, requireBasicAuth, sanitizeOriginalName } from '../security.js';

export const ticketsRouter = express.Router();
export const ticketExportRouter = express.Router();

const downloadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  action: 'attachment.download'
});

ticketsRouter.use(requireBasicAuth);

ticketsRouter.post(
  '/',
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimit.savePer15m,
    action: 'ticket.create'
  }),
  (req, res, next) => {
    try {
      const ticket = createTicket(req.body, req.ip);
      res.status(201).json(ticket);
    } catch (error) {
      next(error);
    }
  }
);

ticketsRouter.get('/', (_req, res) => {
  res.json({ tickets: listTickets() });
});

ticketsRouter.get('/:id', (req, res, next) => {
  try {
    const ticket = getTicketById(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'ไม่พบ ticket ที่ต้องการ' });
      return;
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

ticketsRouter.patch('/:id', (req, res, next) => {
  try {
    const ticket = updateTicket(req.params.id, req.body, req.ip);
    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'ไม่พบ ticket ที่ต้องการ' });
      return;
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get('/:id/attachments/:attachmentId', downloadLimiter, (req, res, next) => {
  try {
    const attachment = getAttachmentForTicket(req.params.id, req.params.attachmentId);
    if (!attachment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'ไม่พบไฟล์แนบที่ต้องการ' });
      return;
    }
    auditLog({
      action: 'attachment.download',
      targetType: 'attachment',
      targetId: attachment.id,
      success: true,
      ip: req.ip,
      detail: { ticket_id: req.params.id }
    });
    res.type(attachment.mime_type);
    res.download(attachment.storage_path, sanitizeOriginalName(path.basename(attachment.original_name)));
  } catch (error) {
    next(error);
  }
});

ticketExportRouter.use(requireBasicAuth);

ticketExportRouter.get('/tickets-export.json', (req, res, next) => {
  try {
    const tickets = listTicketsForExport();
    auditLog({ action: 'export.download', targetType: 'tickets', targetId: 'json', success: true, ip: req.ip });
    res.attachment('ai-ticket-desk-tickets.json').json({ tickets });
  } catch (error) {
    next(error);
  }
});

ticketExportRouter.get('/tickets-export.csv', (req, res, next) => {
  try {
    const tickets = listTicketsForExport();
    auditLog({ action: 'export.download', targetType: 'tickets', targetId: 'csv', success: true, ip: req.ip });
    res.type('text/csv; charset=utf-8');
    res.attachment('ai-ticket-desk-tickets.csv').send(ticketsToCsv(tickets));
  } catch (error) {
    next(error);
  }
});
