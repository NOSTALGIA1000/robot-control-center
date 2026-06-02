// ============================================
// 5. COMMAND CONSOLE (Interactive — real page effects)
// ============================================
const cmdInput   = document.getElementById('commandInput');
const cmdOutput  = document.getElementById('commandOutput');
let   cmdHistory = [];
let   histIndex  = -1;

function appendOutput(type, text) {
  const maxLines = (window._historyLimit || 100) * 2;
  while (cmdOutput.children.length >= maxLines) {
    cmdOutput.removeChild(cmdOutput.firstChild);
  }
  const div = document.createElement('div');
  div.className = 'cmd-line';
  if (type === 'echo') {
    div.innerHTML = `<span class="cmd-prompt">root@cyber-core:~$</span> <span class="cmd-echo">${text}</span>`;
  } else if (type === 'result') {
    div.innerHTML = `<span class="cmd-result">${text}</span>`;
  } else if (type === 'error') {
    div.innerHTML = `<span class="cmd-error">${text}</span>`;
  } else if (type === 'warn') {
    div.innerHTML = `<span class="cmd-warn">${text}</span>`;
  }
  cmdOutput.appendChild(div);
  cmdOutput.scrollTop = cmdOutput.scrollHeight;
}

// --- Visual effect helpers ---
function flashElement(sel, duration = 600) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.style.transition = 'all .15s';
  const c = getComputedStyle(document.documentElement).getPropertyValue('--cy-cyan').trim();
  el.style.boxShadow = `0 0 20px ${hexToRgba(c,0.6)}, 0 0 40px ${hexToRgba(c,0.2)}`;
  setTimeout(() => { el.style.boxShadow = ''; }, duration);
}

function addAlertLog(text, cls = 'text-cyber-cyan') {
  const log = document.getElementById('alertLogContainer');
  if (!log) return;
  const now = new Date();
  const ts = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  // Store in current unit's alert history
  const store = unitProfiles[currentUnit].alertLog;
  store.push({ text: text, cls: cls, ts: ts });
  while (store.length > 12) store.shift();
  // Render to DOM
  const entry = document.createElement('div');
  entry.className = cls;
  entry.innerHTML = '<span class="text-gray-600">[' + ts + ']</span> ' + text;
  log.insertBefore(entry, log.firstChild);
  // Keep DOM max 12
  while (log.children.length > 12) log.removeChild(log.lastChild);
}

window._alertLevel = 2; // 0=off, 1-4 active
window._historyLimit = 100;
window._cpuThreshold = 80;
function updateAlertLevel(level) {
  const alertEl = document.getElementById('alertLabel');
  const dotEl   = document.getElementById('alertDot');
  if (!alertEl || !dotEl) return;
  if (level === 'off' || level === '0') {
    window._alertLevel = 0;
    alertEl.textContent = 'ALL CLEAR';
    alertEl.className = 'text-xs text-cyber-green tracking-wide';
    dotEl.className = 'w-2 h-2 rounded-full bg-cyber-green pulse-dot';
  } else {
    window._alertLevel = parseInt(level);
    const colors = { 1: 'cyber-amber', 2: 'cyber-amber', 3: 'cyber-red', 4: 'cyber-red' };
    const c = colors[level] || 'cyber-red';
    alertEl.textContent = `ALERT LV.${level}`;
    alertEl.className = `text-xs text-${c} tracking-wide`;
    dotEl.className = `w-2 h-2 rounded-full bg-${c}`;
    dotEl.style.animation = level >= 3 ? 'pulse-dot 0.6s ease-in-out infinite' : 'pulse-dot 1.5s ease-in-out infinite';
  }
}

// Track node states (per-unit)
// unitProfiles defined in telemetry.js
let currentUnit = 'RX-7-alpha';
let nodeStates = unitProfiles[currentUnit].nodes;
// Render alert log from current unit's array
function renderAlertLog() {
  const logContainer = document.getElementById('alertLogContainer');
  if (!logContainer) return;
  logContainer.innerHTML = '';
  const entries = unitProfiles[currentUnit].alertLog;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const div = document.createElement('div');
    div.className = e.cls;
    div.innerHTML = '<span class="text-gray-600">[' + e.ts + ']</span> ' + e.text;
    logContainer.appendChild(div);
  }
}

// Initialize alert log + health for default unit
renderAlertLog();
recalcHealth();
updateStatusDots();

