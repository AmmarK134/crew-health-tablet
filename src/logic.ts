// What each tablet should show, worked out from the shared server state.
// These rules are carried over from the original front end so every view says the same thing it said before.

import { rangeInfo } from './range';
import type { CrewState, Indicator, PersonId, Radiation } from './api';
import { NAMES, SHELTER_WORD } from './content';
import { clock, percent } from './format';

export type AlertClass = 'emergency' | 'caution' | 'advisory';

export const heartRelevant = (S: CrewState) =>
  !!S.heart && ['caution', 'countdown', 'doctor_woken', 'monitored', 'confirmed'].includes(S.heart.stage);

export const speOn = (S: CrewState) => !!S.emergency && S.emergency.kind === 'spe';

/** Lena is the person the staged heart result is about. */
export const heartOnFor = (S: CrewState, me: PersonId) => me === 'lena' && heartRelevant(S);

/** The radiation dose plan advisory: shown when the projection uses 80% or more of the career limit. */
export function radAlert(rad: Radiation | null): string | null {
  if (!rad || rad.dose.shareOfLimit < 0.8) return null;
  return rad.dose.limitDay
    ? `Projected to pass the 600 mSv career limit on mission day ${rad.dose.limitDay}, ${rad.dose.limitDay - rad.mission.today} days from now. Flight surgeons will review the dose plan.`
    : `Projected to use ${percent(rad.dose.shareOfLimit)} of the 600 mSv career limit by the end of the mission.`;
}

export const stormDose = (rad: Radiation | null) => (rad && rad.storm ? rad.storm : null);

/** A storm dose worth quoting: simulated profiles always, measured ones only when an increase was detected. */
export function stormDoseShown(rad: Radiation | null): number | null {
  const d = stormDose(rad);
  if (!d) return null;
  return d.doseSource !== 'real' || d.detected ? d.extraDose : null;
}

export type StatusKind = 'emergency' | 'shelter' | 'caution' | 'advisory' | 'missing' | 'ok';

export interface PersonStatus {
  rank: number;
  kind: StatusKind;
  reason: string;
}

/** How the crew doctor's overview ranks and describes each person. Highest rank first. */
export function personStatus(S: CrewState, rad: Radiation | null, pid: PersonId): PersonStatus {
  const e = S.emergency;
  if (e && e.kind === 'spe') {
    const st = e.roster[pid];
    const shown = stormDoseShown(rad);
    const dose = shown != null ? `, storm dose ${shown} mSv` : '';
    if (st === 'in_shelter') return { rank: 2, kind: 'shelter', reason: `In the storm shelter${dose}` };
    return { rank: 4, kind: 'emergency', reason: `${SHELTER_WORD[st] || st}${dose}` };
  }
  if (e && e.patient === pid) return { rank: 5, kind: 'emergency', reason: `${e.what}: emergency in progress` };
  if (pid === 'lena' && S.heart) {
    const h = S.heart;
    if (['caution', 'countdown', 'doctor_woken', 'confirmed'].includes(h.stage)) {
      return {
        rank: 3,
        kind: 'caution',
        reason:
          h.model.level === 'criterion_met'
            ? 'Possible heart problem: 12-lead heart tracing meets the ST-elevation criterion'
            : 'Possible heart problem: chest strap heart tracing changed from usual (screening)',
      };
    }
    if (h.stage === 'monitored') return { rank: 2, kind: 'advisory', reason: 'Monitored: heart screening alert' };
  }
  if (S.doctor_woken && S.doctor_woken.by === pid) {
    return { rank: 3, kind: 'caution', reason: `${NAMES[pid]} asked for you: ${S.doctor_woken.why}` };
  }
  const sm = S.summary[pid];
  if (sm && sm.state === 'missing') return { rank: 1, kind: 'missing', reason: sm.reason };
  return { rank: 0, kind: 'ok', reason: sm ? sm.reason : 'All indicators within usual range' };
}

