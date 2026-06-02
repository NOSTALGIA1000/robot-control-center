const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  const results = [];
  page.on('pageerror', err => { errors.push(err.message); });

  function ok(msg) { results.push(`[OK] ${msg}`); console.log(`  [OK] ${msg}`); }
  function fail(msg, reason) { results.push(`[FAIL] ${msg}: ${reason}`); console.log(`  [FAIL] ${msg}: ${reason}`); }

  async function isModalClosed(id) {
    return page.evaluate((modalId) => {
      const el = document.getElementById(modalId);
      if (!el) return true;
      const s = getComputedStyle(el);
      return s.opacity === '0' || s.pointerEvents === 'none' || s.display === 'none';
    }, id);
  }

  // Safely dismiss all modals
  async function dismissAllModals() {
    for (const id of ['modalSettings', 'modalAlert']) {
      if (!(await isModalClosed(id))) {
        await page.click(`#${id} .modal-close`, { timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    // Close turtle panel too
    try { await page.click('.turtle-close', { timeout: 500 }); await page.waitForTimeout(200); } catch (_) {}
  }

  await page.goto('http://localhost:8771');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // --- 1. Core Elements ---
  console.log('\n--- 1. Core Elements ---');
  for (const [name, sel] of [
    ['Header', 'header'], ['Sidebar', '#sidebar'], ['CommandInput', '#commandInput'],
    ['CommandOutput', '#commandOutput'], ['AlertLogContainer', '#alertLogContainer'],
    ['UnitSelect', '#unitSelect'], ['SysClock', '#sysClock'], ['HealthIndex', '#healthIndex'],
    ['ConsoleToggleBtn', '#consoleToggleBtn'],
  ]) {
    (await page.locator(sel).isVisible().catch(() => false))
      ? ok(`${name} visible`) : fail(`${name}`, 'not visible');
  }

  // --- 2. Quick Actions ---
  console.log('\n--- 2. Quick Actions ---');
  for (const text of ['INIT', 'HALT', 'RESET', 'KILL']) {
    try {
      await page.click(`button:has-text("${text}")`, { timeout: 2000 });
      await page.waitForTimeout(300);
      ok(`${text} clickable`);
    } catch (e) { fail(`${text}`, e.message.substring(0,60)); }
  }

  // --- 3. Command Console ---
  console.log('\n--- 3. Command Console ---');
  for (const cmd of ['help', 'status', 'clear', 'ros2', 'ros2 topic list',
    'ros2 node list', 'ros2 service list', 'alert 3', 'history', 'uptime']) {
    try {
      await page.locator('#commandInput').fill(cmd);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      ok(`cmd "${cmd}"`);
    } catch (e) { fail(`cmd "${cmd}"`, e.message.substring(0,60)); }
  }

  // --- 4. Unit Selector ---
  console.log('\n--- 4. Unit Selector ---');
  try {
    await page.selectOption('#unitSelect', 'RX-7-beta');
    await page.waitForTimeout(400);
    const val = await page.locator('#unitSelect').inputValue();
    val === 'RX-7-beta' ? ok('Switched to RX-7-beta') : fail('Unit switch', `value=${val}`);
    await page.selectOption('#unitSelect', 'RX-7-alpha');
    await page.waitForTimeout(200);
    ok('Switched back to RX-7-alpha');
  } catch (e) { fail('Unit selector', e.message.substring(0,60)); }

  // --- 5. System Clock ---
  console.log('\n--- 5. System Clock ---');
  try {
    const t1 = await page.locator('#sysClock').innerText();
    await page.waitForTimeout(1100);
    const t2 = await page.locator('#sysClock').innerText();
    t1 !== t2 ? ok('Clock updating') : fail('Clock', 'stuck');
  } catch (e) { fail('Clock', e.message.substring(0,60)); }

  // --- 6. Settings Modal ---
  console.log('\n--- 6. Settings Modal ---');
  try {
    await page.click('#btnSettings');
    await page.waitForTimeout(500);
    if (await isModalClosed('modalSettings')) { fail('Settings open', 'still closed'); }
    else {
      ok('Settings modal opened');
      await page.selectOption('#setTheme', 'matrix');
      await page.click('button:has-text("APPLY")');
      await page.waitForTimeout(1200);
      (await isModalClosed('modalSettings')) ? ok('Settings closed') : fail('Settings close', 'not closed');
    }
  } catch (e) { fail('Settings modal', e.message.substring(0,80)); }
  await dismissAllModals();

  // --- 7. Emergency Modal ---
  console.log('\n--- 7. Emergency Modal ---');
  try {
    await page.click('#btnAlert', { timeout: 3000 });
    await page.waitForTimeout(500);
    if (await isModalClosed('modalAlert')) { fail('Emergency open', 'still closed'); }
    else {
      ok('Emergency modal opened');
      // Dismiss via close button (✕)
      await page.click('#modalAlert .modal-close', { timeout: 3000 });
      await page.waitForTimeout(500);
      (await isModalClosed('modalAlert')) ? ok('Emergency dismissed') : fail('Emergency dismiss', 'not closed');
    }
  } catch (e) { fail('Emergency modal', e.message.substring(0,80)); }
  await dismissAllModals();

  // --- 8. Turtle Panel ---
  console.log('\n--- 8. Turtle Panel ---');
  try {
    await page.click('#btnTurtle', { timeout: 3000 });
    await page.waitForTimeout(500);
    (await page.locator('#turtleCanvas').isVisible().catch(() => false))
      ? ok('Turtle panel + canvas') : fail('Turtle panel', 'not visible');
    let dirsOk = 0;
    for (const dir of ['↑', '↓', '↺', '↻', '⏹']) {
      try { await page.click(`button:has-text("${dir}")`, { timeout: 1000 }); await page.waitForTimeout(100); dirsOk++; } catch (_) {}
    }
    ok(`Turtle buttons: ${dirsOk}/5`);
    await page.click('.turtle-close');
    await page.waitForTimeout(400);
    ok('Turtle closed');
  } catch (e) { fail('Turtle panel', e.message.substring(0,80)); }
  await dismissAllModals();

  // --- 9. Console Toggle ---
  console.log('\n--- 9. Console Toggle ---');
  try {
    const beforeH = (await page.locator('#commandOutput').boundingBox())?.height || 0;
    await page.click('#consoleToggleBtn', { timeout: 3000 });
    await page.waitForTimeout(600);
    const afterH = (await page.locator('#commandOutput').boundingBox())?.height || 0;
    afterH !== beforeH
      ? ok(`Console toggle (${beforeH.toFixed(0)} → ${afterH.toFixed(0)}px)`)
      : fail('Console toggle', `unchanged ${beforeH.toFixed(0)}px`);
    await page.click('#consoleToggleBtn');
    await page.waitForTimeout(400);
  } catch (e) { fail('Console toggle', e.message.substring(0,80)); }

  // --- 10. Charts ---
  console.log('\n--- 10. Charts ---');
  const canvases = await page.locator('canvas').count();
  canvases >= 4 ? ok(`${canvases} canvas elements`) : fail('Charts', `only ${canvases} canvas`);

  // --- 11. Health & Status ---
  try {
    const health = await page.locator('#healthIndex').innerText();
    ok(`Health: ${health}`);
    const dots = await page.locator('.w-2.h-2.rounded-full').count();
    ok(`${dots} status dots`);
  } catch (e) { fail('Health/Dots', e.message.substring(0,60)); }

  // --- 12. Sidebar ---
  try {
    const info = await page.evaluate(() => {
      const el = document.getElementById('sidebar');
      if (!el) return 'no-sidebar';
      return `w:${el.offsetWidth}px overflow:${getComputedStyle(el).overflowY}`;
    });
    ok(`Sidebar: ${info}`);
  } catch (e) { fail('Sidebar', e.message.substring(0,60)); }

  // --- 13. Alert Level ---
  console.log('\n--- 13. Alert Level ---');
  try {
    await page.locator('#commandInput').fill('alert 4');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const label = await page.locator('#alertLabel').innerText();
    label.includes('LV.4') ? ok('Alert LV.4') : fail('Alert level', label);
    await page.locator('#commandInput').fill('alert off');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    ok('Alert cleared');
  } catch (e) { fail('Alert level', e.message.substring(0,60)); }

  // --- FINAL ---
  console.log('\n========== SUMMARY ==========');
  const fails = results.filter(r => r.startsWith('[FAIL]'));
  console.log(`Page errors: ${errors.length}`);
  if (errors.length > 0) for (const e of errors) console.log(`  [ERR] ${e}`);
  console.log(`Tests: ${results.length} total, ${fails.length} failed`);
  if (fails.length > 0) for (const f of fails) console.log(`  ${f}`);

  if (errors.length > 0 || fails.length > 0) {
    await page.screenshot({ path: 'f:/CC-project/robot-control-center/layout-test.png', fullPage: false });
  } else {
    console.log('\n=== ALL TESTS PASSED ===');
  }
  await browser.close();
})();
