// The server sends each person's measures in the design team's shape (crew/engine.py, _health()).
// The tablet's screens read Indicators, so this file turns one into the other. It also holds the words the
// server no longer sends with each measure: why it matters in space and how it is measured.

import type { CrewState, Indicator, Measure, MissingKind, PersonId, Range, ReadingValue } from './api';

interface Def {
  key: string;
  name: string;
  unit: string;
  why: string;
  risk: string;
  measured: string;
  src: string;
  measured_src?: string;
  private?: boolean;
  entry?: boolean;
}

const DEFS: Record<string, Def> = {
  stShift: {
    key: 'ecg',
    name: 'Heart rhythm (wearable ECG)',
    unit: '',
    why: 'Fluid shifts and deconditioning change how the heart works in weightlessness; rhythm changes are a named NASA cardiovascular hazard.',
    risk: 'Risk of Cardiovascular Adaptations',
    measured: 'Wearable ECG: the CSA Bio-Monitor shirt (continuous, day and night) or a smartwatch.',
    src: 'research_cardio',
    measured_src: 'bio',
  },
  heartRate: {
    key: 'hr',
    name: 'Resting heart rate',
    unit: 'bpm',
    why: 'Resting heart rate is usually unchanged in flight, so a rise from your own range is worth a look.',
    risk: 'Risk of Cardiovascular Adaptations',
    measured: 'Bio-Monitor shirt or smartwatch, overnight average.',
    src: 'norsk',
    measured_src: 'bio',
  },
  exercise: {
    key: 'exercise',
    name: 'Exercise',
    unit: 'min',
    why: 'Daily exercise is the crew’s main protection against muscle and bone loss in weightlessness, so time below your plan is worth a look.',
    risk: 'Risk of Impaired Performance Due to Reduced Muscle Mass, Strength and Endurance',
    measured: 'Bio-Monitor shirt or smartwatch: minutes of exercise so far today.',
    src: '',
    measured_src: 'bio',
  },
  bloodPressure: {
    key: 'bp',
    name: 'Blood pressure',
    unit: 'mmHg',
    why: 'Blood pressure falls about 8 to 10 mmHg in flight, so your usual range here is your in-flight range, not your Earth range.',
    risk: 'Risk of Cardiovascular Adaptations',
    measured: 'Cuff, morning, seated quietly.',
    src: 'norsk',
  },
  hydration: {
    key: 'hydration',
    name: 'Hydration',
    unit: '',
    why: 'Weightlessness changes thirst, and too little fluid raises the risk of kidney stones.',
    risk: 'Risk of Renal Stone Formation',
    measured: 'Urine colour against an 8-step colour card (1 palest, 8 darkest), entered by you.',
    src: '',
    entry: true,
  },
  bodyTemperature: {
    key: 'temp',
    name: 'Body temperature',
    unit: '°C',
    why: 'Resting core temperature rises about 1 °C over the first months in flight, so 37.6 °C is normal for you here.',
    risk: 'Risk of Altered Immune System Responses',
    measured: 'Forehead core-temperature sensor.',
    src: 'stahn',
  },
  reactionTime: {
    key: 'reaction',
    name: 'Reaction time',
    unit: 'ms',
    why: 'Short sleep, fatigue and stress slow reactions; a short test tracks alertness before tasks that need it.',
    risk: 'Risk of Behavioral Conditions and Psychiatric Disorders',
    measured: 'Short reaction test on the tablet: the average of the last test.',
    src: 'behav',
    entry: true,
  },
  sleep: {
    key: 'sleep',
    name: 'Sleep',
    unit: 'h',
    why: 'Crews sleep about 6 hours against 8.5 scheduled; a further drop affects alertness and errors.',
    risk: 'Risk of Inadequate Sleep and Irregular Schedules',
    measured: 'Movement sensor in the Bio-Monitor shirt or a smartwatch, worn overnight (actigraphy, as in NASA’s ARCHeR study).',
    src: 'barger',
    measured_src: 'bio',
  },
  mood: {
    key: 'mood',
    name: 'Mood check-in',
    unit: '',
    why: 'Isolation and confinement affect mood; NASA lists no monitoring tool for this risk.',
    risk: 'Risk of Behavioral Conditions and Psychiatric Disorders',
    measured: 'Short check-in; private to you.',
    src: 'behav',
    private: true,
    entry: true,
  },
  stress: {
    key: 'stress',
    name: 'Stress check-in',
    unit: '',
    why: 'Isolation, confinement and workload raise stress, which affects sleep, mood and decisions.',
    risk: 'Risk of Behavioral Conditions and Psychiatric Disorders',
    measured: 'Short check-in; private to you.',
    src: 'behav',
    private: true,
    entry: true,
  },
};

