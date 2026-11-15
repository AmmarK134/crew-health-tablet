// Mock AI insight: scripted answers about one person's readings, built from the server's demo data and the
// sources already cited in the app. It is not a model and not medical advice.
//
// Team rule kept: no invented probabilities, warning windows or track records. Figures come from the person's
// own readings or from a cited source; "what it could lead to" is worded as what a finding can point to and
// which test decides, never as a diagnosis or a percentage.

import type { CrewState, Indicator, PersonId, Radiation } from './api';
import { NAMES, NEXT, QUICK_WORD, SRC, type Source } from './content';
import { radAlert } from './logic';
import { checkinsDone, CHECKIN_DEFS, indicatorsFor } from './measures';
import { numText, rangeInfo } from './range';
import { clock } from './format';

export type Audience = 'self' | 'doctor';
export type Intent = 'summary' | 'lead' | 'normal' | 'next' | 'differential' | 'evidence' | 'chance' | 'unknown';

export interface Line {
  text: string;
  src?: Source;
}

export interface Answer {
  title: string;
  lines: Line[];
}

export interface Ctx {
  S: CrewState;
  rad: Radiation | null;
  pid: PersonId;
  audience: Audience;
}

export const SUGGESTIONS: Record<Audience, { intent: Intent; q: string }[]> = {
  self: [
    { intent: 'summary', q: 'What changed this week?' },
    { intent: 'lead', q: 'What could this lead to?' },
    { intent: 'normal', q: 'Is this normal in space?' },
    { intent: 'next', q: 'What should I do next?' },
  ],
  doctor: [
    { intent: 'summary', q: 'Summarise this crew member' },
    { intent: 'differential', q: 'What else could explain this?' },
    { intent: 'evidence', q: 'What does the evidence say?' },
    { intent: 'next', q: 'What should I check next?' },
  ],
};

/** Free text to an intent. Anything about chances or percentages gets an honest answer about why there is none. */
export function intentOf(text: string): Intent {
  const t = text.toLowerCase();
  if (/%|percent|chance|probab|likel|odds|risk of|how risky/.test(t)) return 'chance';
  if (/else|differential|other cause|explain/.test(t)) return 'differential';
  if (/evidence|source|study|studies|research|paper|literature/.test(t)) return 'evidence';
  if (/lead|mean|serious|danger|worr|cause|why/.test(t)) return 'lead';
  if (/normal|space|flight|weightless/.test(t)) return 'normal';
  if (/check|next|do |should|what now|help/.test(t)) return 'next';
  if (/change|week|summar|overview|how am i|how is|status|doing/.test(t)) return 'summary';
  return 'unknown';
}

// ---------------------------------------------------------------- the person's readings, in words

const you = (c: Ctx) => (c.audience === 'self' ? 'your' : `${NAMES[c.pid]}'s`);
const You = (c: Ctx) => (c.audience === 'self' ? 'Your' : `${NAMES[c.pid]}'s`);

/** How many of the latest days (or nights) are outside the usual range, counting back from today. */
function daysOutside(ind: Indicator): number {
  if (!ind.series || !ind.band) return 0;
  let k = 0;
  for (let i = ind.series.length - 1; i >= 0; i--) {
    const v = ind.series[i];
    if (v < ind.band[0] || v > ind.band[1]) k++;
    else break;
  }
  return k;
}

function readingWords(ind: Indicator): string {
  if (ind.key === 'ecg' && ind.series) {
    const v = ind.series[ind.series.length - 1];
    return `an ST shift of ${v > 0 ? '+' : v < 0 ? '−' : ''}${numText(Math.abs(v))} mm`;
  }
  if (ind.key === 'sleep') return `${ind.value} hours`;
  return `${ind.value}${ind.unit ? ` ${ind.unit}` : ''}`;
}

function outsideLine(c: Ctx, ind: Indicator): string {
  const r = rangeInfo(ind)!;
  const k = daysOutside(ind);
  const per = ind.key === 'sleep' ? 'night' : 'day';
  const span = k >= 2 ? ` for ${k} ${per}s in a row` : k === 1 ? (ind.key === 'sleep' ? ' last night' : ' today') : '';
  const usual = ind.key === 'ecg' ? `±${ind.band![1]} mm` : `${ind.usual}${ind.unit ? ` ${ind.unit}` : ''}`;
  return `${ind.name}: ${readingWords(ind)}, ${r.side} ${you(c)} usual ${usual}${span}.`;
}

