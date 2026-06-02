// CYBER-CORE WebSocket handler
const url = require('url');

function handleConnection(ws, req, locals) {
  console.log('[ws] client connected');

  // Send cached telemetry immediately
  if (locals.telemetryCache.data) {
    ws.send(JSON.stringify(locals.telemetryCache.data));
  }

  // Batch-send recent alerts (avoids N individual reflows on client)
  const recentAlerts = locals.alertCache.slice(-20);
  if (recentAlerts.length > 0) {
    ws.send(JSON.stringify({ type: 'alert_batch', alerts: recentAlerts }));
  }

  // Ping/pong keepalive every 30s (prevents silent proxy/NAT drops)
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) ws.ping();
  }, 30_000);

  // Validate incoming messages
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (!msg || typeof msg !== 'object') return;
      if (msg.type && !['cmd', 'cmd_vel', 'turtle_rpc'].includes(msg.type)) {
        console.warn('[ws] unknown message type:', msg.type);
      }
    } catch (err) {
      console.warn('[ws] invalid JSON from client:', err.message);
    }
  });

  ws.on('error', (err) => {
    console.error('[ws] client error:', err.message);
  });
  ws.on('close', (code, reason) => {
    clearInterval(pingInterval);
    console.log('[ws] client disconnected, code:', code);
  });
}

function broadcast(wss, msg) {
  const payload = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

module.exports = { handleConnection, broadcast };