export interface MyStatus {
  kind: 'emergency' | 'caution' | 'missing' | 'ok';
  title: string;
  detail: string;
  /** Set when no alert is open but a reading is outside its usual range (the team's pill colour rule). */
  outside?: 'above' | 'below';
}

/** The one sentence at the top of My health. */
export function myStatus(S: CrewState, me: PersonId, inds: Indicator[]): MyStatus {
  const roster = S.emergency ? S.emergency.roster[me] : null;
  if (speOn(S)) {
    return {
      kind: 'emergency',
      title: 'Solar particle event: radiation dose rate raised',
      detail: `You: ${(roster && SHELTER_WORD[roster]) || roster || ''}`,
    };
  }
  if (S.emergency && S.emergency.patient === me) {
    return { kind: 'emergency', title: 'Possible heart attack: help is coming', detail: 'Stay where you are. The crew has been alerted.' };
  }
  if (heartOnFor(S, me)) {
    return { kind: 'caution', title: 'Possible heart problem: quick check needed', detail: 'A screening signal, not a diagnosis.' };
  }
  if (S.spe_caution) {
    return { kind: 'caution', title: 'Solar particle event: follow ground instructions', detail: 'The ground radiation team directs precautions.' };
  }
  if (inds.some((i) => i.state === 'missing' && i.missing === 'sensor_off')) {
    return {
      kind: 'missing',
      title: 'Some readings are missing',
      detail: 'Your watch is not sending data. Missing data is never counted as usual.',
    };
  }
  const off = inds.map((i) => ({ i, r: rangeInfo(i) })).filter((x) => x.r && x.r.side !== 'within');
  if (off.length) {
    const side = off[0].r!.side as 'above' | 'below';
    return {
      kind: 'ok',
      outside: side,
      title: off.length === 1 ? `${off[0].i.name} ${side} your usual range` : `${off.length} readings outside your usual range`,
      detail: off[0].i.preventive || 'No alert has been raised.',
    };
  }
  return { kind: 'ok', title: 'Within your usual ranges', detail: `Data current at ${clock(S.now)}` };
}

/** Indicators in reading order: flagged first, then current readings, then missing ones. */
export function orderIndicators(inds: Indicator[]): Indicator[] {
  return [
    ...inds.filter((i) => i.state === 'flag'),
    ...inds.filter((i) => i.state !== 'flag' && i.state !== 'missing'),
    ...inds.filter((i) => i.state === 'missing'),
  ];
}

export interface AlertCounts {
  emergency: number;
  caution: number;
  advisory: number;
}

/** Active alerts this person can see, by class. Shown in the status bar on every view. */
export function alertCounts(S: CrewState, rad: Radiation | null, me: PersonId): AlertCounts {
  const openAdvisories = S.advisories.filter((a) => !a.dismissed).length;
  const pendingOutcomes = S.closed.filter((c) => c.outcome === 'not_known').length;
  return {
    emergency: S.emergency ? 1 : 0,
    caution: (heartOnFor(S, me) ? 1 : 0) + (S.spe_caution ? 1 : 0) + (me === 'sam' && S.doctor_woken ? 1 : 0),
    advisory:
      (me === 'lena' && S.access_closed_notice ? 1 : 0) +
      (radAlert(rad) ? 1 : 0) +
      (S.doctor_woken && S.doctor_woken.by === me ? 1 : 0) +
      (me === 'sam' ? openAdvisories + pendingOutcomes : 0),
  };
}

export const canEnd = (S: CrewState, me: PersonId) =>
  !!S.emergency && ((S.emergency.kind === 'heart' && me === 'sam') || (S.emergency.kind === 'spe' && (me === 'sam' || me === 'maya')));

/** What this person should do in the active emergency, in one sentence. */
export function myAction(S: CrewState, me: PersonId, actions: { heart: Record<string, string>; spe: string }): string {
  const e = S.emergency;
  if (!e) return '';
  if (e.kind === 'spe') return actions.spe;
  return e.patient === me ? actions.heart.patient : actions.heart[me] || '';
}