interface Findings {
  inds: Indicator[];
  outside: Indicator[];
  flagged: Indicator[];
  stale: Indicator[];
  off: Indicator[];
  notEntered: Indicator[];
}

function findings(c: Ctx): Findings {
  const all = indicatorsFor(c.S, c.pid);
  const inds = c.audience === 'doctor' ? all.filter((i) => !i.private) : all;
  const outside = inds.filter((i) => {
    const r = i.state !== 'missing' ? rangeInfo(i) : null;
    return !!r && r.side !== 'within';
  });
  return {
    inds,
    outside,
    flagged: inds.filter((i) => i.state === 'flag'),
    stale: inds.filter((i) => i.state === 'missing' && i.missing === 'stale'),
    off: inds.filter((i) => i.state === 'missing' && i.missing === 'sensor_off'),
    notEntered: inds.filter((i) => i.state === 'missing' && i.missing === 'not_entered'),
  };
}

const heartOpen = (c: Ctx) =>
  c.pid === 'lena' && !!c.S.heart && !['cleared', 'closed'].includes(c.S.heart.stage);

// ---------------------------------------------------------------- what each finding can point to (no numbers invented)

const FLIGHT: Record<string, Line> = {
  bp: { text: 'Blood pressure falls about 8 to 10 mmHg in flight, so the usual range here is the in-flight range, not the Earth range.', src: SRC.norsk },
  hr: { text: 'Resting heart rate is usually unchanged in flight, so a rise from your own range is worth a look.', src: SRC.norsk },
  temp: { text: 'Resting core temperature rises about 1 °C over the first months in flight, so a reading near 37.6 °C can be normal there.', src: SRC.stahn },
  sleep: { text: 'Crews slept about 6 hours on the space station against 8.5 scheduled.', src: SRC.barger },
  ecg: { text: 'Rhythm changes are among the cardiovascular hazards NASA names for spaceflight.', src: SRC.research_cardio },
  reaction: { text: 'Isolation and confinement affect mood, sleep and decisions; NASA lists no monitoring tool for this risk.', src: SRC.behav },
};

function leadLines(c: Ctx, f: Findings): Line[] {
  const out: Line[] = [];
  const keys = new Set(f.outside.map((i) => i.key));
  if (keys.has('ecg')) {
    out.push({
      text: `A shift in the ST segment, together with a higher heart rate${keys.has('bp') ? ' and blood pressure' : ''}, can be an early sign that the heart muscle is short of blood. A wearable ECG is a screening signal only and cannot confirm or rule this out.`,
      src: SRC.rule,
    });
    out.push({
      text: 'The deciding test is the 12-lead heart reading: new ST elevation of at least 1 mm in two neighbouring leads is the published criterion for a possible heart attack. Diagnosis still needs the crew doctor.',
      src: SRC.thygesen,
    });
  } else {
    if (keys.has('hr')) out.push({ text: 'A resting heart rate above the usual range can follow exercise, short sleep, illness or stress. On its own it is a reason to recheck at rest, not an alarm.' });
    if (keys.has('bp')) out.push({ text: 'Blood pressure above the in-flight usual range: on its own, recheck seated after a few minutes of rest.', src: SRC.norsk });
  }
  if (keys.has('sleep')) {
    out.push({ text: 'Short sleep over several nights lowers alertness and makes errors more likely, and can affect mood. It is the kind of change a small step now can fix before it becomes a caution.', src: SRC.barger });
  }
  if (keys.has('temp')) out.push({ text: 'A temperature above the in-flight usual range can be an early sign of infection; recheck, and tell the crew doctor if it stays high.', src: SRC.stahn });
  if (keys.has('reaction')) out.push({ text: 'Slower reactions often follow short sleep, fatigue or stress. Worth avoiding tasks that need fast reactions until it recovers.', src: SRC.behav });
  if (f.stale.length || f.off.length) {
    out.push({ text: 'No new readings from the wearable: nothing can be said about what is not measured. Missing data is never counted as normal.' });
  }
  if (!out.length) out.push({ text: `Nothing in ${you(c)} readings this week points to a problem. Everything is within ${you(c)} own usual range.` });
  return out;
}

