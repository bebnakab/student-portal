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
