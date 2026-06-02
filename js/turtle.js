// 9. TURTLESIM ENGINE (ROS2 turtlesim clone)
// ============================================

function hslToRgb(h, s, l) {
  var r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    var hue2rgb = function(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const T = {
  x: 0, y: 0, theta: 0,      // ROS convention: theta=0 points RIGHT
  _useBridge: false,
  _bridgePose(px, py, pt, lv, av) {
    this._useBridge = true;
    this.x = px; this.y = py; this.theta = pt;
    if (lv !== undefined) this.linearVel = lv;
    if (av !== undefined) this.angularVel = av;
  },
  linearVel: 0, angularVel: 0,
  penDown: true, penR: 0, penG: 240, penB: 255, penWidth: 2,
  canvas: null, ctx: null, cx: 0, cy: 0,
  animId: null, lastTime: 0,
  trail: [],        // [{x, y, r, g, b, w}] — trail segments
  gridCache: null,  // offscreen canvas for static grid
  velHistory: { linear: [], angular: [], maxLen: 120 },
  frameCount: 0,
  shapePoints: null, shapeIdx: 0, shapeSpeed: 80,
  rainbowMode: false, rainbowHue: 195,
  mirrorMode: 0,        // 0=off, 4=4-way, 8=8-way
  trailGlow: true,
  keysDown: {},

  init(canvas) {
    T.canvas = canvas;
    T.ctx = canvas.getContext('2d');
    T.cx = canvas.width / 2; T.cy = canvas.height / 2;
    T.buildGridCache();
    T.startLoop();
  },

  buildGridCache() {
    var g = document.createElement('canvas');
    g.width = T.canvas.width; g.height = T.canvas.height;
    var gc = g.getContext('2d');
    var w = g.width, h = g.height;
    var c = getComputedStyle(document.documentElement).getPropertyValue('--cy-grid').trim();
    gc.strokeStyle = c; gc.lineWidth = 0.5;
    for (var x = T.cx % 40; x < w; x += 40) { gc.beginPath(); gc.moveTo(x, 0); gc.lineTo(x, h); gc.stroke(); }
    for (var y = T.cy % 40; y < h; y += 40) { gc.beginPath(); gc.moveTo(0, y); gc.lineTo(w, y); gc.stroke(); }
    gc.strokeStyle = 'rgba(255,255,255,0.08)'; gc.lineWidth = 1;
    gc.beginPath(); gc.moveTo(T.cx, 0); gc.lineTo(T.cx, h); gc.stroke();
    gc.beginPath(); gc.moveTo(0, T.cy); gc.lineTo(w, T.cy); gc.stroke();
    T.gridCache = g;
  },

  startLoop() {
    if (T.animId) return;
    T.lastTime = performance.now();
    (function loop(now) {
      var dt = Math.min((now - T.lastTime) / 1000, 0.1);
      if (document.hidden) { T.animId = requestAnimationFrame(loop); return; }
      T.lastTime = now;
      T.step(dt);
      T.render();
      T.updateStatus();
      T.frameCount++;
      if (T.frameCount % 5 === 0) T.renderMini();
      T.updateDataPanel();
      T.animId = requestAnimationFrame(loop);
    })(T.lastTime);
  },
  stopLoop() {
    if (T.animId) { cancelAnimationFrame(T.animId); T.animId = null; }
  },

  step(dt) {
    // Shape waypoint navigation
    if (T.shapePoints && T.shapeIdx < T.shapePoints.length) {
      var target = T.shapePoints[T.shapeIdx];
      var dx = target.x - T.x, dy = target.y - T.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        T.shapeIdx++;
        if (T.shapeIdx >= T.shapePoints.length) {
          T.linearVel = 0; T.angularVel = 0;
          T.shapePoints = null;
          addAlertLog('turtlesim: 轨迹绘制完成', 'text-cyber-green');
          return;
        }
        target = T.shapePoints[T.shapeIdx];
        dx = target.x - T.x; dy = target.y - T.y;
        dist = Math.sqrt(dx * dx + dy * dy);
      }
      var targetAngle = Math.atan2(dy, dx);
      var angleDiff = targetAngle - T.theta;
      // Normalize to [-π, π]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      T.angularVel = Math.max(-4, Math.min(4, angleDiff * 8));
      T.linearVel = Math.min(T.shapeSpeed, dist * 3);
      if (Math.abs(angleDiff) > 1.0) T.linearVel *= 0.3; // slow down during sharp turns
    }
    // Record vel in ring buffer
    var vl = T.velHistory;
    vl.linear.push(T.linearVel);
    vl.angular.push(T.angularVel);
    if (vl.linear.length > vl.maxLen) { vl.linear.shift(); vl.angular.shift(); }
    if (T.linearVel === 0 && T.angularVel === 0 && !T.shapePoints) return;
    // Record previous pos for trail
    var px = T.x, py = T.y;
    T.theta += T.angularVel * dt;
    T.x += T.linearVel * Math.cos(T.theta) * dt;
    T.y += T.linearVel * Math.sin(T.theta) * dt;
    // Clamp to canvas bounds
    var bw = 30, maxX = T.cx - bw, maxY = T.cy - bw;
    T.x = Math.max(-maxX, Math.min(maxX, T.x));
    T.y = Math.max(-maxY, Math.min(maxY, T.y));
    if (T.penDown && (T.x !== px || T.y !== py)) {
      T.trail.push({x: px, y: py, x2: T.x, y2: T.y, r: T.penR, g: T.penG, b: T.penB, w: T.penWidth});
      while (T.trail.length > 5000) T.trail.shift();
    }
    // Rainbow pen: cycle hue while moving
    if (T.rainbowMode && (T.linearVel !== 0 || T.angularVel !== 0)) {
      T.rainbowHue = (T.rainbowHue + 60 * dt) % 360;
      var rgb = hslToRgb(T.rainbowHue / 360, 1, 0.55);
      T.penR = rgb[0]; T.penG = rgb[1]; T.penB = rgb[2];
    }
  },

  render() {
    var ctx = T.ctx, w = T.canvas.width, h = T.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (T.gridCache) ctx.drawImage(T.gridCache, 0, 0);

    function drawTrail(mirrorAngle) {
      var len = T.trail.length;
      for (var i = 0; i < len; i++) {
        var t = T.trail[i];
        // Trail glow: older = more transparent
        if (T.trailGlow) {
          var age = (i / Math.max(1, len - 1));
          ctx.globalAlpha = 0.15 + 0.85 * (1 - age);
        }
        var x1 = t.x, y1 = t.y, x2 = t.x2, y2 = t.y2;
        if (mirrorAngle && mirrorAngle !== 0) {
          var cos = Math.cos(mirrorAngle), sin = Math.sin(mirrorAngle);
          var rx1 = x1 * cos - y1 * sin, ry1 = x1 * sin + y1 * cos;
          var rx2 = x2 * cos - y2 * sin, ry2 = x2 * sin + y2 * cos;
          x1 = rx1; y1 = ry1; x2 = rx2; y2 = ry2;
        }
        ctx.beginPath();
        ctx.moveTo(T.cx + x1, T.cy - y1);
        ctx.lineTo(T.cx + x2, T.cy - y2);
        ctx.strokeStyle = 'rgb(' + t.r + ',' + t.g + ',' + t.b + ')';
        ctx.lineWidth = t.w; ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawTrail(0);
    // Mirror copies
    if (T.mirrorMode === 4) {
      for (var m = 1; m < 4; m++) drawTrail(m * Math.PI / 2);
    } else if (T.mirrorMode === 8) {
      for (var m = 1; m < 8; m++) drawTrail(m * Math.PI / 4);
    }
    T.drawTurtleBody();
  },

  drawTurtleBody() {
    var ctx = T.ctx, sx = T.cx + T.x, sy = T.cy - T.y;
    var c = 'rgb(' + T.penR + ',' + T.penG + ',' + T.penB + ')';
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-T.theta);  // screen rotation: negate theta (screen y is flipped)
    ctx.shadowColor = c; ctx.shadowBlur = 8;
    // Body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(13, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(15, -3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, 3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(15.5, -3, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(15.5, 3, 1, 0, Math.PI * 2); ctx.fill();
    // Shell pattern
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(5, -5); ctx.stroke();
    // Flippers
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(-5, -10, 6, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-5, 10, 6, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    // Tail
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-17, -4); ctx.lineTo(-17, 4); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Mirror ghost turtles
    if (T.mirrorMode > 0) {
      var n = T.mirrorMode;
      for (var m = 1; m < n; m++) {
        var angle = (2 * Math.PI / n) * m;
        var cos = Math.cos(angle), sin = Math.sin(angle);
        var gx = T.x * cos - T.y * sin, gy = T.x * sin + T.y * cos;
        var gsx = T.cx + gx, gsy = T.cy - gy;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = c;
        ctx.shadowColor = c; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(gsx, gsy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  },

  updateStatus() {
    var el = document.getElementById('turtleStatus');
    if (el) {
      var deg = (T.theta * 180 / Math.PI) % 360;
      if (deg < 0) deg += 360;
      el.textContent = 'x=' + T.x.toFixed(1) + ' y=' + T.y.toFixed(1) + ' θ=' + deg.toFixed(0) + '° | ⌨️WASD驾驶 R彩虹 M镜 C清 Space停';
    }
  },

  renderMini() {
    var mini = document.getElementById('turtleMiniCanvas');
    if (!mini || mini.offsetParent === null) return;
    var mctx = mini.getContext('2d'), mw = mini.width, mh = mini.height;
    var scale = 0.25;
    mctx.clearRect(0, 0, mw, mh);
    // Grid
    mctx.strokeStyle = 'rgba(255,255,255,0.05)'; mctx.lineWidth = 0.5;
    for (var gx = mw/2 % 40; gx < mw; gx += 40) { mctx.beginPath(); mctx.moveTo(gx, 0); mctx.lineTo(gx, mh); mctx.stroke(); }
    for (var gy = mh/2 % 40; gy < mh; gy += 40) { mctx.beginPath(); mctx.moveTo(0, gy); mctx.lineTo(mw, gy); mctx.stroke(); }
    // Trail
    var ox = mw/2, oy = mh/2;
    for (var i = 0; i < T.trail.length; i++) {
      var t = T.trail[i];
      mctx.beginPath();
      mctx.moveTo(ox + t.x * scale, oy - t.y * scale);
      mctx.lineTo(ox + t.x2 * scale, oy - t.y2 * scale);
      mctx.strokeStyle = 'rgb(' + t.r + ',' + t.g + ',' + t.b + ')';
      mctx.lineWidth = Math.max(1, t.w * scale); mctx.lineCap = 'round';
      mctx.stroke();
    }
    // Turtle dot
    var sx = ox + T.x * scale, sy = oy - T.y * scale;
    mctx.fillStyle = 'rgb(' + T.penR + ',' + T.penG + ',' + T.penB + ')';
    mctx.shadowColor = mctx.fillStyle; mctx.shadowBlur = 4;
    mctx.beginPath(); mctx.arc(sx, sy, 1.5, 0, Math.PI * 2); mctx.fill();
    mctx.shadowBlur = 0;
    // Heading line
    mctx.strokeStyle = mctx.fillStyle; mctx.lineWidth = 1;
    mctx.beginPath(); mctx.moveTo(sx, sy);
    mctx.lineTo(sx + Math.cos(T.theta) * 5, sy - Math.sin(T.theta) * 5);
    mctx.stroke();
  },

  updateDataPanel() {
    var tdp = document.getElementById('turtleDataPanel');
    if (!tdp || tdp.style.display === 'none') return;
    // Pose digits
    var deg = (T.theta * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    document.getElementById('tdX').textContent = T.x.toFixed(1);
    document.getElementById('tdY').textContent = T.y.toFixed(1);
    document.getElementById('tdTheta').textContent = deg.toFixed(1) + '°';
    document.getElementById('tdV').textContent = (T.linearVel / 30).toFixed(1);
    document.getElementById('tdOmega').textContent = (T.angularVel / 2).toFixed(1);
    // Pen status
    document.getElementById('tdPenSwatch').style.background = 'rgb(' + T.penR + ',' + T.penG + ',' + T.penB + ')';
    document.getElementById('tdPenW').textContent = T.penWidth + 'px';
    var penOn = document.getElementById('tdPenOn');
    penOn.textContent = T.penDown ? 'ON' : 'OFF';
    penOn.className = T.penDown ? 'text-cyber-green' : 'text-cyber-red';
    // Velocity chart (throttled: every 15 frames)
    if (T.frameCount % 15 === 0) updateTurtleVelChart();
  },

  reset() { T.x = 0; T.y = 0; T.theta = 0; T.linearVel = 0; T.angularVel = 0; T.trail = []; T.velHistory.linear = []; T.velHistory.angular = []; },
  clearTrail() { T.trail = []; },
  setPen(r, g, b, width, off) { T.penR = r; T.penG = g; T.penB = b; T.penWidth = width || 2; T.penDown = !off; },
  teleport(x, y, theta) { T.x = x; T.y = y; T.theta = theta || 0; },
};

// --- Turtle Panel Management ---
function openTurtle() {
  var panel = document.getElementById('turtlePanel');
  var canvas = document.getElementById('turtleCanvas');
  if (!T.ctx) { T.init(canvas); }
  panel.classList.add('visible');
  T.startLoop();
  var tdp = document.getElementById('turtleDataPanel');
  if (tdp) { tdp.style.display = ''; }
  if (!window.__charts.turtleVel) initTurtleVelChart();
  addAlertLog('turtlesim 仿真器已启动 — /turtle1 在线', 'text-cyber-green');
}
function closeTurtle() {
  document.getElementById('turtlePanel').classList.remove('visible');
  var tdp = document.getElementById('turtleDataPanel');
  if (tdp) { tdp.style.display = 'none'; }
}
var TURTLE_LINEAR_SCALE = 30;  // 1.0 ROS unit -> 30 px/s
var TURTLE_ANGULAR_SCALE = 2;   // 1.0 rad/s -> reasonable rotation

function turtlesimSetVel(vx, va) {
  openTurtle();
  T.linearVel = vx * 30;   // scale for visible movement: 1.0 → 30 px/s
  T.angularVel = va * 2;   // 1.0 rad/s → reasonable rotation
}
function turtlesimClear() { T.clearTrail(); }
function execTurtleCmd() {
  var input = document.getElementById('turtleInput');
  var val = input.value.trim();
  if (!val) return;
  openTurtle();
  // Simulate as if typed in console: parse and dispatch
  var cmdInput_ = document.getElementById('commandInput');
  cmdInput_.value = val;
  cmdInput_.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  input.value = '';
}
document.getElementById('turtleInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); execTurtleCmd(); }
  if (e.key === 'Escape') { closeTurtle(); document.getElementById('commandInput').focus(); }
});

// Draggable panel
(function() {
  var dragging = false, ox = 0, oy = 0;
  var panel = document.getElementById('turtlePanel');
  var handle = document.getElementById('turtleDragHandle');
  handle.addEventListener('mousedown', function(e) {
    dragging = true;
    var r = panel.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    panel.style.transform = 'none';
    panel.style.top = r.top + 'px'; panel.style.left = r.left + 'px';
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    panel.style.top = (e.clientY - oy) + 'px';
    panel.style.left = (e.clientX - ox) + 'px';
  });
  document.addEventListener('mouseup', function() { dragging = false; });
})();

// --- Extend console with turtlesim command ---
window.__commands.turtle = function() {
  openTurtle();
  return '🐢 turtlesim 已打开 | /turtle1 在线\n\n⌨️ 键盘驾驶: WASD/方向键 移动 | R彩虹 M镜像 C清除 Space停止\n🖱️ 点击画布 → 导航\n\n🕹️ 面板按钮: ↑↓↺↻⏹✕ | 🌈彩虹画笔 | 🪞镜像模式(4/8向) | 📐预设图形\n\nROS2 命令:\n  ros2 topic pub /turtle1/cmd_vel geometry_msgs/msg/Twist \"{linear: {x: 2.0}, angular: {z: 1.0}}\"\n  ros2 service call /clear std_srvs/srv/Empty\n  ros2 service call /turtle1/teleport_absolute turtlesim/srv/TeleportAbsolute \"{x: 1.0, y: 1.0, theta: 0.0}\"\n  ros2 service call /turtle1/set_pen turtlesim/srv/SetPen \"{r: 0, g: 255, b: 0, width: 3, off: 0}\"\n  ros2 service call /turtle1/set_rainbow turtlesim/srv/SetRainbow \"{on: 1}\"\n  ros2 service call /turtle1/set_mirror turtlesim/srv/SetMirror \"{mode: 4}\"\n  ros2 topic echo /turtle1/pose';
};

// --- Wire turtlesim into ROS2 command handlers ---
// Override _topicPub to handle /turtle1/cmd_vel
var _origTopicPub = window.__commands._topicPub;
window.__commands._topicPub = function(args) {
  var topic = args[0], data = args.slice(2).join(' ');
  if (topic === '/turtle1/cmd_vel') {
    openTurtle();
    var lx = parseFloat((data.match(/x:\s*([\d.-]+)/) || [0, 2])[1]);
    var az = parseFloat((data.match(/z:\s*([\d.-]+)/) || [0, 1])[1]);
    T.linearVel = lx * TURTLE_LINEAR_SCALE;
    T.angularVel = az * 2;
    addAlertLog('turtlesim: cmd_vel → vx=' + lx.toFixed(1) + ' vz=' + az.toFixed(1), 'text-cyber-cyan');
    return '[PUB] /turtle1/cmd_vel: 速度指令已发布 — linear.x=' + lx.toFixed(1) + ', angular.z=' + az.toFixed(1);
  }
  return _origTopicPub(args);
};

// Extend _serviceCall to handle turtlesim services
var _origServiceCall = window.__commands._serviceCall;
window.__commands._serviceCall = function(args) {
  var srv = args[0];
  if (srv === '/clear') {
    openTurtle();
    T.clearTrail();
    addAlertLog('turtlesim: 画布清除', 'text-gray-500');
    return '[service call] /clear\n  response: {success: true}';
  }
  if (srv === '/turtle1/teleport_absolute') {
    openTurtle();
    var str = args.slice(2).join(' ');
    var mx = str.match(/x:\s*([\d.-]+)/), my = str.match(/y:\s*([\d.-]+)/), mt = str.match(/theta:\s*([\d.-]+)/);
    var tx = mx ? parseFloat(mx[1]) * TURTLE_LINEAR_SCALE : 0;
    var ty = my ? parseFloat(my[1]) * 30 : 0;
    var tt = mt ? parseFloat(mt[1]) : 0;
    T.teleport(tx, ty, tt);
    T.linearVel = 0; T.angularVel = 0;
    addAlertLog('turtlesim: 瞬移到 (' + (tx/30).toFixed(1) + ', ' + (ty/30).toFixed(1) + ')', 'text-cyber-cyan');
    return '[service call] /turtle1/teleport_absolute\n  response: {success: true}';
  }
  if (srv === '/turtle1/teleport_relative') {
    openTurtle();
    T.teleport(T.x, T.y, T.theta + 1.57);
    T.linearVel = 0; T.angularVel = 0;
    addAlertLog('turtlesim: 相对瞬移', 'text-cyber-cyan');
    return '[service call] /turtle1/teleport_relative\n  response: {success: true}';
  }
  if (srv === '/turtle1/set_pen') {
    openTurtle();
    var str = args.slice(2).join(' ');
    var mr = str.match(/r:\s*(\d+)/), mg = str.match(/g:\s*(\d+)/), mb = str.match(/b:\s*(\d+)/);
    var mw = str.match(/width:\s*(\d+)/), mo = str.match(/off:\s*(\d+)/);
    T.setPen(
      mr ? parseInt(mr[1]) : 0,
      mg ? parseInt(mg[1]) : 240,
      mb ? parseInt(mb[1]) : 255,
      mw ? parseInt(mw[1]) : 2,
      mo ? parseInt(mo[1]) : 0
    );
    addAlertLog('turtlesim: 画笔颜色=r' + T.penR + ' g' + T.penG + ' b' + T.penB, 'text-cyber-cyan');
    return '[service call] /turtle1/set_pen\n  response: {success: true}';
  }
  if (srv === '/reset') {
    T.reset();
    addAlertLog('turtlesim: 仿真重置', 'text-cyber-amber');
    return '[service call] /reset\n  response: {success: true}';
  }
  return _origServiceCall(args);
};

// Extend _topicEcho for /turtle1/pose
var _origTopicEcho = window.__commands._topicEcho;
window.__commands._topicEcho = function(topic) {
  if (topic === '/turtle1/pose') {
    return 'x: ' + (T.x/30).toFixed(4) + '\ny: ' + (T.y/30).toFixed(4) + '\ntheta: ' + T.theta.toFixed(4) + '\nlinear_velocity: ' + (T.linearVel/30).toFixed(2) + '\nangular_velocity: ' + (T.angularVel/2).toFixed(2) + '\n---';
  }
  return _origTopicEcho(topic);
};

// --- Shape Drawing (animated waypoint navigation) ---
T.startShape = function(points, label, cssClass) {
  openTurtle();
  T.linearVel = 0; T.angularVel = 0;
  T.shapePoints = points;
  T.shapeIdx = 0;
  addAlertLog('turtlesim: ' + label, cssClass);
};

function ptsHeart() {
  var pts = [];
  var scale = 5;
  var ox = 0, oy = 20;
  for (var i = 0; i <= 120; i++) {
    var t = (i / 120) * Math.PI * 2;
    var x = 16 * Math.pow(Math.sin(t), 3);
    var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({x: x * scale + ox, y: y * scale + oy});
  }
  return pts;
}

function drawHeart() {
  T.startShape(ptsHeart(), '心形轨迹开始绘制 ❤', 'text-cyber-magenta');
}

function ptsPentagram() {
  var pts = [];
  var outerR = 100, innerR = 38;
  var cx = 0, cy = 0;
  for (var i = 0; i < 5; i++) {
    var angleOuter = -Math.PI / 2 + (2 * Math.PI * i) / 5;
    pts.push({x: cx + outerR * Math.cos(angleOuter), y: cy + outerR * Math.sin(angleOuter)});
    var angleInner = -Math.PI / 2 + (2 * Math.PI * i + Math.PI) / 5;
    pts.push({x: cx + innerR * Math.cos(angleInner), y: cy + innerR * Math.sin(angleInner)});
  }
  pts.push(pts[0]);
  return pts;
}

function drawPentagram() {
  T.startShape(ptsPentagram(), '五角星轨迹开始绘制 ⭐', 'text-cyber-amber');
}

function ptsSpiral() {
  var pts = [], turns = 3, maxR = 120;
  for (var i = 0; i <= 300; i++) {
    var t = (i / 300) * turns * Math.PI * 2;
    var r = (i / 300) * maxR;
    pts.push({x: Math.cos(t) * r, y: Math.sin(t) * r});
  }
  return pts;
}
function drawSpiral() { T.startShape(ptsSpiral(), '螺旋线轨迹开始绘制 🌀', 'text-cyber-cyan'); }

function ptsLemniscate() {
  var pts = [], a = 100;
  for (var i = 0; i <= 200; i++) {
    var t = (i / 200) * Math.PI * 2;
    var d = 1 + Math.sin(t) * Math.sin(t);
    pts.push({x: a * Math.cos(t) / d, y: a * Math.sin(t) * Math.cos(t) / d});
  }
  return pts;
}
function drawLemniscate() { T.startShape(ptsLemniscate(), '双纽线轨迹开始绘制 ∞', 'text-cyber-magenta'); }

function ptsHexagon() {
  var pts = [], r = 90;
  for (var i = 0; i <= 6; i++) {
    var a = (Math.PI / 3) * i;
    pts.push({x: r * Math.cos(a), y: r * Math.sin(a)});
  }
  return pts;
}
function drawHexagon() { T.startShape(ptsHexagon(), '六边形轨迹开始绘制 ⬡', 'text-cyber-amber'); }

function ptsSquare() {
  var s = 80;
  return [
    {x: -s, y: s}, {x: s, y: s}, {x: s, y: -s}, {x: -s, y: -s}, {x: -s, y: s}
  ];
}
function drawSquare() { T.startShape(ptsSquare(), '正方形轨迹开始绘制 □', 'text-cyber-green'); }

function ptsSineWave() {
  var pts = [], amp = 60, period = 300, samples = 200;
  for (var i = 0; i <= samples; i++) {
    var x = -period / 2 + (i / samples) * period;
    pts.push({x: x, y: amp * Math.sin(x / 40)});
  }
  return pts;
}
function drawSineWave() { T.startShape(ptsSineWave(), '正弦波轨迹开始绘制 ∿', 'text-cyber-cyan'); }

// Shape dropdown toggle
function toggleShapeMenu() {
  var menu = document.getElementById('shapeMenu');
  menu.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  var menu = document.getElementById('shapeMenu');
  var toggle = document.getElementById('shapeToggle');
  if (menu && toggle && !toggle.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// --- Rainbow Pen Toggle ---
function toggleRainbow() {
  T.rainbowMode = !T.rainbowMode;
  var btn = document.getElementById('btnRainbow');
  if (btn) btn.classList.toggle('active', T.rainbowMode);
  addAlertLog('turtlesim: 彩虹画笔 ' + (T.rainbowMode ? 'ON 🌈' : 'OFF'), T.rainbowMode ? 'text-cyber-magenta' : 'text-gray-500');
}

// --- Mirror Mode Cycle (0→4→8→0) ---
function cycleMirror() {
  T.mirrorMode = T.mirrorMode === 0 ? 4 : T.mirrorMode === 4 ? 8 : 0;
  var btn = document.getElementById('btnMirror');
  if (btn) {
    btn.classList.toggle('active', T.mirrorMode > 0);
    btn.textContent = T.mirrorMode === 4 ? '🪞4' : T.mirrorMode === 8 ? '🪞8' : '🪞';
  }
  var label = T.mirrorMode === 4 ? '4向镜像' : T.mirrorMode === 8 ? '8向万花筒' : 'OFF';
  addAlertLog('turtlesim: 镜像模式 → ' + label, T.mirrorMode > 0 ? 'text-cyber-green' : 'text-gray-500');
}

// --- Keyboard Drive ---
var KB_SPEED = 100, KB_TURN = 3.5;

function kbIsInputFocused() {
  var el = document.activeElement;
  if (!el) return false;
  var tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

document.addEventListener('keydown', function(e) {
  var panel = document.getElementById('turtlePanel');
  if (!panel || !panel.classList.contains('visible')) return;
  if (kbIsInputFocused()) return;

  T.keysDown[e.key] = true;
  var linear = 0, angular = 0;

  if (T.keysDown['ArrowUp'] || T.keysDown['w'] || T.keysDown['W']) linear = KB_SPEED;
  if (T.keysDown['ArrowDown'] || T.keysDown['s'] || T.keysDown['S']) linear = -KB_SPEED;
  if (T.keysDown['ArrowLeft'] || T.keysDown['a'] || T.keysDown['A']) angular = KB_TURN;
  if (T.keysDown['ArrowRight'] || T.keysDown['d'] || T.keysDown['D']) angular = -KB_TURN;

  openTurtle();
  T.linearVel = linear; T.angularVel = angular;
  if (T.shapePoints) { T.shapePoints = null; }

  if (!e.repeat) {
    if (e.key === 'r' || e.key === 'R') toggleRainbow();
    if (e.key === 'm' || e.key === 'M') cycleMirror();
    if (e.key === 'c' || e.key === 'C') { T.clearTrail(); addAlertLog('turtlesim: 画布清除', 'text-gray-500'); }
    if (e.key === ' ') { e.preventDefault(); T.linearVel = 0; T.angularVel = 0; T.shapePoints = null; }
  }
});
document.addEventListener('keyup', function(e) {
  if (kbIsInputFocused()) return;
  T.keysDown[e.key] = false;
  var linear = 0, angular = 0;
  if (T.keysDown['ArrowUp'] || T.keysDown['w'] || T.keysDown['W']) linear = KB_SPEED;
  if (T.keysDown['ArrowDown'] || T.keysDown['s'] || T.keysDown['S']) linear = -KB_SPEED;
  if (T.keysDown['ArrowLeft'] || T.keysDown['a'] || T.keysDown['A']) angular = KB_TURN;
  if (T.keysDown['ArrowRight'] || T.keysDown['d'] || T.keysDown['D']) angular = -KB_TURN;
  T.linearVel = linear; T.angularVel = angular;
});

// --- Mouse Click-to-Navigate ---
document.getElementById('turtleCanvas').addEventListener('click', function(e) {
  var rect = this.getBoundingClientRect();
  var scaleX = this.width / rect.width;
  var scaleY = this.height / rect.height;
  var canvasX = (e.clientX - rect.left) * scaleX;
  var canvasY = (e.clientY - rect.top) * scaleY;
  var worldX = canvasX - T.cx;
  var worldY = T.cy - canvasY;  // flip Y
  openTurtle();
  T.linearVel = 0; T.angularVel = 0;
  T.shapePoints = [{x: worldX, y: worldY}];
  T.shapeIdx = 0;
  addAlertLog('turtlesim: 导航至 (' + (worldX/30).toFixed(1) + ', ' + (worldY/30).toFixed(1) + ') 🖱️', 'text-cyber-cyan');
});

// --- Console extensions for rainbow / mirror ---
(function() {
  var _origSC = window.__commands._serviceCall;
  window.__commands._serviceCall = function(args) {
    var srv = args[0];
    if (srv === '/turtle1/set_rainbow') {
      if (!T.rainbowMode) toggleRainbow();
      return '[service call] /turtle1/set_rainbow\n  response: {success: true, rainbow: ' + T.rainbowMode + '}';
    }
    if (srv === '/turtle1/set_mirror') {
      var str = args.slice(2).join(' ');
      var mm = str.match(/mode:\s*(\d+)/);
      var target = mm ? parseInt(mm[1]) : 4;
      while (T.mirrorMode !== target) cycleMirror();
      return '[service call] /turtle1/set_mirror\n  response: {success: true, mirror: ' + T.mirrorMode + '}';
    }
    return _origSC(args);
  };
})();