// CYBER-CORE server — Express + WebSocket + telemetry + process manager
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const { getTelemetry } = require('./lib/telemetry');
const { loadConfig, getUnit } = require('./lib/config');
const ProcessManager = require('./lib/process-manager');
const { broadcast, handleConnection } = require('./routes/ws');
const apiRouter = require('./routes/api');
const db = require('./db/database');

const PORT = process.env.PORT || 8771;

// Global error handlers — log and continue (local dashboard, not production)
process.on('uncaughtException', (err) => {
  console.error('[CYBER-CORE] UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CYBER-CORE] UNHANDLED REJECTION:', reason);
});
const TELEMETRY_INTERVAL_MS = 2000;

const app = express();
app.use(express.json());
// Serve only public frontend assets (no source, no db, no node_modules)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));

// Simple in-memory rate limiter for POST /api/*
const rateLimitWindow = 60_000;
const rateLimitMax = 30;
const rateLimitStore = new Map();

app.use('/api', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry || now - entry.reset > rateLimitWindow) {
    entry = { count: 0, reset: now + rateLimitWindow };
    rateLimitStore.set(ip, entry);
  }
  entry.count++;
  if (entry.count > rateLimitMax) {
    return res.status(429).json({ ok: false, message: 'Too many requests. Slow down.' });
  }
  next();
});

// Cleanup stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.reset > rateLimitWindow) rateLimitStore.delete(ip);
  }
}, 300_000).unref();

// Dependency injection for routes
const pm = new ProcessManager();
const config = loadConfig();
app.locals.pm = pm;
app.locals.config = config;
app.locals.getUnit = getUnit;
app.locals.db = db;

// Health check via WebSocket — shared state
app.locals.telemetryCache = { ts: 0, data: null };
app.locals.alertCache = [];

app.use('/api', apiRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store references for API routes
app.locals._wss = wss;
app.locals._broadcast = (payload) => broadcast(wss, payload);

// WebSocket connection handling
wss.on('connection', (ws, req) => handleConnection(ws, req, app.locals));

// Telemetry broadcast loop
let telemetryTimer;
function startTelemetry() {
  telemetryTimer = setInterval(async () => {
    try {
      const sys = await getTelemetry();
      const msg = buildTelemetryMessage(sys, pm, config);
      app.locals.telemetryCache = { ts: Date.now(), data: msg };
      broadcast(wss, msg);
    } catch (err) {
      console.error('[telemetry] error:', err.message);
    }
  }, TELEMETRY_INTERVAL_MS);
}

function buildTelemetryMessage(sys, processMgr, cfg) {
  const units = {};
  const nodeStatuses = processMgr.getAllStatus();
  for (const u of cfg.units) {
    const managed = nodeStatuses[u.id] || {};
    const nodes = {};
    for (const r of u.robots) {
      // managed nodes: process liveness; unmanaged: assume online from robots.json
      nodes[r.nodeKey] = managed[r.nodeKey] !== undefined ? managed[r.nodeKey] : true;
    }
    units[u.id] = {
      cpu: sys.cpu,
      mem: parseFloat(sys.mem),
      net: parseFloat(sys.net),
      temp: sys.temp,
      nodes,
      uptime: sys.uptime,
      alertLevel: 0
    };
  }
  return { type: 'telemetry', ts: Date.now(), units };
}

// Process manager events → broadcast alerts + persist to DB
pm.on('process-started', (unitId, nodeKey, pid) => {
  const text = `节点 ${nodeKey} 已启动 (PID: ${pid})`;
  const alert = { type: 'alert', unitId, text, level: 'green', ts: ts() };
  app.locals.alertCache.push(alert);
  if (app.locals.alertCache.length > 100) app.locals.alertCache.shift();
  broadcast(wss, alert);
  db.addAlert(unitId, text, 'green');
});

pm.on('process-exit', (unitId, nodeKey, code, signal) => {
  if (code === 0 || signal === 'SIGTERM') {
    const text = `节点 ${nodeKey} 已正常关闭`;
    const alert = { type: 'alert', unitId, text, level: 'cyan', ts: ts() };
    broadcast(wss, alert);
    db.addAlert(unitId, text, 'cyan');
  } else {
    const text = `节点 ${nodeKey} 进程异常退出 (code: ${code})`;
    const alert = { type: 'alert', unitId, text, level: 'red', ts: ts() };
    app.locals.alertCache.push(alert);
    if (app.locals.alertCache.length > 100) app.locals.alertCache.shift();
    broadcast(wss, alert);
    db.addAlert(unitId, text, 'red');
  }
});

pm.on('process-error', (unitId, nodeKey, err) => {
  const text = `节点 ${nodeKey} 启动失败: ${err.message}`;
  const alert = { type: 'alert', unitId, text, level: 'red', ts: ts() };
  app.locals.alertCache.push(alert);
  if (app.locals.alertCache.length > 100) app.locals.alertCache.shift();
  broadcast(wss, alert);
  db.addAlert(unitId, text, 'red');
});

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Start monitor, telemetry, DB, server
(async () => {
  await db.open();
  db.startAutoSave(15000);
  pm.startMonitor();
  startTelemetry();

  server.listen(PORT, () => {
    console.log('[CYBER-CORE] Backend online — http://localhost:' + PORT);
    console.log('[CYBER-CORE] Units:', config.units.map(u => u.id).join(', '));
  });
})();

// Graceful shutdown
function shutdown() {
  console.log('\n[CYBER-CORE] Shutting down...');
  clearInterval(telemetryTimer);
  pm.cleanup();
  db.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
