// 7. MODAL SYSTEM
// ============================================
function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('active');
  if (id === 'modalAlert') {
    const lv = window._alertLevel || 0;
    const labels = {0:'无告警',1:'LEVEL 1 — 轻微异常',2:'LEVEL 2 — 关节扭矩异常',3:'LEVEL 3 — 严重故障',4:'LEVEL 4 — 紧急停机'};
    const cssCls = {0:'text-cyber-green',1:'text-cyber-amber',2:'text-cyber-amber',3:'text-cyber-red',4:'text-cyber-red'};
    const dotColor = lv >= 3 ? 'bg-cyber-red' : lv >= 1 ? 'bg-cyber-amber' : 'bg-cyber-green';
    const anim = lv >= 3 ? 'pulse-dot 0.6s ease-in-out infinite' : lv >= 1 ? 'pulse-dot 1.5s ease-in-out infinite' : 'none';
    document.getElementById('alertTime').textContent =
      new Date().toLocaleTimeString('zh-CN', { hour12: false });
    document.getElementById('emergencyResult').classList.add('hidden');
    const alertLevelEl = document.getElementById('alertLevelText');
    if (alertLevelEl) {
      alertLevelEl.textContent = labels[lv] || labels[2];
      alertLevelEl.className = `font-mono ${cssCls[lv] || 'text-cyber-amber'}`;
    }
    const alertDotEl = document.getElementById('alertModalDot');
    if (alertDotEl) {
      alertDotEl.className = `w-2 h-2 rounded-full ${dotColor} ${lv > 0 ? 'alert-pulse' : ''}`;
      if (lv > 0) alertDotEl.style.animation = anim;
    }
  }
  if (id === 'modalSettings') {
    const themeSel = document.getElementById('setTheme');
    if (themeSel) themeSel.value = currentTheme;
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

document.getElementById('btnSettings').addEventListener('click', () => openModal('modalSettings'));
document.getElementById('btnAlert').addEventListener('click', () => openModal('modalAlert'));

// Settings: Apply
function applySettings() {
  // Theme
  const themeSelect = document.getElementById('setTheme');
  if (themeSelect) switchTheme(themeSelect.value);

  // Scanlines
  const scanlineEl = document.querySelector('.scanlines');
  const scanlineVal = document.getElementById('setScanlines').value;
  if (scanlineEl) scanlineEl.style.display = scanlineVal === '关闭' ? 'none' : '';

  // Refresh rate
  const refreshSelect = document.getElementById('setRefresh');
  if (refreshSelect) {
    const rates = { '1s': 1000, '3s': 3000, '5s': 5000, '10s': 10000 };
    const interval = rates[refreshSelect.value] || 3000;
    if (window._telemetryTimer) window._telemetryTimer.stop();
    window._telemetryTimer = createVisibleInterval(updateTelemetry, interval);
  }

  // Chart animation toggle
  const animSelect = document.getElementById('setAnimation');
  if (animSelect) {
    const animOn = animSelect.value === '开启';
    Object.values(window.__charts || {}).forEach(c => {
      c.options.animation = animOn;
      c.options.animations = animOn ? {} : false;
      c.update('none');
    });
  }

  // Alert threshold — store for telemetry feedback
  const thresholdSelect = document.getElementById('setThreshold');
  if (thresholdSelect) {
    window._cpuThreshold = parseInt(thresholdSelect.value) || 80;
    addAlertLog(`CPU告警阈值更新 → ${thresholdSelect.value}`, 'text-cyber-amber');
  }

  // Terminal history limit
  const histSelect = document.getElementById('setHistoryLimit');
  if (histSelect) {
    window._historyLimit = parseInt(histSelect.value) || 100;
    while (cmdHistory.length > window._historyLimit) cmdHistory.shift();
  }

  // Flash feedback
  const applyBtn = document.querySelector('#modalSettings button.text-cyber-cyan');
  if (applyBtn) { applyBtn.textContent = '✓ APPLIED'; setTimeout(() => { applyBtn.textContent = 'APPLY'; }, 1500); }

  addAlertLog('系统配置已更新', 'text-cyber-cyan');
  setTimeout(() => closeModal('modalSettings'), 800);
}

// Unit selector handler — full data switch
document.getElementById('unitSelect').addEventListener('change', function() {
  var unitId = this.value;
  if (!unitProfiles[unitId]) return;
  // Save current unit state
  unitProfiles[currentUnit].nodes = Object.assign({}, nodeStates);
  // Switch
  currentUnit = unitId;
  nodeStates = unitProfiles[currentUnit].nodes;
  var p = unitProfiles[currentUnit];
  addAlertLog('活动单元切换 → ' + p.label, 'text-cyber-cyan');
  flashElement('#sidebar');
  // Refresh telemetry: force display of unit's last known values
  var prev = p.prevTelemetry;
  document.getElementById('statCpu').textContent = prev.cpu.toFixed(0) + '%';
  document.getElementById('statMem').textContent = prev.mem.toFixed(1) + ' GB';
  document.getElementById('statNet').textContent = prev.net.toFixed(1) + ' Mbps';
  document.getElementById('statTemp').textContent = prev.temp.toFixed(0) + '°C';
  uptimeSec = p.uptime;
  // Clear delta indicators
  ['statCpuD','statMemD','statNetD','statTempD'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.textContent = '';
  });
  // Refresh node dots + health
  updateStatusDots();
  recalcHealth();
  // Switch alert log display
  renderAlertLog();
});

