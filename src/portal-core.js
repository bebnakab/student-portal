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