function recalcHealth() {
  const online = Object.values(nodeStates).filter(Boolean).length;
  const total = Object.keys(nodeStates).length;
  const pct = Math.round((online / total) * 100);
  const el = document.getElementById('healthIndex');
  if (el) el.textContent = pct + '%';
  // Update NODE status in header
  const nodeEl = document.getElementById('nodeStatus');
  if (nodeEl) {
    nodeEl.textContent = `NODE-${online} ACTIVE`;
    nodeEl.className = online === total ? 'text-xs text-cyber-green tracking-wide' : online > total/2 ? 'text-xs text-cyber-amber tracking-wide' : 'text-xs text-cyber-red tracking-wide';
  }
}

function updateStatusDots() {
  document.querySelectorAll('.status-dot').forEach(dot => {
    const row = dot.closest('[data-node]');
    if (!row) return;
    const nodeId = row.getAttribute('data-node');
    const online = nodeStates[nodeId] !== false;
    dot.className = online ? 'w-2 h-2 rounded-full bg-cyber-green status-dot' : 'w-2 h-2 rounded-full bg-cyber-red status-dot';
  });
}

function setNodeStatus(node, online) {
  const id = node.toUpperCase();
  if (!(id in nodeStates)) return false;
  nodeStates[id] = online;
  updateStatusDots();
  recalcHealth();
  return true;
}
function resetAllNodes(online) {
  Object.keys(nodeStates).forEach(n => { nodeStates[n] = online; });
  updateStatusDots();
  recalcHealth();
}

function doReboot() {
  if (window._rebooting) return;
  window._rebooting = true;
  // Flash screen overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:var(--cy-bg);opacity:0;transition:opacity .3s;pointer-events:none;';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  // Sequence reboot
  const sequence = [
    { delay: 600, action: () => appendOutput('warn', '  >>> 正在关闭子系统...') },
    { delay: 1000, action: () => appendOutput('warn', '  >>> 动力总线离线') },
    { delay: 1400, action: () => appendOutput('warn', '  >>> 传感器阵列停用') },
    { delay: 1800, action: () => appendOutput('warn', '  >>> 核心处理器重置') },
    { delay: 2400, action: () => {
      // Reset everything
      updateAlertLevel('off');
      document.getElementById('statCpu').textContent = '0%';
      document.getElementById('statNet').textContent = '0 Mbps';
      document.getElementById('statTemp').textContent = '--°C';
    }},
    { delay: 3000, action: () => overlay.style.opacity = '0' },
    { delay: 3400, action: () => { overlay.remove(); appendOutput('result', '══════════════════════════════\n REBOOT 完成 — 所有系统已恢复\n 节点: 7/7 在线 | 状态: NOMINAL\n══════════════════════════════'); }},
    { delay: 3500, action: () => {
      resetAllNodes(true);
      updateTelemetry();
      updateStatusDots();
      recalcHealth();
      addAlertLog('系统重启完成 — 自检通过', 'text-cyber-green');
      window._rebooting = false;
    }},
  ];
  sequence.forEach(s => setTimeout(s.action, s.delay));
}

