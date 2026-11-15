// My health: one person's own status, alerts and indicators, each against their own usual range.

import { useState } from 'react';
import type { CrewState, Indicator, PersonId, Radiation } from '../api';
import { BandChart, BeatShape, Spark } from '../charts';
import {
  AFTER_YES,
  ANSWER_WINDOW_S,
  CHECK_QUESTION,
  GLOSSARY,
  HEART_STAGE_TEXT,
  INDICATOR_ICON,
  MISSING,
  NEXT,
  QUICK,
  QUICK_WORD,
  SHELTER_WORD,
  SRC,
} from '../content';
import { clock, dose, duration } from '../format';
import { CHECKIN_DEFS, cautionFor, checkinsDone, indicatorsFor } from '../measures';
import { Icon } from '../icons';
import { heartOnFor, myStatus, orderIndicators, radAlert, speOn, stormDose } from '../logic';
import { AmountLines, Button, ClassTag, Countdown, Fact, LinkPill, PlainTag, RangePill, Scroll, Seg, SourceChip, StateTag, TrendLine, revealDetail } from '../ui';
import { rangeInfo, trendWords, usualSentence } from '../range';
import type { ViewId } from './Chrome';

export type Selection = { kind: 'ind'; key: string } | { kind: 'heart' };

interface Props {
  S: CrewState;
  rad: Radiation | null;
  me: PersonId;
  sel: Selection;
  setSel: (s: Selection) => void;
  send: (type: string, extra?: Record<string, unknown>) => void;
  go: (v: ViewId) => void;
}

const isNumber = (v: string | null) => !!v && /^[\d.,/\s+\-−]+$/.test(v);

/** "Usual 52–60 bpm": the unit follows the range when the range is made of numbers. A plan replaces the range. */
const usualText = (ind: Indicator) =>
  ind.refText || `Usual ${ind.usual}${ind.unit && isNumber(ind.usual.replace(/[–\s/]/g, '')) ? ` ${ind.unit}` : ''}`;

/** What changed, in one sentence, for a reading the heart caution flags. */
function changedText(ind: Indicator): string {
  const r = rangeInfo(ind);
  const t = r ? trendWords(ind) : null;
  const trend = t && t.dir !== 'flat' ? `, ${t.words.toLowerCase()}` : '';
  if (ind.key === 'ecg' && ind.series && ind.band) {
    const v = ind.series[ind.series.length - 1];
    return `Your wearable ECG shows an ST shift of ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} mm, outside your usual ±${ind.band[1]} mm${trend}.`;
  }
  if (r && r.side !== 'within') {
    return `Your ${ind.name.toLowerCase()} is ${ind.value} ${ind.unit}, ${r.side} your usual ${ind.usual} ${ind.unit}${trend}.`;
  }
  return 'Outside your usual range.';
}


