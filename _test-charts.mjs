import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning')
    errors.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', err => errors.push(`[PAGE_ERROR] ${err.message}`));

try {
  await page.goto('http://localhost:8771', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
} catch (e) {
  errors.push(`[NAV_ERROR] ${e.message}`);
}

const screenshotPath = 'f:/CC-project/robot-control-center/layout-test2.png';
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log(`Screenshot saved: ${screenshotPath}`);

// Check chart canvases
const chartLoad = await page.$('#chartLoad');
const chartTasks = await page.$('#chartTasks');
const chartRadar = await page.$('#chartRadar');

console.log('=== CHART ELEMENTS ===');
console.log('chartLoad:', chartLoad ? `visible=${await chartLoad.isVisible()}` : 'NOT FOUND');
console.log('chartTasks:', chartTasks ? `visible=${await chartTasks.isVisible()}` : 'NOT FOUND');
console.log('chartRadar:', chartRadar ? `visible=${await chartRadar.isVisible()}` : 'NOT FOUND');
console.log('Total canvas elements:', await page.locator('canvas').count());

// Check sidebar
const sidebar = await page.$('#sidebar');
console.log('Sidebar:', sidebar ? `visible=${await sidebar.isVisible()}` : 'NOT FOUND');
const hamburger = await page.$('#btnHamburger');
console.log('Hamburger:', hamburger ? `visible=${await hamburger.isVisible()}` : 'NOT FOUND');

// Check status panel health index
const healthEl = await page.$('#healthIndex');
console.log('HealthIndex:', healthEl ? await healthEl.textContent() : 'NOT FOUND');

// Check telemetry values
const statCpu = await page.$('#statCpu');
const statMem = await page.$('#statMem');
const statNet = await page.$('#statNet');
console.log('CPU:', statCpu ? await statCpu.textContent() : 'N/A');
console.log('MEM:', statMem ? await statMem.textContent() : 'N/A');
console.log('NET:', statNet ? await statNet.textContent() : 'N/A');

console.log(`\n=== CONSOLE ERRORS/WARNINGS (${errors.length}) ===`);
const shown = errors.slice(0, 40);
if (shown.length === 0) console.log('(none)');
else shown.forEach(e => console.log(e));

// Check if Chart is defined and charts exist
const chartInfo = await page.evaluate(() => {
  const info = {};
  info.ChartDefined = typeof Chart !== 'undefined';
  info.lucideDefined = typeof lucide !== 'undefined';
  info.__commandsDefined = typeof window.__commands !== 'undefined';
  info.__chartsKeys = window.__charts ? Object.keys(window.__charts) : [];
  info.cmdKeys = window.__commands ? Object.keys(window.__commands).length + ' commands' : 'UNDEFINED';
  // Check for unitProfiles
  info.unitProfilesKeys = typeof unitProfiles !== 'undefined' ? Object.keys(unitProfiles) : 'UNDEFINED';
  return info;
});
console.log('\n=== RUNTIME STATE ===');
console.log(JSON.stringify(chartInfo, null, 2));

await browser.close();
