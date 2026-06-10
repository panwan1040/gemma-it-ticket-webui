const SHEET_NAME = 'Electricity Bills';
const HEADERS = [
  'timestamp',
  'sourceName',
  'provider',
  'customer_name',
  'service_address',
  'ca_ref_no',
  'invoice_no',
  'bill_period',
  'due_date',
  'meter_reading_date',
  'pea_code',
  'mru',
  'pea_no',
  'type',
  'total_kwh',
  'base_amount',
  'ft_rate',
  'ft_amount',
  'discount',
  'subtotal',
  'vat_rate',
  'vat_amount',
  'grand_total',
  'validation_subtotal_plus_vat',
  'confidence_overall',
  'low_confidence_fields',
  'invoice_json'
];

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Electricity bill webhook is ready. Use POST from the Web UI.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'No POST body received. Deploy as Web App and call the /exec URL.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const payload = JSON.parse(e.postData.contents);
  const sheet = ensureSheet_();
  sheet.appendRow(HEADERS.map((key) => {
    if (key === 'invoice_json') return JSON.stringify(payload.invoice || {});
    return payload[key] == null ? '' : payload[key];
  }));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function testDoPost() {
  return doPost({
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        sourceName: 'sample.pdf',
        provider: 'PEA',
        ca_ref_no: '020019320090',
        invoice_no: '000022098363',
        bill_period: '04/2559',
        total_kwh: 232,
        subtotal: 862.18,
        vat_amount: 60.35,
        grand_total: 922.53,
        validation_subtotal_plus_vat: true,
        confidence_overall: 0.8,
        invoice: { document_info: { document_type: 'electricity_invoice', provider: 'PEA' } }
      })
    }
  });
}