// Quick Action handlers — unified helper + button wiring
function doQuickAction(btn, endpoint, opts) {
  var unitLabel = unitProfiles[currentUnit].label;
  var apiBase = '/api/units/' + encodeURIComponent(currentUnit);
  var restore = function() { btn.innerHTML = btn.dataset.original; btn.disabled = false; };

  if (opts.confirmMsg && !confirm(opts.confirmMsg.replace('{unit}', unitLabel))) return;

  btn.textContent = opts.runningText || '...';
  btn.disabled = true;
  addAlertLog(opts.alertText.replace('{unit}', unitLabel), opts.alertCls);
  if (opts.alertLevel !== undefined) updateAlertLevel(opts.alertLevel);
  if (opts.flashes) opts.flashes.forEach(function(sel) { flashElement(sel); });

  fetch(apiBase + endpoint, { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.innerHTML = opts.successHtml; btn.disabled = false;
      if (data.ok) addAlertLog(data.message, 'text-cyber-green');
      else addAlertLog(opts.label + ' 失败: ' + data.message, 'text-cyber-red');
      setTimeout(restore, opts.restoreMs || 1200);
    })
    .catch(function(err) {
      btn.innerHTML = '✗ ERR'; btn.disabled = false;
      addAlertLog(opts.label + ' 请求失败: ' + err.message, 'text-cyber-red');
      setTimeout(restore, opts.restoreMs || 1500);
    });
}

