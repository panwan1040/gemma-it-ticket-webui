const SHEET_NAME = 'Tickets';
const HEADERS = [
  'timestamp',
  'ประเภท',
  'ปัญหา',
  'ผลกระทบ',
  'ข้อมูลที่ได้รับ',
  'ระดับความเร่งด่วน',
  'ทีมที่เกี่ยวข้อง',
  'sourceMessage',
  'agentReply',
  'transcript'
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
    .createTextOutput(JSON.stringify({ ok: true, message: 'Ticket webhook is ready. Use POST from the Web UI.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'No POST body received. Do not click Run for doPost; deploy as Web App and call the /exec URL.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const payload = JSON.parse(e.postData.contents);
  const sheet = ensureSheet_();
  sheet.appendRow(HEADERS.map((key) => payload[key] || ''));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function testDoPost() {
  return doPost({
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        'ประเภท': 'CCTV/NVR',
        'ปัญหา': 'ทดสอบบันทึก',
        'ผลกระทบ': 'ทดสอบ',
        'ข้อมูลที่ได้รับ': 'เรียกจาก testDoPost',
        'ระดับความเร่งด่วน': 'Low',
        'ทีมที่เกี่ยวข้อง': 'IT Support',
        sourceMessage: 'manual test',
        agentReply: 'manual test',
        transcript: 'manual test'
      })
    }
  });
}
