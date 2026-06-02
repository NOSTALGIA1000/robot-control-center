// CYBER-CORE config — read and validate robots.json
const fs = require('fs');
const path = require('path');

let config = null;

function loadConfig(filePath) {
  if (config) return config;
  const p = filePath || path.join(__dirname, '..', 'robots.json');
  const raw = fs.readFileSync(p, 'utf-8');
  config = JSON.parse(raw);
  if (!config.units || !Array.isArray(config.units)) {
    throw new Error('robots.json: "units" must be an array');
  }
  for (const u of config.units) {
    if (!u.id || !u.label) throw new Error('robots.json: each unit needs "id" and "label"');
    if (!u.robots || !Array.isArray(u.robots)) {
      throw new Error('robots.json: unit ' + u.id + ' needs "robots" array');
    }
    for (const r of u.robots) {
      if (!r.nodeKey || !r.command) {
        throw new Error('robots.json: each robot needs "nodeKey" and "command"');
      }
      if (!r.args) r.args = [];
    }
  }
  return config;
}

function getUnits() {
  return config.units.map(u => ({ id: u.id, label: u.label, robotCount: u.robots.length }));
}

function getUnit(id) {
  return config.units.find(u => u.id === id) || null;
}

module.exports = { loadConfig, getUnits, getUnit };
