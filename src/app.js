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
    $('in-class').value = '';
    $('in-room').value = '';
    $('in-number').value = '';
    showLogin();
  }

  function restore() {
    var raw = sessionStorage.getItem(SKEY);
    if (!raw) return false;
    try {
      var s = JSON.parse(raw);
      lastQuery = s.query;
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
