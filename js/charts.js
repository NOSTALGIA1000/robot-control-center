// 4. CHART CONFIG
// ============================================
Chart.defaults.borderColor = 'rgba(30,30,58,0.6)';
Chart.defaults.font.family = "'JetBrains Mono', monospace";
window.__charts = {};

// Hex to rgba helper (global)
function hexToRgba(hex, a) {
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2), 16);
  const g = parseInt(h.substring(2,4), 16);
  const b = parseInt(h.substring(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function initCharts(cyan, magenta, green, amber, blue, red, bg) {
  if (typeof Chart === 'undefined') {
    ['chartLoad', 'chartTasks', 'chartRadar'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.parentElement) {
        el.style.display = 'none';
        var msg = document.createElement('div');
        msg.className = 'flex items-center justify-center h-full';
        msg.innerHTML = '<span class="text-xs text-gray-600 font-mono">图表引擎加载失败<br>请检查网络连接</span>';
        el.parentElement.appendChild(msg);
      }
    });
    return;
  }
  Chart.defaults.color = '#8888aa';
  const alpha = hexToRgba;

  // Chart 1: Line
  const ctx1 = document.getElementById('chartLoad').getContext('2d');
  window.__charts.c1 = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: ['20:00','21:00','22:00','23:00','00:00','01:00','02:00'],
      datasets: [{
        label: 'CPU %', data: [32,45,38,67,59,47,52],
        borderColor: cyan, backgroundColor: alpha(cyan,0.05),
        borderWidth:2, tension:.4, fill:true,
        pointBackgroundColor: cyan, pointBorderColor: bg,
        pointBorderWidth:2, pointRadius:4, pointHoverRadius:6,
      }, {
        label: 'MEM %', data: [55,58,62,71,68,64,60],
        borderColor: magenta, backgroundColor: alpha(magenta,0.03),
        borderWidth:2, tension:.4, fill:true,
        pointBackgroundColor: magenta, pointBorderColor: bg,
        pointBorderWidth:2, pointRadius:4, pointHoverRadius:6,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ intersect:false, mode:'index' },
      plugins:{ legend:{ labels:{ usePointStyle:true, padding:20, boxWidth:8 } } },
      scales:{
        y:{ beginAtZero:false, min:0, max:100, grid:{ color: alpha(cyan,0.08) } },
        x:{ grid:{ color: alpha(cyan,0.08) } }
      }
    }
  });

  // Chart 2: Bar
  const ctx2 = document.getElementById('chartTasks').getContext('2d');
  window.__charts.c2 = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['RX-1','RX-2','RX-3','RX-4','RX-5','RX-6','RX-7'],
      datasets: [{
        label: '已完成', data:[42,38,55,29,48,33,51],
        backgroundColor: alpha(green,0.6), borderColor: green,
        borderWidth:1, borderRadius:4,
      }, {
        label: '进行中', data:[8,12,3,15,6,10,4],
        backgroundColor: alpha(cyan,0.5), borderColor: cyan,
        borderWidth:1, borderRadius:4,
      }, {
        label: '队列中', data:[10,5,8,12,3,7,9],
        backgroundColor: alpha(amber,0.4), borderColor: amber,
        borderWidth:1, borderRadius:4,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ usePointStyle:true, padding:15, boxWidth:8 } } },
      scales:{
        x:{ stacked:true, grid:{ display:false } },
        y:{ stacked:true, grid:{ color: alpha(cyan,0.08) } }
      }
    }
  });

  // Chart 3: Radar
  const ctx3 = document.getElementById('chartRadar').getContext('2d');
  window.__charts.c3 = new Chart(ctx3, {
    type: 'radar',
    data: {
      labels: ['运动控制','视觉感知','路径规划','通讯延迟','能源效率','负载能力','故障恢复'],
      datasets: [{
        label: '当前值', data:[88,72,85,63,91,78,69],
        borderColor: cyan, backgroundColor: alpha(cyan,0.10),
        borderWidth:2, pointBackgroundColor: cyan,
        pointBorderColor: bg, pointBorderWidth:2, pointRadius:4, pointHoverRadius:6,
      }, {
        label: '阈值', data:[80,70,80,50,80,75,60],
        borderColor: amber, backgroundColor: alpha(amber,0.05),
        borderWidth:2, borderDash:[6,3],
        pointBackgroundColor: amber, pointBorderColor: bg,
        pointBorderWidth:2, pointRadius:3, pointStyle:'triangle',
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:true,
      plugins:{
        legend:{ labels:{ usePointStyle:true, padding:15, boxWidth:8, font:{ size:11 } } }
      },
      scales:{
        r:{
          beginAtZero:true, max:100, min:0,
          grid:{ color: alpha(cyan,0.12) },
          angleLines:{ color: alpha(cyan,0.12) },
          pointLabels:{ color:'#aaaacc', font:{ size:12 } },
          ticks:{ display:false, stepSize:20, backdropColor:'transparent' }
        }
      }
    }
  });
}

// Initial chart render
const s = getComputedStyle(document.documentElement); initCharts(s.getPropertyValue('--cy-cyan').trim(), s.getPropertyValue('--cy-magenta').trim(), s.getPropertyValue('--cy-green').trim(), s.getPropertyValue('--cy-amber').trim(), s.getPropertyValue('--cy-blue').trim(), s.getPropertyValue('--cy-red').trim(), s.getPropertyValue('--cy-bg').trim());

// --- Turtle velocity chart (lazy init) ---
function initTurtleVelChart() {
  if (typeof Chart === 'undefined') return;
  const s = getComputedStyle(document.documentElement);
  const cyan = s.getPropertyValue('--cy-cyan').trim();
  const green = s.getPropertyValue('--cy-green').trim();
  const magenta = s.getPropertyValue('--cy-magenta').trim();
  const bg = s.getPropertyValue('--cy-bg').trim();
  const h = hexToRgba;
  const ctx = document.getElementById('chartTurtleVel').getContext('2d');
  window.__charts.turtleVel = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({length: 120}, function(_,i){ return i; }),
      datasets: [{
        label: 'v (u/s)', data: Array(120).fill(0),
        borderColor: cyan, backgroundColor: 'transparent',
        borderWidth: 1.5, tension: 0.3, pointRadius: 0,
      }, {
        label: 'ω (rad/s)', data: Array(120).fill(0),
        borderColor: magenta, backgroundColor: 'transparent',
        borderWidth: 1.5, tension: 0.3, pointRadius: 0,
        borderDash: [4, 2],
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, labels: { usePointStyle: true, padding: 12, boxWidth: 6, font: { size: 9 } } }
      },
      scales: {
        y: {
          min: -5, max: 5,
          grid: { color: h(cyan, 0.08) },
          ticks: { font: { size: 9 }, stepSize: 2.5 }
        },
        x: { display: false }
      }
    }
  });
}

function updateTurtleVelChart() {
  const chart = window.__charts.turtleVel;
  if (!chart) return;
  const vl = T.velHistory;
  const pad = chart.data.labels.length - vl.linear.length;
  let ldata = pad > 0 ? Array(pad).fill(0).concat(vl.linear.map(function(v){ return v / 30; })) : vl.linear.slice(-chart.data.labels.length).map(function(v){ return v / 30; });
  let adata = pad > 0 ? Array(pad).fill(0).concat(vl.angular.map(function(v){ return v / 2; })) : vl.angular.slice(-chart.data.labels.length).map(function(v){ return v / 2; });
  if (ldata.length > chart.data.labels.length) ldata = ldata.slice(-chart.data.labels.length);
  if (adata.length > chart.data.labels.length) adata = adata.slice(-chart.data.labels.length);
  chart.data.datasets[0].data = ldata;
  chart.data.datasets[1].data = adata;
  chart.update('none');
}