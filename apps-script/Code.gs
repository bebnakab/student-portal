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
    // DEBUG: ?debug=1 -> รายงานสถานะ Spreadsheet/แท็บ/แถว เพื่อวินิจฉัย (ลบทิ้งได้เมื่อแก้เสร็จ)
    if (e && e.parameter && e.parameter.debug) {
      payload = debugInfo_(ss, q);
    } else {
      // แท็บแยกตามชั้น เช่น "Roster_ม.6" — เติม suffix จากค่า class ที่ส่งมา
      var suffix = q.class ? ('_' + String(q.class).trim()) : '';
      var data = {
        roster: readSheetEither_(ss, 'Roster', suffix),
        submissions: readSheetEither_(ss, 'Submissions', suffix),
        exams: readSheetEither_(ss, 'Exams', suffix),
      };
      payload = buildResponse(data, q); // จาก portal-lib.js
    }
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

// DEBUG helper: รายงานว่าผูกกับ Spreadsheet ไหน, มีแท็บอะไรบ้าง, แต่ละแท็บมีกี่แถว/คอลัมน์,
// และตัวอย่าง 2 แถวแรกของแต่ละแท็บที่โค้ดต้องใช้ (Roster/Submissions/Exams).
function debugInfo_(ss, q) {
  if (!ss) return { ok: false, error: 'no_active_spreadsheet' };
  var allSheets = ss.getSheets().map(function (s) {
    return { name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn() };
  });
  var want = ['Roster', 'Submissions', 'Exams'];
  var detail = {};
  want.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { detail[name] = { exists: false }; return; }
    var values = sh.getDataRange().getValues();
    detail[name] = {
      exists: true,
      rowCount: values.length,
      header: values[0] || [],
      firstDataRow: values[1] || [],
    };
  });
  return {
    ok: true,
    debug: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    query: q,
    sheetTabs: allSheets,
    expectedTabs: detail,
  };
}
