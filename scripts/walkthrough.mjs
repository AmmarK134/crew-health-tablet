// A full walk through every action, done by tapping the real interface in a headless browser and
// checking the server's state after each tap. Optional: it needs Google Chrome and "npm install puppeteer-core".
//
//   python run.py                         (in one terminal)
//   node scripts/walkthrough.mjs          (in another)
//
// Set BASE to test another address, and CHROME to point at the browser if it is not found.

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://localhost:5050';
const CHROME =
  process.env.CHROME ||
  ['/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) =>
    existsSync(p),
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = async () => (await fetch(`${BASE}/api/state`)).json();
let passed = 0;
const failed = [];
function check(ok, what) {
  if (ok) passed += 1;
  else failed.push(what);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const errors = [];
async function tablet(who) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  await page.goto(`${BASE}/?as=${who}`, { waitUntil: 'networkidle2' });
  await sleep(700);
  return page;
}
/** Tap the last visible control whose text contains (or exactly equals) the given words. */
async function tap(page, text, { exact = false, within = 'button, a.btn' } = {}) {
  const found = await page.evaluate(
    (text, exact, within) => {
      const norm = (s) => s.replace(/\s+/g, ' ').trim();
      const els = Array.from(document.querySelectorAll(within)).filter((el) => {
        if (el.offsetParent === null || el.disabled) return false;
        // Two-line buttons carry their main word in the first child.
        const first = el.firstElementChild ? norm(el.firstElementChild.textContent || '') : '';
        const t = norm(el.textContent || '');
        return exact ? t === text || first === text : t.includes(text);
      });
      if (!els.length) return false;
      els[els.length - 1].click();
      return true;
    },
    text,
    exact,
    within,
  );
  if (!found) check(false, `control "${text}" was not on screen`);
  await sleep(450);
}
const startScenario = async (page) => {
  await tap(page, 'Demo tablet');
  await tap(page, 'Issue a low-confidence heart result');
  await sleep(1200);
};
const reset = async (page) => {
  await tap(page, 'Demo tablet');
  await tap(page, 'Reset everything');
  await sleep(1200);
};

const lena = await tablet('lena');
const sam = await tablet('sam');
const ravi = await tablet('ravi');
const maya = await tablet('maya');
let S;

await reset(lena);
S = await state();
check(!S.heart && !S.emergency && S.mode === 'mars', 'reset gives a clean state');

// ---- check-ins and manual entry
await tap(lena, 'Check-ins', { within: '.dock-item' });
await tap(lena, 'Reaction-time test');
S = await state();
check(S.checkins.fatigue === true, 'tapping a check-in marks it done');
await tap(lena, 'My health', { within: '.dock-item' });
await tap(lena, 'Blood sugar');
await tap(lena, 'Enter now');
S = await state();
check(S.checkins.glucose === true && S.indicators.lena.find((i) => i.key === 'glucose').value === '84', '"Enter now" records the blood sugar reading');

// ---- get crew doctor
await tap(lena, 'Get crew doctor');
S = await state();
check(S.doctor_woken && S.doctor_woken.by === 'lena', '"Get crew doctor" tells the crew doctor');

// ---- quick check: No, Not sure, Yes then Stop
await reset(lena);
await startScenario(lena);
S = await state();
check(S.heart && S.heart.stage === 'caution' && S.advisories.length === 1, 'the heart scenario issues a caution and an advisory');
await tap(lena, 'No', { exact: true, within: '.answer' });
S = await state();
check(S.heart?.stage === 'monitored' && S.heart?.quick_check === 'no', 'quick check "No" sets the result to monitored');

await reset(lena);
await startScenario(lena);
await tap(lena, 'Not sure', { exact: true, within: '.answer' });
S = await state();
check(S.heart.stage === 'doctor_woken' && S.doctor_woken.why === 'Quick check: not sure', 'quick check "Not sure" wakes only the crew doctor');
await tap(lena, 'Take a Heart reading');
S = await state();
check(S.heart.heart_reading === true && S.heart.model.level === 'criterion_met', '"Take a Heart reading" records the 12-lead reading');

await reset(lena);
await startScenario(lena);
await tap(lena, 'Yes', { exact: true, within: '.answer' });
S = await state();
check(S.heart.stage === 'countdown' && !!S.heart.countdown_end, 'quick check "Yes" starts the countdown');
await tap(lena, 'Stop: wake only the crew doctor');
S = await state();
check(S.heart.stage === 'doctor_woken' && S.doctor_woken.why === 'Countdown stopped' && !S.emergency, 'stopping the countdown wakes only the crew doctor');

// ---- crew doctor decisions
await tap(sam, 'Monitor', { exact: true, within: '.decision' });
await tap(sam, 'No symptoms, stable');
await tap(sam, 'Record: monitor');
S = await state();
check(S.heart.stage === 'monitored' && S.decisions[0].decision === 'monitor' && S.decisions[0].reason === 'No symptoms, stable', 'Monitor is recorded with its reason');
await tap(sam, 'Confirm', { exact: true, within: '.decision' });
await tap(sam, 'Record: confirm');
S = await state();
check(S.heart.stage === 'confirmed' && S.decisions[0].decision === 'confirm', 'Confirm is recorded');
await tap(sam, 'Dismiss', { exact: true, within: '.decision' });
await tap(sam, 'Sensor artefact suspected');
await tap(sam, 'Record: dismiss');
S = await state();
check(S.heart.stage === 'cleared' && S.advisories[0].dismissed === 'Sensor artefact suspected', 'Dismiss clears the result and the advisory');

await reset(sam);
await startScenario(sam);
await tap(sam, 'Sensor artefact', { exact: true, within: '.review .chip' });
S = await state();
check(S.advisories[0].dismissed === 'Sensor artefact' && S.heart.stage === 'cleared', 'the review list dismisses an advisory with a reason');

// ---- escalate, stop, escalate, send now
await reset(sam);
await startScenario(sam);
await tap(sam, 'Record Heart reading');
await tap(sam, 'Escalate', { exact: true, within: '.decision' });
S = await state();
check(S.heart.stage === 'countdown' && S.heart.countdown_by === 'Sam (crew doctor)', 'Escalate starts the crew doctor\'s countdown');
await tap(sam, 'Stop countdown');
S = await state();
check(S.heart.stage === 'doctor_woken' && !S.emergency, 'the crew doctor can stop the countdown');
await tap(sam, 'Escalate', { exact: true, within: '.decision' });
await tap(sam, 'Send now');
await sleep(1500);
S = await state();
check(S.emergency?.kind === 'heart' && S.emergency?.roster.lena === 'patient', '"Send now" declares the crew-wide emergency');
check(await ravi.evaluate(() => !!document.querySelector('.emg-band')), 'the emergency opens by itself on another tablet');

// ---- responding, checklist, ending
await tap(ravi, "I'm responding");
await tap(ravi, 'On the way');
await tap(ravi, 'On scene');
S = await state();
check(S.emergency?.roster.ravi === 'on_scene', 'a responder moves from alerted to on scene');
await tap(sam, 'Record as done');
await sam.type('.step-entry input', '1.6 mm in II, III and aVF');
await tap(sam, 'Record result');
S = await state();
check(S.emergency?.checklist[0].result === 'Done' && S.emergency?.checklist[1].result === '1.6 mm in II, III and aVF' && S.emergency?.checklist[1].by === 'Sam', 'checklist results are recorded with who and when');
check(S.emergency?.report.status === 'sent' && S.emergency?.report.earliest_reply_at > S.emergency?.report.sent_at, 'the report to Earth was sent by itself');
await tap(sam, 'End emergency', { exact: true });
check(await sam.evaluate(() => Array.from(document.querySelectorAll('.dialog button')).some((b) => b.textContent.includes('End emergency for Lena') && b.disabled)), 'ending needs a reason first');
await tap(sam, 'Patient stable, monitoring continues');
await tap(sam, 'End emergency for Lena');
await sleep(1500);
S = await state();
check(!S.emergency && S.closed[0]?.outcome === 'not_known' && S.closed[0]?.reason === 'Patient stable, monitoring continues' && !!S.access_closed_notice, 'ending closes the emergency, logs the reason and closes crew access');
await tap(sam, 'Real event', { within: '.review .chip' });
S = await state();
check(S.closed[0]?.outcome === 'confirmed' && S.track.confirmed === 1, 'the outcome can be set later from the review list');

// ---- mission setting and solar particle events
await tap(lena, 'Earth link');
await tap(lena, 'Space station');
S = await state();
check(S.mode === 'station', 'the mission setting changes from the Earth link sheet');
await tap(lena, 'Close');
await tap(lena, 'Demo tablet');
await tap(lena, 'Demo event (simulated)');
await sleep(1500);
S = await state();
check(S.spe_caution && !S.emergency, 'at the station a solar particle event is a caution, not an emergency');
await tap(lena, 'My health', { within: '.dock-item' });
await tap(lena, 'Acknowledge: alert over');
S = await state();
check(!S.spe_caution, 'the station caution can be acknowledged');

await tap(lena, 'Earth link');
await tap(lena, 'Mars', { exact: true, within: '.seg button' });
await tap(lena, 'Close');
await tap(lena, 'Demo tablet');
await sleep(1200);
const stormId = await lena.evaluate(() => {
  const chip = document.querySelector('.storm-year .chip');
  if (chip) chip.click();
  return !!chip;
});
await sleep(1800);
S = await state();
check(stormId && S.emergency && S.emergency.kind === 'spe' && /SEP/.test(S.emergency.event), 'a recorded storm replays as a crew-wide emergency on Mars');
await tap(maya, "I'm responding");
await tap(maya, "I'm in the shelter");
S = await state();
check(S.emergency?.roster.maya === 'in_shelter', 'a crew member reports being in the shelter');
await tap(maya, 'End emergency', { exact: true });
await tap(maya, 'Storm over, dose rate back to usual');
await tap(maya, 'End emergency for the whole crew');
await sleep(1500);
S = await state();
check(!S.emergency && S.closed[0]?.kind === 'spe', 'the commander can end the solar particle emergency');

await reset(lena);
S = await state();
check(!S.heart && !S.emergency && S.closed.length === 0 && S.mode === 'mars', 'reset everything starts again');
check(errors.length === 0, `no errors in the page (${errors.length ? errors.join('; ') : 'none'})`);

await browser.close();
console.log(`\n${passed} checks passed, ${failed.length} failed.`);
if (failed.length) {
  console.log(failed.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
