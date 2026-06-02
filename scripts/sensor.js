// CYBER-CORE sensor simulator — micro HTTP server, one per robot node
// Usage: node scripts/sensor.js --port=9101
const http = require('http');
const port = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1]) || 9100;

const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    pid: process.pid,
    port,
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024),
    time: new Date().toISOString()
  }));
});

server.listen(port, () => {
  console.log('[sensor] pid=' + process.pid + ' port=' + port);
});

process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT', () => { process.exit(0); });
