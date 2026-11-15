// Types and calls for the team's Flask server (crew/engine.py, radiation/model.py, radiation/donki.py).
// The server owns every rule and every number. This file only describes what it sends and receives.

export type PersonId = 'lena' | 'sam' | 'ravi' | 'maya';
export type Mode = 'station' | 'moon' | 'mars';

export interface CrewMember {
  id: PersonId;
  name: string;
  role: string;
  where: string;
}

export type MissingKind = 'not_entered' | 'sensor_off' | 'fault' | 'stale';

export interface Indicator {
  key: string;
  name: string;
  value: string | null;
  unit: string;
  usual: string;
  trend?: string;
  series?: number[];
  band?: [number, number];
  series_unit?: string;
  state: 'ok' | 'flag' | 'missing' | 'stale';
  missing?: MissingKind | null;
  why: string;
  risk: string;
  measured: string;
  src: string;
  private?: boolean;
  preventive?: string;
  /** Source chip for "How it is measured" (the wearable). */
  measured_src?: string;
  /** The check-in id the server uses when this is entered by the person (hydration, mood, stress, reactionTime). */
  entry?: string;
  /** Shown instead of "Usual …" when the measure is read against a plan rather than a usual range. */
  refText?: string;
  /** For a stale reading: the time of the last reading, on the server's clock (seconds). */
  lastAt?: number;
}

// ---------------------------------------------------------------- per-person health, in the design team's shape
// (crew/engine.py, _health(); app/health-caution.html, crew-data.js). The tablet turns this into Indicators.

export interface Range {
  low: number;
  high: number;
}

export type ReadingValue = number | string | { systolic: number; diastolic: number } | null;

export interface Measure {
  unit: string;
  usualRange?: Range | { systolic: Range; diastolic: Range };
  plan?: number;
  publishedLine?: number;
  usual?: string;
  medicalLimit?: unknown;
  staleAfterMinutes?: number | null;
  stateSetByHand?: string;
  source: string;
  trend: { direction: 'up' | 'down' | 'flat'; words: string };
  readings: { day: number; value: ReadingValue; time?: string }[];
}

export interface HealthCaution {
  class: string;
  name: string;
  raised: string;
  answerBy: string;
  answered: string | null;
  answeredAt: string | null;
  seenAt: string | null;
  measures: string[];
  reasons: string;
  checkIn: {
    details: string;
    question: string;
    symptom: string;
    afterYes: string;
    outcomes: Record<string, string>;
  };
}

export interface PersonHealth {
  clock: string;
  person: { name: string };
  crewDoctor: { name: string; pronoun: string };
  earthLink: string;
  measures: Record<string, Measure>;
  caution: HealthCaution | null;
}

export interface Criterion {
  label: string;
  value: string;
  met: boolean | null;
  basis: string;
}

export interface HeartModel {
  stage: string;
  level: 'screening' | 'criterion_met';
  summary: string;
  criteria: Criterion[];
  coverage: { text: string };
  rule: string;
  limits: string;
  label: string;
}

export type HeartStage =
  | 'caution'
  | 'countdown'
  | 'doctor_woken'
  | 'monitored'
  | 'confirmed'
  | 'cleared'
  | 'emergency'
  | 'closed';

export type QuickAnswer = 'yes' | 'no' | 'unsure';

export interface Heart {
  id: number;
  person: PersonId;
  stage: HeartStage;
  issued_at: number;
  model: HeartModel;
  quick_check: QuickAnswer | null;
  heart_reading: boolean;
  countdown_end: number | null;
  countdown_by?: string;
  reading_at?: number;
  outcome: string | null;
  answered_at?: number | null;
  seen_at?: number;
  clot_test?: boolean;
  clot_at?: number;
  unanswered_alerted?: number;
}

export interface Advisory {
  id: number;
  kind: string;
  person: PersonId;
  at: number;
  text: string;
  dismissed: string | null;
}

export interface ChecklistStep {
  step: string;
  role: string;
  result_hint: string;
  mock?: boolean;
  result: string | null;
  by: string | null;
  at: number | null;
}

export interface EarthReport {
  status: 'queued' | 'sent';
  queued_at: number;
  send_at: number;
  sent_at: number | null;
  earliest_reply_at: number | null;
}

export type RosterStatus = 'alerted' | 'acknowledged' | 'on_the_way' | 'on_scene' | 'patient' | 'in_shelter';

