// Crew overview: the crew doctor's view. Who needs attention first, what supports each result,
// and a record of every decision. The human decides; the system only alerts.

import { useEffect, useState } from 'react';
import type { CrewState, Criterion, PersonId, Radiation } from '../api';
import {
  DECIDE_REASONS,
  DECISION_WORD,
  DISMISS_REASONS,
  LABS,
  NAMES,
  OUTCOME_WORD,
  QUICK_WORD,
  SRC,
} from '../content';
import { clock, dose, sentenceCase } from '../format';
import { Icon } from '../icons';
import { personStatus, speOn, stormDose, type PersonStatus } from '../logic';
import { Button, ClassTag, Countdown, Dialog, Fact, PlainTag, RangePill, ReasonChips, Scroll, SourceChip, StateTag, revealDetail } from '../ui';
import type { ViewId } from './Chrome';
import { outsideSide, rangeInfo, type Side } from '../range';
import { indicatorsFor } from '../measures';
import { AiInsight } from './Insight';

interface Props {
  S: CrewState;
  rad: Radiation | null;
  me: PersonId;
  selPerson: PersonId;
  setSelPerson: (p: PersonId) => void;
  send: (type: string, extra?: Record<string, unknown>) => void;
  go: (v: ViewId) => void;
}

export function StatusTag({ st, outside }: { st: PersonStatus; outside?: Side | null }) {
  if (st.kind === 'emergency') return <ClassTag cls="emergency" />;
  if (st.kind === 'caution') return <ClassTag cls="caution" />;
  if (st.kind === 'advisory') return <ClassTag cls="advisory" />;
  if (st.kind === 'shelter') return <PlainTag icon="check_circle" strong>In shelter</PlainTag>;
  if (st.kind === 'missing') return <StateTag kind="sensor_off" />;
  return <RangePill side={outside || 'within'} />;
}

