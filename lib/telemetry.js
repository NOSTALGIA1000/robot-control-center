// CYBER-CORE telemetry — wraps systeminformation, emits normalized objects
const si = require('systeminformation');
const os = require('os');

async function getTelemetry() {
  let cpu = 0, mem = 0, net = 0, temp = null;
  try {
    const [load, memData, netData, tempData] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
      si.cpuTemperature().catch(() => ({ main: null }))
    ]);
    cpu = Math.round(load.currentLoad);
    mem = ((memData.used / 1024 / 1024 / 1024).toFixed(1));
    net = (netData[0]?.tx_sec ? (netData[0].tx_sec / 1024 / 1024 * 8).toFixed(1) : 0);
    temp = tempData.main;
  } catch (_) {
    // Fallback: use os module for CPU/MEM
    cpu = Math.round(100 - (os.cpus().reduce((a, c) => {
      const t = Object.values(c.times).reduce((s, v) => s + v, 0);
      return a + (c.times.idle / t);
    }, 0) / os.cpus().length) * 100) || 0;
    mem = ((1 - os.freemem() / os.totalmem()) * os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    net = 0;
    temp = null;
  }
  return { cpu, mem, net, temp, uptime: Math.floor(os.uptime()) };
}

module.exports = { getTelemetry };
