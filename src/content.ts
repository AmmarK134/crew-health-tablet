// Words and sources shown by the interface.
// Carried over from the original front end (static/app.js) so nothing the crew could read before is lost.
// Team vocabulary is used where the team has agreed a word (docs/ux-06d-information-architecture.md, part E).

import type { IconName } from './icons';
import type { EmergencyKind, MissingKind, Outcome, PersonId, QuickAnswer, RosterStatus } from './api';

export const NAMES: Record<PersonId, string> = { lena: 'Lena', sam: 'Sam', ravi: 'Ravi', maya: 'Maya' };
export const PEOPLE: PersonId[] = ['lena', 'sam', 'ravi', 'maya'];
export const TABLET_ROLE: Record<PersonId, string> = {
  lena: 'Flight engineer',
  sam: 'Crew doctor',
  ravi: 'Backup crew medical officer',
  maya: 'Commander',
};

export interface Link {
  t: string;
  u: string;
}

export interface Source {
  label: string;
  title: string;
  body: string;
  links: Link[];
  simulated?: boolean;
}

export const L = {
  cardio: { t: 'NASA: Risk of Cardiovascular Adaptations', u: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
  norsk: { t: 'Norsk et al. 2015, Journal of Physiology (blood pressure in flight)', u: 'https://doi.org/10.1113/jphysiol.2014.284869' },
  stahn: { t: 'Stahn et al. 2017, Scientific Reports (core temperature in flight)', u: 'https://doi.org/10.1038/s41598-017-15560-w' },
  barger: { t: 'Barger et al. 2014, Lancet Neurology (sleep in flight)', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436' },
  trim: { t: 'Trim et al. 2023, Clinical Nutrition (blood sugar, bed rest)', u: 'https://doi.org/10.1016/j.clnu.2023.02.006' },
  behav: { t: 'NASA: Risk of Behavioral Conditions and Psychiatric Disorders', u: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/' },
  osdr569: { t: 'NASA Open Science Data Repository, study 569 (Inspiration4 blood count)', u: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569' },
  osdr575: { t: 'NASA Open Science Data Repository, study 575 (Inspiration4 metabolic panel)', u: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575' },
  radlab: { t: 'NASA RadLab (space radiation measurements)', u: 'https://visualization.osdr.nasa.gov/radlab/gui/' },
  zeitlin: { t: 'Zeitlin et al. 2013, Science (Curiosity radiation detector, cruise)', u: 'https://doi.org/10.1126/science.1235989' },
  hassler: { t: 'Hassler et al. 2014, Science (Curiosity radiation detector, Mars surface)', u: 'https://doi.org/10.1126/science.1244797' },
  zhang: { t: "Zhang et al. 2020, Science Advances (Chang'e 4, Moon surface)", u: 'https://doi.org/10.1126/sciadv.aaz1334' },
  csa: { t: 'Canadian Space Agency: Monitoring Radiation for Astronaut Health (2026)', u: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp' },
  thygesen: { t: 'Thygesen et al. 2018, Circulation', u: 'https://doi.org/10.1161/CIR.0000000000000617' },
  cdc: { t: 'Centers for Disease Control and Prevention: Acute Radiation Syndrome', u: 'https://www.cdc.gov/radiation-emergencies/hcp/clinical-guidance/ars.html' },
  bio: { t: 'Canadian Space Agency: Bio-Monitor', u: 'https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp' },
  crew13: { t: 'Canadian Space Agency: Crew-13 science activities (Joshua Kutryk)', u: 'https://www.asc-csa.gc.ca/eng/missions/crew-13/science-activities.asp' },
  actis: { t: 'Canadian Space Agency: ACTIS, Acute Care Testing in Space', u: 'https://www.asc-csa.gc.ca/eng/sciences/actis.asp' },
  radin2: { t: 'Canadian Space Agency: Radi-N2', u: 'https://www.asc-csa.gc.ca/eng/sciences/radi-n2.asp' },
} satisfies Record<string, Link>;

export const SRC: Record<string, Source> = {
  research_cardio: { label: 'NASA heart risk', title: 'Cardiovascular adaptations', body: 'NASA names rhythm disturbances, clots and fainting at landing among the cardiovascular hazards of spaceflight.', links: [L.cardio] },
  norsk: { label: 'Norsk 2015', title: 'Blood pressure and heart rate in flight', body: '24-hour average blood pressure fell 8 to 10 mmHg on the International Space Station; resting heart rate was unchanged.', links: [L.norsk] },
  stahn: { label: 'Stahn 2017', title: 'Core temperature in flight', body: 'Resting core temperature rose about 1 °C over about 2.5 months on six-month International Space Station missions.', links: [L.stahn] },
  barger: { label: 'Barger 2014', title: 'Sleep in flight', body: 'Astronauts slept about 6 hours on the International Space Station against 8.5 scheduled.', links: [L.barger] },
  trim: { label: 'Trim 2023', title: 'Blood sugar with inactivity', body: 'In a 60-day bed rest study, daily blood sugar rose 6% and fasting insulin 40%.', links: [L.trim] },
  behav: { label: 'NASA behavioural risk', title: 'Behavioural conditions', body: "Isolation and confinement affect mood, sleep and decisions. NASA's risk page lists no monitoring tool.", links: [L.behav] },
  demo: { label: 'Demo data', simulated: true, title: 'Demo data', body: 'Values for a fictional crew member, shaped by the published in-flight changes cited on each indicator.', links: [] },
  rule: { label: 'Alert rule', simulated: true, title: 'Screening alert rule (team design)', body: "Fires when the wearable ECG's ST segment stays outside the person's own usual range on 3 consecutive 10-minute averages and resting heart rate is also outside its usual range. A design choice to be tuned with flight data; a wearable ECG is a screening signal, not diagnostic.", links: [] },
  thygesen: { label: 'Thygesen 2018', title: 'ST-elevation criterion', body: 'Fourth Universal Definition of Myocardial Infarction: new ST elevation at the J point of at least 1 mm in two contiguous leads (higher thresholds in leads V2 to V3), measured on a 12-lead heart tracing. Meeting it indicates possible myocardial infarction (heart attack); diagnosis needs clinical assessment.', links: [L.thygesen] },
  symptom: { label: 'Check-in', title: 'Reported symptom', body: 'Chest pain, pressure or discomfort, as answered by the crew member in the check-in.', links: [] },
  bio: {
    label: 'CSA Bio-Monitor',
    title: 'Where the readings come from',
    body: "Every crew member has a tablet. Continuous readings come from a wearable paired with it: a smartwatch, or the Canadian Space Agency's Bio-Monitor, a smart shirt and headband (Carré Technologies, Montreal) that measure heart rate and electrical heart activity, blood pressure, breathing rate and volume, skin temperature, blood oxygen and movement. It can be worn during sleep and exercise and pairs with a tablet app. First used on the space station by David Saint-Jacques after launching in December 2018, and in use again on Crew-13 by Canadian astronaut Joshua Kutryk. A smartwatch heart tracing is usually single-lead and taken on demand, so continuous monitoring works best with the shirt. Values shown here are demo values, not Bio-Monitor data.",
    links: [L.bio, L.crew13],
  },
  actis: {
    label: 'CSA ACTIS',
    title: 'Blood clot test in space',
    body: 'ACTIS is a portable device the Canadian Space Agency is testing on Crew-13 with Joshua Kutryk. It measures D-dimer, a protein fragment produced when blood clots break down, from a blood sample in about 15 minutes, and can send the result to the ground. A blood clot in the lungs can also cause chest pain, so a normal result helps the crew doctor rule it out. It does not confirm or rule out a heart attack. The result shown here is mock.',
    links: [L.actis, L.cardio],
  },
  labs: { label: 'NASA open data', title: 'Real astronaut laboratory results', body: "Inspiration4 crew member C001: blood count (study 569) and metabolic panel (study 575), with the testing laboratory's own normal ranges. Shown as an example laboratory history; not Lena's data.", links: [L.osdr569, L.osdr575] },
  ars: { label: 'Why no symptoms', title: 'Acute radiation sickness threshold', body: 'Acute radiation syndrome usually needs a large whole-body dose received quickly, generally above about 0.7 gray. Doses from a sheltered solar storm are far below that, so vital signs are not expected to change; the concern is the added lifetime (career) dose.', links: [L.cdc] },
  limit: { label: 'NASA standard', title: 'NASA career dose limit', body: "NASA's career effective dose limit for all astronauts is 600 millisieverts (NASA-STD-3001, Volume 1).", links: [] },
  neutrons: { label: 'Canadian Space Agency', title: 'Neutron share of space station radiation', body: 'Neutrons make up about 30% of radiation on the International Space Station and need their own detectors.', links: [L.csa] },
};

// ---------------------------------------------------------------- data states (team vocabulary)

export const MISSING: Record<MissingKind, { word: string; icon: IconName; note: string }> = {
  not_entered: { word: 'No entry yet', icon: 'edit_note', note: 'Not counted as usual' },
  sensor_off: { word: 'Sensor off', icon: 'sensors_off', note: 'Not counted as usual' },
  fault: { word: 'Sensor malfunction', icon: 'build', note: 'Not counted as usual' },
  stale: { word: 'Stale', icon: 'schedule', note: 'Old reading' },
};

export const INDICATOR_ICON: Record<string, IconName> = {
  ecg: 'ecg_heart',
  hr: 'monitor_heart',
  bp: 'blood_pressure',
  temp: 'thermostat',
  sleep: 'bedtime',
  glucose: 'glucose',
  mood: 'mood',
  rad: 'flare',
  exercise: 'directions_run',
  hydration: 'water_drop',
  reaction: 'timer',
  stress: 'psychology',
};

// What to do next, for the three measures the heart caution flags (crew/engine.py, CAUTION_MEASURES).
export const NEXT: Record<string, [string, string]> = {
  ecg: ['Answer the check-in, then take a heart reading with the 12-lead heart tracing from the medical kit.', 'Crew doctor (already told)'],
  hr: ['Rest for 10 minutes and let the wearable take a new reading.', 'Crew doctor (already told)'],
  bp: ['Rest, then take a new reading with the cuff, seated quietly.', 'Crew doctor (already told)'],
};

export const GLOSSARY: Record<string, string> = {
  ecg: 'ECG stands for electrocardiogram: a tracing of the heart’s electrical signal. The ST segment is the flat part of the tracing just after each main spike.',
  hr: 'bpm means beats per minute.',
  bp: 'mmHg means millimetres of mercury, the usual unit for blood pressure.',
  glucose: 'mg/dL means milligrams per decilitre of blood.',
  reaction: 'ms means milliseconds, thousandths of a second.',
};

// ---------------------------------------------------------------- check-in (the heart caution's question)
// Wording from the design file (health-caution.html), as the server sends it in health.<person>.caution.checkIn.
// These are the fallbacks if it is missing. "Yes" never declares an emergency: the crew doctor decides.

export const CHECK_QUESTION = 'Do you have chest pain, pressure or discomfort?';
export const ANSWER_WINDOW_S = 180;

export const QUICK: { answer: QuickAnswer; word: string; then: string }[] = [
  { answer: 'yes', word: 'Yes', then: 'The crew doctor is alerted now and decides what happens next.' },
  { answer: 'unsure', word: 'Not sure', then: 'Take a heart reading. The crew doctor is also alerted.' },
  { answer: 'no', word: 'No', then: 'Take a heart reading.' },
];

export const AFTER_YES = 'Stay where you are and rest. If the pain gets worse, press SOS.';

export const QUICK_WORD: Record<QuickAnswer, string> = { yes: 'Yes', no: 'No', unsure: 'Not sure' };

export const HEART_STAGE_TEXT: Record<string, string> = {
  doctor_woken: 'The crew doctor has been alerted and decides what happens next.',
  monitored: 'Take a heart reading. The result is monitored; check again sooner if you feel unwell.',
  confirmed: 'The crew doctor has reviewed your result and will tell you the next step.',
};

// ---------------------------------------------------------------- emergency

export const ACTION = {
  heart: {
    patient: 'Stop what you are doing. Sit or lie down. Help is coming.',
    sam: 'Go to Lena in the Laboratory module. You lead the response.',
    ravi: 'Bring the medical kit and defibrillator to the Laboratory module.',
    maya: 'Go to the Laboratory module and record the response.',
    lena: 'Stop what you are doing. Sit or lie down. Help is coming.',
  } as Record<string, string>,
  spe: 'Go to the storm shelter now.',
  sosPatient: 'Stay where you are if you can. Help is coming.',
};

export const ROSTER_WORD: Record<RosterStatus, string> = {
  alerted: 'Alerted',
  acknowledged: 'Acknowledged',
  on_the_way: 'On the way',
  on_scene: 'On scene',
  patient: 'Patient',
  in_shelter: 'In shelter',
};

export const SHELTER_WORD: Record<string, string> = {
  alerted: 'Not yet acknowledged',
  acknowledged: 'On the way to the shelter',
  in_shelter: 'In the storm shelter',
};

/** The next response a person can give, by emergency kind and current status. */
export function nextResponse(kind: EmergencyKind, status: RosterStatus): [RosterStatus, string] | null {
  if (kind === 'spe') {
    if (status === 'alerted') return ['acknowledged', "I'm responding"];
    if (status === 'acknowledged') return ['in_shelter', "I'm in the shelter"];
    return null;
  }
  if (status === 'alerted') return ['acknowledged', "I'm responding"];
  if (status === 'acknowledged') return ['on_the_way', 'On the way'];
  if (status === 'on_the_way') return ['on_scene', 'On scene'];
  return null;
}

export const RESPONSE_STEPS: Record<EmergencyKind, RosterStatus[]> = {
  heart: ['alerted', 'acknowledged', 'on_the_way', 'on_scene'],
  sos: ['alerted', 'acknowledged', 'on_the_way', 'on_scene'],
  spe: ['alerted', 'acknowledged', 'in_shelter'],
};

/** The step before this person's current one, for "Undo". Null when there is nothing to go back to. */
export function previousResponse(kind: EmergencyKind, status: RosterStatus): RosterStatus | null {
  const steps = RESPONSE_STEPS[kind];
  const i = steps.indexOf(status);
  return i > 0 ? steps[i - 1] : null;
}

/** How long the person who pressed SOS has to cancel it as a mistake. */
export const SOS_CANCEL_S = 10;

export const OUTCOME_WORD: Record<Outcome, string> = {
  not_known: 'Not yet known',
  confirmed: 'Real event',
  false_alarm: 'False alarm',
  ended: 'Ended',
};

export const DECISION_WORD: Record<string, string> = {
  escalate: 'Escalated to crew-wide emergency',
  monitor: 'Monitor',
  confirm: 'Confirmed credible',
  override: 'Dismissed as not credible',
  clear: 'Cleared',
  dismiss: 'Dismissed',
};

// Reasons a person can tap instead of typing. They fill the reason field and can still be edited.
export const DISMISS_REASONS = ['Explained by exercise', 'Sensor artefact', 'Known for this person'];
export const DECIDE_REASONS = ['Symptoms reported', '12-lead criterion met', 'No symptoms, stable', 'Sensor artefact suspected'];
export const END_REASONS = ['Patient stable, monitoring continues', 'False alarm, readings back in usual range', 'Storm over, dose rate back to usual'];
export const SOS_END_REASONS = ['Crew member safe, help given', 'SOS pressed by mistake', 'Patient stable, monitoring continues'];

// ---------------------------------------------------------------- laboratory example (real data)
// Inspiration4 crew member C001, NASA Open Science Data Repository studies 569 and 575.
export const LABS = {
  times: ['92 days before launch', '44 days before launch', '3 days before launch', '1 day after return', '45 days after return', '82 days after return', '194 days after return'],
  short: ['L−92', 'L−44', 'L−3', 'R+1', 'R+45', 'R+82', 'R+194'],
  rows: [
    { name: 'Glucose', unit: 'mg/dL', range: '65–99', v: [83, 80, 69, 90, 84, 91, 87], lo: 65, hi: 99 },
    { name: 'Potassium', unit: 'mmol/L', range: '3.5–5.3', v: [4.6, 4.2, 3.9, 4.4, 4.0, 4.3, 4.3], lo: 3.5, hi: 5.3 },
    { name: 'Creatinine', unit: 'mg/dL', range: '0.6–1.35', v: [1.24, 1.1, 1.37, 1.12, 1.11, 1.25, 1.29], lo: 0.6, hi: 1.35 },
    { name: 'Haemoglobin', unit: 'g/dL', range: '13.2–17.1', v: [14.1, 14.9, 14.7, 14.7, 14.3, 15.7, 14.1], lo: 13.2, hi: 17.1 },
    { name: 'White cells', unit: '×1000/µL', range: '3.8–10.8', v: [5.4, 5.5, 7.0, 5.0, 4.9, 4.9, 4.9], lo: 3.8, hi: 10.8 },
  ],
};

// ---------------------------------------------------------------- mission settings

export const MODE_NAME = { station: 'Space station', moon: 'Moon base', mars: 'Mars' } as const;
export const MODE_PLACE = { station: 'Space station', moon: 'Moon', mars: 'Mars' } as const;
export const DELAY_TEXT = {
  station: 'Near-live',
  moon: 'About 1.3 seconds each way',
  mars: '4 to 24 minutes each way',
} as const;
// Short forms for the status bar: a label and a value.
export const DELAY_LABEL = { station: 'Earth link', moon: 'Earth link, each way', mars: 'Earth link, each way' } as const;
export const DELAY_SHORT = { station: 'Near-live', moon: 'About 1.3 seconds', mars: '4 to 24 minutes' } as const;
export const DELAY_NOTE = {
  station: 'Earth can answer almost at once.',
  moon: 'Earth can answer within seconds.',
  mars: 'This demo uses 14 minutes each way, so the earliest reply is 28 minutes after sending.',
} as const;