// Theme switching
let currentTheme = 'cyber';
function switchTheme(name) {
  const valid = ['cyber', 'neon', 'matrix'];
  if (!valid.includes(name)) return;
  currentTheme = name;
  document.documentElement.setAttribute('data-theme', name);

  // In-place chart recolor (no destroy flicker)
  const s = getComputedStyle(document.documentElement);
  const c = s.getPropertyValue('--cy-cyan').trim();
  const m = s.getPropertyValue('--cy-magenta').trim();
  const g = s.getPropertyValue('--cy-green').trim();
  const a = s.getPropertyValue('--cy-amber').trim();
  const b = s.getPropertyValue('--cy-bg').trim();
  const h = hexToRgba;

  Chart.defaults.color = '#8888aa';
  const ch = window.__charts;
  if (!ch.c1) return;

  // Line chart: update 2 datasets + grid
  [ch.c1, ch.c3].forEach(chart => {
    chart.options.scales.r
      ? (chart.options.scales.r.grid.color = h(c, 0.12), chart.options.scales.r.angleLines.color = h(c, 0.12))
      : (chart.options.scales.y.grid.color = h(c, 0.08), chart.options.scales.x.grid.color = h(c, 0.08));
  });
  ch.c1.data.datasets[0].borderColor = c; ch.c1.data.datasets[0].backgroundColor = h(c, 0.05);
  ch.c1.data.datasets[0].pointBackgroundColor = c; ch.c1.data.datasets[0].pointBorderColor = b;
  ch.c1.data.datasets[1].borderColor = m; ch.c1.data.datasets[1].backgroundColor = h(m, 0.03);
  ch.c1.data.datasets[1].pointBackgroundColor = m; ch.c1.data.datasets[1].pointBorderColor = b;

  // Bar chart: update 3 datasets
  ch.c2.options.scales.y.grid.color = h(c, 0.08);
  ch.c2.data.datasets[0].backgroundColor = h(g, 0.6); ch.c2.data.datasets[0].borderColor = g;
  ch.c2.data.datasets[1].backgroundColor = h(c, 0.5); ch.c2.data.datasets[1].borderColor = c;
  ch.c2.data.datasets[2].backgroundColor = h(a, 0.4); ch.c2.data.datasets[2].borderColor = a;

  // Radar chart: update 2 datasets
  ch.c3.data.datasets[0].borderColor = c; ch.c3.data.datasets[0].backgroundColor = h(c, 0.10);
  ch.c3.data.datasets[0].pointBackgroundColor = c; ch.c3.data.datasets[0].pointBorderColor = b;
  ch.c3.data.datasets[1].borderColor = a; ch.c3.data.datasets[1].backgroundColor = h(a, 0.05);
  ch.c3.data.datasets[1].pointBackgroundColor = a; ch.c3.data.datasets[1].pointBorderColor = b;

  [ch.c1, ch.c2, ch.c3].forEach(function(chart) { chart.update('none'); });

  // Turtle vel chart (if initialized)
  if (ch.turtleVel) {
    ch.turtleVel.options.scales.y.grid.color = h(c, 0.08);
    ch.turtleVel.data.datasets[0].borderColor = c;
    ch.turtleVel.data.datasets[1].borderColor = m;
    ch.turtleVel.update('none');
  }
}

cmdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = cmdInput.value.trim();
    if (!cmd) return;

    // Echo
    appendOutput('echo', cmd);
    cmdHistory.push(cmd);
    // Enforce history limit
    const limit = window._historyLimit || 100;
    while (cmdHistory.length > limit) cmdHistory.shift();
    histIndex = cmdHistory.length;

    // Execute
    const [action, ...args] = cmd.toLowerCase().split(/\s+/);
    if (action === 'clear') {
      cmdOutput.innerHTML = '';
    } else if (window.__commands[action]) {
      appendOutput('result', window.__commands[action].call(window.__commands, ...args));
    } else {
      appendOutput('error', `未知指令: "${cmd}" — 输入 "help" 查看可用命令`);
    }

    cmdInput.value = '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const val = cmdInput.value, pos = cmdInput.selectionStart;
    const before = val.slice(0, pos);
    const words = before.split(/\s+/);
    const partial = words[words.length - 1] || '';
    if (!partial) return;

    // Build completions list
    const comps = Object.keys(window.__commands).concat([
      'ros2','node','topic','service','action','param','launch','run','bag',
      'list','info','echo','hz','pub','call','send_goal','get','set','record','play',
      'square','triangle','star','spiral','flower','fractal',
      'fd','bk','rt','lt','pu','pd','home','clean','setcolor','setpensize','repeat',
    ]).filter(function(w) { return w.startsWith(partial) && w !== partial; });

    if (!comps.length) return;

    // Cycle through matches
    if (!cmdInput._tabIndex || cmdInput._tabPartial !== partial) {
      cmdInput._tabIndex = 0; cmdInput._tabPartial = partial;
    } else {
      cmdInput._tabIndex = (cmdInput._tabIndex + 1) % comps.length;
    }

    const newBefore = before.slice(0, -partial.length) + comps[cmdInput._tabIndex];
    cmdInput.value = newBefore + val.slice(pos);
    cmdInput.setSelectionRange(newBefore.length, newBefore.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (histIndex > 0) {
      histIndex--;
      cmdInput.value = cmdHistory[histIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (histIndex < cmdHistory.length - 1) {
      histIndex++;
      cmdInput.value = cmdHistory[histIndex];
    } else {
      histIndex = cmdHistory.length;
      cmdInput.value = '';
    }
  }
});