export function CrewOverview({ S, rad, me, selPerson, setSelPerson, send, go }: Props) {
  const crew = S.crew.map((c) => ({ ...c, st: personStatus(S, rad, c.id) })).sort((a, b) => b.st.rank - a.st.rank);
  const open = S.advisories.filter((a) => !a.dismissed);
  const pending = S.closed.filter((c) => c.outcome === 'not_known');
  const quick = S.heart && S.heart.quick_check ? QUICK_WORD[S.heart.quick_check] : 'not answered yet';
  const showEvidence = selPerson === 'lena' && !!S.heart && !['cleared', 'closed'].includes(S.heart.stage);

  return (
    <div className="view">
      <Scroll>
        {S.doctor_woken && (
          <div className="alert alert--caution alert--lead">
            <div className="alert-head">
              <ClassTag cls="caution" />
              <span className="alert-when">{clock(S.doctor_woken.at)}</span>
            </div>
            <p className="hero-title">{NAMES[S.doctor_woken.by] || S.doctor_woken.by} needs you</p>
            <p className="hero-detail">{S.doctor_woken.why}</p>
          </div>
        )}

        <section className="panel" aria-label="Who needs you first">
          <div className="panel-head">
            <h3>Who needs you first</h3>
            <span className="muted">Alerts first, then missing data</span>
          </div>
          {crew.map((c) => (
            <button key={c.id} type="button" className="row row--person" aria-pressed={selPerson === c.id} onClick={() => { setSelPerson(c.id); revealDetail(); }}>
              <span>
                <span className="row-title">
                  {c.name}
                  {c.id === me ? ' (you)' : ''}
                </span>
                <span className="row-sub">{c.st.reason}</span>
              </span>
              <StatusTag st={c.st} outside={outsideSide(indicatorsFor(S, c.id))} />
              <Icon name="chevron_right" className="row-chevron" />
            </button>
          ))}
        </section>

        <section className="panel" aria-label="Review list">
          <div className="panel-head">
            <h3>Review list</h3>
            <span className="muted">Advisories arrive here quietly, with no sound</span>
          </div>
          {open.length === 0 && pending.length === 0 && <p className="empty">Nothing to review.</p>}
          {open.map((a) => (
            <div key={a.id} className="review">
              <div className="alert-head">
                <ClassTag cls="advisory" />
                <b>{NAMES[a.person]}</b>
                <span className="alert-when">{clock(a.at)}</span>
              </div>
              <p>{a.text}</p>
              <p className="muted">
                {NAMES[a.person]} has also been told. Check-in answer: {quick}.
              </p>
              <div>
                <Button
                  kind="primary"
                  onClick={() => {
                    setSelPerson(a.person);
                    revealDetail();
                  }}
                >
                  Open evidence
                </Button>
              </div>
              <div className="stack stack--tight">
                <span className="label">Dismiss with a reason</span>
                <div className="chips">
                  {DISMISS_REASONS.map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => send('dismiss_advisory', { id: a.id, reason: r })}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {pending.map((c) => (
            <div key={c.id} className="review">
              <div className="alert-head">
                <ClassTag cls="advisory" />
                <b>Outcome not yet known: {c.what}</b>
                <span className="alert-when">Ended {clock(c.ended_at)}</span>
              </div>
              <div className="chips">
                <button type="button" className="chip" onClick={() => send('set_outcome', { id: c.id, outcome: 'confirmed' })}>
                  {OUTCOME_WORD.confirmed}
                </button>
                <button type="button" className="chip" onClick={() => send('set_outcome', { id: c.id, outcome: 'false_alarm' })}>
                  {OUTCOME_WORD.false_alarm}
                </button>
              </div>
            </div>
          ))}
        </section>

        {S.decisions.length > 0 && (
          <section className="panel panel-pad stack" aria-label="Decision record">
            <h3>Decision record</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Decision</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {S.decisions.slice(0, 6).map((d, i) => (
                    <tr key={i}>
                      <td className="num">{clock(d.at)}</td>
                      <td>{d.who}</td>
                      <td>{DECISION_WORD[d.decision] || sentenceCase(d.decision || '')}</td>
                      <td>{d.reason || <span className="muted">No reason given</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {S.events.length > 0 && (
          <section className="panel panel-pad stack" aria-label="Event record">
            <h3>Event record</h3>
            <ol className="timeline">
              {S.events.slice(0, 8).map((ev, i) => (
                <li key={i}>
                  <span className="num">{clock(ev.at)}</span>
                  <span>{ev.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </Scroll>

      {showEvidence ? (
        <div className="pane">
          <Scroll>
            <Evidence S={S} rad={rad} send={send} />
          </Scroll>
          <DecideBar S={S} send={send} go={go} />
        </div>
      ) : (
        <Scroll>
          <PersonRecord key={selPerson} S={S} rad={rad} pid={selPerson} />
        </Scroll>
      )}
    </div>
  );
}

function Met({ c }: { c: Criterion }) {
  if (c.met === true)
    return (
      <span className="met">
        <Icon name="check_circle" /> Met
      </span>
    );
  if (c.met === false) return <span className="met">Not met</span>;
  return (
    <span className="met muted">
      <Icon name="hourglass_top" /> Not yet known
    </span>
  );
}

function Evidence({ S, rad, send }: { S: CrewState; rad: Radiation | null; send: Props['send'] }) {
  const h = S.heart!;
  const m = h.model;
  const t = S.track;
  const BASIS: Record<string, keyof typeof SRC> = { rule: 'rule', norsk: 'norsk', symptom: 'symptom', thygesen: 'thygesen', actis: 'actis' };
  // Opening the evidence tells Lena when the crew doctor has seen it (crew/engine.py, "doctor_seen").
  useEffect(() => {
    if (!h.seen_at) send('doctor_seen');
    // Once per heart alert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.id]);
  return (
    <section className="panel panel-pad detail enter" aria-label="Lena: possible heart problem">
      <header className="detail-head">
        <h2>Lena: possible heart problem</h2>
        <ClassTag cls={h.stage === 'monitored' ? 'advisory' : h.stage === 'emergency' ? 'emergency' : 'caution'} />
      </header>
      <p className="detail-lead">{m.summary}</p>
      <p className="small-line">
        <Icon name="schedule" />
        <span>
          {m.level === 'criterion_met' ? '12-lead criterion met' : 'Screening signal (wearable ECG)'}. Issued{' '}
          <span className="num">{clock(h.issued_at)}</span>
          {h.reading_at ? (
            <>
              , 12-lead Heart reading at <span className="num">{clock(h.reading_at)}</span>
            </>
          ) : null}
          .
        </span>
      </p>

      <ul className="criteria" aria-label="Criteria">
        {m.criteria.map((c) => (
          <li key={c.label} className="criterion">
            <Met c={c} />
            <div>
              <p className="criterion-label">{c.label}</p>
              <p className="criterion-value">{c.value}</p>
            </div>
            <SourceChip source={SRC[BASIS[c.basis]] || SRC.demo} />
          </li>
        ))}
      </ul>

      {h.stage !== 'emergency' && (!h.heart_reading || !h.clot_test) && (
        <div className="btn-row">
          {!h.heart_reading && (
            <Button icon="ecg_heart" onClick={() => send('heart_reading')}>
              Record heart reading (12-lead heart tracing)
            </Button>
          )}
          {!h.clot_test && (
            <Button icon="science" onClick={() => send('clot_test')}>
              Run ACTIS blood clot test
            </Button>
          )}
        </div>
      )}
      {!h.clot_test && h.stage !== 'emergency' && (
        <p className="small-line">
          <span>
            ACTIS, a Canadian Space Agency device on Crew-13, measures D-dimer in about 15 minutes to rule out a blood clot, another cause of chest
            pain. Result is mock.
          </span>{' '}
          <SourceChip source={SRC.actis} />
        </p>
      )}
      {h.clot_test && (
        <p className="small-line">
          <Icon name="check_circle" /> ACTIS blood clot test taken at <span className="num">{clock(h.clot_at)}</span> (mock result).
        </p>
      )}

      <div className="facts">
        <Fact label="Data covered">{m.coverage.text}</Fact>
        <Fact label="Limits">{m.limits}</Fact>
      </div>
      <Fact label="Heart alerts this mission" note="Counted from this mission's own alerts, not invented figures.">
        <span className="num">{t.alerts}</span> issued, <span className="num">{t.confirmed}</span> confirmed,{' '}
        <span className="num">{t.not_confirmed}</span> not confirmed,{' '}
        <span className="num">{Math.max(0, t.alerts - t.confirmed - t.not_confirmed)}</span> outcome not yet recorded
      </Fact>
      <p className="glossary">{m.label}. Values shaped by published in-flight data where cited.</p>
      <AiInsight S={S} rad={rad} pid="lena" audience="doctor" />
    </section>
  );
}

const DECISIONS: { id: string; word: string; sub: string; title: string; then: string }[] = [
  { id: 'monitor', word: 'Monitor', sub: 'keep reviewing', title: 'Monitor this result', then: 'The result stays under review. Lena is told to check again in 1 hour.' },
  { id: 'confirm', word: 'Confirm', sub: 'credible', title: 'Confirm the result is credible', then: 'Lena is told you have reviewed it. You decide the next step.' },
  { id: 'override', word: 'Dismiss', sub: 'not credible', title: 'Dismiss the result as not credible', then: 'The result is cleared and leaves your review list.' },
];

/** The decision controls stay in view under the evidence, so a decision or a countdown never hides below a scroll. */
function DecideBar({ S, send, go }: { S: CrewState; send: Props['send']; go: Props['go'] }) {
  const h = S.heart!;
  const [asking, setAsking] = useState<(typeof DECISIONS)[number] | null>(null);
  if (h.stage === 'emergency') {
    return (
      <div className="pinned panel">
        <p>The crew-wide emergency is in progress. End it from the Emergency view when care no longer needs the whole crew.</p>
        <Button onClick={() => go('emergency')}>Back to emergency</Button>
      </div>
    );
  }
  if (h.stage === 'countdown' && h.countdown_end) {
    return (
      <div className="pinned panel pinned--countdown" role="alert">
        <Countdown
          end={h.countdown_end}
          total={S.countdown_s}
          caption={
            <>
              until the crew-wide emergency is declared
              <span className="muted">Started by {h.countdown_by}</span>
            </>
          }
        />
        <div className="pinned-actions pinned-actions--two">
          <Button kind="primary" size="xl" icon="send" onClick={() => send('send_now')}>
            Send now
          </Button>
          <span className="guard" aria-hidden="true" />
          <Button size="xl" icon="pan_tool" onClick={() => send('stop_countdown')}>
            Stop countdown
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="pinned panel">
      <div className="spread">
        <span className="label">Decide. Recorded with your name, the time and your reason.</span>
      </div>
      <div className="pinned-actions">
        <button type="button" className="btn btn--primary btn--xl decision" onClick={() => send('decide', { decision: 'escalate', reason: '' })}>
          <span className="decision-word">Escalate</span>
          <span className="decision-sub">whole crew</span>
        </button>
        <span className="guard" aria-hidden="true" />
        {DECISIONS.map((d) => (
          <button key={d.id} type="button" className="btn btn--secondary btn--xl decision" aria-haspopup="dialog" onClick={() => setAsking(d)}>
            <span className="decision-word">{d.word}</span>
            <span className="decision-sub">{d.sub}</span>
          </button>
        ))}
      </div>
      <p className="muted">Escalate starts a {S.countdown_s}-second countdown you can stop.</p>
      {asking && (
        <DecideDialog
          decision={asking}
          onClose={() => setAsking(null)}
          onRecord={(reason) => {
            send('decide', { decision: asking.id, reason });
            setAsking(null);
          }}
        />
      )}
    </div>
  );
}

function DecideDialog({
  decision,
  onClose,
  onRecord,
}: {
  decision: (typeof DECISIONS)[number];
  onClose: () => void;
  onRecord: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog title={decision.title} onClose={onClose} small>
      <p className="muted">{decision.then}</p>
      <div className="field">
        <label htmlFor="decide-reason">Reason, in one line</label>
        <input id="decide-reason" className="input" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tap a reason below, or type one" />
        <ReasonChips options={DECIDE_REASONS} value={reason} onPick={setReason} />
      </div>
      <div className="btn-row btn-row--apart end-actions">
        <Button kind="primary" size="xl" data-autofocus onClick={() => onRecord(reason.trim())}>
          Record: {decision.word.toLowerCase()}
        </Button>
        <Button size="xl" onClick={onClose}>
          Back
        </Button>
      </div>
    </Dialog>
  );
}

function PersonRecord({ S, rad, pid }: { S: CrewState; rad: Radiation | null; pid: PersonId }) {
  const inds = indicatorsFor(S, pid).filter((i) => !i.private);
  const storm = stormDose(rad);
  return (
    <section className="panel panel-pad detail enter" aria-label={NAMES[pid]}>
      <header className="detail-head">
        <h2>{NAMES[pid]}</h2>
        <StatusTag st={personStatus(S, rad, pid)} outside={outsideSide(indicatorsFor(S, pid))} />
      </header>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Now</th>
              <th>Usual range</th>
            </tr>
          </thead>
          <tbody>
            {inds.map((i) => (
              <tr key={i.key}>
                <td>{i.name}</td>
                <td>
                  {i.state === 'missing' ? (
                    <StateTag kind={i.missing || 'sensor_off'} />
                  ) : (
                    <>
                      <b>{i.value}</b> {i.unit} {rangeInfo(i) && <RangePill side={rangeInfo(i)!.side} />}
                    </>
                  )}
                </td>
                <td>{i.refText || i.usual}</td>
              </tr>
            ))}
            {rad && (
              <tr>
                <td>
                  Radiation, career dose (habitat estimate)
                  {speOn(S) && storm ? <div className="fact-note">Includes {storm.extraDose} mSv from the current storm</div> : null}
                </td>
                <td>
                  <span className="num">{dose(rad.dose.soFar)}</span> mSv {speOn(S) && <ClassTag cls="emergency" />}
                </td>
                <td>
                  Limit <span className="num">600</span> mSv, projected <span className="num">{dose(rad.dose.projectedTotal)}</span> at mission end
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="small-line">
        <Icon name="lock" /> Wellbeing: check-in completed today. Scores and trends only; journal entries are never available.
      </p>
      <AiInsight S={S} rad={rad} pid={pid} audience="doctor" />
      {pid === 'lena' && <Labs />}
    </section>
  );
}

function Labs() {
  return (
    <div className="stack stack--tight">
      <div className="spread">
        <h3>Example laboratory history</h3>
        <SourceChip source={SRC.labs} />
      </div>
      <p className="muted">Real astronaut data from a private mission, shown as an example. It is not Lena's data.</p>
      <div className="table-wrap">
        <table className="table table--labs">
          <thead>
            <tr>
              <th rowSpan={2}>Test and the laboratory's range</th>
              <th colSpan={3} className="group">
                Days before launch
              </th>
              <th colSpan={4} className="group">
                Days after return
              </th>
            </tr>
            <tr>
              {[92, 44, 3, 1, 45, 82, 194].map((d, i) => (
                <th key={i} className="num">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LABS.rows.map((r) => (
              <tr key={r.name}>
                <td>
                  {r.name}
                  <div className="fact-note num">
                    {r.range} {r.unit}
                  </div>
                </td>
                {r.v.map((v, i) => {
                  const out = v < r.lo || v > r.hi;
                  return (
                    <td key={i} className="num">
                      {v}
                      {out && <div className="out-note">outside range</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Values outside the range occur before flight too, so one result alone should not alarm.</p>
    </div>
  );
}