export function MyHealth({ S, rad, me, sel, setSel, send, go }: Props) {
  const inds = indicatorsFor(S, me);
  const ordered = orderIndicators(inds);
  const status = myStatus(S, me, inds);
  const heartOn = heartOnFor(S, me);
  const roster = S.emergency ? S.emergency.roster[me] : null;
  const ra = radAlert(rad);
  const storm = stormDose(rad);
  const done = checkinsDone(S, me);
  const selected = sel.kind === 'ind' ? inds.find((i) => i.key === sel.key) || ordered[0] : null;

  return (
    <div className={`view view--even${sel.kind === 'heart' && heartOn ? ' view--urgent-right' : ''}`}>
      <Scroll>
        {/* The one sentence that answers "how am I?" */}
        {status.kind === 'ok' || status.kind === 'missing' ? (
          <div className="hero">
            <span
              className={`hero-glyph${status.kind === 'missing' ? ' hero-glyph--state' : status.outside ? ' hero-glyph--outside' : ' hero-glyph--ok'}`}
            >
              <Icon name={status.kind === 'missing' ? 'sensors_off' : status.outside === 'above' ? 'arrow_upward' : status.outside === 'below' ? 'arrow_downward' : 'check'} />
            </span>
            <div>
              <p className="hero-title">{status.title}</p>
              <p className="hero-detail">{status.detail}</p>
            </div>
          </div>
        ) : heartOn && status.kind === 'caution' ? (
          <div className="alert alert--caution alert--lead">
            <div className="alert-head">
              <ClassTag cls="caution" />
              <span className="alert-when">Issued {clock(S.heart!.issued_at)}</span>
            </div>
            <p className="hero-title">{status.title}</p>
            {sel.kind !== 'heart' && <p className="hero-detail">{status.detail} Only you and the crew doctor have been told.</p>}
            {sel.kind !== 'heart' && (
              <div>
                <Button kind="primary" onClick={() => setSel({ kind: 'heart' })}>
                  {S.heart!.stage === 'caution' && !S.heart!.quick_check ? 'Open check-in' : 'Open possible heart problem'}
                </Button>
              </div>
            )}
          </div>
        ) : speOn(S) ? null : (
          <div className={`alert alert--${status.kind} alert--lead`}>
            <div className="alert-head">
              <ClassTag cls={status.kind as 'emergency' | 'caution'} />
            </div>
            <p className="hero-title">{status.title}</p>
            <p className="hero-detail">{status.detail}</p>
          </div>
        )}

        {speOn(S) && (
          <div className="alert alert--emergency alert--lead">
            <div className="alert-head">
              <ClassTag cls="emergency" />
              <span className="alert-when">Storm in progress</span>
            </div>
            <p className="hero-title">{status.title}</p>
            <p>
              {storm
                ? storm.doseSource === 'real' && !storm.detected
                  ? 'No increase above normal variation has been measured at this location yet.'
                  : `Extra dose from this storm so far: ${storm.extraDose} mSv (habitat estimate${storm.doseSource === 'simulated' ? ', simulated profile' : ''}), added to your career dose.`
                : 'Loading the storm dose.'}
            </p>
            <p>
              Your status: <b>{(roster && SHELTER_WORD[roster]) || roster}</b>
              {roster !== 'in_shelter' ? '. Go to the storm shelter now.' : '.'}
            </p>
            <p className="small">
              Your other indicators are not expected to change: storm doses in a shelter are far below the level that causes
              immediate symptoms. <SourceChip source={SRC.ars} />
            </p>
            {roster !== 'in_shelter' && (
              <div>
                <Button kind="primary" size="xl" onClick={() => send('respond', { status: 'in_shelter' })}>
                  I'm in the shelter
                </Button>
              </div>
            )}
          </div>
        )}

        {S.spe_caution && (
          <div className="alert alert--caution">
            <div className="alert-head">
              <ClassTag cls="caution" />
              <span className="alert-when">Issued {clock(S.spe_caution.at)}</span>
            </div>
            <p className="alert-title">{S.spe_caution.text}</p>
            <p className="small">
              At the station, Earth's magnetic field shields most of each orbit. The ground radiation team directs precautions.
            </p>
            <div>
              <Button onClick={() => send('spe_end')}>Acknowledge: alert over</Button>
            </div>
          </div>
        )}

        {me === 'lena' && S.access_closed_notice && (
          <button type="button" className="alert alert--advisory alert--row" onClick={() => go('sharing')}>
            <ClassTag cls="advisory" />
            <span>
              <span className="alert-title">Crew access to your data closed at {clock(S.access_closed_notice.at)}</span>
              <span className="small">
                Shared during the emergency: {S.access_closed_notice.data}, with {S.access_closed_notice.shared_with}. Your mood
                check-ins and journal were never shared.
              </span>
            </span>
            <Icon name="chevron_right" className="row-chevron" />
          </button>
        )}

        {ra && (
          <button type="button" className="alert alert--advisory alert--row" onClick={() => go('radiation')}>
            <ClassTag cls="advisory" />
            <span>
              <span className="alert-title">Radiation dose plan</span>
              <span className="small">{ra}</span>
            </span>
            <Icon name="chevron_right" className="row-chevron" />
          </button>
        )}

        {S.doctor_woken && S.doctor_woken.by === me && (
          <div className="alert alert--advisory alert--row">
            <ClassTag cls="advisory" />
            <span>
              <span className="alert-title">Crew doctor notified at {clock(S.doctor_woken.at)}</span>
              <span className="small">Sam is coming to you. Nobody else has been alerted.</span>
            </span>
          </div>
        )}

        <section className="panel" aria-label="My indicators">
          <div className="panel-head">
            <h3>My indicators</h3>
            <span className="muted">Against your own usual range in flight</span>
          </div>
          {ordered.map((i) => (
            <IndicatorRow
              key={i.key}
              ind={i}
              selected={sel.kind === 'ind' && selected?.key === i.key}
              onOpen={() => {
                setSel({ kind: 'ind', key: i.key });
                revealDetail();
              }}
            />
          ))}
          {rad && (
            <button type="button" className="row row--ind row--go" onClick={() => go('radiation')}>
              <Icon name="flare" className="row-icon" />
              <span>
                <span className="row-title">Radiation exposure</span>
                <span className="row-sub">
                  {speOn(S) ? <ClassTag cls="emergency" /> : `Projected ${dose(rad.dose.projectedTotal)} mSv at mission end`}
                </span>
              </span>
              <span className="row-value">
                <span className="num">{dose(rad.dose.soFar)}</span>
                <span className="unit">mSv</span>
              </span>
              <Icon name="chevron_right" className="row-chevron" />
            </button>
          )}
        </section>

        <section className="panel" aria-label="Today's check-ins">
          <button type="button" className="row row--link" onClick={() => go('checkins')}>
            <Icon name="task_alt" className="row-icon" />
            <span>
              <span className="row-title">Today's check-ins</span>
              <span className="row-sub">
                {done} of {CHECKIN_DEFS.length} done
              </span>
            </span>
            <Icon name="chevron_right" className="row-chevron" />
          </button>
        </section>
      </Scroll>

      <Scroll>
        {sel.kind === 'heart' && heartOn ? (
          <HeartPanel S={S} send={send} />
        ) : selected ? (
          <IndicatorDetail key={selected.key} ind={selected} now={S.now} send={send} inCaution={heartOn && selected.state === 'flag'} />
        ) : null}
      </Scroll>
    </div>
  );
}

