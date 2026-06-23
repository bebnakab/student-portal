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
