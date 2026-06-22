# เว็บเช็คสถานะส่งงาน + ขูดดูคะแนนสอบ (Student Grade Portal) — Design Spec

วันที่: 2026-06-22
สถานะ: approved (รอ implementation plan)

## 1. เป้าหมาย (Purpose)

เว็บ **อ่านอย่างเดียว** สำหรับนักเรียน เปิดจากมือถือเป็นหลัก:
- กรอก **ชั้น / ห้อง / เลขที่** เพื่อระบุตัวตน (ไม่มีรหัสผ่าน/PIN)
- ดู **สถานะการส่งงาน** ของตัวเอง (ส่งแล้ว / ยังไม่ส่ง) รายชิ้น
- ดู **คะแนนสอบ** ผ่านลูกเล่น **บัตรขูด** (scratch-to-reveal เหมือนลอตเตอรี่)

ครูเป็นผู้ดูแลข้อมูลทั้งหมดใน Google Sheets และอัปเดตได้เองโดยไม่ต้องแก้โค้ด

### ขอบเขตที่ตัดออก (YAGNI / Out of scope)
- ไม่มีการอัปโหลดไฟล์งานจากนักเรียน (ดูสถานะอย่างเดียว)
- ไม่มีระบบ authentication จริง (ชั้น/ห้อง/เลขที่ = การระบุตัวตน ไม่ใช่การยืนยันตัวตน)
- ไม่มีคะแนนรวม/สรุป/กราฟ
- ไม่มี backend database — ใช้ Google Sheets เป็นแหล่งข้อมูล
- การ "ขูด" ไม่บันทึกถาวร (เปิด modal ใหม่ขูดใหม่ได้)

## 2. ภาพรวมสถาปัตยกรรม (Architecture)

```
[นักเรียน / มือถือ]
   │  เปิดเว็บ static (host ฟรี: GitHub Pages หรือ Netlify)
   ▼
[index.html + app.js]  ── กรอก ชั้น/ห้อง/เลขที่ ──┐
   │                                              │ fetch GET (class, room, number)
   ▼                                              ▼
[หน้า Dashboard]  ◄── JSON เฉพาะคนนั้น ──  [Apps Script Web App /exec]
                                                  │  อ่าน + กรองแถวที่ตรง
                                                  ▼
                                          [Google Sheet (private)]
                                          tabs: Roster / Submissions / Exams
```

**หลักความเป็นส่วนตัว:** Google Sheet ไม่ publish/public. Apps Script เป็นตัวกลางที่คืนข้อมูล
"เฉพาะนักเรียนคนที่ล็อกอินทีละคน" เท่านั้น → กรณีเลวร้ายสุดคือเดาเลขที่เพื่อนเห็นได้ทีละคน
แต่ข้อมูลทั้งก้อนไม่หลุด

## 3. แหล่งข้อมูล: Google Sheet (โครงสร้างแบบ Wide)

เลือก **Wide format** (1 แถว = 1 นักเรียน, 1 คอลัมน์ = 1 ชิ้นงาน/สนามสอบ) เพราะคนกรอกคือครู
ความสะดวกในการกรอกสำคัญกว่าความยืดหยุ่นเชิงโปรแกรม

คีย์ที่ใช้จับคู่ทุกแท็บ: `(class, room, number)`

### แท็บ `Roster`
ทะเบียนชื่อ — ใช้ตรวจว่ามีนักเรียนคนนี้จริง และเอาชื่อไปแสดง

| class | room | number | name |
|-------|------|--------|------|
| ม.5 | 1 | 1 | สมชาย ใจดี |

### แท็บ `Submissions` (งานทั่วไป — สถานะส่ง)
หัวคอลัมน์ตั้งแต่คอลัมน์ที่ 4 เป็นต้นไป = ชื่อชิ้นงาน
ค่าในเซลล์ = `ส่งแล้ว` หรือ `ยังไม่ส่ง` (เว้นว่าง = ตีความว่า "ยังไม่ส่ง")