function IndicatorRow({ ind, selected, onOpen }: { ind: Indicator; selected: boolean; onOpen: () => void }) {
  const miss = ind.state === 'missing';
  const r = rangeInfo(ind);
  return (
    <button type="button" className="row row--ind" aria-pressed={selected} onClick={onOpen}>
      <Icon name={INDICATOR_ICON[ind.key] || 'monitor_heart'} className="row-icon" />
      <span>
        <span className="row-title">{ind.name}</span>
        <span className="row-sub row-sub--pills">
          {miss ? MISSING[ind.missing || 'sensor_off'].note : r ? <RangePill side={r.side} /> : ind.private ? 'Private to you' : usualText(ind)}
          {ind.preventive ? <span>Preventive step</span> : null}
        </span>
      </span>
      <span className="row-spark">{ind.series && !miss ? <Spark series={ind.series} band={ind.band} /> : null}</span>
      <span className="row-value">
        {miss ? (
          <StateTag kind={ind.missing || 'sensor_off'} />
        ) : isNumber(ind.value) ? (
          <>
            <span className="num">{ind.value}</span>
            <span className="unit">{ind.unit}</span>
          </>
        ) : (
          <span className="row-word">{ind.value}</span>
        )}
      </span>
    </button>
  );
}

function IndicatorDetail({ ind, now, send, inCaution }: { ind: Indicator; now: number; send: Props['send']; inCaution: boolean }) {
  const [graph, setGraph] = useState<'trend' | 'beat'>('trend');
  const flag = ind.state === 'flag';
  const miss = ind.state === 'missing';
  const src = ind.src ? SRC[ind.src] : undefined;
  let changed: string;
  let next: string;
  let who: string;
  if (flag) {
    changed = changedText(ind);
    [next, who] = NEXT[ind.key] || ['Check again later.', 'Crew doctor'];
  } else if (miss && ind.missing === 'not_entered') {
    changed = 'No reading entered today. This is not a warning.';
    next = "Enter today's reading.";
    who = 'Only you';
  } else if (miss && ind.missing === 'stale') {
    changed = `Last reading at ${clock(ind.lastAt)}, ${duration(now - (ind.lastAt || now))} ago. Your wearable (Bio-Monitor shirt or watch) is not sending data. Missing data is never counted as usual.`;
    next = 'Put the shirt or watch on and check that the tablet shows a connection.';
    who = 'Only you';
  } else if (miss) {
    changed = 'Your wearable (Bio-Monitor shirt or watch) is not sending data. Missing data is never counted as usual.';
    next = 'Put the shirt or watch on and check that the tablet shows a connection.';
    who = 'Only you';
  } else if (ind.preventive) {
    changed = ind.preventive;
    next = 'A small preventive step, before this reaches a caution level.';
    who = 'Only you';
  } else {
    changed = 'Within your usual range.';
    next = 'No action needed. Next check: tomorrow morning.';
    who = 'Nobody';
  }
  const r = rangeInfo(ind);
  const trend = r ? trendWords(ind) : null;
  const shift = ind.key === 'ecg' && ind.series ? ind.series[ind.series.length - 1] : null;
  const unitForChart = ind.series_unit || ind.unit;

  return (
    <section className="panel panel-pad detail enter" aria-label={ind.name}>
      <header className="detail-head">
        <Icon name={INDICATOR_ICON[ind.key] || 'monitor_heart'} size={32} />
        <h2>{ind.name}</h2>
        <span className="pills">
          {r && <RangePill side={r.side} />}
          {inCaution && <LinkPill />}
          {miss && <StateTag kind={ind.missing || 'sensor_off'} />}
          {ind.private && <PlainTag icon="lock">Private to you</PlainTag>}
        </span>
      </header>

      <p className="detail-lead">{changed}</p>
      {trend && <TrendLine dir={trend.dir} words={trend.words} name={ind.name} />}

      {!miss && (
        <div className="reading">
          {isNumber(ind.value) ? (
            <span className="reading-value num">{ind.value}</span>
          ) : (
            <span className="reading-value reading-value--word">{ind.value}</span>
          )}
          {ind.unit && <span className="reading-unit">{ind.unit}</span>}
          {!r && ind.usual && (
            <span className="reading-side">
              <span>{usualText(ind)}</span>
            </span>
          )}
        </div>
      )}

      {r && (
        <div className="against">
          <AmountLines r={r} />
          <p className="range-line">{usualSentence(r)}</p>
        </div>
      )}

      {miss && ind.missing === 'not_entered' && ind.entry && (
        <div>
          <Button kind="primary" size="xl" icon="add" onClick={() => send('checkin', { id: ind.entry })}>
            Enter now
          </Button>
        </div>
      )}

      {!miss && ind.series && ind.band && (
        <div className="stack stack--tight">
          {shift != null && (
            <Seg
              label="What to show"
              value={graph}
              onChange={setGraph}
              options={[
                { value: 'trend', label: 'Last 7 days' },
                { value: 'beat', label: 'Beat shape' },
              ]}
            />
          )}
          {graph === 'beat' && shift != null ? (
            <BeatShape shift={shift} />
          ) : (
            <BandChart series={ind.series} band={ind.band} unit={unitForChart} name={ind.name} axisKey={ind.key} title={ind.key === 'sleep' ? 'Last 7 nights, in hours' : `Last 7 days, in ${unitForChart}`} />
          )}
          <div className="chart-foot">
            <SourceChip source={SRC.demo} />
          </div>
        </div>
      )}

      <div className="facts">
        <Fact label="Next step">{next}</Fact>
        <Fact label="Who to tell">{who}</Fact>
        <Fact label="Why it matters in space" note={ind.risk ? `NASA: ${ind.risk}` : undefined}>
          {ind.why} {src && <SourceChip source={src} />}
        </Fact>
        <Fact
          label="How it is measured"
          note={ind.private ? 'Private: the crew doctor sees that you checked in, never your entries.' : undefined}
        >
          {ind.measured} {ind.measured_src && SRC[ind.measured_src] && <SourceChip source={SRC[ind.measured_src]} />}
        </Fact>
      </div>

      {GLOSSARY[ind.key] && <p className="glossary">{GLOSSARY[ind.key]}</p>}
    </section>
  );
}

