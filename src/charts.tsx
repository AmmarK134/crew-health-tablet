// Charts, drawn as plain SVG at real pixel size so text stays at its true size.
// Rules followed: one neutral line over the person's usual range (style guide SG-17), an out-of-range
// point marked with the alert colour and a word (SG-18), a title and units on every chart (SG-19),
// and every value reachable by tap or keyboard as well as by sight.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { Radiation } from './api';
import { day as dayText, dose, fixed } from './format';
import { unit } from './store';
import { numText, weekSentence } from './range';

export function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.floor(el.getBoundingClientRect().width / unit()));
    measure();
    // The root font size follows the window, and a height-only change may leave this box the same width.
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);
  return [ref, w];
}

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

const trim = (v: number) => String(Number(v.toFixed(2)));

// ------------------------------------------------------------------ marks (the team's agreed chart marks)
// Within the usual range: a green circle. Outside it: a caution-yellow diamond. Each has a black rim and a halo in
// the chart's own surface colour, so shape and colour both carry the state and a mark never merges with the line.

function Mark({ x, y, out, r = 6 }: { x: number; y: number; out: boolean; r?: number }) {
  if (!out)
    return (
      <g>
        <circle cx={x} cy={y} r={r + 2} className="m-halo" />
        <circle cx={x} cy={y} r={r} className="m-within" />
      </g>
    );
  const d = (r - 0.5) * Math.SQRT2;
  const pts = `${x},${y - d} ${x + d},${y} ${x},${y + d} ${x - d},${y}`;
  return (
    <g>
      <polygon points={pts} className="m-halo m-halo--edge" />
      <polygon points={pts} className="m-outside" />
    </g>
  );
}

// ------------------------------------------------------------------ sparkline (in list rows)

export function Spark({ series, band }: { series: number[]; band?: [number, number] }) {
  const W = 104;
  const H = 40;
  const p = 8;
  let lo = Math.min(...series, band ? band[0] : Infinity);
  let hi = Math.max(...series, band ? band[1] : -Infinity);
  if (hi === lo) hi = lo + 1;
  const x = (i: number) => p + i * ((W - 2 * p) / (series.length - 1));
  const y = (v: number) => p + (H - 2 * p) * (1 - (v - lo) / (hi - lo));
  const last = series.length - 1;
  const v = series[last];
  const out = !!band && (v > band[1] || v < band[0]);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {band && <rect x={0} y={y(band[1])} width={W} height={Math.max(3, y(band[0]) - y(band[1]))} rx={3} className="c-band" />}
      <polyline points={series.map((s, i) => `${x(i)},${y(s)}`).join(' ')} className="c-line" strokeWidth={2} />
      <Mark x={x(last)} y={y(v)} out={out} r={5} />
    </svg>
  );
}

// ------------------------------------------------------------------ trend against the usual range

/** Fixed axes for each measure, never fitted to the week's readings (the team's chart research). An axis grows by
    whole steps only if a reading would otherwise fall off the plot. */
const AXES: Record<string, { min: number; max: number; step: number; bars?: boolean; nights?: boolean }> = {
  ecg: { min: -0.5, max: 1.5, step: 0.5 },
  hr: { min: 50, max: 80, step: 10 },
  bp: { min: 90, max: 140, step: 10 },
  temp: { min: 36, max: 38.5, step: 0.5 },
  sleep: { min: 0, max: 10, step: 2, bars: true, nights: true },
  glucose: { min: 60, max: 120, step: 20 },
};

function axisFor(key: string, values: number[], band: [number, number]) {
  const a = AXES[key];
  const all = [...values, ...band];
  if (!a) {
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.2;
    lo -= pad;
    hi += pad;
    const t = niceTicks(lo, hi, 3);
    return { min: Math.min(lo, t[0]), max: Math.max(hi, t[t.length - 1]), ticks: t, bars: false, nights: false };
  }
  let { min, max } = a;
  let step = a.step;
  while (Math.max(...all) > max + 1e-9) max += step;
  while (Math.min(...all) < min - 1e-9) min -= step;
  while ((max - min) / step > 6) step *= 2;
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(3)));
  return { min, max: ticks[ticks.length - 1] < max ? max : ticks[ticks.length - 1], ticks, bars: !!a.bars, nights: !!a.nights };
}

