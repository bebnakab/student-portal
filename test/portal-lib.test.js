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

test('buildSubmissions treats a recorded score as ส่งแล้ว and never leaks the number', () => {
  const header = ['class', 'room', 'number', 'ใบงาน 1', 'ใบงาน 2', 'ใบงาน 3'];
  const row = ['ม.5', '1', '1', '8', '0', '10.5'];
  assert.deepEqual(lib.buildSubmissions(header, row), [
    { item: 'ใบงาน 1', status: 'ส่งแล้ว' },
    { item: 'ใบงาน 2', status: 'ส่งแล้ว' },
    { item: 'ใบงาน 3', status: 'ส่งแล้ว' },
  ]);
});

test('normalizeSubmissionStatus keeps text statuses, hides numbers, defaults blanks', () => {
  assert.equal(lib.normalizeSubmissionStatus('ส่งแล้ว'), 'ส่งแล้ว');
  assert.equal(lib.normalizeSubmissionStatus('ยังไม่ส่ง'), 'ยังไม่ส่ง');
  assert.equal(lib.normalizeSubmissionStatus(''), 'ยังไม่ส่ง');
  assert.equal(lib.normalizeSubmissionStatus('8'), 'ส่งแล้ว');
  assert.equal(lib.normalizeSubmissionStatus(8), 'ส่งแล้ว');
  assert.equal(lib.normalizeSubmissionStatus('ส่งช้า'), 'ส่งช้า');
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
