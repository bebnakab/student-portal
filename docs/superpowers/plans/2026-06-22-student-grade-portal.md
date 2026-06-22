# Student Grade Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างเว็บอ่านอย่างเดียวให้นักเรียนกรอกชั้น/ห้อง/เลขที่ เพื่อดูสถานะส่งงานและขูดดูคะแนนสอบ โดยมี Google Apps Script เป็น API อ่านข้อมูลจาก Google Sheets ส่วนตัว

**Architecture:** Static frontend (vanilla HTML/CSS/JS, ไม่มี build step) host ฟรี เรียก Apps Script Web App `/exec` ผ่าน `fetch` GET. Apps Script อ่าน 3 แท็บ (Roster/Submissions/Exams) แล้วคืน JSON เฉพาะนักเรียนหนึ่งคน. ตรรกะล้วน (data shaping ทั้งฝั่ง backend และ frontend) แยกเป็นฟังก์ชัน pure ที่ทดสอบด้วย Node test runner; ส่วน DOM/canvas เป็น glue บางๆ ตรวจด้วยมือ.

**Tech Stack:** HTML5, CSS3 (mobile-first), Vanilla JS (ES5-safe สำหรับ browser เก่า), Google Apps Script (V8), Node.js built-in test runner (`node --test`, ไม่มี dependency)

## Global Constraints

- ไม่มี build step / ไม่มี framework / ไม่มี npm dependency — frontend เป็นไฟล์ static เปิดตรงได้
- ไฟล์ logic ที่ทดสอบได้ต้องเป็น pure function + export แบบ guarded: `if (typeof module !== 'undefined' && module.exports) module.exports = {...}` (ทำงานทั้ง Node และ browser/Apps Script)
- ภาษาในหน้าเว็บทั้งหมดเป็นภาษาไทย
- mobile-first: ออกแบบสำหรับจอมือถือก่อน
- Google Sheet ต้อง **ไม่** publish เป็น public — เข้าถึงผ่าน Apps Script เท่านั้น
- API คืนข้อมูลของนักเรียน **คนเดียว** ต่อหนึ่ง request เสมอ
- สถานะส่งงานมี 2 ค่า: `ส่งแล้ว` / `ยังไม่ส่ง` (เซลล์ว่าง = `ยังไม่ส่ง`)
- คะแนนสอบแสดงรูปแบบ `score / max`; ถ้ายังไม่ประกาศ (`score` เป็น null) แสดง `ยังไม่ประกาศคะแนน`
- เกณฑ์เผยบัตรขูดอัตโนมัติ = ขูดออก 60% ของพื้นที่ (`REVEAL = 0.6`)

---

## File Structure

```
student-portal/
├── index.html              # โครงหน้า: login view + dashboard view + overlay + scratch modal container
├── style.css               # mobile-first styles
├── config.js               # APPS_SCRIPT_URL, USE_MOCK, CLASSES, ROOMS (window.PORTAL_CONFIG)
├── mock.json               # ตัวอย่าง API response สำหรับ dev/test ฝั่ง frontend
├── package.json            # test script (node --test) — ไม่มี dependency
├── src/
│   ├── portal-core.js      # pure: validateLogin, buildApiUrl, submissionView, examView, scratchRevealReached
│   ├── app.js              # DOM glue: dropdowns, fetch, render, session, error overlay
│   └── scratch.js          # openScratchModal: canvas scratch-to-reveal + fallback
├── apps-script/
│   ├── portal-lib.js       # pure: normStr, findRow, buildSubmissions, buildExams, validateQuery, buildResponse
│   └── Code.gs             # doGet + SpreadsheetApp glue (เรียก buildResponse)
├── test/
│   ├── portal-lib.test.js  # ทดสอบ portal-lib
│   └── portal-core.test.js # ทดสอบ portal-core
├── README.md               # คู่มือ deploy (Sheet + Apps Script + hosting)
└── docs/superpowers/...    # spec + plan
```

ลำดับ task: backend logic (TDD) → backend glue → frontend logic (TDD) → static shell → frontend glue → scratch → deploy docs. แต่ละ task จบด้วย deliverable ที่ตรวจได้เอง.

---

### Task 1: Backend pure logic — `apps-script/portal-lib.js`

แปลง 2D array จาก 3 แท็บ → payload JSON ของนักเรียนหนึ่งคน. รวม scaffolding (`package.json`, `test/`) ในงานนี้เพราะ test รันครั้งแรกที่นี่.

**Files:**
- Create: `package.json`
- Create: `apps-script/portal-lib.js`
- Test: `test/portal-lib.test.js`

**Interfaces:**
- Consumes: (ไม่มี — งานแรก)
- Produces:
  - `normStr(v) -> string` (trim, null-safe)
  - `findRow(rows, cls, room, number) -> row|null` (rows รวม header ที่ index 0; match คอลัมน์ 0/1/2)
  - `buildSubmissions(headerRow, dataRow|null) -> [{item, status}]`
  - `buildExams(headerRow, maxRow|null, dataRow|null) -> [{item, score:number|null, max:number|null}]`
  - `validateQuery({class, room, number}) -> boolean`
  - `buildResponse({roster, submissions, exams}, {class, room, number}) -> response object`

- [ ] **Step 1: สร้าง `package.json`**

```json
{
  "name": "student-grade-portal",
  "version": "1.0.0",
  "private": true,
  "description": "Read-only student portal: submission status + scratch-to-reveal exam scores",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: เขียน test ที่ยังล้มเหลว — `test/portal-lib.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../apps-script/portal-lib.js');

test('validateQuery requires all three fields', () => {
  assert.equal(lib.validateQuery({ class: 'ม.5', room: '1', number: '1' }), true);
  assert.equal(lib.validateQuery({ class: 'ม.5', room: '', number: '1' }), false);
  assert.equal(lib.validateQuery({ class: '', room: '', number: '' }), false);
});