function HeartPanel({ S, send }: { S: CrewState; send: Props['send'] }) {
  const h = S.heart!;
  const m = h.model;
  const c = cautionFor(S, 'lena');
  const question = (c && c.checkIn.question) || CHECK_QUESTION;
  const then = (q: (typeof QUICK)[number]) => (c && c.checkIn.outcomes[q.word]) || q.then;
  const asking = h.stage === 'caution' && !h.quick_check;
  return (
    <section className="panel panel-pad detail enter" aria-label="Possible heart problem">
      <header className="detail-head">
        <ClassTag cls="caution" />
        <h2>Possible heart problem</h2>
        <span className="alert-when">Issued {clock(h.issued_at)}</span>
      </header>
      <p className="detail-lead">{m.summary}</p>

      {asking && (
        <div className="stack">
          <h3>Check-in: {question}</h3>
          <p className="muted">
            {h.unanswered_alerted
              ? `No answer yet, so the crew doctor was alerted at ${clock(h.unanswered_alerted)}. You can still answer.`
              : `Please answer by ${clock(h.issued_at + ANSWER_WINDOW_S)}. If there is no answer by then, the crew doctor is alerted.`}
          </p>
          <div className="answers">
            {QUICK.map((q) => (
              <button key={q.answer} type="button" className="answer" onClick={() => send('quick_check', { answer: q.answer })}>
                <span className="answer-word">{q.word}</span>
                <span className="answer-then">{then(q)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {h.stage === 'countdown' && h.countdown_end && (
        <div className="countdown-block">
          <Countdown
            end={h.countdown_end}
            total={S.countdown_s}
            caption={
              <>
                until the whole crew is alerted
                <span className="muted">Started by {h.countdown_by}</span>
              </>
            }
          />
          <Button kind="secondary" size="xl" block icon="pan_tool" onClick={() => send('stop_countdown')}>
            Stop: wake only the crew doctor
          </Button>
        </div>
      )}

      {!asking && h.stage !== 'countdown' && (
        <div className="stage-note">
          <p>{HEART_STAGE_TEXT[h.stage] || ''}</p>
          {h.quick_check && (
            <p className="muted">
              Your answer: {QUICK_WORD[h.quick_check]}
              {h.answered_at ? ` at ${clock(h.answered_at)}` : ''}.
            </p>
          )}
          {h.quick_check === 'yes' && (
            <p>
              <b>{(c && c.checkIn.afterYes) || AFTER_YES}</b>
            </p>
          )}
        </div>
      )}

      {h.seen_at && (
        <p className="small-line">
          <Icon name="visibility" /> Sam, the crew doctor, saw this at {clock(h.seen_at)}.
        </p>
      )}

      <div className="reading-row">
        {h.heart_reading ? (
          <p className="small-line">
            <Icon name="check_circle" /> Heart reading (12-lead heart tracing) taken at {clock(h.reading_at)}.
          </p>
        ) : (
          <>
            <Button kind="quiet" icon="ecg_heart" onClick={() => send('heart_reading')}>
              Take a heart reading
            </Button>
            <span className="muted">A 12-lead heart tracing from the medical kit. It is the deciding measurement.</span>
          </>
        )}
      </div>
      <p className="small-line">
        <span>Based on: {m.coverage.text}</span> <SourceChip source={m.level === 'criterion_met' ? SRC.thygesen : SRC.rule} />
      </p>
      <p className="small-line">
        <Icon name="lock" /> Only you and the crew doctor have been told.
      </p>
    </section>
  );
}