| class | room | number | ใบงาน 1 | ใบงาน 2 | ... |
|-------|------|--------|---------|---------|-----|
| ม.5 | 1 | 1 | ส่งแล้ว | ยังไม่ส่ง | |

### แท็บ `Exams` (คะแนนสอบ — ซ่อนหลังบัตรขูด)
แถวแรกของข้อมูล (ป้ายคอลัมน์แรกว่า `MAX`) เก็บคะแนนเต็มของแต่ละสนามสอบ
แถวถัดมา = นักเรียนแต่ละคน, ค่าในเซลล์ = คะแนนที่ได้

| class | room | number | สอบเก็บคะแนน | สอบกลางภาค | ... |
|-------|------|--------|-------------|-----------|-----|
| MAX | | | 10 | 20 | |
| ม.5 | 1 | 1 | 8 | 18 | |

> การที่ "คอลัมน์ไหนเป็นคะแนนสอบ" ถูกตอบด้วยการอยู่ในแท็บ `Exams` — ครูไม่ต้องทำเครื่องหมายเอง

## 4. Backend: Google Apps Script Web App

ไฟล์เดียว `Code.gs` deploy เป็น Web App (execute as me, access: anyone)

### `doGet(e)`
รับ query params: `class`, `room`, `number`

ขั้นตอน:
1. validate ว่ามีครบทั้ง 3 ค่า → ถ้าไม่ครบ คืน `{ ok:false, error:"missing_params" }`
2. หาแถวใน `Roster` ที่ตรง `(class, room, number)` → ถ้าไม่พบ คืน `{ ok:true, found:false }`
3. อ่านแถวที่ตรงจาก `Submissions` → ประกอบ array `submissions`
   (ทุกคอลัมน์ตั้งแต่ที่ 4: `{ item: <header>, status: <cell|"ยังไม่ส่ง"> }`)
4. อ่านแถวที่ตรงจาก `Exams` + แถว `MAX` → ประกอบ array `exams`
   (`{ item: <header>, score: <cell>, max: <MAX cell> }`; ถ้าเซลล์ว่าง → `score:null` = ยังไม่ประกาศ)
5. คืน JSON:

```json
{
  "ok": true,
  "found": true,
  "name": "สมชาย ใจดี",
  "submissions": [
    { "item": "ใบงาน 1", "status": "ส่งแล้ว" },
    { "item": "ใบงาน 2", "status": "ยังไม่ส่ง" }
  ],
  "exams": [
    { "item": "สอบเก็บคะแนน", "score": 8,  "max": 10 },
    { "item": "สอบกลางภาค",   "score": 18, "max": 20 }
  ]
}
```

### CORS
frontend host แยก domain → ตั้ง response เป็น `ContentService` JSON.
ใช้รูปแบบ GET ธรรมดา (Apps Script `/exec` รองรับ cross-origin GET). หากเจอปัญหา preflight
ให้หลีกเลี่ยง custom headers (ส่ง params ผ่าน query string ล้วน ไม่ใส่ header พิเศษ)

## 5. Frontend (vanilla HTML/CSS/JS, mobile-first)

ไฟล์: `index.html`, `style.css`, `app.js` (+ `config.js` เก็บ URL ของ Apps Script)

### หน้า Login
- 3 ช่อง: **ชั้น** (dropdown), **ห้อง** (dropdown), **เลขที่** (input number)
- ปุ่ม "เข้าดูข้อมูล"
- รายการชั้น/ห้องตั้งค่าใน `config.js` (หรือดึงครั้งแรกจาก Apps Script — เริ่มจาก hardcode ใน config ก่อน)

