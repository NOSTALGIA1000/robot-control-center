// 6b. WEBSOCKET CLIENT — real backend data, graceful fallback
// ============================================
let ws = null, wsData = null, wsConnected = false, wsReconnectTimer = null;

function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  try {
    ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onopen = function() {
      wsConnected = true;
      if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
      addAlertLog('后端数据链路已连接', 'text-cyber-green');
    };
    ws.onmessage = function(ev) {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg || !msg.type) return;
        if (msg.type === 'telemetry') {
          wsData = msg;
        } else if (msg.type === 'alert') {
          addAlertLog(msg.text, 'text-cyber-' + (msg.level || 'cyan'));
        } else if (msg.type === 'alert_batch') {
          (msg.alerts || []).forEach(function(a) {
            addAlertLog(a.text, 'text-cyber-' + (a.level || 'cyan'));
          });
        } else if (msg.type === 'action_result') {
          handleActionResult(msg);
        }
      } catch (err) {
        console.warn('[CYBER-CORE] Invalid WS message:', err.message);
      }
    };
    ws.onclose = function() {
      wsConnected = false; ws = null;
      addAlertLog('后端数据链路断开 — 切换到模拟数据', 'text-cyber-amber');
      if (!wsReconnectTimer) wsReconnectTimer = setTimeout(connectWS, 3000);
    };
    ws.onerror = function() { console.error('[CYBER-CORE] WebSocket connection error'); };
  } catch (_) {}
}
connectWS();

// ============================================
// 6c. ACTION RESULT HANDLER — cross-tab sync
// ============================================
function handleActionResult(msg) {
  if (!msg.ok) {
    addAlertLog('操作失败: ' + (msg.message || '未知错误'), 'text-cyber-red');
    return;
  }
  addAlertLog(msg.message, 'text-cyber-green');
  if (msg.details && msg.details.results) {
    // Sync node states
    var unitId = msg.unitId;
    if (unitId === currentUnit) {
      msg.details.results.forEach(function(r) {
        if (r.started || r.killed) setNodeStatus(r.nodeKey, r.started || false);
      });
      updateStatusDots();
      recalcHealth();
    }
  }
  // Flash relevant panels
  if (msg.action === 'init') flashElement('#sidebar');
  if (msg.action === 'halt') flashElement('#chartTasks');
  if (msg.action === 'reset') { flashElement('#sidebar'); flashElement('#chartLoad'); }
  if (msg.action === 'kill') { flashElement('#chartTasks'); flashElement('#chartRadar'); }
}

// ============================================
// 6d. ROS2 BRIDGE CLIENT — connects to ros2-bridge backend
// ============================================
let bridgeWs = null, bridgeConnected = false, bridgeReconnectTimer = null;
const bridgeUrl = 'ws://localhost:8772/ws';

function connectBridge() {
  if (bridgeWs && bridgeWs.readyState === WebSocket.OPEN) return;
  try {
    bridgeWs = new WebSocket(bridgeUrl);
    bridgeWs.onopen = function() {
      bridgeConnected = true;
      if (bridgeReconnectTimer) { clearTimeout(bridgeReconnectTimer); bridgeReconnectTimer = null; }
      console.log('[BRIDGE] Connected to ros2-bridge');
    };
    bridgeWs.onmessage = function(ev) {
      var msg = JSON.parse(ev.data);
      if (msg.type === 'turtle_pose' && typeof T !== 'undefined' && T._bridgePose) {
        T._bridgePose(msg.x, msg.y, msg.theta);
      }
    };
    bridgeWs.onclose = function() {
      bridgeConnected = false; bridgeWs = null;
      if (!bridgeReconnectTimer) bridgeReconnectTimer = setTimeout(connectBridge, 5000);
    };
    bridgeWs.onerror = function() {};
  } catch (_) {}
}
connectBridge();

async function bridgeRos2Cmd(subcmd, args) {
  if (!bridgeWs || bridgeWs.readyState !== WebSocket.OPEN) return null;
  return new Promise(function(resolve) {
    var tid = 'br_' + Date.now();
    var handler = function(ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id === tid) {
        bridgeWs.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    bridgeWs.addEventListener('message', handler);
    bridgeWs.send(JSON.stringify({ type: 'cmd', subcmd: subcmd, args: args, id: tid }));
    setTimeout(function() { bridgeWs.removeEventListener('message', handler); resolve(null); }, 5000);
  });
}

function bridgeCmdVel(linear, angular) {
  if (!bridgeWs || bridgeWs.readyState !== WebSocket.OPEN) return;
  bridgeWs.send(JSON.stringify({ type: 'cmd_vel', linear: linear, angular: angular }));
}

async function bridgeTurtleRPC(action, body) {
  if (!bridgeWs || bridgeWs.readyState !== WebSocket.OPEN) return null;
  return new Promise(function(resolve) {
    var tid = 'tr_' + Date.now();
    var handler = function(ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id === tid) {
        bridgeWs.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    bridgeWs.addEventListener('message', handler);
    bridgeWs.send(JSON.stringify({ type: 'turtle_rpc', action: action, body: body, id: tid }));
    setTimeout(function() { bridgeWs.removeEventListener('message', handler); resolve(null); }, 5000);
  });
}

// Uptime counter
let uptimeSec = 127 * 3600 + 34 * 60;
createVisibleInterval(() => {
  uptimeSec++;
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  document.getElementById('statUptime').textContent = h + 'h ' + m + 'm';
}, 1000);