// ---------------------------------------------------------------- answers

function summary(c: Ctx, f: Findings): Answer {
  const lines: Line[] = [];
  const name = NAMES[c.pid];
  if (c.audience === 'doctor') {
    const done = checkinsDone(c.S, c.pid);
    lines.push({ text: `${name}: ${f.inds.length} measures from the wearable, the cuff and check-ins. Check-ins ${done} of ${CHECKIN_DEFS.length} done today (scores only; mood and stress are private and not used).` });
  }
  f.outside.forEach((i) => lines.push({ text: outsideLine(c, i) }));
  f.stale.forEach((i) =>
    lines.push({ text: `${i.name}: no new reading since ${clock(i.lastAt)}. The wearable (Bio-Monitor shirt or watch) is not sending data.` }),
  );
  f.off.forEach((i) => lines.push({ text: `${i.name}: no reading today (sensor off).` }));
  if (c.audience === 'self') f.notEntered.forEach((i) => lines.push({ text: `${i.name}: not entered today. This is not a warning.` }));
  if (heartOpen(c)) {
    const h = c.S.heart!;
    lines.push({
      text: `Open heart caution since ${clock(h.issued_at)}. Check-in answer: ${h.quick_check ? QUICK_WORD[h.quick_check] : 'not answered yet'}. 12-lead heart reading: ${h.heart_reading ? `taken at ${clock(h.reading_at)}` : 'not taken yet'}. ACTIS blood clot test: ${h.clot_test ? 'taken (mock result: normal)' : 'not taken yet'}.`,
      src: h.model.level === 'criterion_met' ? SRC.thygesen : SRC.rule,
    });
  }
  const ra = radAlert(c.rad);
  if (ra) lines.push({ text: `Radiation: ${ra}`, src: SRC.limit });
  if (!f.outside.length && !f.stale.length && !f.off.length) {
    lines.unshift({ text: `${You(c)} readings are within ${you(c)} own usual ranges this week.` });
  }
  return { title: c.audience === 'doctor' ? `${name} this week` : 'This week', lines };
}

function next(c: Ctx, f: Findings): Answer {
  const lines: Line[] = [];
  const heart = heartOpen(c) ? c.S.heart! : null;
  if (c.audience === 'doctor' && heart) {
    if (!heart.quick_check) lines.push({ text: 'Ask about symptoms: Lena has not answered the chest pain check-in yet.' });
    if (!heart.heart_reading) lines.push({ text: 'Take the 12-lead heart reading: it is the deciding measurement.', src: SRC.thygesen });
    if (!heart.clot_test) lines.push({ text: 'Run the ACTIS blood clot test to rule out a clot, another cause of chest pain (result in about 15 minutes).', src: SRC.actis });
    lines.push({ text: 'Recheck blood pressure with the cuff, seated after rest, and check the wearable sits well on the skin.' });
    lines.push({ text: 'Then decide: monitor, confirm, dismiss or escalate. Every decision is recorded with your reason.' });
  } else {
    f.flagged.forEach((i) => {
      const n = NEXT[i.key];
      if (n) lines.push({ text: `${i.name}: ${n[0]}` });
    });
    f.outside
      .filter((i) => i.state !== 'flag')
      .forEach((i) => lines.push({ text: `${i.name}: ${i.preventive || 'recheck tomorrow; no alert has been raised.'}` }));
    if (f.stale.length || f.off.length) lines.push({ text: 'Put the Bio-Monitor shirt or watch back on and check that the tablet shows a connection.' });
    if (c.audience === 'self' && f.notEntered.length) lines.push({ text: `Enter today's ${f.notEntered.map((i) => i.name.toLowerCase()).join(' and ')} when you have a moment.` });
  }
  if (!lines.length) lines.push({ text: 'Nothing to do. Next check: tomorrow morning.' });
  if (c.audience === 'self') lines.push({ text: 'If you feel unwell at any point, press Get crew doctor, or SOS in an emergency.' });
  return { title: c.audience === 'doctor' ? 'Suggested next checks' : 'What to do next', lines };
}

