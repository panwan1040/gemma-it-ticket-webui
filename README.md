# Gemma IT Ticket WebUI

Local Web UI สำหรับทดสอบ Agent รับแจ้งปัญหา IT/CCTV, สรุป Ticket, และบันทึกลง Google Sheet ผ่าน Apps Script webhook.

## ใช้ทำอะไร

- รับข้อความ เช่น `กล้องหน้าโกดังดูไม่ได้`
- ให้ Agent ถามข้อมูลเพิ่มเป็นภาษาไทย
- สรุป Ticket เป็นฟิลด์สำหรับ Google Sheet
- ใช้ Gemma 4 12B QAT 4-bit แบบ local ผ่าน `llama.cpp`
- ถ้าไม่ได้เปิดโมเดล จะ fallback ด้วย rules เพื่อทดสอบ UI ได้

## ติดตั้งพร้อมโมเดลบนเครื่องใหม่

```zsh
npm install
scripts/install_local.sh
```

สคริปต์นี้จะติดตั้ง/ตรวจ `llama.cpp`, ติดตั้ง Hugging Face downloader, ดาวน์โหลดโมเดล GGUF ลง `models/gemma-4-12b-qat/`, และสร้าง `.env` ถ้ายังไม่มี

โมเดลไม่ถูก commit เข้า git เพราะไฟล์ใหญ่มาก ให้แต่ละเครื่องดาวน์โหลดด้วยสคริปต์นี้แทน

## เปิดใช้งานแบบแยก 2 Terminal

Terminal 1 เปิดโมเดล local:

```zsh
scripts/start_model.sh
```

Terminal 2 เปิด Web UI:

```zsh
scripts/start_webui.sh
```

เปิดหน้าเว็บ:

```text
http://127.0.0.1:3000
```

## เปิดทั้งโมเดลและ Web UI พร้อมกัน

```zsh
scripts/dev_all.sh
```

## ค่าโมเดลที่ตั้งไว้

- Model: `Gemma 4 12B QAT Q4_0 GGUF`
- Context: `16384`
- Batch size: `1024`
- Micro-batch: `256`
- GPU layers: `99`
- Metal: ใช้อัตโนมัติผ่าน `llama.cpp` บน Apple Silicon
- KV cache: `q8_0` ทั้ง K และ V
- Reasoning: `off` เพื่อให้ API ส่ง JSON ใน `message.content` เสถียรกว่า
- Server: `http://127.0.0.1:18080/v1`

ถ้า Mac 16GB เริ่ม swap ให้ลด context:

```zsh
CTX_SIZE=8192 scripts/start_model.sh
```

## Google Sheet

1. สร้าง Google Sheet ใหม่
2. ไปที่ Extensions > Apps Script
3. วางโค้ดจาก `google-apps-script.gs`
4. Deploy > New deployment > Web app
5. Execute as: Me
6. Who has access: Anyone with the link
7. Copy Web app URL
8. ใส่ใน `.env`

```zsh
GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/xxxx/exec
```

ถ้าไม่ตั้ง webhook ระบบจะบันทึก local log ที่ `data/tickets.jsonl`

## Memory monitoring

```zsh
memory_pressure
vm_stat
top -o mem
```