interface BandChartProps {
  series: number[];
  band: [number, number];
  unit: string;
  title: string;
  name: string;
  axisKey: string;
}

export function BandChart({ series, band, unit, title, name, axisKey }: BandChartProps) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const n = series.length;
  const lastIndex = n - 1;
  const [sel, setSel] = useState(lastIndex);
  const lastValue = series[lastIndex];
  useEffect(() => setSel(lastIndex), [lastIndex, lastValue]);

  const ax = axisFor(axisKey, series, band);
  const L = 58;
  const R = 104;
  const T = 14;
  const ph = 150;
  const H = T + ph + 62;
  const pw = Math.max(1, W - L - R);
  const slot = pw / n;
  const x = (i: number) => L + slot * (i + 0.5);
  const y = (v: number) => T + ph * (1 - (v - ax.min) / (ax.max - ax.min));
  const outside = (v: number) => v < band[0] || v > band[1];
  const ago = (i: number) => {
    const d = lastIndex - i;
    if (ax.nights) return d === 0 ? 'Last night' : d === 1 ? 'The night before last' : `${d} nights ago`;
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) * W) / box.width;
    setSel(Math.max(0, Math.min(lastIndex, Math.floor((px - L) / slot))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, s - 1));
    if (e.key === 'ArrowRight') setSel((s) => Math.min(lastIndex, s + 1));
  };
  const v = series[sel];
  const where = v > band[1] ? 'above your usual range' : v < band[0] ? 'below your usual range' : 'within your usual range';
  // Direct labels for the two usual-range lines, in the right gutter; pushed apart if they would touch.
  let yHi = y(band[1]) + 6;
  let yLo = y(band[0]) + 6;
  if (yLo - yHi < 22) {
    const mid = (yHi + yLo) / 2;
    yHi = mid - 11;
    yLo = mid + 11;
  }
  const bw = Math.min(24, slot * 0.5);

  return (
    <figure className="chart">
      <figcaption className="chart-cap">
        <span>{title}</span>
        <span className="chart-readout" aria-live="polite">
          <span className="muted">{ago(sel)}</span>
          <b>
            <span className="num">{numText(v)}</span> {unit}
          </b>
          <span className="muted">{where}</span>
        </span>
      </figcaption>
      <div className="chart-plot" ref={ref}>
        {W > 0 && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            tabIndex={0}
            aria-label={`${title}. Use the left and right arrow keys to read each ${ax.nights ? 'night' : 'day'}.`}
            onPointerDown={pick}
            onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0 ? pick(e) : undefined)}
            onKeyDown={onKey}
            className="chart-svg"
          >
            {ax.ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={L + pw} y1={y(t)} y2={y(t)} className="c-grid" />
                <text x={L - 10} y={y(t) + 5} textAnchor="end" className="c-tick">
                  {numText(t)}
                </text>
              </g>
            ))}
            <line x1={x(sel)} x2={x(sel)} y1={T} y2={T + ph} className="c-cross" />
            {ax.bars &&
              series.map((s, i) => (
                <rect
                  key={i}
                  x={x(i) - bw / 2}
                  y={y(s)}
                  width={bw}
                  height={Math.max(1, y(ax.min) - y(s))}
                  className={`c-bar2 ${outside(s) ? 'm-outside' : 'm-within'}${i === sel ? ' is-sel' : ''}`}
                />
              ))}
            {ax.bars && <line x1={L} x2={L + pw} y1={y(ax.min)} y2={y(ax.min)} className="c-baseline" />}
            <line x1={L} x2={L + pw} y1={y(band[1])} y2={y(band[1])} className="c-usual" />
            <line x1={L} x2={L + pw} y1={y(band[0])} y2={y(band[0])} className="c-usual" />
            <text x={L + pw + 10} y={yHi} className="c-note">
              Usual {numText(band[1])}
            </text>
            <text x={L + pw + 10} y={yLo} className="c-note">
              Usual {numText(band[0])}
            </text>
            {!ax.bars && (
              <>
                <polyline points={series.map((s, i) => `${x(i)},${y(s)}`).join(' ')} className="c-line" strokeWidth={2.5} />
                {series.map((s, i) => (
                  <Mark key={i} x={x(i)} y={y(s)} out={outside(s)} r={i === sel ? 8 : 6} />
                ))}
              </>
            )}
            {series.map((_, i) => {
              // A word as the last label starts just left of its day and runs into the free gutter, clear of the "1".
              const word = i === lastIndex ? (ax.nights ? 'Last night' : 'Today') : null;
              return (
                <text
                  key={i}
                  x={word ? x(i) - 14 : x(i)}
                  y={T + ph + 26}
                  textAnchor={word ? 'start' : 'middle'}
                  className={word ? 'c-note' : 'c-tick'}
                >
                  {word || lastIndex - i}
                </text>
              );
            })}
            <text x={L + pw / 2} y={T + ph + 54} textAnchor="middle" className="c-note">
              {ax.nights ? 'Nights ago' : 'Days ago'}
            </text>
          </svg>
        )}
      </div>
      <ul className="legend" aria-hidden="true">
        <li>
          <svg className="key-mark" viewBox="0 0 20 20">
            <circle cx={10} cy={10} r={6} className="m-within" />
          </svg>
          Within usual range
        </li>
        <li>
          <svg className="key-mark" viewBox="0 0 20 20">
            <polygon points="10,2.2 17.8,10 10,17.8 2.2,10" className="m-outside" />
          </svg>
          Outside usual range
        </li>
        <li>
          <i className="key key--usual" />
          Usual range
        </li>
      </ul>
      <p className="sr-only">{weekSentence(name, series, band, unit, ax.nights)}</p>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {series.map((s, i) => (
            <tr key={i}>
              <th scope="row">{ago(i)}</th>
              <td>
                {numText(s)} {unit}, {outside(s) ? (s > band[1] ? 'above' : 'below') : 'within'} your usual range
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ------------------------------------------------------------------ career dose against the limit

/** One long track from zero to the end of the mission, with the career limit marked on it. */
export function DoseTrack({ rad }: { rad: Radiation }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const d = rad.dose;
  const max = Math.max(d.limit, d.projectedTotal) * 1.04;
  const H = 150;
  const P = 2;
  const top = 46;
  const bar = 30;
  const x = (v: number) => P + (v / max) * (W - 2 * P);
  const over = d.projectedTotal > d.limit;
  const limitX = x(d.limit);
  const limitAnchor = limitX > W - 150 ? 'end' : limitX < 150 ? 'start' : 'middle';
  const soFarX = x(d.soFar);
  const projX = x(d.projectedTotal);
  return (
    <figure className="chart chart--bare">
      <div className="chart-plot" ref={ref}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Career dose so far ${dose(d.soFar)} millisieverts, projected ${dose(d.projectedTotal)} at mission end, career limit ${dose(d.limit)}.`}
        >
          <rect x={P} y={top} width={W - 2 * P} height={bar} rx={6} className="c-track" />
          <rect x={x(0)} y={top} width={Math.max(2, x(d.priorCareer) - x(0) - 2)} height={bar} rx={4} className="c-fill c-fill--soft" />
          <rect x={x(d.priorCareer)} y={top} width={Math.max(2, soFarX - x(d.priorCareer) - 2)} height={bar} rx={4} className="c-fill" />
          <rect x={soFarX} y={top + 1} width={Math.max(2, projX - soFarX)} height={bar - 2} rx={4} className="c-projected" />
          <line x1={limitX} x2={limitX} y1={top - 14} y2={top + bar + 14} className="c-limit-mark" />
          <text x={limitX} y={22} textAnchor={limitAnchor} className="c-label">
            Career limit {dose(d.limit)} mSv
          </text>
          <line x1={soFarX} x2={soFarX} y1={top + bar} y2={top + bar + 10} className="c-tickmark" />
          <text x={soFarX > 180 ? soFarX : P} y={top + bar + 30} textAnchor={soFarX > 180 ? 'end' : 'start'} className="c-label">
            So far {dose(d.soFar)} mSv
          </text>
          <text x={projX > 440 ? Math.min(projX, W - 2) : P} y={top + bar + 58} textAnchor={projX > 440 ? 'end' : 'start'} className="c-label c-label--soft">
            Projected at mission end {dose(d.projectedTotal)} mSv{over ? ', past the limit' : ''}
          </text>
        </svg>
      )}
      </div>
    </figure>
  );
}

/** Career dose by mission day: measured so far, projected to the end, with the uncertainty band. */
export function DoseProjection({ rad }: { rad: Radiation }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const total = rad.mission.totalDays;
  const lim = rad.dose.limit;
  const all = [...rad.cumulative, ...rad.projection];
  // The selected point, as a position in "all". Days are looked up by their own number, not by position,
  // because the server's day-by-day history can stop before today.
  const [sel, setSel] = useState<number | null>(null);
  const H = 280;
  const L = 60;
  const R = 18;
  const T = 30;
  const B = 44;
  const maxY = Math.max(lim * 1.15, ...rad.band.high, rad.dose.projectedTotal) * 1.03;
  const x = (dy: number) => L + ((dy - 1) / Math.max(1, total - 1)) * (W - L - R);
  const y = (v: number) => T + (H - T - B) * (1 - v / maxY);
  const last = rad.cumulative[rad.cumulative.length - 1];
  // "Today" is the mission day the server reports, at the server's own "so far" figure. If the day-by-day
  // history stops earlier, the stretch with no daily data is drawn as a faint dotted line, never as measured.
  const now = { day: Math.max(rad.mission.today, last.day), value: last.value };
  const historyGap = now.day > last.day;
  const soFar = rad.cumulative.map((p) => `${x(p.day)},${y(p.value)}`).join(' ');
  const proj = [now, ...rad.projection].map((p) => `${x(p.day)},${y(p.value)}`).join(' ');
  const band = [
    `${x(now.day)},${y(now.value)}`,
    ...rad.projection.map((p, i) => `${x(p.day)},${y(rad.band.high[i])}`),
    ...rad.projection.map((p, i) => `${x(p.day)},${y(rad.band.low[i])}`).reverse(),
  ].join(' ');
  const yStep = maxY > 900 ? 300 : 200;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += yStep) yTicks.push(v);
  const xStep = total > 400 ? 200 : total > 250 ? 100 : total > 150 ? 60 : 30;
  const xTicks: number[] = [];
  for (let dy = xStep; dy <= total; dy += xStep) xTicks.push(dy);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const dy = 1 + ((e.clientX - box.left - L) / Math.max(1, W - L - R)) * (total - 1);
    let best = 0;
    for (let i = 1; i < all.length; i++) if (Math.abs(all[i].day - dy) < Math.abs(all[best].day - dy)) best = i;
    setSel(best);
  };
  const selPoint = sel == null ? null : all[Math.min(sel, all.length - 1)];
  const todayX = x(now.day);
  const todayAnchor = todayX > W - 170 ? 'end' : 'start';
  // The limit label drops its unit (the caption gives it) when the full label would run into the "today" line.
  const crossesToday = (width: number) => todayX > L + 4 && todayX < L + 10 + width + 8;
  const limitLabel = crossesToday(168) && !crossesToday(134) ? `Career limit ${dose(lim)}` : `Career limit ${dose(lim)} mSv`;
  // The "Limit reached" label sits below the limit line and to the right of its dot, where the projection
  // has already risen above the line. Near the right edge it moves to the left of the dot.
  const limX = rad.dose.limitDay ? x(rad.dose.limitDay) : 0;
  const limRight = limX + 12 + 116 <= W - 4;
  const limTextX = limX + (limRight ? 12 : -12);
  return (
    <figure className="chart">
      <figcaption className="chart-cap">
        <span>Career dose by mission day, in millisieverts (mSv)</span>
        <span className="chart-readout" aria-live="polite">
          {selPoint ? (
            <>
              <span className="muted">Day {selPoint.day}</span>
              <b className="num">{dose(selPoint.value)} mSv</b>
              <span className="muted">{selPoint.kind === 'projection' ? 'projected' : 'so far'}</span>
            </>
          ) : (
            <span className="muted">Tap the chart to read a day</span>
          )}
        </span>
      </figcaption>
      <div className="chart-plot" ref={ref}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label="Career dose by mission day. Use the left and right arrow keys to read each day."
          className="chart-svg"
          onPointerDown={pick}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0 ? pick(e) : undefined)}
          onKeyDown={(e) => {
            const start = rad.cumulative.length - 1;
            if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, Math.min(s ?? start, all.length - 1) - 1));
            if (e.key === 'ArrowRight') setSel((s) => Math.min(all.length - 1, (s ?? start) + 1));
          }}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="c-grid" />
              <text x={L - 10} y={y(v) + 5} textAnchor="end" className="c-tick">
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((dy) => (
            <text key={dy} x={x(dy)} y={H - B + 22} textAnchor="middle" className="c-tick">
              {dy}
            </text>
          ))}
          <text x={L} y={H - 4} className="c-note">
            Mission day
          </text>
          <polygon points={band} className="c-uncertainty" />
          <line x1={L} x2={W - R} y1={y(lim)} y2={y(lim)} className="c-threshold" />
          <line x1={todayX} x2={todayX} y1={T - 8} y2={H - B} className="c-cross" />
          <text x={L + 10} y={y(lim) - 9} className="c-label c-halo">
            {limitLabel}
          </text>
          <text x={todayX + (todayAnchor === 'end' ? -8 : 8)} y={T - 12} textAnchor={todayAnchor} className="c-note">
            Today, day {now.day}
          </text>
          <polyline points={soFar} className="c-line" strokeWidth={3} />
          {historyGap && (
            <polyline
              points={`${x(last.day)},${y(last.value)} ${todayX},${y(now.value)}`}
              className="c-line c-line--ghost"
              strokeWidth={2}
            />
          )}
          <polyline points={proj} className="c-line c-line--projected" strokeWidth={2.5} />
          <circle cx={todayX} cy={y(now.value)} r={6} className="c-dot" />
          {rad.dose.limitDay && (
            <>
              <circle cx={limX} cy={y(lim)} r={7} className="c-dot c-dot--open" />
              <text x={limTextX} y={y(lim) + 27} textAnchor={limRight ? 'start' : 'end'} className="c-label c-halo">
                <tspan x={limTextX}>Limit reached</tspan>
                <tspan x={limTextX} dy={21}>
                  day {rad.dose.limitDay}
                </tspan>
              </text>
            </>
          )}
          {selPoint && <circle cx={x(selPoint.day)} cy={y(selPoint.value)} r={6} className="c-dot c-dot--open" />}
        </svg>
      )}
      </div>
      <ul className="legend" aria-hidden="true">
        <li>
          <i className="key key--solid" />
          So far
        </li>
        <li>
          <i className="key key--dashed" />
          Projected
        </li>
        <li>
          <i className="key key--band" />
          Uncertainty, about ±{Math.round(rad.band.spread * 100)}%
        </li>
      </ul>
      {historyGap && (
        <p className="chart-note">
          No day-by-day data for days {last.day + 1} to {now.day}. The faint dotted stretch joins the last recorded day to today.
        </p>
      )}
    </figure>
  );
}

/** Daily dose rate over the recent window, with the usual (median) rate marked. */
export function DailyBars({ rad }: { rad: Radiation }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const vals = rad.recent.values;
  const dates = rad.recent.dates;
  const [sel, setSel] = useState<number | null>(null);
  const H = 170;
  const L = 60;
  const R = 8;
  const T = 12;
  const B = 34;
  const sorted = [...vals].sort((a, b) => a - b);
  const med = sorted[Math.floor(vals.length / 2)] ?? 0;
  const maxY = Math.max(...vals, med) * 1.15 || 1;
  const slot = (W - L - R) / Math.max(1, vals.length);
  const bw = Math.min(24, Math.max(4, slot - 2));
  const y = (v: number) => T + (H - T - B) * (1 - v / maxY);
  const label = (i: number) => (dates ? dayText(dates[i]) : `${vals.length - 1 - i} days ago`);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - L) / slot);
    setSel(i >= 0 && i < vals.length ? i : null);
  };
  return (
    <figure className="chart">
      <figcaption className="chart-cap">
        <span>
          Daily dose, last {vals.length} days, in mSv per day
          <span className="muted"> ({rad.mission.instrument})</span>
        </span>
        <span className="chart-readout" aria-live="polite">
          {sel != null ? (
            <>
              <span className="muted">{label(sel)}</span>
              <b className="num">{fixed(vals[sel])} mSv per day</b>
            </>
          ) : (
            <span className="muted">Tap a bar to read it</span>
          )}
        </span>
      </figcaption>
      <div className="chart-plot" ref={ref}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label="Daily dose rate. Use the left and right arrow keys to read each day."
          className="chart-svg"
          onPointerDown={pick}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0 ? pick(e) : undefined)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, (s ?? vals.length) - 1));
            if (e.key === 'ArrowRight') setSel((s) => Math.min(vals.length - 1, (s ?? -1) + 1));
          }}
        >
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="c-grid" />
          {vals.map((v, i) => {
            const h = Math.max(2, y(0) - y(v));
            const bx = L + i * slot + (slot - bw) / 2;
            const r = Math.min(4, bw / 2, h);
            return (
              <path
                key={i}
                d={`M${bx},${y(0)} V${y(0) - h + r} Q${bx},${y(0) - h} ${bx + r},${y(0) - h} H${bx + bw - r} Q${bx + bw},${y(0) - h} ${bx + bw},${y(0) - h + r} V${y(0)} Z`}
                className={`c-bar${v > med * 1.5 ? ' c-bar--high' : ''}${i === sel ? ' is-sel' : ''}`}
              />
            );
          })}
          <line x1={L} x2={W - R} y1={y(med)} y2={y(med)} className="c-threshold" />
          <text x={L - 10} y={y(med) + 5} textAnchor="end" className="c-tick">
            {fixed(med)}
          </text>
          <text x={L} y={H - 8} className="c-tick">
            {label(0)}
          </text>
          <text x={W - R} y={H - 8} textAnchor="end" className="c-tick">
            {label(vals.length - 1)}
          </text>
        </svg>
      )}
      </div>
      <ul className="legend" aria-hidden="true">
        <li>
          <i className="key key--dashed" />
          Usual rate (median) {fixed(med)} mSv per day
        </li>
        <li>
          <i className="key key--bar-high" />
          More than 1.5 times the usual rate
        </li>
      </ul>
      <table className="sr-only">
        <caption>Daily dose rate in millisieverts per day</caption>
        <tbody>
          {vals.map((v, i) => (
            <tr key={i}>
              <th scope="row">{label(i)}</th>
              <td>{fixed(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** One whole split in two: today's dose by particle type at the space station. */
export function SplitBar({ share, a, b }: { share: number; a: string; b: string }) {
  const n = Math.round(share * 100);
  return (
    <div className="split" role="img" aria-label={`${a} ${100 - n} percent, ${b} ${n} percent`}>
      <div className="split-part split-part--a" style={{ flexGrow: 100 - n }}>
        <span className="num">{100 - n}%</span> {a}
      </div>
      <div className="split-part split-part--b" style={{ flexGrow: n }}>
        <span className="num">{n}%</span> {b}
      </div>
    </div>
  );
}

/** Check-ins done today, as a ring with the count written inside. */
export function Ring({ done, total }: { done: number; total: number }) {
  const size = 168;
  const r = 70;
  const c = 2 * Math.PI * r;
  const gap = 6;
  const seg = c / total;
  return (
    <svg
      className="ring"
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      role="img"
      aria-label={`${done} of ${total} check-ins done today`}
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {Array.from({ length: total }, (_, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${seg - gap - 12} ${c - seg + gap + 12}`}
            strokeDashoffset={-(i * seg + gap / 2 + 6)}
            className={i < done ? 'ring-on' : 'ring-off'}
          />
        ))}
      </g>
      <text x="50%" y="50%" textAnchor="middle" dy="0.1em" className="ring-num">
        {done} of {total}
      </text>
      <text x="50%" y="50%" textAnchor="middle" dy="1.7em" className="ring-word">
        done today
      </text>
    </svg>
  );
}

