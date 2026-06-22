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
