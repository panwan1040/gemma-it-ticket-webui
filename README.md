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

- Model default: `Gemma 4 E4B QAT Q4_0 GGUF`
- Context default: `8192` for E4B, `16384` optional for 12B
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


## เลือกโมเดล

ค่า default ตอนนี้คือ E4B QAT เพราะเหมาะกับ Mac 16GB มากกว่า 12B สำหรับงาน Ticket/RAG เบาๆ

ดาวน์โหลด E4B:

```zsh
MODEL_SIZE=e4b scripts/download_model.sh
```

เปิด E4B:

```zsh
MODEL_SIZE=e4b CTX_SIZE=8192 scripts/start_model.sh
```

กลับไปใช้ 12B:

```zsh
MODEL_SIZE=12b scripts/download_model.sh
MODEL_SIZE=12b CTX_SIZE=16384 scripts/start_model.sh
```


## Chat triage mode

Web UI ตอนนี้เป็น multi-turn chat:

- ผู้ใช้ส่งข้อความได้หลายรอบ
- Agent ใช้บริบทบทสนทนาล่าสุดเพื่ออัปเดต Ticket draft
- ผู้ใช้แก้ field เองได้ก่อนบันทึก
- กดบันทึกเมื่อคิดว่าข้อมูลครบแล้วได้เลย
- Transcript จะถูกส่งไป Google Sheet ด้วยในคอลัมน์ `transcript`

## Apps Script note

อย่ากด Run ที่ `doPost` ตรงๆ เพราะ Apps Script จะไม่มี `e.postData` ให้ ทำให้เกิด error ได้

ถ้าต้องการทดสอบใน Apps Script editor ให้ Run ฟังก์ชัน `testDoPost` แทน

## Local knowledge vault / RAG

โปรเจกต์มี knowledge vault แบบ Markdown ที่ `knowledge/` เพื่อใช้กับ local RAG:

```text
knowledge/SOP/
knowledge/Assets/
knowledge/Incidents/
```

สร้าง index ใหม่หลังเพิ่มหรือแก้ note:

```zsh
npm run index:knowledge
```

ค้น knowledge ผ่าน API:

```text
/api/rag/search?q=กล้องหน้าโกดัง
```

เมื่อบันทึก ticket ระบบจะสร้าง incident note ลง `knowledge/Incidents/` ด้วย เพื่อให้เคสเก่ากลับมาเป็น context ในรอบถัดไป

ถ้าใช้ Obsidian ให้เปิดโฟลเดอร์ `knowledge/` เป็น vault ได้ทันที หรือย้าย `knowledge/` ไปอยู่ใน Obsidian vault แล้ว symlink กลับมาในโปรเจกต์นี้

## Image OCR worker

Chat UI รองรับการแนบรูป screenshot แล้ว ระบบจะส่งรูปไป `/api/ocr` เพื่อ OCR เป็นข้อความก่อน แล้วนำข้อความที่อ่านได้เข้า conversation context ให้ Gemma วิเคราะห์ต่อ

ข้อดีคือใช้ทรัพยากรน้อยกว่า vision model เต็มรูปแบบ และเหมาะกับ error screenshot / printer panel / NVR message

ข้อจำกัดปัจจุบัน:

- OCR ใช้ภาษาอังกฤษเป็นหลัก
- รูปไม่ควรเกิน 8MB
- หากเป็นภาพที่ไม่มีตัวอักษร ควรใช้ vision model/mmproj เพิ่มในอนาคต