function normal(c: Ctx, f: Findings): Answer {
  const keys = ['bp', 'hr', 'temp', 'sleep'];
  const lines: Line[] = keys.map((k) => FLIGHT[k]);
  const out = f.outside.filter((i) => keys.includes(i.key));
  lines.push({
    text: out.length
      ? `Even against the in-flight ranges, ${out.map((i) => i.name.toLowerCase()).join(' and ')} ${out.length === 1 ? 'is' : 'are'} outside ${you(c)} own usual range, so ${out.length === 1 ? 'it is' : 'they are'} worth a look.`
      : `Against those in-flight ranges, ${you(c)} readings this week are as expected.`,
  });
  return { title: 'Normal in space?', lines };
}

function differential(c: Ctx, f: Findings): Answer {
  if (!heartOpen(c)) {
    const lines = leadLines(c, f);
    return { title: 'What else could explain it', lines };
  }
  const ex = f.inds.find((i) => i.key === 'exercise');
  return {
    title: 'Other explanations to rule out',
    lines: [
      { text: 'Heart muscle short of blood (possible heart attack): the 12-lead heart reading decides, against the ST-elevation criterion.', src: SRC.thygesen },
      { text: 'A blood clot in the lungs can also cause chest pain: the ACTIS D-dimer test helps rule it out.', src: SRC.actis },
      { text: 'A loose or shifted wearable electrode can shift the tracing: check the shirt fits and the reading is clean.', src: SRC.bio },
      {
        text: `Recent exertion raises heart rate and blood pressure: today's exercise so far is ${ex && ex.value ? `${ex.value} minutes` : 'not recorded'}; recheck after rest.`,
      },
    ],
  };
}

function evidence(c: Ctx, f: Findings): Answer {
  const keys = Array.from(new Set([...f.outside.map((i) => i.key), 'bp', 'hr']));
  const lines: Line[] = keys.filter((k) => FLIGHT[k]).map((k) => FLIGHT[k]);
  if (heartOpen(c)) {
    lines.push({ text: 'Screening rule (team design, to be tuned with flight data): ST segment outside the usual range on 3 consecutive 10-minute averages, plus resting heart rate outside its range.', src: SRC.rule });
    lines.push({ text: 'Confirming criterion: new ST elevation of at least 1 mm in two contiguous leads on a 12-lead ECG (Fourth Universal Definition of Myocardial Infarction).', src: SRC.thygesen });
  }
  lines.push({ text: 'Where the readings come from: the Canadian Space Agency Bio-Monitor shirt or a smartwatch, with check-ins on the tablet.', src: SRC.bio });
  return { title: 'What the evidence says', lines };
}

function chance(c: Ctx, f: Findings): Answer {
  return {
    title: 'Why there is no percentage',
    lines: [
      { text: 'I do not put a percentage on this. There is no validated model that turns these readings into a chance for this crew, and a made-up number would look more certain than the evidence is.' },
      ...leadLines(c, f).slice(0, 2),
      { text: c.audience === 'doctor' ? 'You decide, with a recorded reason.' : 'The crew doctor decides, not this tool.' },
    ],
  };
}

export function answer(c: Ctx, intent: Intent): Answer {
  const f = findings(c);
  switch (intent) {
    case 'summary':
      return summary(c, f);
    case 'lead':
      return { title: 'What it could point to', lines: leadLines(c, f) };
    case 'normal':
      return normal(c, f);
    case 'next':
      return next(c, f);
    case 'differential':
      return differential(c, f);
    case 'evidence':
      return evidence(c, f);
    case 'chance':
      return chance(c, f);
    default:
      return {
        title: 'Try one of the suggestions',
        lines: [
          {
            text: `In this demo I answer questions about ${you(c)} readings: what changed, what it could point to, whether it is normal in space, what to check next, and the evidence behind it.`,
          },
        ],
      };
  }
}
