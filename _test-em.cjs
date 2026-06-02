const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:8771');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Test Emergency modal directly (no theme switch first)
  console.log('Clicking #btnAlert...');
  await page.click('#btnAlert');
  await page.waitForTimeout(500);

  const modalHtml = await page.locator('#modalAlert').evaluate(el => el.innerHTML.substring(0, 500));
  console.log('Modal innerHTML:', modalHtml);

  // Try clicking CANCEL
  const cancelBtns = await page.locator('#modalAlert button').all();
  for (const btn of cancelBtns) {
    const text = await btn.innerText();
    console.log('Button found:', text);
  }

  // Try click by text
  try {
    await page.click('button:has-text("CANCEL")', { timeout: 2000 });
    console.log('CANCEL clicked OK');
  } catch (e) {
    console.log('CANCEL click failed:', e.message.substring(0, 100));
    // Try xpath
    try {
      await page.click('text=CANCEL', { timeout: 2000 });
      console.log('text=CANCEL clicked OK');
    } catch (e2) {
      console.log('text=CANCEL also failed');
    }
  }

  await page.screenshot({ path: 'f:/CC-project/robot-control-center/layout-test.png', fullPage: false });
  await browser.close();
})();