/** The order the tablet lists them in: continuous vitals first, then plans and entries. (The server's JSON
 *  arrives with its keys sorted, so it does not carry an order.) */
const ORDER = ['stShift', 'heartRate', 'bloodPressure', 'bodyTemperature', 'sleep', 'exercise', 'hydration', 'reactionTime', 'mood', 'stress'];

const PREVENTIVE: Record<string, string> = {
  sleep: 'Sleep has been below your usual range for 3 nights. Try dimming cabin lights 30 minutes earlier tonight.',
};

// ---------------------------------------------------------------- check-ins

export interface CheckinDef {
  id: string;
  label: string;
  sub: string;
}

/** The four entries the server keeps per person (crew/engine.py, ENTRY_TODAY). */
export const CHECKIN_DEFS: CheckinDef[] = [
  { id: 'hydration', label: 'Hydration (urine colour)', sub: 'Compare with the colour card · 30 s' },
  { id: 'mood', label: 'Mood check-in', sub: '5 taps · 30 s' },
  { id: 'stress', label: 'Stress check-in', sub: '3 taps · 20 s' },
  { id: 'reactionTime', label: 'Reaction-time test', sub: '3 min' },
];

export const checkinsFor = (S: CrewState, pid: PersonId): Record<string, boolean> => (S.checkins && S.checkins[pid]) || {};

export const checkinsDone = (S: CrewState, pid: PersonId) => {
  const mine = checkinsFor(S, pid);
  return CHECKIN_DEFS.filter((d) => mine[d.id]).length;
};

// ---------------------------------------------------------------- measures to indicators

const isRange = (r: unknown): r is Range => !!r && typeof (r as Range).low === 'number';
const round = (v: number, d = 2) => Number(v.toFixed(d));

