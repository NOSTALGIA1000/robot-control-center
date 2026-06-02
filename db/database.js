// CYBER-CORE SQLite database — sql.js WASM, no native addons
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cybercore.db');

let db = null;
let saveTimer = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id     TEXT NOT NULL,
  text        TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'info',
  ts          TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS action_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id     TEXT NOT NULL,
  action      TEXT NOT NULL,
  result      TEXT NOT NULL,
  message     TEXT,
  details     TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_unit ON alerts(unit_id);
CREATE INDEX IF NOT EXISTS idx_alerts_ts   ON alerts(ts);
CREATE INDEX IF NOT EXISTS idx_actions_unit ON action_log(unit_id);
`;

async function open() {
  if (db) return db;
  const SQL = await initSqlJs();
  let buffer;
  try {
    if (fs.existsSync(DB_PATH)) {
      buffer = fs.readFileSync(DB_PATH);
    }
  } catch (_) {}
  db = new SQL.Database(buffer);
  db.run('PRAGMA journal_mode=WAL');
  db.run(SCHEMA);
  return db;
}

function save() {
  if (!db) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  } catch (err) {
    console.error('[db] save error:', err.message);
  }
}

function startAutoSave(intervalMs) {
  if (saveTimer) return;
  saveTimer = setInterval(save, intervalMs || 10000);
}

function stopAutoSave() {
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
  save();
}

// ---- Alert queries ----
function addAlert(unitId, text, level) {
  if (!db) return;
  const ts = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  db.run('INSERT INTO alerts (unit_id, text, level, ts) VALUES (?, ?, ?, ?)', [unitId, text, level || 'info', ts]);
  // Keep max 200 alerts per unit
  const count = db.exec('SELECT COUNT(*) as c FROM alerts WHERE unit_id = ?', [unitId]);
  if (count.length > 0 && count[0].values[0][0] > 200) {
    db.run('DELETE FROM alerts WHERE id IN (SELECT id FROM alerts WHERE unit_id = ? ORDER BY id ASC LIMIT 50)', [unitId]);
  }
}

function getAlerts(unitId, limit) {
  if (!db) return [];
  const stmt = db.prepare('SELECT text, level, ts FROM alerts WHERE unit_id = ? ORDER BY id DESC LIMIT ?');
  stmt.bind([unitId, limit || 50]);
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// ---- Action log ----
function logAction(unitId, action, result, message, details) {
  if (!db) return;
  db.run('INSERT INTO action_log (unit_id, action, result, message, details) VALUES (?, ?, ?, ?, ?)',
    [unitId, action, result, message || '', details ? JSON.stringify(details) : '']);
}

function getActionLog(unitId, limit) {
  if (!db) return [];
  const stmt = db.prepare('SELECT id, unit_id, action, result, message, details, created_at FROM action_log WHERE unit_id = ? ORDER BY id DESC LIMIT ?');
  stmt.bind([unitId, limit || 50]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function close() {
  stopAutoSave();
  if (db) { db.close(); db = null; }
}

module.exports = { open, save, startAutoSave, stopAutoSave, close, addAlert, getAlerts, logAction, getActionLog };
