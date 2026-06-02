// CYBER-CORE REST API routes
const express = require('express');
const router = express.Router();

// Middleware: validate unit ID against config whitelist
function validUnitId(req, res, next) {
  const config = req.app.locals.config;
  if (!config || !config.units.find(u => u.id === req.params.id)) {
    return res.status(404).json({ ok: false, message: 'unit not found' });
  }
  next();
}

// GET /api/status — full system snapshot
router.get('/status', (req, res) => {
  const cache = req.app.locals.telemetryCache;
  if (!cache.data) return res.json({ ok: false, message: 'telemetry not ready' });
  res.json({ ok: true, ...cache.data });
});

// GET /api/units — list all configured units
router.get('/units', (req, res) => {
  const config = req.app.locals.config;
  const list = config.units.map(u => ({
    id: u.id,
    label: u.label,
    robotCount: u.robots.length
  }));
  res.json({ ok: true, units: list });
});

// GET /api/units/:id — single unit detail
router.get('/units/:id', validUnitId, (req, res) => {
  const unit = req.app.locals.getUnit(req.params.id);
  const pm = req.app.locals.pm;
  const status = pm.getStatus(req.params.id);
  res.json({ ok: true, unit: { id: unit.id, label: unit.label, robots: unit.robots, processes: status } });
});

// GET /api/units/:id/alerts — alert history from DB (fallback to cache)
router.get('/units/:id/alerts', validUnitId, (req, res) => {
  const db = req.app.locals.db;
  const dbAlerts = db.getAlerts(req.params.id, 50);
  if (dbAlerts.length > 0) {
    return res.json({ ok: true, alerts: dbAlerts, source: 'db' });
  }
  const cacheAlerts = req.app.locals.alertCache.filter(a => a.unitId === req.params.id).slice(-50);
  res.json({ ok: true, alerts: cacheAlerts, source: 'cache' });
});

// GET /api/processes — all managed process statuses
router.get('/processes', (req, res) => {
  const pm = req.app.locals.pm;
  const config = req.app.locals.config;
  const all = [];
  for (const u of config.units) {
    const statuses = pm.getStatus(u.id);
    for (const s of statuses) {
      all.push({ ...s, unitId: u.id });
    }
  }
  res.json({ ok: true, processes: all });
});

// POST /api/units/:id/init — spawn all robots for unit
router.post('/units/:id/init', validUnitId, async (req, res) => {
  const unit = req.app.locals.getUnit(req.params.id);
  try {
    const pm = req.app.locals.pm;
    const results = await pm.initUnit(unit);
    const started = results.filter(r => r.started).length;
    broadcastActionResult(req, res, 'init', req.params.id, true,
      `${started}/${unit.robots.length} 节点已启动`, { results });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/units/:id/halt — graceful shutdown
router.post('/units/:id/halt', validUnitId, async (req, res) => {
  const unit = req.app.locals.getUnit(req.params.id);
  try {
    const pm = req.app.locals.pm;
    const results = await pm.haltUnit(req.params.id);
    const halted = results.filter(r => r.halted).length;
    broadcastActionResult(req, res, 'halt', req.params.id, true,
      `${halted}/${unit.robots.length} 节点已冻结`, { results });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/units/:id/reset — kill all then respawn
router.post('/units/:id/reset', validUnitId, async (req, res) => {
  const unit = req.app.locals.getUnit(req.params.id);
  try {
    const pm = req.app.locals.pm;
    const results = await pm.resetUnit(unit);
    const restarted = results.filter(r => r.started).length;
    broadcastActionResult(req, res, 'reset', req.params.id, true,
      `${restarted}/${unit.robots.length} 节点已重置`, { results });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/units/:id/kill — force kill all
router.post('/units/:id/kill', validUnitId, async (req, res) => {
  const unit = req.app.locals.getUnit(req.params.id);
  try {
    const pm = req.app.locals.pm;
    const results = await pm.killUnit(req.params.id);
    const killed = results.filter(r => r.killed).length;
    broadcastActionResult(req, res, 'kill', req.params.id, true,
      `${killed}/${unit.robots.length} 节点已紧急停机`, { results });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

function broadcastActionResult(req, res, action, unitId, ok, message, details) {
  const payload = { type: 'action_result', action, unitId, ok, message, details };
  if (req.app.locals._broadcast) {
    req.app.locals._broadcast(JSON.stringify(payload));
  }
  // Log to DB
  req.app.locals.db.logAction(unitId, action, ok ? 'success' : 'error', message, details);
  res.json({ ok, message, details });
}

module.exports = router;