document.querySelectorAll('#sidebar button.font-mono').forEach(function(btn) {
  if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
  btn.addEventListener('click', function() {
    var text = this.textContent.trim();
    if (text.includes('INIT')) {
      doQuickAction(this, '/init', {
        label: 'INIT', runningText: '...', successHtml: '✓ DONE',
        alertText: '{unit} 初始化序列启动', alertCls: 'text-cyber-green',
        alertLevel: 'off', flashes: ['#sidebar']
      });
    } else if (text.includes('HALT')) {
      doQuickAction(this, '/halt', {
        label: 'HALT', runningText: '⏸ PAUSED', successHtml: '⏸ PAUSED',
        alertText: '{unit} 任务队列冻结', alertCls: 'text-cyber-amber',
        alertLevel: '2', flashes: ['#chartTasks'], restoreMs: 1000
      });
    } else if (text.includes('RESET')) {
      doQuickAction(this, '/reset', {
        label: 'RESET', runningText: '...', successHtml: '✓ RESET',
        alertText: '{unit} 恢复默认配置', alertCls: 'text-cyber-cyan',
        alertLevel: 'off', flashes: ['#sidebar', '#chartLoad']
      });
    } else if (text.includes('KILL')) {
      doQuickAction(this, '/kill', {
        label: 'KILL', runningText: '☠', successHtml: '☠ KILLED',
        alertText: '{unit} 紧急停机执行', alertCls: 'text-cyber-red',
        alertLevel: '4', flashes: ['#chartTasks', '#chartRadar'], restoreMs: 2000,
        confirmMsg: '确认紧急停机 {unit}?\n所有动力输出将被切断。'
      });
    }
  });
});
// Alert: Emergency stop
function triggerEmergency() {
  resetAllNodes(false);
  const result = document.getElementById('emergencyResult');
  result.classList.remove('hidden');
  result.innerHTML = '⚠ EMERGENCY STOP 已执行<br>所有动力输出已切断<br>节点 RX-7 已进入安全模式<br><br>请等待人工介入恢复';
  document.querySelector('.emergency-btn').disabled = true;
  document.querySelector('.emergency-btn').style.opacity = '.4';

  // Flash header indicators red
  const dots = document.querySelectorAll('header .pulse-dot');
  dots.forEach(d => { d.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--cy-red').trim(); });

  setTimeout(() => {
    dots.forEach(d => { d.style.backgroundColor = ''; });
    closeModal('modalAlert');
    // Reset button state after close
    setTimeout(() => {
      document.querySelector('.emergency-btn').disabled = false;
      document.querySelector('.emergency-btn').style.opacity = '1';
    }, 300);
  }, 3000);
}

// Console collapse/expand
const consoleWrapper = document.getElementById('consoleWrapper');
const consoleToggle  = document.getElementById('consoleToggle');
const consoleToggleBtn = document.getElementById('consoleToggleBtn');

function toggleConsole() {
  consoleWrapper.classList.toggle('collapsed');
  // Focus input when expanding
  if (!consoleWrapper.classList.contains('collapsed')) {
    setTimeout(() => document.getElementById('commandInput').focus(), 100);
  }
}
consoleToggle.addEventListener('click', toggleConsole);
consoleToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleConsole();
});

// Mobile sidebar toggle
let _sidebarOverlay = null;
let _sidebarClickHandler = null;
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isOpen = sidebar.classList.toggle('open');
  if (!_sidebarOverlay) {
    _sidebarOverlay = document.createElement('div');
    _sidebarOverlay.className = 'sidebar-overlay';
    document.body.appendChild(_sidebarOverlay);
  }
  _sidebarOverlay.classList.toggle('show', isOpen);
  if (isOpen) {
    // Close on click outside sidebar (deferred so this click doesn't close it)
    _sidebarClickHandler = function(e) {
      if (!sidebar.contains(e.target) && e.target !== document.getElementById('btnHamburger')) {
        sidebar.classList.remove('open');
        _sidebarOverlay.classList.remove('show');
        document.removeEventListener('click', _sidebarClickHandler);
        _sidebarClickHandler = null;
      }
    };
    setTimeout(function() {
      document.addEventListener('click', _sidebarClickHandler);
    }, 0);
  } else if (_sidebarClickHandler) {
    document.removeEventListener('click', _sidebarClickHandler);
    _sidebarClickHandler = null;
  }
}

// ============================================
// 8. GLOBAL KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
  // ESC — close all modals + turtle panel
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    closeTurtle();
    return;
  }

  // Ctrl+` — toggle console
  if (e.ctrlKey && e.key === '`') {
    e.preventDefault();
    toggleConsole();
    return;
  }

  // Ignore modifier chords
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Auto-expand collapsed console + focus input on any key
  if (e.key.length === 1 && !e.target.closest('input,select,textarea,[contenteditable]')) {
    if (consoleWrapper.classList.contains('collapsed')) {
      toggleConsole();
      setTimeout(() => { cmdInput.focus(); cmdInput.value += e.key; }, 100);
    } else if (document.activeElement !== cmdInput) {
      cmdInput.focus();
      cmdInput.value += e.key;
    }
  }
});