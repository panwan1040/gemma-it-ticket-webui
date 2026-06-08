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
  'agentReply'
];

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  sheet.appendRow(HEADERS.map((key) => payload[key] || ''));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
