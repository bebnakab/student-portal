# เว็บเช็คงาน & ขูดดูคะแนนสอบ (Student Grade Portal)

เว็บอ่านอย่างเดียวให้นักเรียนกรอก ชั้น/ห้อง/เลขที่ เพื่อดูสถานะการส่งงาน
และขูดดูคะแนนสอบ ข้อมูลทั้งหมดอยู่ใน Google Sheets ส่วนตัวของครู

## โครงสร้าง
- `index.html`, `style.css`, `config.js`, `src/` — เว็บส่วนหน้า (static)
- `apps-script/` — โค้ด backend (วางใน Google Apps Script)
- `mock.json` — ข้อมูลจำลองสำหรับทดสอบ

## 1) สร้าง Google Sheet (3 แท็บ)
ตั้งชื่อแท็บให้ตรงตามนี้ (ตัวพิมพ์ใหญ่-เล็กต้องตรง):

**Roster** — แถวแรกเป็นหัวคอลัมน์
| class | room | number | name |
|-------|------|--------|------|
| ม.5 | 1 | 1 | สมชาย ใจดี |

**Submissions** — คอลัมน์ที่ 4 เป็นต้นไปคือชื่อชิ้นงาน; เซลล์ใส่ `ส่งแล้ว` หรือเว้นว่าง
| class | room | number | ใบงาน 1 | ใบงาน 2 |
|-------|------|--------|---------|---------|
| ม.5 | 1 | 1 | ส่งแล้ว | |

**Exams** — แถวที่คอลัมน์แรกเป็น `MAX` เก็บคะแนนเต็ม; แถวอื่นคือคะแนนนักเรียน
| class | room | number | สอบกลางภาค | สอบปลายภาค |
|-------|------|--------|-----------|-----------|
| MAX | | | 20 | 30 |
| ม.5 | 1 | 1 | 18 | |

## 2) ติดตั้ง Apps Script
1. ใน Google Sheet เลือกเมนู **Extensions > Apps Script**
2. สร้างไฟล์ 2 ไฟล์ วางเนื้อหาจาก:
   - `apps-script/portal-lib.js` → ไฟล์ใหม่ชื่อ `portal-lib.gs`
   - `apps-script/Code.gs` → ไฟล์ `Code.gs`
   (บรรทัด `module.exports` ใน portal-lib ไม่มีผลใน Apps Script — ปล่อยไว้ได้)
3. **Deploy > New deployment > เลือกชนิด Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. คัดลอก URL ที่ลงท้ายด้วย `/exec`

## 3) ตั้งค่าและ host เว็บส่วนหน้า
1. เปิด `config.js` วาง URL ลง `APPS_SCRIPT_URL` และตั้ง `USE_MOCK: false`
2. แก้ `CLASSES` / `ROOMS` ให้ตรงกับโรงเรียน
3. อัปโหลดทั้งโฟลเดอร์ (ยกเว้น `test/`, `docs/`, `node_modules` ถ้ามี) ขึ้น host ฟรี:
   - **GitHub Pages:** push repo แล้วเปิด Pages ที่ branch หลัก
   - **Netlify:** ลากโฟลเดอร์ลง Netlify Drop

## พัฒนา/ทดสอบ
- รัน unit test: `npm test` (ต้องมี Node.js) — ทดสอบ `apps-script/portal-lib.js` + `src/portal-core.js`
- ทดสอบหน้าเว็บด้วย mock: ตั้ง `USE_MOCK: true` แล้วเสิร์ฟผ่าน http
  (`python -m http.server` แล้วเปิด `http://localhost:8000`)

## ความเป็นส่วนตัว
Google Sheet **ห้าม** publish เป็น public — เข้าถึงผ่าน Apps Script เท่านั้น
API คืนข้อมูลของนักเรียนทีละคนเสมอ
