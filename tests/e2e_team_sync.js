const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => console.error('pageerror:', error.message));
  console.log('browser launched');
  await page.goto(process.env.TRANSPOSEPDF_URL || 'http://127.0.0.1:8000', { waitUntil: 'domcontentloaded' });
  console.log('page loaded');
  await page.locator('#teamSyncButton').waitFor();
  await page.click('#teamSyncButton');
  console.log('drawer opened');
  assert.equal(await page.locator('#teamSyncDrawer').isVisible(), true);
  assert.match(await page.locator('#teamSyncStatus').textContent(), /Local only/);
  assert.equal(await page.locator('#shareTeamButton').isVisible(), false);

  await page.route('https://dedicated.test/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'user-1', email: 'member@example.com' }) });
    if (url.includes('/rest/v1/team_members')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ role: 'owner', teams: { id: 'team-1', name: 'Sunday Band', created_at: '2026-09-13' } }]) });
    if (url.includes('/rest/v1/rpc/sync_changes_since')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.evaluate(() => localStorage.setItem('transpose.supabase.session:https://dedicated.test', JSON.stringify({ access_token: 'test-token' })));
  await page.fill('#syncProjectUrl', 'https://dedicated.test');
  await page.fill('#syncPublishableKey', 'test-publishable-key');
  await page.click('#saveSyncConfigButton');
  console.log('configuration submitted');
  await page.waitForTimeout(300);
  console.log('sync status:', await page.locator('#teamSyncStatus').textContent());
  await page.locator('#syncTeamPanel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#syncTeamSelect').inputValue(), 'team-1');
  assert.match(await page.locator('#syncUser').textContent(), /member@example.com/);
  assert.equal(await page.locator('#shareTeamButton').isVisible(), true);
  await page.screenshot({ path: 'artifacts/e2e/team-sync-settings.png', fullPage: false });
  await page.click('#disconnectSyncButton');
  assert.match(await page.locator('#teamSyncStatus').textContent(), /Local only/);
  assert.equal(await page.locator('#shareTeamButton').isVisible(), false);
  console.log('team sync browser smoke: 10 assertions passed');
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; setTimeout(() => process.exit(1), 50); });
