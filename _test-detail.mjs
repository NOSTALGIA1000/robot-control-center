import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:8771', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

// Deep chart inspection
const chartDetails = await page.evaluate(() => {
  const ch = window.__charts;
  const result = {};

  // c1: Line chart - System Load
  if (ch.c1) {
    result.c1 = {
      type: ch.c1.config.type,
      datasets: ch.c1.data.datasets.map(d => ({
        label: d.label,
        dataPoints: d.data.length,
        values: d.data,
        borderColor: d.borderColor,
        hasData: d.data.some(v => v !== 0)
      })),
      labels: ch.c1.data.labels,
      scales: {
        yMin: ch.c1.options.scales.y.min,
        yMax: ch.c1.options.scales.y.max
      }
    };
  }

  // c2: Bar chart - Task Queue
  if (ch.c2) {
    result.c2 = {
      type: ch.c2.config.type,
      datasets: ch.c2.data.datasets.map(d => ({
        label: d.label,
        dataPoints: d.data.length,
        values: d.data,
        backgroundColor: d.backgroundColor
      })),
      labels: ch.c2.data.labels
    };
  }

  // c3: Radar chart
  if (ch.c3) {
    result.c3 = {
      type: ch.c3.config.type,
      datasets: ch.c3.data.datasets.map(d => ({
        label: d.label,
        values: d.data,
        borderColor: d.borderColor,
        borderDash: d.borderDash
      })),
      labels: ch.c3.data.labels,
      pointLabelsColor: ch.c3.options.scales.r.pointLabels.color
    };
  }

  // Status dots
  const dots = [];
  document.querySelectorAll('.status-dot').forEach(d => {
    dots.push({
      node: d.closest('[data-node]')?.getAttribute('data-node'),
      classes: d.className
    });
  });
  result.statusDots = dots;

  // Alert log entries
  const alertEntries = document.querySelectorAll('#alertLogContainer > div').length;
  result.alertLogEntries = alertEntries;

  // Check TURTLE_DATA panel
  const turtlePanel = document.getElementById('turtleDataPanel');
  result.turtlePanelVisible = turtlePanel ? turtlePanel.style.display !== 'none' : false;

  return result;
});

console.log(JSON.stringify(chartDetails, null, 2));
console.log(`\nErrors (${errors.length}):`);
errors.forEach(e => console.log(' -', e));

// Take detailed screenshot
await page.screenshot({ path: 'f:/CC-project/robot-control-center/layout-detail.png', fullPage: true });
console.log('\nScreenshot: layout-detail.png');

await browser.close();
