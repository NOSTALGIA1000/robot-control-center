// CYBER-CORE process manager — child_process lifecycle, EventEmitter
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');

const HALT_GRACE_MS = 5000; // wait after SIGTERM before reporting warning
const MONITOR_INTERVAL_MS = 5000;

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // key: "unitId:nodeKey" => { pid, child, robot, unitId, startedAt }
    this._monitorTimer = null;
  }

  getKey(unitId, nodeKey) { return unitId + ':' + nodeKey; }

  getStatus(unitId) {
    const robots = [];
    for (const [key, proc] of this.processes) {
      if (proc.unitId !== unitId) continue;
      robots.push({
        nodeKey: proc.robot.nodeKey,
        pid: proc.pid,
        status: proc.child.exitCode === null ? (proc.child.killed ? 'stopped' : 'running') : 'exited',
        uptime: proc.startedAt ? Math.floor((Date.now() - proc.startedAt) / 1000) : 0
      });
    }
    return robots;
  }

  getAllStatus() {
    const all = {};
    for (const [key, proc] of this.processes) {
      if (!all[proc.unitId]) all[proc.unitId] = {};
      all[proc.unitId][proc.robot.nodeKey] = proc.child.exitCode === null && !proc.child.killed;
    }
    return all;
  }

  async initUnit(unit) {
    const results = [];
    const dir = path.join(__dirname, '..');
    for (const robot of unit.robots) {
      const key = this.getKey(unit.id, robot.nodeKey);
      if (this.processes.has(key) && this.processes.get(key).child.exitCode === null) {
        results.push({ nodeKey: robot.nodeKey, skipped: true, reason: 'already running' });
        continue;
      }
      try {
        const child = spawn(robot.command, robot.args, {
          cwd: robot.cwd ? path.resolve(dir, robot.cwd) : dir,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        });
        const proc = { pid: child.pid, child, robot, unitId: unit.id, startedAt: Date.now() };
        this.processes.set(key, proc);
        child.on('exit', (code, signal) => {
          proc.child.exitCode = code;
          this.emit('process-exit', unit.id, robot.nodeKey, code, signal);
        });
        child.stdout.on('data', (d) => {
          this.emit('process-stdout', unit.id, robot.nodeKey, d.toString().trim());
        });
        child.stderr.on('data', (d) => {
          this.emit('process-stderr', unit.id, robot.nodeKey, d.toString().trim());
        });
        results.push({ nodeKey: robot.nodeKey, pid: child.pid, started: true });
        this.emit('process-started', unit.id, robot.nodeKey, child.pid);
      } catch (err) {
        results.push({ nodeKey: robot.nodeKey, error: err.message });
        this.emit('process-error', unit.id, robot.nodeKey, err);
      }
    }
    return results;
  }

  async haltUnit(unitId) {
    const promises = [];
    for (const [key, proc] of this.processes) {
      if (proc.unitId !== unitId) continue;
      if (proc.child.exitCode !== null || proc.child.killed) {
        promises.push(Promise.resolve({ nodeKey: proc.robot.nodeKey, skipped: true, reason: 'not running' }));
        continue;
      }
      proc.child.kill('SIGTERM');
      const nodeKey = proc.robot.nodeKey;
      promises.push(new Promise(resolve => {
        const t = setTimeout(() => resolve({ nodeKey, halted: true, graceful: false }), HALT_GRACE_MS);
        proc.child.once('exit', () => { clearTimeout(t); resolve({ nodeKey, halted: true, graceful: true }); });
        proc.child.once('error', () => { clearTimeout(t); resolve({ nodeKey, halted: true, graceful: false }); });
      }));
    }
    return Promise.all(promises);
  }

  async killUnit(unitId) {
    const results = [];
    for (const [key, proc] of this.processes) {
      if (proc.unitId !== unitId) continue;
      if (proc.child.exitCode !== null && !proc.child.killed) {
        results.push({ nodeKey: proc.robot.nodeKey, skipped: true, reason: 'already exited' });
        continue;
      }
      try {
        proc.child.kill('SIGKILL');
        results.push({ nodeKey: proc.robot.nodeKey, killed: true });
      } catch (e) {
        results.push({ nodeKey: proc.robot.nodeKey, error: e.message });
      }
    }
    // Clear tracking
    for (const [key, proc] of this.processes) {
      if (proc.unitId === unitId) this.processes.delete(key);
    }
    return results;
  }

  async resetUnit(unit) {
    await this.killUnit(unit.id);
    return this.initUnit(unit);
  }

  startMonitor() {
    if (this._monitorTimer) return;
    this._monitorTimer = setInterval(() => {
      for (const [key, proc] of this.processes) {
        if (proc.child.exitCode !== null && proc.child.exitCode !== 0 && !proc._exitReported) {
          proc._exitReported = true;
          this.emit('process-exit', proc.unitId, proc.robot.nodeKey, proc.child.exitCode, null);
        }
      }
    }, MONITOR_INTERVAL_MS);
  }

  stopMonitor() {
    if (this._monitorTimer) { clearInterval(this._monitorTimer); this._monitorTimer = null; }
  }

  cleanup() {
    this.stopMonitor();
    for (const [, proc] of this.processes) {
      try { proc.child.kill('SIGKILL'); } catch (_) {}
    }
    this.processes.clear();
  }
}

module.exports = ProcessManager;
