import fs from 'node:fs';
import { chromium } from 'playwright';

const SITE_URL = process.env.KOSMIC_SITE_URL || 'https://kosmickatstudio.github.io/Kosmic-kat-studio/';
const OUT = process.env.KOSMIC_QA_DIR || 'qa-artifacts';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const warnings = [];
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const badResponses = [];

function fail(message, detail = '') { failures.push(detail ? `${message}: ${detail}` : message); }
function warn(message, detail = '') { warnings.push(detail ? `${message}: ${detail}` : message); }

async function visible(page, selector) {
  const locator = page.locator(selector).first();
  return await locator.count() > 0 && await locator.isVisible().catch(() => false);
}

async function auditSettings(page, screenshotName) {
  let opened = false;
  try {
    opened = await page.evaluate(() => {
      try {
        if (typeof toggleIgSettings === 'function') { toggleIgSettings(); return true; }
      } catch (e) { window.__kosmicQaSettingsError = String(e?.stack || e); }
      return false;
    });
  } catch (e) { warn('Settings evaluation failed', String(e?.message || e)); }

  await sleep(350);
  if (!opened) {
    const launcher = page.locator('[onclick*="toggleIgSettings"], [onclick*="openDirSheet"]').first();
    if (await launcher.count()) await launcher.click({ timeout: 3000 }).catch((e) => warn('Settings launcher could not be clicked', e.message));
    else warn('No known Image Settings launcher found');
    await sleep(350);
  }

  const state = await page.evaluate(() => {
    const sheet = document.querySelector('.ig-settings-sheet');
    const backdrop = document.querySelector('.ig-settings-backdrop');
    if (!sheet) return { found: false };
    const s = getComputedStyle(sheet);
    const b = backdrop ? getComputedStyle(backdrop) : null;
    const rect = sheet.getBoundingClientRect();
    return {
      found: true,
      classes: sheet.className,
      parent: sheet.parentElement?.tagName || null,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      sheet: { display: s.display, visibility: s.visibility, opacity: s.opacity, zIndex: s.zIndex, position: s.position, transform: s.transform, filter: s.filter, pointerEvents: s.pointerEvents },
      backdrop: b ? { display: b.display, visibility: b.visibility, opacity: b.opacity, zIndex: b.zIndex, position: b.position } : null,
      handle: !!sheet.querySelector('.ig-sheet-handle'),
      contentText: (sheet.innerText || '').trim().slice(0, 500),
    };
  });

  if (state.found) {
    if (!state.handle) fail('Settings sheet opened but shutter handle is missing');
    if (state.parent !== 'BODY') warn('Settings sheet is not mounted directly under BODY', state.parent);
    if (state.sheet.pointerEvents !== 'auto') warn('Settings sheet pointer-events is not auto', state.sheet.pointerEvents);
    if (state.sheet.filter !== 'none') warn('Settings sheet has a filter while open', state.sheet.filter);
    if (state.sheet.visibility !== 'visible' || state.sheet.opacity === '0' || state.sheet.display === 'none') fail('Settings sheet exists but is not visibly open', JSON.stringify(state.sheet));
    if (!state.contentText) warn('Settings sheet opened with no readable text content');
    await page.screenshot({ path: `${OUT}/${screenshotName}`, fullPage: false }).catch(() => {});
  } else warn('Image Settings sheet was not found at runtime');
  return state;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage();

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err?.stack || err)));
  page.on('requestfailed', (req) => requestFailures.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`));
  page.on('response', (res) => { if (res.status() >= 500) badResponses.push(`${res.status()} ${res.request().method()} ${res.url()}`); });

  let response;
  try {
    response = await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) { fail('Initial navigation threw', String(e?.message || e)); }
  if (!response) fail('Initial navigation returned no response');
  else if (response.status() >= 400) fail('Initial navigation failed', `${response.status()} ${response.url()}`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(1500);

  const title = await page.title();
  if (!/KosmicKat/i.test(title)) warn('Unexpected page title', title);
  for (const selector of ['body', 'header', '.studio-body', '.main-content']) if (!(await visible(page, selector))) fail('Required shell element missing/invisible', selector);
  for (const selector of ['#homeAgentInput', '#aiModelSelectTrigger', '#brainSubModelSelectTrigger']) if (!(await visible(page, selector))) warn('Home control missing/invisible', selector);

  const modelSnapshot = await page.evaluate(() => ({
    providerKeys: typeof BRAIN_SUBMODELS === 'object' && BRAIN_SUBMODELS ? Object.keys(BRAIN_SUBMODELS) : [],
    models: typeof BRAIN_SUBMODELS === 'object' && BRAIN_SUBMODELS ? Object.fromEntries(Object.entries(BRAIN_SUBMODELS).map(([k, v]) => [k, Array.isArray(v) ? v.map((m) => m?.id || m?.label || String(m)) : []])) : {},
  }));
  if (!modelSnapshot.providerKeys.length) warn('BRAIN_SUBMODELS is not exposed at runtime');

  const settingsState = await auditSettings(page, 'kosmic-settings-desktop.png');
  await page.screenshot({ path: `${OUT}/kosmic-home-desktop.png`, fullPage: true }).catch(() => {});

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(1000);
  const mobile = await page.evaluate(() => {
    const sheet = document.querySelector('.ig-settings-sheet');
    const handle = sheet?.querySelector('.ig-sheet-handle');
    if (!sheet || !handle) return { found: false };
    const ss = getComputedStyle(sheet); const hs = getComputedStyle(handle);
    return { found: true, viewport: { width: innerWidth, height: innerHeight }, sheet: { position: ss.position, width: ss.width, maxWidth: ss.maxWidth }, handle: { touchAction: hs.touchAction, pointerEvents: hs.pointerEvents } };
  });
  if (mobile.found) {
    if (mobile.handle.touchAction === 'auto') warn('Mobile settings handle touch-action is not overridden', mobile.handle.touchAction);
    if (mobile.handle.pointerEvents === 'none') fail('Mobile settings handle cannot receive input');
  }
  const mobileSettingsState = await auditSettings(page, 'kosmic-settings-mobile.png');
  await page.screenshot({ path: `${OUT}/kosmic-home-mobile.png`, fullPage: true }).catch(() => {});

  if (pageErrors.length) fail('Runtime page errors detected', pageErrors.slice(0, 20).join(' | '));
  if (badResponses.length) fail('HTTP 5xx responses detected', badResponses.slice(0, 20).join(' | '));
  if (requestFailures.length) warn('Network requests failed', requestFailures.slice(0, 20).join(' | '));
  if (consoleErrors.length) warn('Console errors detected', consoleErrors.slice(0, 20).join(' | '));

  const report = {
    site: SITE_URL, checkedAt: new Date().toISOString(), navigation: response ? { status: response.status(), url: response.url() } : null,
    title, failures, warnings, consoleErrors, pageErrors, requestFailures, badResponses,
    modelSnapshot, settingsState, mobileSettingsState, mobile,
  };
  fs.writeFileSync(`${OUT}/kosmic-runtime-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  if (failures.length) { console.error(`KOSMIC QA FAILED — ${failures.length} failure(s)`); process.exitCode = 1; }
  else console.log(`KOSMIC QA PASSED — ${warnings.length} warning(s)`);
}

main().catch((err) => { console.error(err?.stack || err); process.exitCode = 1; });