/** A schematic of one heartbeat, drawn from the ST shift value: the usual shape and the shape now. */
export function BeatShape({ shift }: { shift: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 226;
  const mm = 13; // pixels per millimetre of tracing
  const base = 158;
  const w = Math.max(320, W);
  const cx = w / 2 - 150;
  // One beat as straight and curved segments; t is horizontal pixels, values are millimetres above the baseline.
  const beat = (st: number) => {
    const pts: [number, number][] = [
      [0, 0], [30, 0], [42, 1.2], [54, 0], [70, 0], [76, -1], [84, 10], [92, -2.4], [98, st], [128, st],
      [146, st + 2.4], [166, 0.2], [176, 0], [300, 0],
    ];
    return pts.map(([t, v]) => `${cx + t},${base - v * mm}`).join(' ');
  };
  const grid: number[] = [];
  for (let gy = base - 10 * mm; gy <= base + 3 * mm; gy += mm) grid.push(gy);
  const stX = cx + 113;
  return (
    <figure className="chart">
      <figcaption className="chart-cap">
        <span>One heartbeat: your usual shape and the shape now</span>
        <span className="chart-readout">
          <span className="muted">ST shift now</span>
          <b className="num">
            {shift > 0 ? '+' : ''}
            {trim(shift)} mm
          </b>
        </span>
      </figcaption>
      <div className="chart-plot" ref={ref}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schematic of one heartbeat. The ST segment, the flat part after the main spike, is shifted by ${trim(shift)} millimetres from your usual shape.`}>
          {grid.map((gy) => (
            <line key={gy} x1={0} x2={W} y1={gy} y2={gy} className="c-grid" />
          ))}
          <polyline points={beat(0)} className="c-line c-line--ghost" strokeWidth={2.5} />
          <polyline points={beat(shift)} className="c-line" strokeWidth={3} />
          {Math.abs(shift) > 0.2 && (
            <>
              <line x1={stX} x2={stX} y1={base} y2={base - shift * mm} className="c-shift" />
              <circle cx={stX} cy={base - shift * mm} r={6} className="c-dot c-dot--caution" />
              <text x={cx + 136} y={base - (Math.max(shift, 0) + 2.4) * mm - 18} className="c-label">
                ST segment, shifted
              </text>
            </>
          )}
          <text x={cx + 84} y={base - 10 * mm - 8} textAnchor="middle" className="c-note">
            Main spike
          </text>
        </svg>
      )}
      </div>
      <ul className="legend" aria-hidden="true">
        <li>
          <i className="key key--ghost" />
          Your usual shape
        </li>
        <li>
          <i className="key key--solid" />
          Now
        </li>
        <li>Each grid line is 1 mm. A schematic drawn from the ST shift value, not a recorded tracing.</li>
      </ul>
    </figure>
  );
}