### หน้า Dashboard
แสดงหลัง fetch สำเร็จและ `found:true`
- หัว: ชื่อนักเรียน + ชั้น/ห้อง/เลขที่ + ปุ่ม "ออก"
- **ส่วน A — รายการส่งงาน:** list ทีละชิ้น พร้อมไอคอน/สี
  - `ส่งแล้ว` → ✓ สีเขียว
  - `ยังไม่ส่ง` → ✗ สีแดง/เทา
- **ส่วน B — คะแนนสอบ:** การ์ดต่อสนามสอบ แต่ละอันเป็นปุ่ม
  - กด → เปิด **modal (หน้าต่างลอย)**
  - ใน modal มี **บัตรขูด**: `<canvas>` สีเทาคลุมคะแนน เขียน "ขูดตรงนี้เพื่อดูคะแนน"
  - ขูดด้วย touch (มือถือ) / mouse: ใช้ `globalCompositeOperation = 'destination-out'` ลบชั้นสีออก
  - ขูดถึง ~60% (วัดจาก pixel ที่โปร่งใส) → เผยคะแนนเต็มอัตโนมัติ + เอฟเฟกต์เบาๆ (เด้ง/confetti)
  - คะแนนข้างใต้แสดงเป็น `18 / 20`

### State / Session
- เก็บ `class/room/number` + ข้อมูลที่ fetch มาใน `sessionStorage`
- ปิดแท็บ → หาย ต้องกรอกใหม่
- การขูดไม่บันทึก — เปิด modal ใหม่ = บัตรขูดใหม่

## 6. Error Handling

| กรณี | พฤติกรรม |
|------|----------|
| กรอกไม่ครบ | เตือน inline ใต้ฟอร์ม ไม่ยิง request |
| ไม่พบนักเรียน (`found:false`) | "ไม่พบข้อมูล ตรวจสอบชั้น/ห้อง/เลขที่อีกครั้ง" |
| เชื่อม Apps Script ไม่ได้ / เน็ตหลุด | "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" + ปุ่มลองใหม่ |
| ไม่มีงานในแท็บ Submissions | ส่วน A แสดง "ยังไม่มีรายการงาน" |
| ยังไม่ประกาศคะแนนสอบ (`score:null`) | การ์ด/modal แสดง "ยังไม่ประกาศคะแนน" (ไม่มีบัตรขูด) |
| เครื่องไม่รองรับ canvas/touch | fallback ปุ่ม "แตะเพื่อเผยคะแนน" (ข้ามการขูด) |

## 7. Testing

- **Apps Script:** ทดสอบด้วย mock rows — เคส พบ / ไม่พบ / ไม่มีงาน / ไม่มีคะแนนสอบ / เซลล์ว่าง
- **Frontend:** ทดสอบด้วย mock JSON (ไม่ต้องต่อ Sheet จริงตอน dev)
  - render submissions ครบ/ว่าง
  - render exams + บัตรขูด ทั้ง touch, mouse, fallback
  - เคส error ทุกแบบในตารางข้อ 6

## 8. โครงไฟล์ที่จะสร้าง (เบื้องต้น)

```
/ (โปรเจกต์เว็บ)
├── index.html        # หน้า login + dashboard (SPA หน้าเดียว สลับ view)
├── style.css         # mobile-first
├── app.js            # logic: fetch, render, scratch card, session
├── config.js         # APPS_SCRIPT_URL + รายการชั้น/ห้อง
├── mock.json         # ข้อมูลจำลองสำหรับ dev/test
└── apps-script/
    └── Code.gs       # backend (วางใน Apps Script editor)
```

## 9. Deploy (สรุปขั้นตอนสำหรับครู — รายละเอียดอยู่ใน implementation plan)
1. สร้าง Google Sheet ตามโครง 3 แท็บ
2. วาง `Code.gs` ใน Apps Script ของ Sheet นั้น → Deploy เป็น Web App → คัดลอก `/exec` URL
3. ใส่ URL ลง `config.js`
4. push โฟลเดอร์เว็บขึ้น GitHub Pages หรือ Netlify
