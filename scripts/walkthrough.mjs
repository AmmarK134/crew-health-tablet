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
const openDemo = async (page) => {
  // The demo controls are hidden from the tablet screen: D opens and closes them.
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press('d');
  await sleep(450);
};
const startScenario = async (page) => {
  await openDemo(page);
  await tap(page, 'Raise the heart caution for Lena');
  await sleep(1200);
};
const reset = async (page) => {
  await openDemo(page);
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

// ---- demo controls: hidden, D opens and closes them
check(await lena.evaluate(() => !document.querySelector('.sheet') && !Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Demo tablet'))), 'demo controls are not on the tablet screen');
await openDemo(lena);
check(await lena.evaluate(() => !!document.querySelector('.sheet')), 'pressing D opens the demo controls');
await openDemo(lena);
check(await lena.evaluate(() => !document.querySelector('.sheet')), 'pressing D again closes them');

// ---- check-ins and manual entry
await tap(lena, 'Check-ins', { within: '.dock-item' });
await tap(lena, 'Reaction-time test');
S = await state();
check(S.checkins.lena.reactionTime === true, 'tapping a check-in enters it');
await tap(lena, 'My health', { within: '.dock-item' });
await tap(lena, 'Stress check-in');
await tap(lena, 'Enter now');
S = await state();
check(S.checkins.lena.stress === true && S.health.lena.measures.stress.readings[6].value === 'Low', '"Enter now" records the stress entry');

// ---- get crew doctor
await tap(lena, 'Get crew doctor');
S = await state();
check(S.doctor_woken && S.doctor_woken.by === 'lena', '"Get crew doctor" tells the crew doctor');

// ---- check-in: No, Not sure, Yes (Yes alerts the crew doctor; it never declares an emergency)
await reset(lena);
await startScenario(lena);
S = await state();
check(S.heart && S.heart.stage === 'caution' && S.advisories.length === 1, 'the heart scenario issues a caution and an advisory');
check(S.health.lena.caution && S.health.lena.caution.measures.includes('stShift'), 'the caution covers Lena\'s wearable ECG');
await tap(lena, 'No', { exact: true, within: '.answer' });
S = await state();
check(S.heart?.stage === 'monitored' && S.heart?.quick_check === 'no', 'check-in "No" sets the result to monitored');

await reset(lena);
await startScenario(lena);
await tap(lena, 'Not sure', { exact: true, within: '.answer' });
S = await state();
check(S.heart.stage === 'doctor_woken' && /^Check-in answer: Not sure/.test(S.doctor_woken.why), 'check-in "Not sure" alerts only the crew doctor');
await tap(lena, 'Take a heart reading');
S = await state();
check(S.heart.heart_reading === true && S.heart.model.level === 'criterion_met', '"Take a heart reading" records the 12-lead reading');

await reset(lena);
await startScenario(lena);
await tap(lena, 'Yes', { exact: true, within: '.answer' });
S = await state();
check(S.heart.stage === 'doctor_woken' && !S.heart.countdown_end && !S.emergency, 'check-in "Yes" alerts the crew doctor and starts no countdown');
check(await lena.evaluate(() => document.body.textContent.includes('If the pain gets worse, press SOS')), 'after "Yes" Lena is told to rest and press SOS if it gets worse');

// ---- crew doctor: opening the evidence is seen by Lena; ACTIS clot test; decisions
await tap(sam, 'Crew overview', { within: '.dock-item' });
await tap(sam, 'Lena', { within: '.row--person' });
await sleep(600);
S = await state();
check(!!S.heart.seen_at, 'opening the evidence records when the crew doctor saw it');
await tap(sam, 'Run ACTIS blood clot test');
S = await state();
check(S.heart.clot_test === true && S.heart.model.criteria.some((c) => c.basis === 'actis' && c.met === false), 'the ACTIS blood clot test is recorded (mock result)');
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
await tap(sam, 'Record heart reading');
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

// ---- responding (with undo), checklist (with a correction), ending
await tap(ravi, "I'm responding");
await tap(ravi, 'On the way');
S = await state();
check(S.emergency?.roster.ravi === 'on_the_way', 'a responder reports being on the way');
await tap(ravi, 'Undo “On the way”');
S = await state();
check(S.emergency?.roster.ravi === 'acknowledged', 'Undo takes a mistaken response back one step');
await tap(ravi, 'On the way');
await tap(ravi, 'On scene');
S = await state();
check(S.emergency?.roster.ravi === 'on_scene', 'a responder moves from alerted to on scene');
await tap(sam, 'Record as done');
await sam.type('.step-entry input', '1.6 mm in II, III and aVF');
await tap(sam, 'Record result');
S = await state();
check(S.emergency?.checklist[0].result === 'Done' && S.emergency?.checklist[1].result === '1.6 mm in II, III and aVF' && S.emergency?.checklist[1].by === 'Sam', 'checklist results are recorded with who and when');
await sam.evaluate(() => {
  const btn = document.querySelector('.checklist li:first-child .step-result-row button');
  btn && btn.click();
});
await sleep(400);
await sam.type('.checklist li:first-child .step-entry input', 'Lena seated at 10:41');
await tap(sam, 'Save correction');
S = await state();
check(S.emergency?.checklist[0].result === 'Lena seated at 10:41', 'a recorded checklist step can be corrected');
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

// ---- SOS: asked once, cancel a mistake within 10 seconds, or the crew doctor ends it
await reset(lena);
await tap(lena, 'SOS', { within: '.sb-sos' });
check(await lena.evaluate(() => !!document.querySelector('.dialog')), 'SOS asks once before sending');
await tap(lena, 'Cancel', { exact: true, within: '.dialog button' });
S = await state();
check(!S.emergency, 'Cancel in the SOS question sends nothing');
await tap(lena, 'SOS', { within: '.sb-sos' });
await tap(lena, 'Send SOS', { within: '.dialog button' });
await sleep(1200);
S = await state();
check(S.emergency?.kind === 'sos' && S.emergency?.patient === 'lena' && S.emergency?.where === 'Laboratory module', 'SOS declares a crew-wide emergency with the name and location');
check(await ravi.evaluate(() => document.querySelector('.emg-band')?.textContent.includes('Lena')), 'the SOS opens by itself on the other tablets');
await tap(lena, 'Cancel SOS: pressed by mistake');
await sleep(1000);
S = await state();
check(!S.emergency && S.closed[0]?.kind === 'sos' && S.closed[0]?.outcome === 'false_alarm' && /mistake/.test(S.closed[0]?.reason), 'the sender can cancel an SOS pressed by mistake; it is recorded as a false alarm');
await tap(lena, 'SOS', { within: '.sb-sos' });
await tap(lena, 'Send SOS', { within: '.dialog button' });
await sleep(11500);
check(await lena.evaluate(() => !Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Cancel SOS'))), 'the cancel button goes after 10 seconds');
await tap(sam, 'End emergency', { exact: true });
await tap(sam, 'Crew member safe, help given');
await tap(sam, 'End emergency for Lena');
await sleep(1200);
S = await state();
check(!S.emergency && S.closed[0]?.kind === 'sos', 'the crew doctor ends an SOS with a reason');

// ---- the watch: SOS needs a 3-second hold, then it can be cancelled; check-ins in one tap
await reset(lena);
const watch = await browser.newPage();
await watch.setViewport({ width: 900, height: 700 });
watch.on('pageerror', (e) => errors.push(`watch: ${e.message}`));
await watch.goto(`${BASE}/?device=cuff&as=ravi`, { waitUntil: 'networkidle2' });
await sleep(800);
await tap(watch, 'SOS', { within: '.cuff-dot' });
const box = await (await watch.$('.cuff-sos')).boundingBox();
await watch.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await watch.mouse.down();
await sleep(1200);
await watch.mouse.up();
await sleep(500);
S = await state();
check(!S.emergency, 'on the watch, a short press on SOS sends nothing');
await watch.mouse.down();
await sleep(3400);
await watch.mouse.up();
await sleep(1200);
S = await state();
check(S.emergency?.kind === 'sos' && S.emergency?.patient === 'ravi', 'on the watch, holding SOS for 3 seconds sends it');
await tap(watch, 'Cancel SOS');
await sleep(1000);
S = await state();
check(!S.emergency && S.closed[0]?.outcome === 'false_alarm', 'the watch can cancel its own SOS');
await watch.goto(`${BASE}/?device=cuff&as=lena`, { waitUntil: 'networkidle2' });
await sleep(800);
await tap(watch, 'Check-ins', { within: '.cuff-dot' });
await tap(watch, 'Stress', { within: '.cuff-check' });
S = await state();
check(S.checkins.lena.stress === true, 'a check-in is entered from the watch in one tap');
await watch.close();

// ---- mission setting and solar particle events
await tap(lena, 'Earth link');
await tap(lena, 'Space station');
S = await state();
check(S.mode === 'station', 'the mission setting changes from the Earth link sheet');
await tap(lena, 'Close');
await tap(lena, 'Radiation', { within: '.dock-item' });
await sleep(1500);
check(await lena.evaluate(() => document.body.textContent.includes('Measured on three Canadian missions')), 'the station radiation view shows the Canadian neutron measurements');
await openDemo(lena);
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
await openDemo(lena);
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
await tap(maya, 'Undo “In shelter”');
S = await state();
check(S.emergency?.roster.maya === 'acknowledged', 'Undo also works for "in the shelter"');
await tap(maya, "I'm in the shelter");
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
