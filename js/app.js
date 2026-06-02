// ============================================
// 1. LUCIDE ICONS INIT (with CDN fallback)
// ============================================
(function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
    return;
  }
  // Fallback: replace lucide icons with simple SVG circles/text
  document.querySelectorAll('[data-lucide]').forEach(el => {
    const icon = el.getAttribute('data-lucide');
    const size = parseInt(el.getAttribute('width') || el.getAttribute('height') || '16');
    el.innerHTML = icon
      ? '<span style=\"display:inline-block;width:'+size+'px;height:'+size+'px;border:1px solid currentColor;border-radius:2px;font-size:10px;line-height:'+size+'px;text-align:center;opacity:.6;\">' + icon[0].toUpperCase() + '</span>'
      : '';
  });
})();

// ============================================
// ============================================
// 2. VISIBILITY-AWARE TIMERS
// ============================================
const _timers = [];
document.addEventListener('visibilitychange', () => {
  const visible = !document.hidden;
  document.body.classList.toggle('tab-hidden', document.hidden);
  _timers.forEach(t => visible ? t.resume() : t.pause());
});
function createVisibleInterval(fn, ms) {
  let id = null, running = true;
  const t = {
    start() { if (id === null && running) id = setInterval(fn, ms); },
    pause() { if (id !== null) { clearInterval(id); id = null; } },
    resume() { if (!document.hidden) t.start(); },
    stop() { running = false; t.pause(); _timers.splice(_timers.indexOf(t), 1); },
    setInterval(newMs) { ms = newMs; t.pause(); t.start(); }
  };
  t.start();
  _timers.push(t);
  return t;
}

// ============================================
// 3. SYSTEM CLOCK
// ============================================
function updateClock() {
  const now = new Date();
  document.getElementById('sysClock').textContent =
    now.toLocaleTimeString('zh-CN', { hour12: false }) +
    ' · ' + now.toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
}
updateClock();
createVisibleInterval(updateClock, 1000);