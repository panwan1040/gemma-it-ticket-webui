
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gemma-tests-'));
process.chdir(tmp);
process.env.NODE_ENV = 'test';
process.env.ADMIN_AUTH = 'admin:test-secret';
process.env.GOOGLE_SHEET_WEBHOOK_URL = '';
process.env.RATE_LIMIT_GENERAL_MAX = '1000';
process.env.RATE_LIMIT_CHAT_MAX = '1000';
process.env.RATE_LIMIT_UPLOAD_MAX = '1000';
process.env.RATE_LIMIT_TICKET_MAX = '1000';
await fs.mkdir('knowledge', { recursive: true });
await fs.mkdir('data', { recursive: true });

const mod = await import(`../server.js?test=${Date.now()}`);

test('safeKnowledgePath prevents path traversal', () => {
  const safe = mod.safeKnowledgePath('Policies/example.md');
  assert.equal(safe.clean, 'Policies/example.md');
  assert.throws(() => mod.safeKnowledgePath('../secret.md'), /path|invalid/i);
  assert.throws(() => mod.safeKnowledgePath('not-markdown.txt'), /markdown/i);
});

test('attachment filenames use random prefixes and safe extensions', () => {
  const a = mod.safeAttachmentName('error screen.png');
  const b = mod.safeAttachmentName('error screen.png');
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f-]{36}-error-screen\.png$/);
});

test('ticket IDs increment per day', async () => {
  await fs.writeFile('data/tickets.jsonl', JSON.stringify({ ticketId: 'IT-20260609-0001' }) + '\n');
  const id = await mod.generateTicketId(new Date('2026-06-09T10:00:00Z'));
  assert.equal(id, 'IT-20260609-0002');
});

test('fallback triage detects printer category', () => {
  const result = mod.fallbackTriage('เครื่องปริ้นพิมพ์ไม่ได้', []);
  assert.equal(result.ticket['ประเภท'], 'Printer');
  assert.match(result.agentReply, /เครื่องปริ้น|บริเวณ/);
});

test('RAG search scores relevant docs and filters unrelated docs', async () => {
  await fs.writeFile('data/rag-index.json', JSON.stringify({ docs: [
    { path: 'knowledge/Printer/fix.md', title: 'Printer fix', content: 'วิธีแก้เครื่องปริ้น paper jam printer', tokens: ['printer', 'เครื่องปริ้น', 'paper', 'jam'] },
    { path: 'knowledge/CCTV/cam.md', title: 'CCTV', content: 'กล้อง nvr cctv', tokens: ['กล้อง', 'nvr', 'cctv'] }
  ] }));
  const result = await mod.searchKnowledge('printer พิมพ์ไม่ได้');
  assert.ok(result.items.length >= 1);
  assert.equal(result.items[0].title, 'Printer fix');
});