function secondsOfDay(hms: string) {
  const [h, m, s] = hms.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

function toIndicator(S: CrewState, pid: PersonId, id: string, m: Measure, flagged: boolean): Indicator | null {
  const def = DEFS[id];
  if (!def) return null;
  const vals: ReadingValue[] = m.readings.map((r) => r.value);
  const today = vals[vals.length - 1];
  const base: Indicator = {
    key: def.key,
    name: def.name,
    value: null,
    unit: def.unit,
    usual: '',
    state: 'ok',
    why: def.why,
    risk: def.risk,
    measured: def.measured,
    src: def.src,
    measured_src: def.measured_src,
    private: def.private,
    entry: def.entry ? id : undefined,
  };

  // Today's reading is missing: entered measures are "No entry yet", sensor ones "Sensor off".
  if (today === null || today === undefined) {
    return { ...base, state: 'missing', missing: (def.entry ? 'not_entered' : 'sensor_off') as MissingKind, usual: usualWords(id, m) };
  }

  const nums = vals.filter((v): v is number => typeof v === 'number');
  const ind: Indicator = { ...base, usual: usualWords(id, m), trend: m.trend.direction === 'up' ? 'rising' : m.trend.direction === 'down' ? 'falling' : 'steady' };

  if (id === 'bloodPressure') {
    const bp = vals.filter((v): v is { systolic: number; diastolic: number } => !!v && typeof v === 'object');
    const t = today as { systolic: number; diastolic: number };
    const ur = m.usualRange as { systolic: Range; diastolic: Range } | undefined;
    ind.value = `${t.systolic}/${t.diastolic}`;
    ind.series = bp.map((v) => v.systolic);
    if (ur) ind.band = [ur.systolic.low, ur.systolic.high];
    ind.series_unit = 'mmHg systolic';
  } else if (id === 'sleep') {
    ind.value = ((today as number) / 60).toFixed(1);
    ind.series = nums.map((v) => round(v / 60));
    if (isRange(m.usualRange)) ind.band = [round(m.usualRange.low / 60), round(m.usualRange.high / 60)];
    ind.series_unit = 'h';
  } else if (id === 'stShift') {
    const v = today as number;
    ind.series = nums;
    if (isRange(m.usualRange)) ind.band = [m.usualRange.low, m.usualRange.high];
    const inside = !ind.band || (v >= ind.band[0] && v <= ind.band[1]);
    ind.value = inside ? 'Regular' : `ST shift ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} mm`;
    ind.series_unit = 'mm ST shift';
  } else if (id === 'bodyTemperature') {
    ind.value = (today as number).toFixed(1);
    ind.series = nums;
    if (isRange(m.usualRange)) ind.band = [m.usualRange.low, m.usualRange.high];
  } else if (id === 'hydration') {
    ind.value = `Step ${today}`;
    ind.refText = `Step ${m.publishedLine ?? 3} or paler is well hydrated`;
    ind.trend = '';
  } else if (id === 'exercise') {
    ind.value = String(today);
    ind.series = nums;
    ind.refText = `Plan ${m.plan ?? 120} minutes a day`;
    ind.trend = '';
  } else if (id === 'mood' || id === 'stress') {
    ind.value = String(today);
    ind.trend = '';
  } else {
    ind.value = String(today);
    ind.series = nums;
    if (isRange(m.usualRange)) ind.band = [m.usualRange.low, m.usualRange.high];
  }

  // A sensor reading older than its stale time is shown as stale, with the time it was taken.
  const last = m.readings[m.readings.length - 1];
  if (m.staleAfterMinutes && last && last.time) {
    let age = (S.now % 86400) - secondsOfDay(last.time);
    if (age < 0) age += 86400;
    if (age > m.staleAfterMinutes * 60) {
      return { ...ind, state: 'missing', missing: 'stale', lastAt: S.now - age };
    }
  }

  if (flagged && ind.band && ind.series && ind.series.length) {
    const v = ind.series[ind.series.length - 1];
    let outside = v < ind.band[0] || v > ind.band[1];
    if (id === 'bloodPressure') {
      const t = today as { systolic: number; diastolic: number };
      const ur = m.usualRange as { systolic: Range; diastolic: Range };
      outside = outside || t.diastolic < ur.diastolic.low || t.diastolic > ur.diastolic.high;
    }
    if (outside) ind.state = 'flag';
  }

  const sm = S.summary[pid];
  if (sm && sm.state === 'preventive' && PREVENTIVE[id] && ind.band && ind.series) {
    const v = ind.series[ind.series.length - 1];
    if (v < ind.band[0] || v > ind.band[1]) ind.preventive = PREVENTIVE[id];
  }
  return ind;
}

function usualWords(id: string, m: Measure): string {
  const r = m.usualRange;
  if (id === 'bloodPressure' && r && !isRange(r)) return `${r.systolic.low}–${r.systolic.high} / ${r.diastolic.low}–${r.diastolic.high}`;
  if (id === 'sleep' && isRange(r)) return `${(r.low / 60).toFixed(1)}–${(r.high / 60).toFixed(1)}`;
  if (id === 'stShift') return 'Regular, no ST shift';
  if (isRange(r)) return `${r.low}–${r.high}`;
  if (m.usual) return m.usual;
  return '';
}

const cache = new WeakMap<CrewState, Partial<Record<PersonId, Indicator[]>>>();

/** One person's indicators, vitals first. */
export function indicatorsFor(S: CrewState, pid: PersonId): Indicator[] {
  let byPerson = cache.get(S);
  if (!byPerson) {
    byPerson = {};
    cache.set(S, byPerson);
  }
  const hit = byPerson[pid];
  if (hit) return hit;
  const h = S.health && S.health[pid];
  const out: Indicator[] = [];
  if (h) {
    const caution = h.caution;
    const ids = [...ORDER.filter((id) => id in h.measures), ...Object.keys(h.measures).filter((id) => !ORDER.includes(id))];
    for (const id of ids) {
      const m = h.measures[id];
      const ind = toIndicator(S, pid, id, m, !!caution && caution.measures.includes(id));
      if (ind) out.push(ind);
    }
  }
  byPerson[pid] = out;
  return out;
}

/** The server's check-in wording for the open heart caution, when there is one. */
export const cautionFor = (S: CrewState, pid: PersonId) => (S.health && S.health[pid] ? S.health[pid].caution : null);