export type EmergencyKind = 'heart' | 'spe' | 'sos';

export interface Emergency {
  id: number;
  kind: EmergencyKind;
  patient: PersonId | null;
  what: string;
  where: string;
  detail: string;
  declared_at: number;
  declared_by: string;
  roster: Record<PersonId, RosterStatus>;
  checklist: ChecklistStep[];
  report: EarthReport;
  event?: string;
}

export type Outcome = 'not_known' | 'confirmed' | 'false_alarm' | 'ended';

export interface ClosedEmergency extends Emergency {
  ended_at: number;
  ended_by: string;
  reason: string;
  outcome: Outcome;
}

export interface Decision {
  at: number;
  who: string;
  decision: string;
  reason: string;
  result: string | null;
}

export interface AccessEntry {
  at: number;
  who: string;
  data: string;
}

export interface CrewState {
  now: number;
  mode: Mode;
  mission_day: number;
  heart: Heart | null;
  advisories: Advisory[];
  emergency: Emergency | null;
  spe_caution: { at: number; event: string; text: string } | null;
  closed: ClosedEmergency[];
  decisions: Decision[];
  access_log: Record<string, AccessEntry[]>;
  access_closed_notice: { at: number; person: PersonId; shared_with: string; data: string } | null;
  doctor_woken: { by: PersonId; at: number; why: string } | null;
  /** Entries made today, per person: hydration, mood, stress, reactionTime. */
  checkins: Record<PersonId, Record<string, boolean>>;
  streak: number;
  track: { alerts: number; confirmed: number; not_confirmed: number };
  events: { at: number; text: string }[];
  crew: CrewMember[];
  one_way_s: number;
  countdown_s: number;
  treatment_mock: string[];
  health: Record<PersonId, PersonHealth>;
  summary: Record<string, { state: string; reason: string; missing?: string }>;
}

export interface DosePoint {
  day: number;
  value: number;
  kind: string;
}

export interface Radiation {
  status: 'green' | 'amber' | 'red';
  headline: string;
  nasaRisk: string;
  mission: {
    mode: Mode;
    label: string;
    today: number;
    totalDays: number;
    phaseToday: string;
    delay: string;
    instrument: string;
  };
  dose: {
    priorCareer: number;
    soFar: number;
    projectedTotal: number;
    limit: number;
    shareOfLimit: number;
    limitDay: number | null;
    todayRate: number;
  };
  cumulative: DosePoint[];
  projection: DosePoint[];
  band: { low: number[]; high: number[]; spread: number };
  recent: { values: number[]; dates: string[] | null; source: 'real' | 'simulated'; unit: string };
  storm: null | {
    id: string;
    date: string | null;
    link: string | null;
    eventSource: string;
    doseSource: 'real' | 'simulated' | null;
    extraDose: number;
    detected: boolean | null;
    threshold: number | null;
    banner: string;
    severity: 'amber' | 'red';
    where: string;
  };
  breakdown: null | NeutronBreakdown;
  actions: { text: string; who: string }[];
  whoActs: string;
  source: 'real' | 'published';
  assumptions: string[];
}

/** Station dose by particle type. With the CSA Radi-N/Radi-N2 data loaded, the neutron part is measured. */
export interface NeutronBreakdown {
  neutrons_share: number;
  note: string;
  neutron_msv_per_day?: number;
  charged_msv_per_day?: number;
  sessions?: number;
  range_usv_per_day?: [number, number];
  first?: string;
  last?: string;
  added_to_total?: boolean;
  rows?: { start: string; days: number; detector: string; usv: number; usv_per_day: number; experiment: string; mission: string }[];
}

export interface StormEvent {
  id: string;
  time: string | null;
  date: string;
  instruments: string[];
  linked_flare_or_cme: string[];
  link: string | null;
  source: string;
  records: string[];
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

export const fetchState = () => getJSON<CrewState>('/api/state');

export const postAction = (type: string, who: PersonId, extra: Record<string, unknown> = {}) =>
  getJSON<CrewState>('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, who, ...extra }),
  });

export const fetchRadiation = (mode: Mode, event?: string | null) =>
  getJSON<Radiation>(`/api/radiation?mode=${mode}${event ? `&event=${encodeURIComponent(event)}` : ''}`);

export const fetchStorms = () => getJSON<{ events: StormEvent[]; cached: boolean }>('/api/donki/events');
