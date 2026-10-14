// Runtime smoke audit for the live site (or a local server).
//   KOSMIC_SITE_URL=http://localhost:8000/ node qa/runtime-audit.mjs
// Checks: no uncaught page errors, Video Studio / Image / Agent Feline / Kosmic Engine
// open, their prompt boxes accept typing, and every KosmicEngine.* inline handler exists.
import fs from 'node:fs';
import { chromium } from 'playwright';

const SITE_URL = process.env.KOSMIC_SITE_URL || 'https://kosmickat.art/';
const OUT = process.env.KOSMIC_QA_DIR || 'qa-artifacts';
const failures = [], warnings = [], pageErrors = [];
const fail = (m, d = '') => failures.push(d ? `${m}: ${d}` : m);
const warn = (m, d = '') => warnings.push(d ? `${m}: ${d}` : m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Errors caused only by the sandbox/offline environment, not by the app.
const IGNORE = /firebase|fbAuth|fbStorage|Failed to fetch|NetworkError|net::/i;

async function openModule(page, mod) {
  await page.evaluate((m) => switchMod(m), mod).catch((e) => fail(`switchMod(${mod}) threw`, String(e)));
  await sleep(1300);
}

async function auditTyping(page, mod, inputSel) {
  await openModule(page, mod);
  const info = await page.evaluate((sel) => {
    const t = document.querySelector(sel);
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { disabled: t.disabled, readOnly: t.readOnly, w: r.width, h: r.height };
  }, inputSel);
  if (!info) return fail(`${mod}: prompt box ${inputSel} missing`);
  if (info.disabled || info.readOnly) fail(`${mod}: prompt box is disabled/read-only`);
  if (info.w < 40 || info.h < 10) fail(`${mod}: prompt box has no size`, JSON.stringify(info));
  await page.locator(inputSel).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator(inputSel).first().click({ force: true }).catch(() => {});
  await page.keyboard.type('qa typing check');
  const v = await page.locator(inputSel).first().inputValue().catch(() => '');
  if (!/qa typing check/.test(v)) fail(`${mod}: typing into the prompt box does not work`, JSON.stringify(v));
  await page.locator(inputSel).first().fill('').catch(() => {});
}

async function auditEngine(page) {
  await page.evaluate(() => {
    S.projects = [{ id: 'qa1', name: 'QA Film', created: Date.now(), episodes: [] }];
    S.kosmicEngineProjectId = 'qa1';
  });
  await openModule(page, 'kosmicengine');
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[onclick],[onchange]').forEach((n) => {
      for (const a of ['onclick', 'onchange']) {
        const v = n.getAttribute(a);
        if (!v) continue;
        for (const m of v.matchAll(/KosmicEngine\.(\w+)/g)) if (typeof KosmicEngine[m[1]] !== 'function') out.push(m[1]);
      }
    });
    return [...new Set(out)];
  });
  if (bad.length) fail('Kosmic Engine inline handlers point at missing functions', bad.join(', '));
  const picker = await page.evaluate(() => document.querySelectorAll('#dcEngineModel option').length).catch(() => 0);
  if (picker < 3) fail('Kosmic Engine brain model picker is empty', String(picker));
  for (const tier of ['lite', 'advance', 'ultra']) {
    const n = await page.evaluate((t) => { KosmicEngine.setEngineTier(t); return document.querySelectorAll('#dcEngineModel option').length; }, tier).catch(() => 0);
    if (n < 2) fail(`Kosmic Engine ${tier} tier has no models`, String(n));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 860 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => { const s = String(e?.stack || e); if (!IGNORE.test(s)) pageErrors.push(s); });
  try { await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
  catch (e) { fail('Initial navigation failed', String(e?.message || e)); }
  await sleep(3000);
  if (!(await page.title().catch(() => '')).match(/KosmicKat/i)) warn('Unexpected page title');
  await auditTyping(page, 'imagegen', '#igChatInput');
  await auditTyping(page, 'agentfeline', '#afChatInput');
  await openModule(page, 'videocanvas');
  const vid = await page.evaluate(() => !!document.querySelector('.kv-composer, #kvInput, [id^="kv"]')).catch(() => false);
  if (!vid) warn('Video Studio shell not detected (selector may need updating)');
  await auditEngine(page);
  await page.screenshot({ path: `${OUT}/engine.png` }).catch(() => {});
  await browser.close();
  if (pageErrors.length) fail('Uncaught page errors', pageErrors.slice(0, 5).join(' | '));
  const report = { site: SITE_URL, failures, warnings };
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(failures.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
