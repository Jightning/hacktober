// Optional browser regressions: point R2_TEST_URL at an isolated seeded server.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const origin = process.env.R2_TEST_URL;
if (!origin) throw new Error('Set R2_TEST_URL to an isolated, seeded test server');
const base = origin + '/api/publications/demo-publication';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  page = await context.newPage();
try {
  await context.request.post(origin + '/api/session/demo', { data: { id: 'student-2' } });
  await context.request.put(base + '/answers/density', { data: { value: '2.5', units: 'g/mL' } });
  await context.request.post(base + '/checks/density-check', { data: {} });
  await page.goto(origin + '/lab/demo-publication');
  const cell = page.locator('#block-density-check'),
    answer = page.locator('#block-density input');
  await cell.getByText('Verified by automatic check', { exact: true }).waitFor();
  const outline = page.getByRole('navigation', { name: 'Notebook outline' });
  assert.deepEqual(
    await outline.getByRole('link').evaluateAll((links) => links.map((link) => link.hash)),
    [
      '#block-intro',
      '#block-formula',
      '#block-density',
      '#block-density-check',
      '#block-discussion',
    ],
  );
  await outline.getByRole('link').nth(2).click();
  assert.equal(new URL(page.url()).hash, '#block-density');
  await answer.focus();
  await page.keyboard.press('Tab');
  const submit = page.getByRole('button', { name: 'Submit answer', exact: true });
  assert.ok(
    await submit.evaluate(
      (element) =>
        element === document.activeElement &&
        getComputedStyle(element).outlineStyle !== 'none' &&
        parseFloat(getComputedStyle(element).outlineWidth) > 0,
    ),
  );
  await cell.getByRole('button', { name: 'Check my answer' }).click();
  await cell.getByText('Verified.', { exact: true }).waitFor();
  await answer.fill('3.25');
  await submit.click();
  await cell.getByText('Not verified', { exact: true }).waitFor();
  assert.equal(await cell.getByText('Verified.', { exact: true }).count(), 0);
  await answer.fill('2.5');
  await submit.click();
  await page.getByText('Answer saved.', { exact: true }).waitFor();
  await cell.getByRole('button', { name: 'Check my answer' }).click();
  await cell.getByText('Verified.', { exact: true }).waitFor();
  console.log('PASS ordered outline, visible keyboard focus, and stale check feedback regression');

  await page.route('**/demo-publication/student', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"Refresh unavailable"}',
    }),
  );
  await answer.fill('3.5');
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await page.getByText('Answer saved. Progress could not refresh yet.', { exact: true }).waitFor();
  assert.equal(await cell.getByText('Verified by automatic check', { exact: true }).count(), 0);
  await cell.getByText('Answer saved, refreshing checkpoint status', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  assert.equal(
    await page
      .getByRole('region', { name: 'Progress', exact: true })
      .getByText('Verified by automatic check', { exact: true })
      .count(),
    0,
  );
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await page.unroute('**/demo-publication/student');
  await cell.getByText('Not verified', { exact: true }).waitFor();
  console.log('PASS successful save with failed refresh never restores revoked verification');
  // Hold an old polling response until a new save and refresh have completed.
  let held = false,
    release,
    seen;
  const gate = new Promise((r) => (release = r)),
    caught = new Promise((r) => (seen = r));
  await page.route('**/demo-publication/student', async (route) => {
    if (!held) {
      held = true;
      const response = await route.fetch();
      const body = await response.text();
      seen();
      await gate;
      await route.fulfill({ response, body });
    } else await route.continue();
  });
  await caught;
  await answer.fill('4.5');
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await page.getByText('Answer saved.', { exact: true }).waitFor();
  release();
  await page.waitForTimeout(300);
  assert.equal(await answer.inputValue(), '4.5');
  await page.unroute('**/demo-publication/student');
  await page.reload();
  assert.equal(await answer.inputValue(), '4.5');
  console.log('PASS delayed pre-save polling cannot replace the new saved response');
  await page.route('**/demo-publication/student', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4200));
    await route.continue();
  });
  await page.reload();
  await answer.waitFor({ timeout: 10000 });
  assert.equal(await answer.inputValue(), '4.5');
  console.log('PASS initial student state loads when reads take longer than the polling interval');
  await page.unroute('**/demo-publication/student');
} finally {
  await browser.close();
}
