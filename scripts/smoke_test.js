const base = process.env.APP_BASE_URL || 'http://127.0.0.1:3000';

async function assertOk(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

await assertOk('health', async () => {
  const res = await fetch(`${base}/api/health`);
  const data = await res.json();
  if (!data.ok) throw new Error(JSON.stringify(data));
});

await assertOk('rag search printer', async () => {
  const res = await fetch(`${base}/api/rag/search?q=${encodeURIComponent('เครื่องปริ้นเตอร์ห้องบัญชี')}`);
  const data = await res.json();
  if (!data.items?.some((item) => item.path.includes('printer'))) throw new Error(JSON.stringify(data.items));
});

await assertOk('chat printer category', async () => {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'เครื่องปริ้นเตอร์ห้องบัญชีพิมพ์ไม่ได้' }] })
  });
  const data = await res.json();
  if (data.ticket?.['ประเภท'] !== 'Printer') throw new Error(JSON.stringify(data));
});

await assertOk('ocr endpoint rejects empty', async () => {
  const res = await fetch(`${base}/api/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});
