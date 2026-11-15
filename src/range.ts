// The reading against the person's own usual range, worked out by the team's pill colour rule
// (health-caution.html, Part 3): size alone sets the state. Within the usual range is green; outside it,
// with no medical limit passed, is yellow with the side (above or below). Time and direction never set it.
// The server gives no medical limits, so the red "past a medical limit" state never arises here.

import type { Indicator } from './api';

export type Side = 'within' | 'above' | 'below';

export interface RangePart {
  label: string; // "Systolic", "Diastolic", or "" for a single number
  value: number;
  lo: number;
  hi: number;
  side: Side;
  amount: number; // how far outside the usual range, 0 when within
}

export interface RangeInfo {
  side: Side;
  parts: RangePart[];
  unit: string;
}

const toNum = (s: string) => parseFloat(s.replace('−', '-'));

function part(label: string, value: number, lo: number, hi: number): RangePart {
  if (value > hi) return { label, value, lo, hi, side: 'above', amount: value - hi };
  if (value < lo) return { label, value, lo, hi, side: 'below', amount: lo - value };
  return { label, value, lo, hi, side: 'within', amount: 0 };
}

/** Null when there is no current number to compare (missing data, entries, no usual range). */
export function rangeInfo(ind: Indicator): RangeInfo | null {
  if (ind.state === 'missing' || !ind.band || !ind.series || !ind.series.length) return null;
  const [lo, hi] = ind.band;
  let parts: RangePart[];
  if (ind.key === 'bp') {
    // Blood pressure has two numbers: "110/68" against "104–118 / 64–74". The reading takes the worse of the two.
    const v = (ind.value || '').split('/').map(toNum);
    const r = [...(ind.usual || '').matchAll(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]);
    if (v.length === 2 && r.length === 2 && v.every(Number.isFinite)) {
      parts = [part('Systolic', v[0], r[0][0], r[0][1]), part('Diastolic', v[1], r[1][0], r[1][1])];
      return { side: parts.find((p) => p.side !== 'within')?.side ?? 'within', parts, unit: 'mmHg' };
    }
  }
  parts = [part('', ind.series[ind.series.length - 1], lo, hi)];
  return { side: parts[0].side, parts, unit: ind.series_unit || ind.unit };
}

/** A number as written on screen: at most two decimals, and a true minus sign. */
export const numText = (v: number) => String(Number(v.toFixed(2))).replace('-', '−');

/** Hours written as hours and minutes, as the team's design writes durations. */
export function hoursText(h: number) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const out: string[] = [];
  if (hh) out.push(`${hh} ${hh === 1 ? 'hour' : 'hours'}`);
  if (mm || !hh) out.push(`${mm} ${mm === 1 ? 'minute' : 'minutes'}`);
  return out.join(' ');
}

/** The usual range as one sentence: "Your usual range is 52 to 60 bpm." */
export function usualSentence(r: RangeInfo): string {
  if (r.parts.length === 2) {
    const [s, d] = r.parts;
    return `Your usual range is ${s.lo} to ${s.hi} over ${d.lo} to ${d.hi} ${r.unit}.`;
  }
  const p = r.parts[0];
  if (r.unit === 'h') return `Your usual range is ${hoursText(p.lo)} to ${hoursText(p.hi)}.`;
  return `Your usual range is ${numText(p.lo)} to ${numText(p.hi)} ${r.unit}.`;
}

/** "Rising for 4 days" when the last days rose every day; otherwise the server's own word. */
export function trendWords(ind: Indicator): { dir: 'up' | 'down' | 'flat'; words: string } | null {
  const t = ind.trend;
  if (!t) return null;
  const s = ind.series || [];
  const nights = ind.key === 'sleep';
  const per = nights ? 'nights' : 'days';
  let k = 0;
  if (t === 'rising') while (k + 1 < s.length && s[s.length - 1 - k] > s[s.length - 2 - k]) k++;
  if (t === 'falling') while (k + 1 < s.length && s[s.length - 1 - k] < s[s.length - 2 - k]) k++;
  if (t === 'rising') return { dir: 'up', words: k >= 2 ? `Rising for ${k} ${per}` : 'Rising' };
  if (t === 'falling') return { dir: 'down', words: k >= 2 ? `Falling for ${k} ${per}` : 'Falling' };
  return { dir: 'flat', words: 'Steady' };
}

/** The hidden sentence that carries a chart's week for screen readers (WCAG 1.1.1), as the team's design words it. */
export function weekSentence(name: string, series: number[], band: [number, number], unit: string, nights = false): string {
  const per = nights ? 'nights' : 'days';
  const out = series.map((v) => (v > band[1] ? 'above' : v < band[0] ? 'below' : null));
  const count = out.filter(Boolean).length;
  const range = ` of ${numText(band[0])} to ${numText(band[1])}`;
  let against: string;
  if (!count) against = `All within your usual range${range}`;
  else {
    let k = 0;
    while (k < out.length && out[out.length - 1 - k]) k++;
    const side = out[out.length - 1];
    if (side && k === count && out.slice(out.length - k).every((s) => s === side))
      against = `${k === 1 ? (nights ? 'Last night is' : 'Today is') : `The last ${k} ${per} are`} ${side} your usual range${range}`;
    else against = `${count} of the ${series.length} ${per} are outside your usual range${range}`;
  }
  return `${name}, last ${series.length} ${per}, oldest first: ${series.map(numText).join(', ')} ${unit}. ${against}.`;
}

/** The side of the first reading outside its usual range among a person's indicators, or null if none is. */
export function outsideSide(inds: Indicator[]): Side | null {
  for (const i of inds) {
    const r = rangeInfo(i);
    if (r && r.side !== 'within') return r.side;
  }
  return null;
}
