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
  var payload;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // แท็บแยกตามชั้น เช่น "Roster_ม.6" — เติม suffix จากค่า class ที่ส่งมา
    var suffix = q.class ? ('_' + String(q.class).trim()) : '';
    var data = {
      roster: readSheetEither_(ss, 'Roster', suffix),
      submissions: readSheetEither_(ss, 'Submissions', suffix),
      exams: readSheetEither_(ss, 'Exams', suffix),
    };
    payload = buildResponse(data, q); // จาก portal-lib.js
  } catch (err) {
    console.error(err);
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

// อ่านแท็บแบบ "<base><suffix>" ก่อน (เช่น Roster_ม.6) ถ้าไม่มีค่อย fallback เป็น "<base>"
function readSheetEither_(ss, base, suffix) {
  if (suffix && ss.getSheetByName(base + suffix)) {
    return readSheet_(ss, base + suffix);
  }
  return readSheet_(ss, base);
}