test('findRow matches on class/room/number and ignores header row', () => {
  const rows = [
    ['class', 'room', 'number', 'name'],
    ['ม.5', '1', '1', 'สมชาย'],
    ['ม.5', '1', '2', 'สมหญิง'],
  ];
  assert.deepEqual(lib.findRow(rows, 'ม.5', '1', '2'), ['ม.5', '1', '2', 'สมหญิง']);
  assert.equal(lib.findRow(rows, 'ม.5', '1', '9'), null);
});

test('findRow treats number 1 and "1" as equal', () => {
  const rows = [['class', 'room', 'number', 'name'], ['ม.5', 1, 1, 'สมชาย']];
  assert.deepEqual(lib.findRow(rows, 'ม.5', '1', '1'), ['ม.5', 1, 1, 'สมชาย']);
});

test('buildSubmissions defaults blank cells to ยังไม่ส่ง', () => {
  const header = ['class', 'room', 'number', 'ใบงาน 1', 'ใบงาน 2'];
  const row = ['ม.5', '1', '1', 'ส่งแล้ว', ''];
  assert.deepEqual(lib.buildSubmissions(header, row), [
    { item: 'ใบงาน 1', status: 'ส่งแล้ว' },
    { item: 'ใบงาน 2', status: 'ยังไม่ส่ง' },
  ]);
});

test('buildSubmissions with null dataRow marks everything ยังไม่ส่ง', () => {
  const header = ['class', 'room', 'number', 'ใบงาน 1'];
  assert.deepEqual(lib.buildSubmissions(header, null), [
    { item: 'ใบงาน 1', status: 'ยังไม่ส่ง' },
  ]);
});

test('buildExams reads MAX row and nulls blank scores', () => {
  const header = ['class', 'room', 'number', 'สอบกลางภาค', 'สอบปลายภาค'];
  const maxRow = ['MAX', '', '', '20', '30'];
  const row = ['ม.5', '1', '1', '18', ''];
  assert.deepEqual(lib.buildExams(header, maxRow, row), [
    { item: 'สอบกลางภาค', score: 18, max: 20 },
    { item: 'สอบปลายภาค', score: null, max: 30 },
  ]);
});

test('buildResponse returns missing_params when incomplete', () => {
  assert.deepEqual(
    lib.buildResponse({ roster: [], submissions: [], exams: [] }, { class: '', room: '', number: '' }),
    { ok: false, error: 'missing_params' }
  );
});

test('buildResponse returns found:false when roster has no match', () => {
  const data = { roster: [['class', 'room', 'number', 'name']], submissions: [], exams: [] };
  assert.deepEqual(
    lib.buildResponse(data, { class: 'ม.5', room: '1', number: '1' }),
    { ok: true, found: false }
  );
});

test('buildResponse assembles full payload for a matched student', () => {
  const data = {
    roster: [['class', 'room', 'number', 'name'], ['ม.5', '1', '1', 'สมชาย']],
    submissions: [['class', 'room', 'number', 'ใบงาน 1'], ['ม.5', '1', '1', 'ส่งแล้ว']],
    exams: [
      ['class', 'room', 'number', 'สอบกลางภาค'],
      ['MAX', '', '', '20'],
      ['ม.5', '1', '1', '18'],
    ],
  };
  assert.deepEqual(lib.buildResponse(data, { class: 'ม.5', room: '1', number: '1' }), {
    ok: true,
    found: true,
    name: 'สมชาย',
    submissions: [{ item: 'ใบงาน 1', status: 'ส่งแล้ว' }],
    exams: [{ item: 'สอบกลางภาค', score: 18, max: 20 }],
  });
});
```

- [ ] **Step 3: รัน test ให้เห็นว่าล้มเหลว**

Run: `node --test`
Expected: FAIL — `Cannot find module '../apps-script/portal-lib.js'`

- [ ] **Step 4: เขียน implementation ขั้นต่ำ — `apps-script/portal-lib.js`**

```js
'use strict';
// Pure data-shaping logic. ทำงานได้ทั้งใน Node (require) และ Google Apps Script (global functions).
// บรรทัด module.exports ท้ายไฟล์ถูกข้ามใน Apps Script เพราะ typeof module === 'undefined'.

function normStr(v) {
  return String(v == null ? '' : v).trim();
}

function keyMatch(row, cls, room, number) {
  return normStr(row[0]) === normStr(cls) &&
         normStr(row[1]) === normStr(room) &&
         normStr(row[2]) === normStr(number);
}

function findRow(rows, cls, room, number) {
  for (var i = 1; i < rows.length; i++) {
    if (keyMatch(rows[i], cls, room, number)) return rows[i];
  }
  return null;
}

function buildSubmissions(headerRow, dataRow) {
  var out = [];
  for (var c = 3; c < headerRow.length; c++) {
    var item = normStr(headerRow[c]);
    if (!item) continue;
    var status = normStr(dataRow ? dataRow[c] : '') || 'ยังไม่ส่ง';
    out.push({ item: item, status: status });
  }
  return out;
}

function buildExams(headerRow, maxRow, dataRow) {
  var out = [];
  for (var c = 3; c < headerRow.length; c++) {
    var item = normStr(headerRow[c]);
    if (!item) continue;
    var rawScore = normStr(dataRow ? dataRow[c] : '');
    var score = rawScore === '' ? null : Number(rawScore);
    if (score !== null && isNaN(score)) score = null;
    var rawMax = normStr(maxRow ? maxRow[c] : '');
    var max = rawMax === '' ? null : Number(rawMax);
    if (max !== null && isNaN(max)) max = null;
    out.push({ item: item, score: score, max: max });
  }
  return out;
}

