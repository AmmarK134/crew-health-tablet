// Emergency: who needs help, where, and this person's own action, in the largest type on the screen.
// It opens by itself on every tablet (decisions log, "Step 2D") and stays one tap away until it is ended.

import { useState } from 'react';
import type { CrewState, Emergency, Outcome, PersonId, Radiation, RosterStatus } from '../api';
import {
  ACTION,
  DELAY_TEXT,
  END_REASONS,
  MODE_PLACE,
  NAMES,
  OUTCOME_WORD,
  RESPONSE_STEPS,
  ROSTER_WORD,
  SOS_CANCEL_S,
  SOS_END_REASONS,
  nextResponse,
  previousResponse,
} from '../content';
import { clock, duration } from '../format';
import { Icon } from '../icons';
import { canEnd, enderWord, myAction, sosCancelLeft, stormDose } from '../logic';
import { serverNow, useTick } from '../store';
import { Button, Dialog, PlainTag, ReasonChips, Scroll, Seg } from '../ui';

interface Props {
  S: CrewState;
  rad: Radiation | null;
  me: PersonId;
  send: (type: string, extra?: Record<string, unknown>) => void;
}

export function EmergencyView({ S, rad, me, send }: Props) {
  const e = S.emergency!;
  const isPatient = e.patient === me;
  const mine = e.roster[me];
  const next = isPatient ? null : nextResponse(e.kind, mine);
  const prev = isPatient ? null : previousResponse(e.kind, mine);
  const shared = e.kind === 'heart' || e.kind === 'sos';
  const [ending, setEnding] = useState(false);
  const [treatment, setTreatment] = useState(false);
  const who = e.patient ? NAMES[e.patient] : 'Whole crew';
  const title = isPatient ? (e.kind === 'sos' ? 'Your SOS was sent' : 'Your emergency') : e.kind === 'spe' ? 'Emergency: solar particle event' : `Emergency: ${who}, ${e.where}`;
  const responders = (Object.entries(e.roster) as [PersonId, RosterStatus][]).filter(([, s]) => s !== 'patient');
  const storm = stormDose(rad);

  return (
    <>
      {/* Only an emergency that this person has not yet acknowledged flashes (style guide SG-49). */}
      <div className={`emg-band${mine === 'alerted' ? ' is-flashing' : ''}`} role="alert">
        <Icon name="report" size={44} />
        <div className="emg-band-main">
          <h1>{title}</h1>
          <p>
            {e.kind === 'spe' ? e.detail || e.what : `${e.what}. ${e.detail}.`} Declared {clock(e.declared_at)} by {e.declared_by}.
          </p>
        </div>
        {shared && (
          <span className="tag tag--on-alert share-tag">
            <Icon name="share" />
            {isPatient ? 'Your emergency data is shared with the crew' : `${who}'s emergency data is shared`}
          </span>
        )}
      </div>

      <div className="view view--wide-left view--emergency">
        <Scroll>
          <section className="panel panel-pad action-panel" aria-label={isPatient ? 'Your instruction' : 'Your action'}>
            <div className="action-main">
              <div>
                <div className="label">{isPatient ? 'Your instruction' : 'Your action'}</div>
                <p className="my-action">{myAction(S, me, ACTION)}</p>
              </div>
              {next && (
                <Button kind="primary" size="xl" className="respond-btn" onClick={() => send('respond', { status: next[0] })}>
                  {next[1]}
                </Button>
              )}
            </div>
            {e.kind === 'sos' && isPatient && <SosCancel S={S} me={me} send={send} />}
            {!isPatient && (
              <div className="steps-row">
              <ol className="steps-line" aria-label="Your response so far">
                {RESPONSE_STEPS[e.kind].map((st, i) => {
                  const at = RESPONSE_STEPS[e.kind].indexOf(mine);
                  return (
                    <li key={st} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
                      {i <= at && <Icon name="check" />}
                      {ROSTER_WORD[st]}
                    </li>
                  );
                })}
              </ol>
              {prev && (
                <Button kind="quiet" icon="undo" className="undo-btn" onClick={() => send('respond', { status: prev })}>
                  Undo “{ROSTER_WORD[mine]}”
                </Button>
              )}
              </div>
            )}
            {isPatient && (
              <div className="facts">
                <div className="fact">
                  <div className="label">Who is coming</div>
                  <ul className="coming">
                    {responders.map(([p, s]) => (
                      <li key={p}>
                        <b>{NAMES[p]}</b>
                        <PlainTag strong={s !== 'alerted'} icon={s === 'on_scene' ? 'check_circle' : undefined}>
                          {ROSTER_WORD[s]}
                        </PlainTag>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="fact">
                  <div className="label">What the crew can see about you</div>
                  <p>
                    {e.kind === 'sos'
                      ? 'Emergency data only: your heart indicators and your location. Not your mood or stress check-ins or journal.'
                      : 'Emergency data only: heart indicators, the model result and your location. Not your mood check-ins or journal.'}
                  </p>
                </div>
              </div>
            )}
            {shared && isPatient && (
              <p className="small-line">
                <Icon name="lock" />
                <span>Emergency data only is shared. Access closes when the emergency ends, and every view is recorded.</span>
              </p>
            )}
            {e.kind === 'spe' && storm && (
              <p className="small-line">
                <Icon name="flare" />
                <span>
                {storm.doseSource === 'real' && !storm.detected
                  ? 'No increase above normal variation has been measured at this location yet.'
                  : `Extra dose from this storm so far: ${storm.extraDose} mSv (habitat estimate${storm.doseSource === 'simulated' ? ', simulated profile' : ''}).`}
                </span>
              </p>
            )}
          </section>

          {!isPatient && <Checklist e={e} S={S} send={send} onTreatment={() => setTreatment(true)} />}
        </Scroll>

        <Scroll>
          <section className="panel" aria-label="Crew status">
            <div className="panel-head">
              <h3>{e.patient ? `${who} and team` : 'Crew'}</h3>
              <span className="muted">{e.where}</span>
            </div>
            {S.crew.map((c) => {
              const st = e.roster[c.id];
              return (
                <div key={c.id} className="row row--roster" aria-current={c.id === me ? 'true' : undefined}>
                  <span>
                    <span className="row-title">
                      {c.name}
                      {c.id === me ? ' (you)' : ''}
                    </span>
                    <span className="row-sub">{c.role}</span>
                  </span>
                  <PlainTag strong={st !== 'alerted'} icon={st === 'on_scene' || st === 'in_shelter' ? 'check_circle' : undefined}>
                    {ROSTER_WORD[st] || st}
                  </PlainTag>
                </div>
              );
            })}
          </section>

          <EarthPanel S={S} e={e} />

          {canEnd(S, me) && (
            <section className="panel panel-pad stack" aria-label="End emergency">
              <div>
                <h3>End emergency</h3>
                <p className="muted">Only the {enderWord(S)} can end it, with a reason.</p>
              </div>
              <div>
                <Button onClick={() => setEnding(true)}>End emergency</Button>
              </div>
            </section>
          )}
        </Scroll>
      </div>

      {ending && <EndDialog e={e} onClose={() => setEnding(false)} send={send} />}
      {treatment && (
        <Dialog title="Detailed treatment" onClose={() => setTreatment(false)} closeWord="Close">
          <div>
            <PlainTag>Mock content</PlainTag>
          </div>
          <ol className="stack stack--tight treatment">
            {S.treatment_mock.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </Dialog>
      )}
    </>
  );
}

function Checklist({ e, S, send, onTreatment }: { e: Emergency; S: CrewState; send: Props['send']; onTreatment: () => void }) {
  const current = e.checklist.findIndex((s) => !s.result);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // A recorded step can be corrected: the server overwrites the result with the new one, who and when.
  const [editing, setEditing] = useState<number | null>(null);
  const total = e.checklist.length;
  return (
    <section className="panel" aria-label="First actions">
      <div className="panel-head">
        <h3>First actions</h3>
        <span className="muted">
          {current === -1 ? `All ${total} steps recorded` : `Step ${current + 1} of ${total}`}. Recorder: Maya, or whoever is free.
        </span>
      </div>
      <ol className="checklist">
        {e.checklist.map((s, i) => {
          const isNow = i === current;
          const draft = drafts[i] || '';
          return (
            <li key={i} className={`step${isNow ? ' is-now' : ''}${s.result ? ' is-done' : ''}`} aria-current={isNow ? 'step' : undefined}>
              <span className="step-n num">{s.result ? <Icon name="check" /> : i + 1}</span>
              <div className="step-body">
                <p className="step-text">
                  {s.step} {s.mock && <PlainTag>Mock content</PlainTag>}
                </p>
                <p className="step-role">
                  {s.role}
                  {isNow ? ', current step' : ''}
                </p>
                {s.result && editing !== i && (
                  <div className="step-result-row">
                    <p className="step-result">
                      Result: {s.result}. Recorded by {s.by} at {clock(s.at)}.
                    </p>
                    <Button
                      kind="quiet"
                      icon="edit"
                      onClick={() => {
                        setEditing(i);
                        setDrafts({ ...drafts, [i]: s.result === 'Done' ? '' : s.result || '' });
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}
                {s.result && editing === i && (
                  <div className="step-entry">
                    <input
                      className="input"
                      type="text"
                      data-autofocus
                      aria-label={`Corrected result for step ${i + 1}`}
                      placeholder={s.result_hint ? `Result: ${s.result_hint.toLowerCase()}` : 'Result (optional)'}
                      value={draft}
                      onChange={(ev) => setDrafts({ ...drafts, [i]: ev.target.value })}
                    />
                    <Button
                      kind="primary"
                      onClick={() => {
                        send('record_step', { index: i, result: draft.trim() || 'Done' });
                        setDrafts({ ...drafts, [i]: '' });
                        setEditing(null);
                      }}
                    >
                      Save correction
                    </Button>
                    <Button onClick={() => setEditing(null)}>Keep as it was</Button>
                  </div>
                )}
                {isNow && (
                  <div className="step-entry">
                    <input
                      className="input"
                      type="text"
                      aria-label={`Result for step ${i + 1}`}
                      placeholder={s.result_hint ? `Result: ${s.result_hint.toLowerCase()}` : 'Result (optional)'}
                      value={draft}
                      onChange={(ev) => setDrafts({ ...drafts, [i]: ev.target.value })}
                    />
                    <Button
                      kind="primary"
                      onClick={() => {
                        send('record_step', { index: i, result: draft.trim() || 'Done' });
                        setDrafts({ ...drafts, [i]: '' });
                      }}
                    >
                      {draft.trim() ? 'Record result' : 'Record as done'}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="checklist-end">
        <span className="muted">End of checklist</span>
        {e.kind === 'heart' && (
          <Button kind="quiet" icon="medical_services" onClick={onTreatment} aria-haspopup="dialog">
            Detailed treatment
          </Button>
        )}
      </div>
      <span className="sr-only">{S.treatment_mock.length} lines of detailed treatment are one tap away.</span>
    </section>
  );
}

/** The report to Earth, drawn as a signal in flight. Earth adds to the response; nobody waits for it. */
export function EarthPanel({ S, e }: { S: CrewState; e: Emergency }) {
  useTick(250);
  const rep = e.report;
  const now = serverNow();
  const oneWay = Math.max(0.001, S.one_way_s);
  const out = rep.sent_at ? Math.min(1, Math.max(0, (now - rep.sent_at) / oneWay)) : 0;
  const back = rep.sent_at ? Math.min(1, Math.max(0, (now - rep.sent_at - oneWay) / oneWay)) : 0;
  const untilReply = rep.earliest_reply_at ? rep.earliest_reply_at - now : null;
  const arrived = out >= 1;
  return (
    <section className="panel panel-pad stack earth" aria-label="Earth">
      <div className="spread">
        <h3>Earth</h3>
        <PlainTag icon="satellite_alt">{DELAY_TEXT[S.mode]}</PlainTag>
      </div>
      <div className="link" aria-hidden="true">
        <div className="link-track">
          <i className="link-fill" style={{ width: `${out * 100}%` }} />
          {rep.sent_at && !arrived && <i className="link-pulse" style={{ left: `${out * 100}%` }} />}
          {arrived && back < 1 && <i className="link-pulse link-pulse--reply" style={{ left: `${(1 - back) * 100}%` }} />}
        </div>
        <div className="link-ends">
          <span>
            <Icon name="home_health" />
            {MODE_PLACE[S.mode]}
          </span>
          <span>
            Earth
            <Icon name="public" />
          </span>
        </div>
      </div>
      {rep.status === 'queued' ? (
        <p>
          <b>Queued</b> at <span className="num">{clock(rep.queued_at)}</span>. It sends by itself when the link is up.
        </p>
      ) : (
        <div className="earth-lines">
          <p>
            <b>Sent</b> at <span className="num">{clock(rep.sent_at)}</span>, without anyone composing it.
            {!arrived ? ` Reaches Earth in ${duration(oneWay * (1 - out))}.` : ' It has reached Earth.'}
          </p>
          <p>
            Earliest possible reply: <b className="num">{clock(rep.earliest_reply_at)}</b>{' '}
            <span className="muted">
              ({untilReply != null && untilReply > 0 ? `in ${duration(untilReply)}` : 'a reply could arrive now'})
            </span>
          </p>
        </div>
      )}
      <p className="continue">Continue without waiting.</p>
    </section>
  );
}

function EndDialog({ e, onClose, send }: { e: Emergency; onClose: () => void; send: Props['send'] }) {
  const who = e.patient ? NAMES[e.patient] : 'the whole crew';
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('not_known');
  const ready = reason.trim().length > 0;
  return (
    <Dialog title={`End the emergency for ${who}?`} onClose={onClose}>
      <div className="stack stack--tight">
        <p>
          {e.what}, {e.where}, declared {clock(e.declared_at)}.
        </p>
        <p className="muted">
          Ending returns every tablet to its normal view{e.patient ? ` and closes the crew's access to ${who}'s data` : ''}.
        </p>
      </div>
      <div className="field">
        <label htmlFor="end-reason">Reason</label>
        <input
          id="end-reason"
          className="input"
          type="text"
          data-autofocus
          placeholder="For example: patient stable, monitoring continues"
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
        />
        <ReasonChips
          options={e.kind === 'sos' ? SOS_END_REASONS : END_REASONS.filter((r) => (e.kind === 'spe' ? r.startsWith('Storm') : !r.startsWith('Storm')))}
          value={reason}
          onPick={(r) => {
            setReason(r);
            if (e.kind === 'sos' && r === 'SOS pressed by mistake') setOutcome('false_alarm');
          }}
        />
      </div>
      {e.kind !== 'spe' && (
        <div className="field">
          <span className="label" id="end-outcome">
            Outcome
          </span>
          <Seg
            label="Outcome"
            block
            tall
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: 'not_known', label: `${OUTCOME_WORD.not_known} (set later)` },
              { value: 'confirmed', label: OUTCOME_WORD.confirmed },
              { value: 'false_alarm', label: OUTCOME_WORD.false_alarm },
            ]}
          />
        </div>
      )}
      {!ready && <p className="muted">Give a reason before ending the emergency.</p>}
      {/* The two outcomes sit well apart; the safe choice is on the right (style guide SG-43 and SG-64). */}
      <div className="btn-row btn-row--apart end-actions">
        <Button
          size="xl"
          disabled={!ready}
          onClick={() => {
            send('stand_down', { reason: reason.trim(), outcome: e.kind !== 'spe' ? outcome : 'ended' });
            onClose();
          }}
        >
          End emergency for {who}
        </Button>
        <Button size="xl" onClick={onClose}>
          Keep active
        </Button>
      </div>
    </Dialog>
  );
}

/** The person who pressed SOS can cancel it as a mistake for the first few seconds. It is ended as a
 *  false alarm with their name, so the record still shows that it happened. */
function SosCancel({ S, me, send }: { S: CrewState; me: PersonId; send: Props['send'] }) {
  useTick(250);
  const left = sosCancelLeft(S, me, serverNow(), SOS_CANCEL_S);
  if (left <= 0) {
    return canEnd(S, me) ? null : (
      <p className="small-line">
        <Icon name="info" />
        <span>If this was a mistake, tell the {enderWord(S)}, who can end it with a reason.</span>
      </p>
    );
  }
  return (
    <div className="sos-cancel">
      <Button
        size="xl"
        icon="undo"
        onClick={() =>
          send('stand_down', { reason: `SOS pressed by mistake, cancelled by ${NAMES[me]}`, outcome: 'false_alarm' })
        }
      >
        Cancel SOS: pressed by mistake
      </Button>
      <span className="muted">
        <span className="num">{Math.ceil(left)}</span> {Math.ceil(left) === 1 ? 'second' : 'seconds'} left to cancel. It is recorded as a false alarm.
      </span>
    </div>
  );
}

/** Asked once before an SOS goes to the whole crew. The safe choice is on the right, well apart. */
export function SosDialog({ me, where, onClose, onSend }: { me: PersonId; where: string; onClose: () => void; onSend: () => void }) {
  return (
    <Dialog title="Send SOS to the whole crew?" onClose={onClose} small>
      <p>
        Every tablet shows an emergency with your name ({NAMES[me]}) and location{where ? ` (${where})` : ''}, and a report goes to Earth
        automatically.
      </p>
      <p className="muted">
        Pressed by mistake? You can cancel it in the first {SOS_CANCEL_S} seconds.
      </p>
      <div className="btn-row btn-row--apart end-actions">
        <Button kind="danger" size="xl" icon="sos" onClick={onSend}>
          Send SOS
        </Button>
        <Button size="xl" data-autofocus onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
