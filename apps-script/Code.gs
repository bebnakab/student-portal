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