function validateQuery(q) {
  return Boolean(normStr(q.class) && normStr(q.room) && normStr(q.number));
}

function findMaxRow(rows) {
  for (var i = 1; i < rows.length; i++) {
    if (normStr(rows[i][0]).toUpperCase() === 'MAX') return rows[i];
  }
  return null;
}

function buildResponse(data, q) {
  if (!validateQuery(q)) return { ok: false, error: 'missing_params' };
  var rosterRow = findRow(data.roster, q.class, q.room, q.number);
  if (!rosterRow) return { ok: true, found: false };
  var subHeader = data.submissions[0] || [];
  var subRow = findRow(data.submissions, q.class, q.room, q.number);
  var examHeader = data.exams[0] || [];
  var maxRow = findMaxRow(data.exams);
  var examRow = findRow(data.exams, q.class, q.room, q.number);
  return {
    ok: true,
    found: true,
    name: normStr(rosterRow[3]),
    submissions: buildSubmissions(subHeader, subRow),
    exams: buildExams(examHeader, maxRow, examRow),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normStr: normStr,
    keyMatch: keyMatch,
    findRow: findRow,
    buildSubmissions: buildSubmissions,
    buildExams: buildExams,
    validateQuery: validateQuery,
    findMaxRow: findMaxRow,
    buildResponse: buildResponse,
  };
}
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `node --test`
Expected: PASS — ทุก test ผ่าน (9 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json apps-script/portal-lib.js test/portal-lib.test.js
git commit -m "feat(backend): add pure data-shaping logic for student payload"
```

---

### Task 2: Backend Apps Script entry — `apps-script/Code.gs`

Glue ที่อ่าน Google Sheet แล้วเรียก `buildResponse`. ทดสอบอัตโนมัติใน Node ไม่ได้ (พึ่ง `SpreadsheetApp`) — ตรวจด้วยการ inspect โค้ดและทดสอบจริงตอน deploy (Task 7).

**Files:**
- Create: `apps-script/Code.gs`

**Interfaces:**
- Consumes: `buildResponse(data, q)` จาก `portal-lib.js` (ใน Apps Script ทั้งสองไฟล์อยู่ใน project เดียว แชร์ global scope)
- Produces: HTTP endpoint `doGet(e)` คืน `ContentService` JSON

- [ ] **Step 1: เขียน `apps-script/Code.gs`**

```js
'use strict';
// Google Apps Script Web App entry point.
// ต้องวางไฟล์นี้ + portal-lib.js ไว้ใน Apps Script project เดียวกัน (แชร์ global scope)
// Deploy: Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone

function doGet(e) {
  var q = {
    class: (e && e.parameter && e.parameter.class) || '',
    room: (e && e.parameter && e.parameter.room) || '',
    number: (e && e.parameter && e.parameter.number) || '',
  };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = {
    roster: readSheet_(ss, 'Roster'),
    submissions: readSheet_(ss, 'Submissions'),
    exams: readSheet_(ss, 'Exams'),
  };
  var payload;
  try {
    payload = buildResponse(data, q); // จาก portal-lib.js
  } catch (err) {
    payload = { ok: false, error: 'server_error' };
  }
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues();
}
```

- [ ] **Step 2: ตรวจสอบ consistency (inspect)**

ยืนยันด้วยสายตา:
- `doGet` อ่าน param ชื่อ `class`, `room`, `number` ตรงกับที่ `buildApiUrl` (Task 3) จะส่ง
- เรียก `buildResponse(data, q)` ด้วย key `roster`/`submissions`/`exams` ตรงกับที่ `buildResponse` คาดหวัง
- คืน MIME `JSON`

Expected: ครบทุกข้อ (ไม่มี automated test สำหรับไฟล์นี้)

- [ ] **Step 3: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(backend): add Apps Script doGet endpoint reading Sheet tabs"
```

---

### Task 3: Frontend pure logic — `src/portal-core.js`

ตรรกะฝั่ง browser ที่ทดสอบได้: validate ฟอร์ม, ประกอบ URL, แปลง item เป็น view model, คำนวณเกณฑ์เผยบัตรขูด.

**Files:**
- Create: `src/portal-core.js`
- Test: `test/portal-core.test.js`

**Interfaces:**
- Consumes: (ไม่มี)
- Produces (เป็น global ใน browser, เป็น module.exports ใน Node):
  - `validateLogin({class, room, number}) -> {valid:boolean, errors:string[], query:{class, room, number}}`
  - `buildApiUrl(baseUrl, query) -> string`
  - `submissionView({item, status}) -> {item, status, submitted:boolean}`
  - `examView({item, score, max}) -> {item, announced:boolean, score, max, display:string}`
  - `scratchRevealReached(clearedPixels, totalPixels, threshold?) -> boolean` (threshold default 0.6)

- [ ] **Step 1: เขียน test ที่ยังล้มเหลว — `test/portal-core.test.js`**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/portal-core.js');

test('validateLogin flags every missing field', () => {
  const r = core.validateLogin({ class: '', room: '', number: '' });
  assert.equal(r.valid, false);
  assert.equal(r.errors.length, 3);
});

test('validateLogin trims values and returns normalized query', () => {
  const r = core.validateLogin({ class: ' ม.5 ', room: '1', number: ' 2 ' });
  assert.equal(r.valid, true);
  assert.deepEqual(r.query, { class: 'ม.5', room: '1', number: '2' });
  assert.equal(r.errors.length, 0);
});

test('buildApiUrl encodes class/room/number as query string', () => {
  const url = core.buildApiUrl('https://x/exec', { class: 'ม.5', room: '1', number: '2' });
  assert.ok(url.indexOf('https://x/exec?') === 0);
  assert.ok(url.indexOf('room=1') !== -1);
  assert.ok(url.indexOf('number=2') !== -1);
});

test('buildApiUrl appends with & when base already has query', () => {
  const url = core.buildApiUrl('https://x/exec?v=1', { class: 'A', room: 'B', number: 'C' });
  assert.ok(url.indexOf('https://x/exec?v=1&') === 0);
});

test('submissionView marks ส่งแล้ว as submitted', () => {
  assert.deepEqual(core.submissionView({ item: 'ก', status: 'ส่งแล้ว' }),
    { item: 'ก', status: 'ส่งแล้ว', submitted: true });
  assert.deepEqual(core.submissionView({ item: 'ข', status: 'ยังไม่ส่ง' }),
    { item: 'ข', status: 'ยังไม่ส่ง', submitted: false });
});

test('examView formats announced score and unannounced', () => {
  assert.deepEqual(core.examView({ item: 'ส', score: 18, max: 20 }),
    { item: 'ส', announced: true, score: 18, max: 20, display: '18 / 20' });
  const ua = core.examView({ item: 'ป', score: null, max: 30 });
  assert.equal(ua.announced, false);
  assert.equal(ua.display, 'ยังไม่ประกาศคะแนน');
});

test('scratchRevealReached uses 0.6 default and respects override', () => {
  assert.equal(core.scratchRevealReached(60, 100), true);
  assert.equal(core.scratchRevealReached(59, 100), false);
  assert.equal(core.scratchRevealReached(50, 100, 0.5), true);
  assert.equal(core.scratchRevealReached(0, 0), false);
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าล้มเหลว**

Run: `node --test test/portal-core.test.js`
Expected: FAIL — `Cannot find module '../src/portal-core.js'`

- [ ] **Step 3: เขียน implementation — `src/portal-core.js`**

```js
'use strict';
// Pure frontend logic. ใน browser โหลดเป็น classic <script> -> ฟังก์ชันกลายเป็น global.
// ใน Node ทดสอบผ่าน module.exports (guarded).

function validateLogin(form) {
  var cls = String(form.class || '').trim();
  var room = String(form.room || '').trim();
  var number = String(form.number || '').trim();
  var errors = [];
  if (!cls) errors.push('กรุณาเลือกชั้น');
  if (!room) errors.push('กรุณาเลือกห้อง');
  if (!number) errors.push('กรุณากรอกเลขที่');
  return { valid: errors.length === 0, errors: errors, query: { class: cls, room: room, number: number } };
}

function buildApiUrl(baseUrl, query) {
  var parts = [
    'class=' + encodeURIComponent(query.class),
    'room=' + encodeURIComponent(query.room),
    'number=' + encodeURIComponent(query.number),
  ];
  var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
  return baseUrl + sep + parts.join('&');
}

function submissionView(item) {
  var status = item.status || 'ยังไม่ส่ง';
  return { item: item.item, status: status, submitted: status === 'ส่งแล้ว' };
}

function examView(item) {
  var announced = item.score !== null && item.score !== undefined;
  return {
    item: item.item,
    announced: announced,
    score: item.score,
    max: item.max,
    display: announced ? (item.score + ' / ' + item.max) : 'ยังไม่ประกาศคะแนน',
  };
}

function scratchRevealReached(clearedPixels, totalPixels, threshold) {
  if (!totalPixels) return false;
  var t = (threshold === undefined || threshold === null) ? 0.6 : threshold;
  return (clearedPixels / totalPixels) >= t;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateLogin: validateLogin,
    buildApiUrl: buildApiUrl,
    submissionView: submissionView,
    examView: examView,
    scratchRevealReached: scratchRevealReached,
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test`
Expected: PASS — ทุก test ผ่าน (Task 1 + Task 3 รวมกัน)

- [ ] **Step 5: Commit**

```bash
git add src/portal-core.js test/portal-core.test.js
git commit -m "feat(frontend): add pure logic for login/url/view-models"
```

---

### Task 4: Static shell — `index.html`, `style.css`, `config.js`, `mock.json`

โครงหน้าและสไตล์ + config + ข้อมูล mock. ตรวจด้วยการเปิดในเบราว์เซอร์ (ยังไม่มี behavior — แค่เห็นหน้า login บนจอมือถือ).

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `config.js`
- Create: `mock.json`

**Interfaces:**
- Consumes: `src/portal-core.js` (Task 3), `src/app.js` (Task 5), `src/scratch.js` (Task 6) — โหลดเป็น `<script>`
- Produces:
  - `window.PORTAL_CONFIG = { APPS_SCRIPT_URL, USE_MOCK, CLASSES, ROOMS }`
  - DOM ids ที่ app.js (Task 5) จะใช้: `in-class`, `in-room`, `in-number`, `btn-login`, `login-error`, `login-view`, `dashboard-view`, `dash-name`, `dash-meta`, `btn-logout`, `submissions-list`, `exams-list`, `overlay`, `overlay-msg`, `overlay-retry`, `scratch-modal`

- [ ] **Step 1: เขียน `config.js`**

```js
'use strict';
window.PORTAL_CONFIG = {
  // วาง URL ของ Apps Script Web App (ลงท้าย /exec) ที่นี่หลัง deploy (Task 7)
  APPS_SCRIPT_URL: '',
  // true = ใช้ mock.json (พัฒนา/ทดสอบ), false = เรียก Apps Script จริง
  USE_MOCK: true,
  CLASSES: ['ม.4', 'ม.5', 'ม.6'],
  ROOMS: ['1', '2', '3', '4'],
};
```

- [ ] **Step 2: เขียน `mock.json`**

```json
{
  "ok": true,
  "found": true,
  "name": "สมชาย ใจดี",
  "submissions": [
    { "item": "ใบงานที่ 1 การเคลื่อนที่แนวตรง", "status": "ส่งแล้ว" },
    { "item": "ใบงานที่ 2 แรงและกฎการเคลื่อนที่", "status": "ยังไม่ส่ง" },
    { "item": "การทดลองที่ 1 วัดความเร่ง", "status": "ส่งแล้ว" }
  ],
  "exams": [
    { "item": "สอบเก็บคะแนนครั้งที่ 1", "score": 8, "max": 10 },
    { "item": "สอบกลางภาค", "score": 18, "max": 20 },
    { "item": "สอบปลายภาค", "score": null, "max": 30 }
  ]
}
```

- [ ] **Step 3: เขียน `index.html`**

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>เช็คงาน &amp; คะแนนสอบ</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">

    <!-- LOGIN VIEW -->
    <section id="login-view" class="view">
      <div class="card login-card">
        <h1>เช็คงาน &amp; คะแนนสอบ</h1>
        <label class="field">ชั้น
          <select id="in-class"></select>
        </label>
        <label class="field">ห้อง
          <select id="in-room"></select>
        </label>
        <label class="field">เลขที่
          <input id="in-number" type="number" inputmode="numeric" min="1" placeholder="เช่น 12">
        </label>
        <button id="btn-login" type="button" class="btn-primary">เข้าดูข้อมูล</button>
        <p id="login-error" class="error" hidden></p>
      </div>
    </section>

    <!-- DASHBOARD VIEW -->
    <section id="dashboard-view" class="view" hidden>
      <header class="dash-header">
        <div>
          <div id="dash-name" class="dash-name"></div>
          <div id="dash-meta" class="dash-meta"></div>
        </div>
        <button id="btn-logout" type="button" class="btn-ghost">ออก</button>
      </header>

      <h2 class="section-title">การส่งงาน</h2>
      <ul id="submissions-list" class="sub-list"></ul>

      <h2 class="section-title">คะแนนสอบ</h2>
      <div id="exams-list" class="exam-grid"></div>
    </section>

    <!-- LOADING / ERROR OVERLAY -->
    <div id="overlay" class="overlay" hidden>
      <div class="overlay-box">
        <p id="overlay-msg"></p>
        <button id="overlay-retry" type="button" class="btn-primary" hidden>ลองใหม่</button>
      </div>
    </div>

    <!-- SCRATCH MODAL CONTAINER (เติมโดย scratch.js) -->
    <div id="scratch-modal" class="modal" hidden></div>

  </div>

  <script src="src/portal-core.js"></script>
  <script src="config.js"></script>
  <script src="src/scratch.js"></script>
  <script src="src/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: เขียน `style.css`**

```css
:root {
  --green: #2e9e5b;
  --red: #d94c4c;
  --gray: #9aa3ad;
  --bg: #f3f5f7;
  --card: #ffffff;
  --text: #222;
  --primary: #2f6fed;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", "Sarabun", system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}
#app { max-width: 480px; margin: 0 auto; padding: 16px; }
.view { width: 100%; }
.card {
  background: var(--card);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,.06);
}
.login-card { margin-top: 24px; }
h1 { font-size: 1.3rem; text-align: center; margin: 0 0 18px; }
.field { display: block; margin-bottom: 14px; font-size: .95rem; }
.field select, .field input {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  font-size: 1rem;
  border: 1px solid #ccd2da;
  border-radius: 10px;
}
.btn-primary {
  width: 100%;
  padding: 13px;
  font-size: 1.05rem;
  color: #fff;
  background: var(--primary);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}
.btn-ghost {
  padding: 8px 14px;
  background: transparent;
  border: 1px solid #ccd2da;
  border-radius: 10px;
  cursor: pointer;
}
.error { color: var(--red); margin: 12px 0 0; font-size: .9rem; }

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.dash-name { font-size: 1.2rem; font-weight: 700; }
.dash-meta { color: #667; font-size: .85rem; }
.section-title { font-size: 1.05rem; margin: 18px 0 10px; }

.sub-list { list-style: none; margin: 0; padding: 0; }
.sub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.sub-item .icon { font-weight: 700; }
.sub-item.done .icon { color: var(--green); }
.sub-item.todo .icon { color: var(--red); }
.sub-item .name { flex: 1; }
.sub-item .status { font-size: .85rem; color: #667; }
.empty { color: #889; font-size: .9rem; padding: 6px 2px; }

.exam-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.exam-card {
  text-align: left;
  background: var(--card);
  border: 1px solid #e3e7ec;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.exam-card.disabled { opacity: .55; cursor: default; }
.exam-card .exam-name { font-weight: 600; }
.exam-card .exam-hint { font-size: .8rem; color: #667; }

.overlay, .modal {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.45);
  z-index: 20;
}
.overlay-box, .modal-box {
  background: #fff; border-radius: 14px; padding: 22px;
  text-align: center; max-width: 320px; width: 86%;
  position: relative; z-index: 21;
}
.modal-backdrop { position: absolute; inset: 0; }

.sc-title { margin: 0 0 14px; font-size: 1.05rem; }
.sc-stage {
  position: relative; width: 280px; height: 140px; margin: 0 auto;
  display: flex; align-items: center; justify-content: center;
}
.sc-score {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 2.2rem; font-weight: 800; color: var(--primary);
}
.sc-canvas {
  position: absolute; inset: 0; border-radius: 10px;
  transition: opacity .4s; touch-action: none;
}
.sc-canvas.revealed { opacity: 0; pointer-events: none; }
.sc-fallback { margin-top: 8px; }
.sc-close { margin-top: 16px; }
```

- [ ] **Step 5: ตรวจด้วยมือ — เปิดในเบราว์เซอร์**

Run: เปิด `index.html` ในเบราว์เซอร์ แล้วเปิด DevTools > Toggle device toolbar (โหมดมือถือ)
Expected:
- เห็นการ์ด login กลางจอ มีหัวข้อ "เช็คงาน & คะแนนสอบ"
- มี dropdown ชั้น/ห้อง (ยังว่าง เพราะ app.js ยังไม่เติม — ปกติ), ช่องเลขที่, ปุ่ม "เข้าดูข้อมูล"
- ไม่มี error ใน Console เกี่ยวกับ `style.css` หรือไฟล์ `<script>` ที่ยังไม่มี (จะเห็น 404 ของ app.js/scratch.js ได้ — ยอมรับได้จนกว่า Task 5/6)

- [ ] **Step 6: Commit**

```bash
git add index.html style.css config.js mock.json
git commit -m "feat(frontend): add static shell, styles, config and mock data"
```

---

### Task 5: Frontend glue — `src/app.js`

เชื่อมทุกอย่าง: เติม dropdown, รับ submit, fetch (mock/จริง), render submissions + exams, session, overlay error.

**Files:**
- Create: `src/app.js`

**Interfaces:**
- Consumes:
  - global จาก `portal-core.js`: `validateLogin`, `buildApiUrl`, `submissionView`, `examView`
  - global จาก `scratch.js` (Task 6): `openScratchModal(examViewObj)` — ถูกเรียกตอนกดการ์ดสอบ
  - `window.PORTAL_CONFIG`
  - DOM ids จาก `index.html` (Task 4)
- Produces: (ไม่มี API ให้ task อื่น — เป็น entry point)

- [ ] **Step 1: เขียน `src/app.js`**

```js
'use strict';
(function () {
  var cfg = window.PORTAL_CONFIG;
  var SKEY = 'portal_session';

  function $(id) { return document.getElementById(id); }

  function initDropdowns() {
    var sc = $('in-class');
    var sr = $('in-room');
    sc.innerHTML = '<option value="">— เลือกชั้น —</option>';
    sr.innerHTML = '<option value="">— เลือกห้อง —</option>';
    cfg.CLASSES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c; sc.appendChild(o);
    });
    cfg.ROOMS.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r; o.textContent = 'ห้อง ' + r; sr.appendChild(o);
    });
  }

  function showLogin() { $('login-view').hidden = false; $('dashboard-view').hidden = true; }
  function showDashboard() { $('login-view').hidden = true; $('dashboard-view').hidden = false; }

  function setOverlay(msg, retry) {
    $('overlay-msg').textContent = msg;
    $('overlay-retry').hidden = !retry;
    $('overlay').hidden = false;
  }
  function clearOverlay() { $('overlay').hidden = true; }

  function fetchData(query) {
    if (cfg.USE_MOCK) {
      return fetch('mock.json').then(function (r) { return r.json(); });
    }
    return fetch(buildApiUrl(cfg.APPS_SCRIPT_URL, query)).then(function (r) { return r.json(); });
  }

  function renderSubmissions(submissions) {
    var ul = $('submissions-list');
    ul.innerHTML = '';
    if (!submissions || submissions.length === 0) {
      var li0 = document.createElement('li');
      li0.className = 'empty';
      li0.textContent = 'ยังไม่มีรายการงาน';
      ul.appendChild(li0);
      return;
    }
    submissions.forEach(function (s) {
      var v = submissionView(s);
      var li = document.createElement('li');
      li.className = 'sub-item ' + (v.submitted ? 'done' : 'todo');
      var icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = v.submitted ? '✓' : '✗';
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = v.item;
      var status = document.createElement('span');
      status.className = 'status';
      status.textContent = v.status;
      li.appendChild(icon); li.appendChild(name); li.appendChild(status);
      ul.appendChild(li);
    });
  }

  function renderExams(exams) {
    var grid = $('exams-list');
    grid.innerHTML = '';
    if (!exams || exams.length === 0) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'ยังไม่มีคะแนนสอบ';
      grid.appendChild(p);
      return;
    }
    exams.forEach(function (e) {
      var v = examView(e);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'exam-card' + (v.announced ? '' : ' disabled');
      var nm = document.createElement('span');
      nm.className = 'exam-name';
      nm.textContent = v.item;
      var hint = document.createElement('span');
      hint.className = 'exam-hint';
      hint.textContent = v.announced ? 'แตะเพื่อดูคะแนน' : 'ยังไม่ประกาศคะแนน';
      card.appendChild(nm); card.appendChild(hint);
      if (v.announced) {
        card.addEventListener('click', function () { openScratchModal(v); });
      } else {
        card.disabled = true;
      }
      grid.appendChild(card);
    });
  }

  function renderDashboard(data, query) {
    $('dash-name').textContent = data.name;
    $('dash-meta').textContent = query.class + ' / ห้อง ' + query.room + ' / เลขที่ ' + query.number;
    renderSubmissions(data.submissions);
    renderExams(data.exams);
    showDashboard();
  }

  function doLogin(query) {
    setOverlay('กำลังโหลด...', false);
    fetchData(query).then(function (data) {
      clearOverlay();
      if (!data || data.ok === false) {
        setOverlay('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', true);
        return;
      }
      if (!data.found) {
        showLogin();
        var el = $('login-error');
        el.textContent = 'ไม่พบข้อมูล ตรวจสอบชั้น/ห้อง/เลขที่อีกครั้ง';
        el.hidden = false;
        return;
      }
      sessionStorage.setItem(SKEY, JSON.stringify({ query: query, data: data }));
      renderDashboard(data, query);
    }).catch(function () {
      setOverlay('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง', true);
    });
  }

  var lastQuery = null;

  function onLoginClick() {
    var res = validateLogin({
      class: $('in-class').value,
      room: $('in-room').value,
      number: $('in-number').value,
    });
    var err = $('login-error');
    if (!res.valid) {
      err.textContent = res.errors.join(' · ');
      err.hidden = false;
      return;
    }
    err.hidden = true;
    lastQuery = res.query;
    doLogin(res.query);
  }

  function logout() {
    sessionStorage.removeItem(SKEY);
    $('in-number').value = '';
    showLogin();
  }

  function restore() {
    var raw = sessionStorage.getItem(SKEY);
    if (!raw) return false;
    try {
      var s = JSON.parse(raw);
      renderDashboard(s.data, s.query);
      return true;
    } catch (e) { return false; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDropdowns();
    $('btn-login').addEventListener('click', onLoginClick);
    $('btn-logout').addEventListener('click', logout);
    $('overlay-retry').addEventListener('click', function () {
      clearOverlay();
      if (lastQuery) doLogin(lastQuery);
    });
    if (!restore()) showLogin();
  });
})();
```

- [ ] **Step 2: ตรวจด้วยมือ — flow หลัก (USE_MOCK = true)**

Run: เปิด `index.html` ในเบราว์เซอร์ (โหมดมือถือ) — ต้องเสิร์ฟผ่าน http (เช่น `python -m http.server` ในโฟลเดอร์โปรเจกต์ แล้วเปิด `http://localhost:8000`) เพราะ `fetch('mock.json')` ต้องใช้ http ไม่ใช่ file://
Expected:
- dropdown ชั้นมี ม.4/ม.5/ม.6, ห้องมี ห้อง 1–4
- กด"เข้าดูข้อมูล" โดยไม่เลือก → ขึ้น error "กรุณาเลือกชั้น · กรุณาเลือกห้อง · กรุณากรอกเลขที่"
- เลือกครบแล้วกด → เห็น dashboard: ชื่อ "สมชาย ใจดี", รายการส่งงาน 3 ชิ้น (✓ เขียว 2, ✗ แดง 1), การ์ดสอบ 3 ใบ (2 ใบกดได้, "สอบปลายภาค" เป็น disabled แสดง "ยังไม่ประกาศคะแนน")
- refresh หน้า → ยังอยู่ที่ dashboard (session restore)
- กด "ออก" → กลับหน้า login, refresh แล้วยังอยู่หน้า login

- [ ] **Step 3: ตรวจด้วยมือ — error state**

Run: ใน `config.js` ตั้ง `USE_MOCK: false` ชั่วคราว และ `APPS_SCRIPT_URL: 'https://invalid.example/exec'` แล้ว login
Expected: ขึ้น overlay "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" + ปุ่ม "ลองใหม่"
หลังทดสอบ คืนค่า `USE_MOCK: true` และ `APPS_SCRIPT_URL: ''`

- [ ] **Step 4: Commit**

```bash
git add src/app.js config.js
git commit -m "feat(frontend): wire login, fetch, render, session and error overlay"
```

---

### Task 6: Scratch-card modal — `src/scratch.js`

Modal เปิดเมื่อกดการ์ดสอบ; มี canvas ให้ขูด เผยคะแนนเมื่อขูดถึง 60%; มี fallback ถ้า canvas ใช้ไม่ได้.

**Files:**
- Create: `src/scratch.js`

**Interfaces:**
- Consumes:
  - global `scratchRevealReached(cleared, total, threshold)` จาก `portal-core.js`
  - DOM id `scratch-modal` จาก `index.html`
  - object จาก `examView` (มี `.item`, `.display`)
- Produces: global `openScratchModal(examViewObj)` — เรียกโดย `app.js` (Task 5)

- [ ] **Step 1: เขียน `src/scratch.js`**

```js
'use strict';
(function () {
  var REVEAL = 0.6;

  function buildModal(v) {
    var modal = document.getElementById('scratch-modal');
    modal.innerHTML =
      '<div class="modal-backdrop"></div>' +
      '<div class="modal-box">' +
        '<h3 class="sc-title"></h3>' +
        '<div class="sc-stage">' +
          '<div class="sc-score"></div>' +
          '<canvas class="sc-canvas" width="280" height="140"></canvas>' +
          '<button type="button" class="sc-fallback btn-ghost" hidden>แตะเพื่อเผยคะแนน</button>' +
        '</div>' +
        '<button type="button" class="sc-close btn-primary">ปิด</button>' +
      '</div>';
    modal.querySelector('.sc-title').textContent = v.item;
    modal.querySelector('.sc-score').textContent = v.display;
    modal.hidden = false;

    modal.querySelector('.sc-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

    setupScratch(modal.querySelector('.sc-canvas'), modal.querySelector('.sc-fallback'));
  }

  function closeModal() {
    var modal = document.getElementById('scratch-modal');
    modal.hidden = true;
    modal.innerHTML = '';
  }

  function setupScratch(canvas, fallback) {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      canvas.hidden = true;
      fallback.hidden = false;
      fallback.addEventListener('click', function () { fallback.hidden = true; });
      return;
    }
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ขูดตรงนี้เพื่อดูคะแนน', canvas.width / 2, canvas.height / 2);
    ctx.globalCompositeOperation = 'destination-out';

    var drawing = false;
    var revealed = false;

    function pos(ev) {
      var rect = canvas.getBoundingClientRect();
      var t = ev.touches && ev.touches.length ? ev.touches[0] : ev;
      return {
        x: (t.clientX - rect.left) * (canvas.width / rect.width),
        y: (t.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    function clearedCount() {
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var clear = 0;
      for (var i = 3; i < img.length; i += 4) { if (img[i] === 0) clear++; }
      return clear;
    }

    function scratch(ev) {
      if (!drawing) return;
      ev.preventDefault();
      var p = pos(ev);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();
      if (!revealed && scratchRevealReached(clearedCount(), canvas.width * canvas.height, REVEAL)) {
        revealed = true;
        canvas.classList.add('revealed');
      }
    }

    function start(ev) { drawing = true; scratch(ev); }
    function end() { drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', scratch);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', scratch, { passive: false });
    canvas.addEventListener('touchend', end);
  }

  window.openScratchModal = buildModal;
})();
```

- [ ] **Step 2: ตรวจด้วยมือ — ขูดด้วยเมาส์**

Run: เสิร์ฟผ่าน http, login (mock), กดการ์ด "สอบกลางภาค"
Expected:
- modal เปิด หัวข้อ "สอบกลางภาค", มีแผ่นสีเทาเขียน "ขูดตรงนี้เพื่อดูคะแนน"
- กดเมาส์ค้างแล้วลากบนแผ่นเทา → สีถูกขูดออกเป็นรอย
- ขูดออกพอประมาณ (~60%) → แผ่นเทาจางหายทันที เผยคะแนน "18 / 20"
- กด "ปิด" หรือพื้นมืดรอบ modal → modal ปิด

- [ ] **Step 3: ตรวจด้วยมือ — มือถือ (touch) + เปิดใหม่ขูดใหม่**

Run: ใน DevTools device mode ใช้ touch ขูด; ปิด modal แล้วเปิดการ์ดเดิมอีกครั้ง
Expected:
- ขูดด้วย touch ได้ (ลากนิ้ว), หน้าไม่ scroll ระหว่างขูด
- เปิด modal ใหม่ → แผ่นเทาเต็มอีกครั้ง (การขูดไม่ถูกบันทึก) — ตรงตาม spec

- [ ] **Step 4: Commit**

```bash
git add src/scratch.js
git commit -m "feat(frontend): add scratch-to-reveal exam modal with touch + fallback"
```

---

### Task 7: Deploy guide — `README.md`

คู่มือให้ครูตั้ง Google Sheet, deploy Apps Script, และ host frontend. ปิดงานด้วยเอกสารที่ทำตามได้จริง.

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: ทุกไฟล์ก่อนหน้า
- Produces: (เอกสาร)

- [ ] **Step 1: เขียน `README.md`**

````markdown
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
4. คัดลอก URL ที่ลงท้าย `/exec`

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
````

- [ ] **Step 2: ตรวจด้วยมือ**

Run: อ่าน `README.md`
Expected: ชื่อแท็บ (Roster/Submissions/Exams) และชื่อคอลัมน์ตรงกับที่ `portal-lib.js` คาดหวัง; ขั้นตอน deploy ครบ

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add deploy guide for Sheet, Apps Script and hosting"
```

---

## Self-Review

**1. Spec coverage:**
- §1 login ชั้น/ห้อง/เลขที่ → Task 4 (form) + Task 5 (validate/fetch) + Task 3 (`validateLogin`) ✔
- §1 สถานะส่งงาน ส่งแล้ว/ยังไม่ส่ง → Task 1 (`buildSubmissions`) + Task 3 (`submissionView`) + Task 5 (`renderSubmissions`) ✔
- §1 ขูดดูคะแนนสอบ → Task 6 (`scratch.js`) + Task 3 (`scratchRevealReached`/`examView`) ✔
- §3 Sheet 3 แท็บ wide + MAX row → Task 1 (`findRow`/`buildExams`/`findMaxRow`) + Task 7 (README) ✔
- §4 Apps Script doGet + JSON shape → Task 1 (`buildResponse`) + Task 2 (`Code.gs`) ✔
- §4 CORS → Task 2 (ContentService JSON, GET ผ่าน query string ล้วน ไม่มี custom header) + Task 5 (`buildApiUrl` query string) ✔
- §5 login view / dashboard view / 2 ส่วน / session → Task 4 (DOM) + Task 5 (render/session) ✔
- §5 scratch modal + auto-reveal 60% + ไม่บันทึกถาวร → Task 6 ✔
- §6 error handling ทุกเคส: กรอกไม่ครบ (Task 5 Step2), ไม่พบ (Task 5 `found:false`), เน็ตหลุด (Task 5 catch), ไม่มีงาน (Task 5 `renderSubmissions` empty), ยังไม่ประกาศคะแนน (Task 3 `examView`/Task 5 disabled card), canvas ไม่รองรับ (Task 6 fallback) ✔
- §7 testing: Apps Script logic (Task 1), frontend logic (Task 3), scratch manual (Task 6) ✔
- §8 file structure → ตรงกับ File Structure ด้านบน ✔

**2. Placeholder scan:** ไม่มี TBD/TODO; ทุก step ที่แก้โค้ดมีโค้ดเต็ม; manual-verify step มีผลลัพธ์ที่คาดหวังชัดเจน ✔

**3. Type consistency:**
- `buildResponse` key: `roster`/`submissions`/`exams` — ตรงกันใน Task 1 (test + impl) และ Task 2 (`Code.gs`) ✔
- query key: `class`/`room`/`number` — ตรงกันใน `validateLogin`, `buildApiUrl`, `doGet` param ✔
- payload shape `{ok, found, name, submissions:[{item,status}], exams:[{item,score,max}]}` — ตรงกันใน Task 1, `mock.json` (Task 4), `submissionView`/`examView` (Task 3), render (Task 5) ✔
- `openScratchModal(v)` รับ object จาก `examView` (`.item`, `.display`) — ตรงกันใน Task 5 (เรียก) และ Task 6 (นิยาม) ✔
- `scratchRevealReached(cleared, total, threshold)` — นิยาม Task 3, เรียก Task 6 ลำดับ argument ตรง ✔

ไม่พบ gap หรือความไม่สอดคล้อง
