'use strict';
// หน้าต่างขูดเพื่อดูคะแนนสอบ (Royal Gold) + เอฟเฟกต์ประกาศผล
// - กล่อง modal คงธีมขาวของแอป เฉพาะ "โซนขูด" เป็นทอง
// - ขูดถึงเกณฑ์ -> เผยคะแนน -> เอฟเฟกต์เต็มจอ (พลุถ้าผ่าน / ฝนถ้าไม่ผ่าน)
// - สัญญาเดิม: window.openScratchModal(v) โดย v = examView(...) มี item, score, max
(function () {
  var REVEAL = 0.6;          // ต้องขูดออก 60% จึงเผยคะแนน
  var PASS_RATIO = 0.6;      // คะแนนผ่านเกณฑ์ = 60% ของคะแนนเต็ม
  var PASS_ABS = 60;         // กรณีไม่มีคะแนนเต็ม (max) ใช้เกณฑ์สัมบูรณ์ 60

  var COAT = {
    stops: [[0,'#fff1bd'],[0.22,'#f4cf60'],[0.42,'#d39a2b'],[0.6,'#9a6c11'],[0.78,'#e7bd47'],[1,'#fde390']],
    accent: '#3a2a08'
  };

  // ---- ทรัพยากร/สถานะระดับ modal (เคลียร์ทุกครั้งที่ปิด) ----
  var listeners = [];   // { target, type, fn } ไว้ถอดตอนปิด
  var rafs = [];        // id ของ requestAnimationFrame ที่ยังวิ่งอยู่
  var fontsInjected = false;

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push({ target: target, type: type, fn: fn });
  }
  function raf(fn) { var id = requestAnimationFrame(fn); rafs.push(id); return id; }
  function cancelAllRaf() { rafs.forEach(cancelAnimationFrame); rafs = []; }
  function removeAllListeners() {
    listeners.forEach(function (l) { l.target.removeEventListener(l.type, l.fn); });
    listeners = [];
  }

  function injectFonts() {
    if (fontsInjected) return;
    fontsInjected = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Chonburi&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&display=swap';
    document.head.appendChild(link);
  }

  function isPassed(v) {
    if (v.max !== null && v.max !== undefined && v.max !== '') {
      return Number(v.score) >= PASS_RATIO * Number(v.max);
    }
    return Number(v.score) >= PASS_ABS;
  }

  // ===================== เปิด modal =====================
  function openScratchModal(v) {
    injectFonts();
    var passed = isPassed(v);
    var modal = document.getElementById('scratch-modal');
    modal.innerHTML =
      '<div class="modal-backdrop"></div>' +
      '<div class="modal-box">' +
        '<h3 class="sc-title"></h3>' +
        '<div class="sc-subtitle">Your Examination Result</div>' +
        '<div class="sc-stage">' +
          '<div class="sc-reveal">' +
            '<div class="sc-score-label">Score</div>' +
            '<div class="sc-score"></div>' +
            '<div class="sc-tag ' + (passed ? 'pass' : 'fail') + '"></div>' +
          '</div>' +
          '<canvas class="sc-canvas" width="280" height="200"></canvas>' +
          '<button type="button" class="sc-fallback btn-ghost" hidden>แตะเพื่อเผยคะแนน</button>' +
        '</div>' +
        '<div class="sc-hint">ใช้นิ้วหรือเมาส์ขูดแถบสีทอง</div>' +
        '<button type="button" class="sc-close btn-primary">ปิด</button>' +
      '</div>';

    modal.querySelector('.sc-title').textContent = v.item;
    modal.querySelector('.sc-score').textContent = v.score;
    modal.querySelector('.sc-tag').textContent = passed ? 'ผ่านเกณฑ์ · PASSED' : 'ต่ำกว่าเกณฑ์ · สู้ใหม่';
    modal.hidden = false;

    on(modal.querySelector('.sc-close'), 'click', closeModal);
    on(modal.querySelector('.modal-backdrop'), 'click', closeModal);

    setupScratch(
      modal.querySelector('.sc-canvas'),
      modal.querySelector('.sc-fallback'),
      v, passed
    );
  }

  function closeModal() {
    cancelAllRaf();
    removeAllListeners();
    var modal = document.getElementById('scratch-modal');
    modal.hidden = true;
    modal.innerHTML = '';
  }

  // ===================== โซนขูด (ทอง) =====================
  function setupScratch(canvas, fallback, v, passed) {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      // เบราว์เซอร์ไม่รองรับ canvas -> เผยคะแนนได้เลยด้วยการแตะ
      canvas.hidden = true;
      fallback.hidden = false;
      on(fallback, 'click', function () {
        fallback.hidden = true;
        triggerEffect(v, passed);
      });
      return;
    }

    var w = canvas.width, h = canvas.height;
    var facets = genFacets(w, h);
    var revealed = false, touched = false, drawing = false;
    var lastPt = null, lastCheck = 0, shimRaf = 0;

    function paint(phase) { drawCoating(ctx, w, h, facets, phase || 0); }

    function startShimmer() {
      cancelAnimationFrame(shimRaf);
      function tick() {
        if (touched || revealed) return;
        paint((performance.now() / 2600) % 1);
        shimRaf = raf(tick);
      }
      shimRaf = raf(tick);
    }

    paint(0);
    startShimmer();

    function pos(ev) {
      var rect = canvas.getBoundingClientRect();
      var t = ev.touches && ev.touches.length ? ev.touches[0] : ev;
      return {
        x: (t.clientX - rect.left) * (w / rect.width),
        y: (t.clientY - rect.top) * (h / rect.height)
      };
    }
    function dot(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    }
    function line(p) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 44; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (lastPt) { ctx.beginPath(); ctx.moveTo(lastPt.x, lastPt.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      dot(p.x, p.y);
    }
    function clearedRatio() {
      var img;
      try { img = ctx.getImageData(0, 0, w, h).data; } catch (e) { return 0; }
      var clear = 0, total = 0;
      for (var i = 3; i < img.length; i += 32) { total++; if (img[i] === 0) clear++; }
      return total ? clear / total : 0;
    }
    function maybeReveal() {
      if (revealed) return;
      if (clearedRatio() >= REVEAL) {
        revealed = true;
        canvas.classList.add('revealed');
        triggerEffect(v, passed);
      }
    }

    function start(ev) {
      if (revealed) return;
      touched = true;
      cancelAnimationFrame(shimRaf);
      paint(0);
      drawing = true;
      var p = pos(ev); lastPt = p; dot(p.x, p.y);
      ev.preventDefault();
    }
    function move(ev) {
      if (!drawing || revealed) return;
      ev.preventDefault();
      var p = pos(ev); line(p); lastPt = p;
      var now = Date.now();
      if (now - lastCheck > 110) { lastCheck = now; maybeReveal(); }
    }
    function end() {
      if (!drawing) return;
      drawing = false; lastPt = null;
      maybeReveal();
    }

    on(canvas, 'mousedown', start);
    on(canvas, 'touchstart', start, { passive: false });
    on(window, 'mousemove', move);
    on(canvas, 'touchmove', move, { passive: false });
    on(window, 'mouseup', end);
    on(canvas, 'touchend', end);
  }

  // วาดผิวทองพร้อม shimmer/gloss/label (ยกอัลกอริทึมจากดีไซน์)
  function genFacets(w, h) {
    var f = [];
    for (var i = 0; i < 46; i++) {
      var cx = Math.random() * w, cy = Math.random() * h;
      var rad = 7 + Math.random() * 22;
      var n = 4 + (Math.random() * 3 | 0);
      var pts = [];
      for (var k = 0; k < n; k++) {
        var a = (Math.PI * 2 * k) / n + Math.random() * 0.5;
        var rr = rad * (0.5 + Math.random() * 0.6);
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
      }
      f.push({ pts: pts, light: Math.random() > 0.5, a: 0.05 + Math.random() * 0.1 });
    }
    return f;
  }

  function drawCoating(ctx, w, h, facets, phase) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    var g = ctx.createLinearGradient(0, 0, w, h);
    COAT.stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var rg = ctx.createRadialGradient(w * 0.42, h * 0.34, 6, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    rg.addColorStop(0, 'rgba(255,248,214,0.36)'); rg.addColorStop(1, 'rgba(255,248,214,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < facets.length; i++) {
      var fc = facets[i];
      ctx.beginPath(); ctx.moveTo(fc.pts[0].x, fc.pts[0].y);
      for (var j = 1; j < fc.pts.length; j++) ctx.lineTo(fc.pts[j].x, fc.pts[j].y);
      ctx.closePath();
      ctx.fillStyle = fc.light ? 'rgba(255,250,222,' + fc.a + ')' : 'rgba(74,46,8,' + fc.a + ')';
      ctx.fill();
    }
    ctx.save();
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#fff6d8';
    ctx.translate(w / 2, h / 2); ctx.rotate(-0.52); ctx.translate(-w / 2, -h / 2);
    ctx.fillRect(-w, h * 0.15, w * 3, h * 0.05);
    ctx.fillRect(-w, h * 0.5, w * 3, h * 0.03);
    ctx.restore();
    var sx = -w * 0.5 + phase * (w * 2), bw = w * 0.42;
    var gs = ctx.createLinearGradient(sx, 0, sx + bw, h);
    gs.addColorStop(0, 'rgba(255,255,255,0)');
    gs.addColorStop(0.5, 'rgba(255,253,235,0.58)');
    gs.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gs; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COAT.accent; ctx.globalAlpha = 0.8;
    ctx.font = "700 16px 'IBM Plex Sans Thai', 'Sarabun', sans-serif";
    ctx.fillText('✦ ขูดตรงนี้ ✦', w / 2, h / 2 - 9);
    ctx.globalAlpha = 0.55;
    ctx.font = "600 10px 'IBM Plex Sans Thai', 'Sarabun', sans-serif";
    ctx.fillText('SCRATCH TO REVEAL', w / 2, h / 2 + 13);
    ctx.restore();
  }

  // ===================== เอฟเฟกต์เต็มจอ (ธีมมืด) =====================
  function triggerEffect(v, passed) {
    var modal = document.getElementById('scratch-modal');
    var stage = document.createElement('div');
    stage.className = 'sc-stage-fx';
    stage.style.background = passed
      ? 'radial-gradient(circle at 50% 42%, rgba(34,20,8,0.7), rgba(6,4,14,0.93))'
      : 'linear-gradient(180deg, rgba(22,30,48,0.93), rgba(8,12,22,0.96))';
    var accent = passed ? '#ffd75e' : '#a9bdd9';
    var accentSoft = passed ? 'rgba(255,215,94,0.3)' : 'rgba(169,189,217,0.28)';
    stage.innerHTML =
      '<canvas class="sc-fx-canvas" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>' +
      '<div class="sc-fx-card" style="border:1px solid ' + accentSoft + ';">' +
        '<div class="sc-fx-eyebrow" style="color:' + accent + ';">' + (passed ? 'CONGRATULATIONS' : 'TRY AGAIN') + '</div>' +
        '<div class="sc-fx-title" style="color:' + accent + ';">' + (passed ? 'ยอดเยี่ยมมาก!' : 'ไม่เป็นไร สู้ใหม่นะ') + '</div>' +
        '<div class="sc-fx-sub">' + (passed ? 'คุณทำได้ดีเกินเกณฑ์ ✦' : 'ครั้งหน้าทำได้ดีกว่านี้แน่นอน') + '</div>' +
        '<div class="sc-fx-score">' + v.score + '</div>' +
        '<div class="sc-fx-caption">คะแนนที่ได้</div>' +
        '<button type="button" class="sc-fx-close">ปิดหน้าต่าง</button>' +
      '</div>';
    modal.appendChild(stage);

    on(stage.querySelector('.sc-fx-close'), 'click', closeModal);

    var c = stage.querySelector('.sc-fx-canvas');
    c.width = c.clientWidth; c.height = c.clientHeight;
    if (passed) runFireworks(c); else runRain(c);
  }

  function runFireworks(c) {
    var fctx = c.getContext('2d');
    var fw = { rockets: [], parts: [], t: 0 };
    var colors = ['#ffd75e','#ff5da2','#5ad1ff','#9b5cff','#7cff8a','#ff7a45','#ffffff','#ffb347'];
    function loop() {
      var W = c.width, H = c.height;
      fctx.globalCompositeOperation = 'source-over';
      fctx.fillStyle = 'rgba(8,5,18,0.22)'; fctx.fillRect(0, 0, W, H);
      fw.t++;
      if (fw.t % 18 === 0 || (fw.rockets.length === 0 && fw.parts.length < 40)) {
        var tx = W * (0.18 + Math.random() * 0.64), ty = H * (0.16 + Math.random() * 0.34);
        fw.rockets.push({ x: tx, y: H + 10, tx: tx, ty: ty, vy: -(9 + Math.random() * 3) });
      }
      fctx.globalCompositeOperation = 'lighter';
      for (var i = fw.rockets.length - 1; i >= 0; i--) {
        var r = fw.rockets[i]; r.y += r.vy;
        fctx.fillStyle = '#ffe9a0';
        fctx.beginPath(); fctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2); fctx.fill();
        if (r.y <= r.ty) {
          var col = colors[(Math.random() * colors.length) | 0];
          var n = 46 + (Math.random() * 24 | 0);
          for (var k = 0; k < n; k++) {
            var a = (Math.PI * 2 * k) / n + Math.random() * 0.2, sp = 2 + Math.random() * 4.5;
            fw.parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col: col, sz: 1.6 + Math.random() * 1.8 });
          }
          fw.rockets.splice(i, 1);
        }
      }
      for (var p2 = fw.parts.length - 1; p2 >= 0; p2--) {
        var p = fw.parts[p2];
        p.x += p.vx; p.y += p.vy; p.vy += 0.055; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.012;
        if (p.life <= 0) { fw.parts.splice(p2, 1); continue; }
        fctx.globalAlpha = Math.max(0, p.life);
        fctx.fillStyle = p.col;
        fctx.beginPath(); fctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); fctx.fill();
      }
      fctx.globalAlpha = 1;
      raf(loop);
    }
    raf(loop);
  }

  function runRain(c) {
    var fctx = c.getContext('2d');
    var drops = [];
    for (var i = 0; i < 240; i++) {
      drops.push({ x: Math.random() * c.width, y: Math.random() * c.height, len: 12 + Math.random() * 22, sp: 7 + Math.random() * 9, op: 0.15 + Math.random() * 0.35 });
    }
    var clouds = Math.random() * 1000;
    function loop() {
      var W = c.width, H = c.height;
      fctx.globalCompositeOperation = 'source-over';
      fctx.clearRect(0, 0, W, H);
      clouds += 0.4;
      for (var ci = 0; ci < 4; ci++) {
        var cx = ((clouds * (0.4 + ci * 0.12) + ci * 380) % (W + 500)) - 250;
        var cy = 40 + ci * 46;
        var grad = fctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
        grad.addColorStop(0, 'rgba(120,134,160,0.20)');
        grad.addColorStop(1, 'rgba(120,134,160,0)');
        fctx.fillStyle = grad; fctx.fillRect(cx - 200, cy - 120, 400, 240);
      }
      fctx.strokeStyle = '#aebfd6'; fctx.lineWidth = 1.4; fctx.lineCap = 'round';
      for (var di = 0; di < drops.length; di++) {
        var d = drops[di];
        fctx.globalAlpha = d.op;
        fctx.beginPath(); fctx.moveTo(d.x, d.y); fctx.lineTo(d.x - 2, d.y + d.len); fctx.stroke();
        d.y += d.sp; d.x -= 0.6;
        if (d.y > H) { d.y = -d.len; d.x = Math.random() * (W + 40); }
      }
      fctx.globalAlpha = 1;
      raf(loop);
    }
    raf(loop);
  }

  window.openScratchModal = openScratchModal;
})();
