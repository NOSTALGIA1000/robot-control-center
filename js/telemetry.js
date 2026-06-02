// 6. LIVE TELEMETRY UPDATE (randomized)
// ============================================

// Unit profiles — hardcoded fallback data when backend is unavailable
const unitProfiles = {
  'RX-7-alpha': {
    label: 'RX-7 // 阿尔法一号',
    cpu: { base: 40, range: 20 }, mem: { base: 10, range: 4 },
    net: { base: 5, range: 8 }, temp: { base: 55, range: 15 },
    uptime: 127 * 3600 + 34 * 60,
    nodes: { 'RX-1': true, 'RX-2': true, 'RX-3': true, 'RX-4': true, 'RX-5': true, 'RX-6': true },
    alertLog: [
      { text:'陀螺仪漂移校准完成', cls:'text-cyber-amber', ts:'22:41:03' },
      { text:'关节-3 扭矩异常 0.4N·m', cls:'text-cyber-red', ts:'22:38:12' },
      { text:'固件校验通过 v2.4.1', cls:'text-gray-400', ts:'22:30:00' },
      { text:'环境温度传感器在线', cls:'text-gray-400', ts:'22:15:44' },
      { text:'动力总线初始化完成', cls:'text-gray-400', ts:'21:58:01' }
    ],
    prevTelemetry: { cpu: 47, mem: 12.4, net: 8.2, temp: 62 }
  },
  'RX-7-beta': {
    label: 'RX-7 // 贝塔二号',
    cpu: { base: 25, range: 25 }, mem: { base: 6, range: 5 },
    net: { base: 3, range: 10 }, temp: { base: 48, range: 18 },
    uptime: 85 * 3600 + 12 * 60,
    nodes: { 'RX-1': true, 'RX-2': true, 'RX-3': false, 'RX-4': true, 'RX-5': true, 'RX-6': true },
    alertLog: [
      { text:'视觉模块帧率下降至15fps', cls:'text-cyber-amber', ts:'22:35:22' },
      { text:'RX-3 导航模块离线 — 重新路由中', cls:'text-cyber-red', ts:'22:20:15' },
      { text:'电池电量 73% 低于阈值', cls:'text-cyber-amber', ts:'22:05:40' },
      { text:'通讯链路延迟 320ms', cls:'text-gray-400', ts:'21:45:33' }
    ],
    prevTelemetry: { cpu: 32, mem: 8.2, net: 5.1, temp: 55 }
  },
  'RX-9-gamma': {
    label: 'RX-9 // 伽马原型机',
    cpu: { base: 55, range: 25 }, mem: { base: 14, range: 5 },
    net: { base: 7, range: 10 }, temp: { base: 62, range: 18 },
    uptime: 43 * 3600 + 8 * 60,
    nodes: { 'RX-1': true, 'RX-2': true, 'RX-3': true, 'RX-4': true, 'RX-5': false, 'RX-6': true },
    alertLog: [
      { text:'RX-5 过热警告 — 核心温度 78°C', cls:'text-cyber-red', ts:'22:42:08' },
      { text:'原型机固件版本 v0.9.3-beta', cls:'text-gray-400', ts:'22:25:30' },
      { text:'电机-2 扭矩校准偏差 ±0.15N·m', cls:'text-cyber-amber', ts:'22:12:55' }
    ],
    prevTelemetry: { cpu: 58, mem: 15.1, net: 9.4, temp: 67 }
  }
};

function updateTelemetry() {
  const p = unitProfiles[currentUnit];
  if (!p) return;
  const prev = p.prevTelemetry;
  let cpu, mem, net, temp;
  // Hybrid data source: backend WS when available, simulation as fallback
  if (wsConnected && wsData && wsData.units && wsData.units[currentUnit]) {
    const real = wsData.units[currentUnit];
    cpu = (real.cpu || 0).toFixed(0);
    mem = (real.mem || 0).toFixed(1);
    net = (real.net || 0).toFixed(1);
    temp = real.temp != null ? real.temp.toFixed(0) : '--';
    // Sync node states from backend
    if (real.nodes) {
      Object.keys(real.nodes).forEach(function(nid) { nodeStates[nid] = real.nodes[nid]; });
      updateStatusDots();
      recalcHealth();
    }
  } else {
    cpu = (p.cpu.base + (Math.random() - 0.3) * p.cpu.range).toFixed(0);
    mem = (p.mem.base + Math.random() * p.mem.range).toFixed(1);
    net = (p.net.base + Math.random() * p.net.range).toFixed(1);
    temp = (p.temp.base + Math.random() * p.temp.range).toFixed(0);
  }
  const tempNum = parseFloat(temp);
  // Update display with trend deltas
  setTelemetryVal('statCpu', 'statCpuD', cpu + '%', parseFloat(cpu) - prev.cpu, '');
  setTelemetryVal('statMem', 'statMemD', mem + ' GB', (parseFloat(mem) - prev.mem).toFixed(1), '');
  setTelemetryVal('statNet', 'statNetD', net + ' Mbps', (parseFloat(net) - prev.net).toFixed(1), '');
  setTelemetryVal('statTemp', 'statTempD', temp + '°C', (tempNum - prev.temp).toFixed(0), '°C');
  // Temp color
  const tempEl = document.getElementById('statTemp');
  if (!isNaN(tempNum)) {
    tempEl.className = tempNum > 70 ? 'text-cyber-red' : tempNum > 60 ? 'text-cyber-amber' : 'text-cyber-green';
  }
  // Store
  p.prevTelemetry = { cpu: parseFloat(cpu), mem: parseFloat(mem), net: parseFloat(net), temp: tempNum };
}
function setTelemetryVal(mainId, deltaId, val, delta, unit) {
  document.getElementById(mainId).textContent = val;
  const dEl = document.getElementById(deltaId);
  if (!dEl) return;
  if (Math.abs(delta) < 0.05) { dEl.textContent = ''; return; }
  const up = delta > 0;
  dEl.textContent = (up ? '↑' : '↓') + Math.abs(delta).toFixed(delta < 1 ? 0 : 0) + (unit || '');
  dEl.className = 'text-xs ml-1 ' + (up ? 'text-cyber-red' : 'text-cyber-green');
}
window._telemetryTimer = createVisibleInterval(updateTelemetry, 3000);