test('protected admin endpoints require auth', async () => {
  const server = http.createServer(mod.app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const unauth = await fetch(`http://127.0.0.1:${port}/api/admin/tickets`);
  assert.equal(unauth.status, 401);
  const auth = await fetch(`http://127.0.0.1:${port}/api/admin/tickets`, {
    headers: { Authorization: `Basic ${Buffer.from('admin:test-secret').toString('base64')}` }
  });
  assert.equal(auth.status, 200);
  server.close();
});

test('utility bill extraction avoids unsafe amount guessing', () => {
  const full = mod.extractUtilityBill('การไฟฟ้าส่วนภูมิภาค G08101 GRST0181 020019320090 000022098363 5700622483 04/2559 1516.000 1284.000 232.000 ค่าพลังงานไฟฟ้า 865.13 ค่าบริการรายเดือน 8.19 ค่า Ft -11.14 รวมเงินค่าไฟฟ้า 862.18 ภาษีมูลค่าเพิ่ม 7 % 60.35 รวมเงินที่ต้องชำระ 922.53 วันครบกำหนดชำระเงิน 25 เม.ย. 2559');
  assert.match(full, /ค่าบริการรายเดือน \| 8\.19/);
  assert.match(full, /รวมเงินที่ต้องชำระ \| 922\.53/);

  const degraded = mod.extractUtilityBill('การไฟฟ้าส่วนภูมิภาค G08101 GRST0181 020019320090 000022098363 5700622483 04/2559 1516.000 1284.000 232.000 ค่าพลังงานไฟฟ้า 865.13 ค่า Ft -11.14 รวมเงินที่ต้องชำระ 922.53 ****922.53 วันครบกำหนดชำระเงิน 25 เม.ย. 2559');
  assert.doesNotMatch(degraded, /-853\.99/);
  assert.match(degraded, /ค่าบริการรายเดือน \| \[ต้องตรวจทาน\]/);
});

test('electricity invoice JSON keeps identifiers as strings and validates totals', () => {
  const invoice = mod.extractElectricityInvoiceJson(`การไฟฟ้าส่วนภูมิภาค G08101 GRST0181
หมายเลขผู้ใช้ไฟฟ้า CA/Ref.No.1 020019320090
Invoice No./Ref.No.2 000022098363
รหัสเครื่องวัด PEA No. 5700622483 ประจำเดือน 04/2559
1516.000 1284.000 232.000
ค่าพลังงานไฟฟ้า 865.13
ค่าบริการรายเดือน 8.19
ค่า Ft -0.0480 บาท/หน่วย -11.14
รวมเงินค่าไฟฟ้า 862.18
ภาษีมูลค่าเพิ่ม 7 % 60.35
รวมเงินที่ต้องชำระ 922.53
วันครบกำหนดชำระเงิน 25 เม.ย. 2559`);
  assert.equal(invoice.document_info.document_type, 'electricity_invoice');
  assert.equal(invoice.customer_info.ca_ref_no, '020019320090');
  assert.equal(invoice.customer_info.invoice_no, '000022098363');
  assert.equal(invoice.amounts.grand_total, 922.53);
  assert.equal(invoice.validation.subtotal_plus_vat_equals_grand_total, true);
});

test('factory electricity invoice JSON separates based amount, subtotal, vat, and grand total', () => {
  const invoice = mod.extractElectricityInvoiceJson(`ใบแจ้งค่าไฟฟ้า Smart Invoice
หมายเลขผู้ใช้ไฟฟ้า CA:Ref.No.1 020001393684
เลขที่ใบแจ้งค่าไฟฟ้า Invoice no. 015511999940
จำนวนเงิน (บาท) Total (Baht) 13,253,795.45
วันที่ครบกำหนดค่าไฟฟ้าเดือนปัจจุบัน Due Date 22 มิถุนายน 2569
G23103 GTTM9803 5900797446 31/05/2569 05/2569
เงินค่าไฟฟ้าฐาน (Based Amount) 11,817,246.48
ค่า Ft พ.ค.69-ส.ค.69=0.1623 บาท/หน่วย 569,478.24
*ส่วนลด (Discount)
รวมเงินค่าไฟฟ้า (Sub Total) 12,386,724.72
ภาษีมูลค่าเพิ่ม 7.00 % (VAT) 867,070.73
รวมเงินค่าไฟฟ้าเดือนปัจจุบัน (Total) 13,253,795.45
รวมเงินทั้งสิ้น (Grand Total) 13,253,795.45`);
  assert.equal(invoice.customer_info.ca_ref_no, '020001393684');
  assert.equal(invoice.amounts.base_amount, 11817246.48);
  assert.equal(invoice.amounts.ft_rate, 0.1623);
  assert.equal(invoice.amounts.ft_amount, 569478.24);
  assert.equal(invoice.amounts.subtotal, 12386724.72);
  assert.equal(invoice.amounts.vat_amount, 867070.73);
  assert.equal(invoice.amounts.grand_total, 13253795.45);
  assert.equal(invoice.validation.base_plus_ft_minus_discount_equals_subtotal, true);
  assert.equal(invoice.validation.subtotal_plus_vat_equals_grand_total, true);
});
