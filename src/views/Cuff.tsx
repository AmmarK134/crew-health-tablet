// The watch: a small display on the wrist that carries what must reach a person wherever they are, and
// anything that takes one or two taps. The tablet stays the main device: everything shown here is also on
// the tablet (project rule "Tablet first").
//
// Screens, swiped left and right (or the arrows under the screen, or the arrow keys):
//   Alert       only while an alert is open for this person; it opens by itself and the watch vibrates
//   Home        how am I, and Get crew doctor (Sam: who needs the crew doctor)
//   Vitals      heart rate, blood pressure, sleep and temperature against the person's own usual range
//   SOS         hold for 3 seconds to send, then a few seconds to cancel a mistake
//   Check-ins   today's four entries, one tap each
//   Space       career radiation dose and the Earth link

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { CrewState, Indicator, PersonId, Radiation } from '../api';
import {
  ACTION,
  AFTER_YES,
  CHECK_QUESTION,
  DELAY_LABEL,
  DELAY_SHORT,
  HEART_STAGE_TEXT,
  MISSING,
  NAMES,
  QUICK,
  ROSTER_WORD,
  SOS_CANCEL_S,
  nextResponse,
  previousResponse,
} from '../content';
import { clock, clockSeconds, dose, duration } from '../format';
import { Icon, type IconName } from '../icons';
import { heartOnFor, myAction, myStatus, sosCancelLeft, speOn } from '../logic';
import { CHECKIN_DEFS, cautionFor, checkinsDone, checkinsFor, indicatorsFor } from '../measures';
import { rangeInfo } from '../range';
import { playSound, stopSound, usePageVisible, vibrate } from '../sound';
import { act, applyDisplay, initialPerson, initialSize, initialTheme, serverNow, startPolling, useShared, useTick } from '../store';
import { ClassTag } from '../ui';

type Send = (type: string, extra?: Record<string, unknown>) => void;
type ScreenId = 'alert' | 'home' | 'vitals' | 'sos' | 'checkins' | 'space';

const SCREEN_NAME: Record<ScreenId, string> = {
  alert: 'Alert',
  home: 'Home',
  vitals: 'Vitals',
  sos: 'SOS',
  checkins: 'Check-ins',
  space: 'Radiation and Earth',
};
const SCREEN_ICON: Record<ScreenId, IconName> = {
  alert: 'report',
  home: 'home_health',
  vitals: 'monitor_heart',
  sos: 'sos',
  checkins: 'task_alt',
  space: 'flare',
};

const HOLD_MS = 3000;

function Time() {
  useTick(500);
  return <span className="num">{clockSeconds(serverNow())}</span>;
}

function Seconds({ end }: { end: number }) {
  useTick(100);
  const left = Math.max(0, Math.ceil(end - serverNow()));
  return (
    <span className="cuff-count">
      <span className="num">{left}</span> {left === 1 ? 'second' : 'seconds'}
    </span>
  );
}

/** Something on this watch that should vibrate and open by itself. Empty when nothing is open. */
function alertKey(S: CrewState, me: PersonId): string {
  if (S.emergency) return `e${S.emergency.id}`;
  if (heartOnFor(S, me)) return `h${S.heart!.id}${S.heart!.stage}${S.heart!.quick_check ? 'a' : ''}`;
  if (S.spe_caution) return `s${S.spe_caution.at}`;
  if (me === 'sam' && S.doctor_woken && S.doctor_woken.by !== 'sam') return `d${S.doctor_woken.at}`;
  return '';
}

export function Cuff() {
  const { S, rad, link } = useShared();
  const me = initialPerson();
  const [buzz, setBuzz] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('home');
  const seen = useRef('');
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    startPolling();
    applyDisplay(initialTheme(), initialSize());
  }, []);

  const key = S ? alertKey(S, me) : '';
  useEffect(() => {
    if (key && key !== seen.current) {
      setBuzz(true);
      vibrate([200, 100, 200]);
      setScreen('alert');
      const t = window.setTimeout(() => setBuzz(false), 900);
      seen.current = key;
      return () => window.clearTimeout(t);
    }
    seen.current = key;
  }, [key]);

  const alertCls = S && S.emergency ? 'emergency' : 'caution';
  const screens: ScreenId[] = [...(key ? (['alert'] as ScreenId[]) : []), 'home', 'vitals', 'sos', 'checkins', 'space'];
  const current: ScreenId = screens.includes(screen) ? screen : 'home';
  const at = screens.indexOf(current);
  const go = (step: number) => setScreen(screens[(at + step + screens.length) % screens.length]);

  // Lena's alarm: while the heart check-in waits for her answer and her watch is on screen showing the alert.
  // It stops when she answers, when the watch tab is left (another tab, another page) or when she swipes away
  // from the alert, and starts again when she comes back. At most 3 plays, 4 seconds apart, each time.
  const visible = usePageVisible();
  const asking = !!S && me === 'lena' && heartOnFor(S, me) && S.heart!.stage === 'caution' && !S.heart!.quick_check;
  const ringing = asking && visible && current === 'alert' ? S!.heart!.id : null;
  useEffect(() => {
    if (ringing == null) return;
    playSound('lena', { times: 3, gap: 4000, onEach: () => vibrate([400, 200, 400, 200, 400]) });
    return () => stopSound('lena');
  }, [ringing]);

  // Sam's warning: once, the first time his watch is on screen while he is alerted. No repeats.
  const samDone = useRef(false);
  const samAlerted = !!S && me === 'sam' && !!S.doctor_woken && S.doctor_woken.by !== 'sam';
  useEffect(() => {
    if (samAlerted && visible && !samDone.current) {
      samDone.current = true;
      playSound('sam', { maxWait: 10000, onEach: () => vibrate([300, 150, 300]) });
    }
    if (!visible) stopSound('sam');
  }, [samAlerted, visible]);

  const send: Send = (type, extra) => void act(type, me, extra);

  const onDown = (e: ReactPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
  };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  return (
    <div className="cuff-page">
      <div className={`cuff${buzz ? ' is-buzzing' : ''}`}>
        <div className="cuff-strap" aria-hidden="true" />
        <div className="cuff-screen" onPointerDown={onDown} onPointerUp={onUp} onKeyDown={onKey}>
          <div className="cuff-top">
            <span>
              {NAMES[me]} · {SCREEN_NAME[current]}
            </span>
            <Time />
          </div>
          {!S ? (
            <div className="cuff-body">
              <p className="cuff-title">{link === 'lost' ? 'No link to the habitat server' : 'Connecting'}</p>
            </div>
          ) : (
            <div className="cuff-pane" key={current} aria-live={current === 'alert' ? 'assertive' : 'polite'}>
              {current === 'alert' && <AlertScreen S={S} me={me} send={send} />}
              {current === 'home' && <HomeScreen S={S} me={me} send={send} />}
              {current === 'vitals' && <VitalsScreen S={S} me={me} />}
              {current === 'sos' && <SosScreen S={S} me={me} send={send} />}
              {current === 'checkins' && <CheckinScreen S={S} me={me} send={send} />}
              {current === 'space' && <SpaceScreen S={S} rad={rad} />}
            </div>
          )}
          <nav className="cuff-nav" aria-label="Watch screens">
            <button type="button" className="cuff-arrow" onClick={() => go(-1)}>
              <Icon name="chevron_left" />
              <span className="sr-only">Previous screen</span>
            </button>
            <div className="cuff-dots">
              {screens.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`cuff-dot${s === 'alert' ? ` cuff-dot--${alertCls}` : ''}`}
                  aria-current={s === current ? 'true' : undefined}
                  onClick={() => setScreen(s)}
                >
                  <Icon name={SCREEN_ICON[s]} />
                  <span className="sr-only">{SCREEN_NAME[s]}</span>
                </button>
              ))}
            </div>
            <button type="button" className="cuff-arrow" onClick={() => go(1)}>
              <Icon name="chevron_right" />
              <span className="sr-only">Next screen</span>
            </button>
          </nav>
        </div>
        <div className="cuff-strap" aria-hidden="true" />
      </div>
      <p className="cuff-note">
        {buzz ? 'Vibrating on the wrist. ' : ''}
        Watch concept: swipe, or use the arrows, to change screens. Everything here is also on the tablet, which stays the main device.
      </p>
      <a className="btn btn--quiet" href={`?as=${me}`}>
        <Icon name="tablet" />
        <span>Open {NAMES[me]}'s tablet</span>
      </a>
    </div>
  );
}

// ------------------------------------------------------------------ alert

function AlertScreen({ S, me, send }: { S: CrewState; me: PersonId; send: Send }) {
  const e = S.emergency;
  if (e) {
    const isPatient = e.patient === me;
    const mine = e.roster[me];
    const next = isPatient ? null : nextResponse(e.kind, mine);
    const prev = isPatient ? null : previousResponse(e.kind, mine);
    return (
      <div className="cuff-body cuff-body--emergency" role="alert">
        <ClassTag cls="emergency" />
        <p className="cuff-title">{myAction(S, me, ACTION)}</p>
        {next ? (
          <button type="button" className="cuff-btn cuff-btn--primary" onClick={() => send('respond', { status: next[0] })}>
            {next[1]}
          </button>
        ) : (
          <p className="cuff-sub">{isPatient ? `${e.what}. The crew has been alerted.` : `You: ${ROSTER_WORD[mine]}. Details on your tablet.`}</p>
        )}
        {prev && (
          <button type="button" className="cuff-link" onClick={() => send('respond', { status: prev })}>
            <Icon name="undo" />
            Undo “{ROSTER_WORD[mine]}”
          </button>
        )}
        {e.kind === 'sos' && isPatient && <CancelSos S={S} me={me} send={send} />}
      </div>
    );
  }
  if (heartOnFor(S, me)) {
    const h = S.heart!;
    const c = cautionFor(S, me);
    if (h.stage === 'caution' && !h.quick_check) {
      return (
        <div className="cuff-body" role="alert">
          <ClassTag cls="caution" />
          <p className="cuff-title">{(c && c.checkIn.question) || CHECK_QUESTION}</p>
          <div className="cuff-row">
            {QUICK.map((q) => (
              <button key={q.answer} type="button" className="cuff-btn" onClick={() => send('quick_check', { answer: q.answer })}>
                {q.word}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (h.stage === 'countdown' && h.countdown_end) {
      return (
        <div className="cuff-body" role="alert">
          <ClassTag cls="caution" />
          <p className="cuff-title">
            <Seconds end={h.countdown_end} /> until the whole crew is alerted
          </p>
          <button type="button" className="cuff-btn" onClick={() => send('stop_countdown')}>
            Stop: wake only the crew doctor
          </button>
        </div>
      );
    }
    return (
      <div className="cuff-body">
        <ClassTag cls="caution" />
        <p className="cuff-title">Possible heart problem</p>
        <p className="cuff-sub">
          {h.quick_check === 'yes' ? (c && c.checkIn.afterYes) || AFTER_YES : HEART_STAGE_TEXT[h.stage] || ''}{' '}
          {h.seen_at ? `Sam saw it at ${clock(h.seen_at)}.` : ''}
        </p>
      </div>
    );
  }
  if (S.spe_caution) {
    return (
      <div className="cuff-body" role="alert">
        <ClassTag cls="caution" />
        <p className="cuff-title">Solar particle event: follow ground instructions</p>
        <button type="button" className="cuff-btn" onClick={() => send('spe_end')}>
          Acknowledge: alert over
        </button>
      </div>
    );
  }
  if (me === 'sam' && S.doctor_woken) {
    return (
      <div className="cuff-body" role="alert">
        <ClassTag cls="caution" />
        <p className="cuff-title">{NAMES[S.doctor_woken.by] || S.doctor_woken.by} needs you</p>
        <p className="cuff-sub">
          {S.doctor_woken.why}. Alerted at {clock(S.doctor_woken.at)}. Open the Crew overview on your tablet.
        </p>
      </div>
    );
  }
  return <HomeScreen S={S} me={me} send={send} />;
}

function CancelSos({ S, me, send }: { S: CrewState; me: PersonId; send: Send }) {
  useTick(250);
  const left = sosCancelLeft(S, me, serverNow(), SOS_CANCEL_S);
  if (left <= 0) return null;
  return (
    <button
      type="button"
      className="cuff-btn"
      onClick={() => send('stand_down', { reason: `SOS pressed by mistake, cancelled by ${NAMES[me]}`, outcome: 'false_alarm' })}
    >
      <Icon name="undo" />
      Cancel SOS ({Math.ceil(left)} s)
    </button>
  );
}

// ------------------------------------------------------------------ home

function HomeScreen({ S, me, send }: { S: CrewState; me: PersonId; send: Send }) {
  const inds = indicatorsFor(S, me);
  const status = myStatus(S, me, inds);
  const hr = inds.find((i) => i.key === 'hr');
  const done = checkinsDone(S, me);
  const asked = S.doctor_woken && S.doctor_woken.by === me;
  if (me === 'sam') {
    const review = S.advisories.filter((a) => !a.dismissed).length + S.closed.filter((c) => c.outcome === 'not_known').length;
    const needs = S.doctor_woken && S.doctor_woken.by !== 'sam' ? S.doctor_woken : null;
    return (
      <div className="cuff-body">
        <p className="cuff-title">
          <Icon name={needs ? 'warning' : 'check'} />
          {needs ? `${NAMES[needs.by] || needs.by} needs you` : 'Nobody has asked for you'}
        </p>
        <p className="cuff-sub">
          {review ? `${review} to review on your tablet, quietly. ` : 'Nothing to review. '}
          {status.kind === 'ok' ? 'Your own readings: within your usual ranges.' : status.title + '.'}
        </p>
      </div>
    );
  }
  return (
    <div className="cuff-body">
      <p className="cuff-title">
        <Icon name={status.kind === 'ok' ? (status.outside ? (status.outside === 'above' ? 'arrow_upward' : 'arrow_downward') : 'check') : status.kind === 'missing' ? 'sensors_off' : 'warning'} />
        {status.title}
      </p>
      <p className="cuff-sub">
        {hr && hr.state !== 'missing' ? `Resting heart rate ${hr.value} ${hr.unit}. ` : 'Heart rate: no current reading. '}
        Check-ins {done} of {CHECKIN_DEFS.length} done.
      </p>
      <button type="button" className="cuff-btn" onClick={() => send('get_doctor')}>
        <Icon name={asked ? 'check_circle' : 'stethoscope'} />
        {asked ? `Crew doctor told at ${clock(S.doctor_woken!.at)}` : 'Get crew doctor'}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ vitals

const VITALS: { key: string; short: string }[] = [
  { key: 'hr', short: 'Heart rate' },
  { key: 'bp', short: 'Blood pressure' },
  { key: 'sleep', short: 'Sleep' },
  { key: 'temp', short: 'Temperature' },
];

function VitalPill({ ind }: { ind: Indicator }) {
  if (ind.state === 'missing') {
    const m = MISSING[ind.missing || 'sensor_off'];
    return (
      <span className="cuff-pill cuff-pill--state">
        <Icon name={m.icon} />
        {m.word}
      </span>
    );
  }
  const r = rangeInfo(ind);
  if (!r) return null;
  if (r.side === 'within') {
    return (
      <span className="cuff-pill cuff-pill--within">
        <Icon name="check" />
        Usual
      </span>
    );
  }
  return (
    <span className="cuff-pill cuff-pill--outside">
      <Icon name={r.side === 'above' ? 'arrow_upward' : 'arrow_downward'} />
      {r.side === 'above' ? 'Above' : 'Below'}
    </span>
  );
}

function VitalsScreen({ S, me }: { S: CrewState; me: PersonId }) {
  const inds = indicatorsFor(S, me);
  return (
    <div className="cuff-body cuff-body--list">
      <ul className="cuff-list" aria-label="Vitals against your usual range">
        {VITALS.map((v) => {
          const ind = inds.find((i) => i.key === v.key);
          if (!ind) return null;
          const miss = ind.state === 'missing';
          return (
            <li key={v.key} className="cuff-vital">
              <span className="cuff-vital-name">{v.short}</span>
              <span className="cuff-vital-value">
                {miss ? (
                  <span className="cuff-dim">--</span>
                ) : (
                  <>
                    <span className="num">{ind.value}</span> <span className="cuff-unit">{ind.unit}</span>
                  </>
                )}
              </span>
              <VitalPill ind={ind} />
            </li>
          );
        })}
      </ul>
      <p className="cuff-foot">Against your own usual range in flight. Demo data.</p>
    </div>
  );
}

// ------------------------------------------------------------------ SOS

function SosScreen({ S, me, send }: { S: CrewState; me: PersonId; send: Send }) {
  const e = S.emergency;
  if (e) {
    const mine = e.kind === 'sos' && e.patient === me;
    return (
      <div className={`cuff-body${mine ? ' cuff-body--emergency' : ''}`}>
        <ClassTag cls="emergency" />
        <p className="cuff-title">{mine ? 'SOS sent. Help is coming.' : `Emergency in progress: ${e.what}`}</p>
        <p className="cuff-sub">{mine ? 'Stay where you are if you can.' : 'SOS is not needed while an emergency is open. See the Alert screen.'}</p>
        {mine && <CancelSos S={S} me={me} send={send} />}
      </div>
    );
  }
  return <HoldToSend onSend={() => send('sos')} />;
}

/** Hold for 3 seconds: a bump against a wall or a sleeve cannot send it. Letting go early cancels. */
function HoldToSend({ onSend }: { onSend: () => void }) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const sent = useRef(false);

  const stop = () => {
    start.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    if (!sent.current) setProgress(0);
  };
  const tick = () => {
    if (start.current == null) return;
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      sent.current = true;
      start.current = null;
      onSend();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (start.current != null || sent.current) return;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.max(0, Math.ceil((HOLD_MS / 1000) * (1 - progress)));
  return (
    <div className="cuff-body cuff-body--center">
      <button
        type="button"
        className="cuff-sos"
        style={{ ['--hold' as string]: `${progress * 360}deg` }}
        onPointerDown={(ev) => {
          ev.stopPropagation();
          begin();
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(ev) => {
          if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) {
            ev.preventDefault();
            begin();
          }
        }}
        onKeyUp={(ev) => {
          if (ev.key === ' ' || ev.key === 'Enter') stop();
        }}
        onContextMenu={(ev) => ev.preventDefault()}
        aria-describedby="cuff-sos-help"
      >
        <span className="cuff-sos-word">SOS</span>
        <span className="sr-only">: hold to send an emergency to the whole crew</span>
      </button>
      <p className="cuff-sub" id="cuff-sos-help" aria-live="polite">
        {progress > 0 ? `Keep holding: ${left} ${left === 1 ? 'second' : 'seconds'}` : 'Hold for 3 seconds to send SOS to the whole crew.'}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ check-ins

const SHORT: Record<string, string> = { hydration: 'Hydration', mood: 'Mood', stress: 'Stress', reactionTime: 'Reaction test' };
const CHECK_ICON: Record<string, IconName> = { hydration: 'water_drop', mood: 'mood', stress: 'psychology', reactionTime: 'timer' };

function CheckinScreen({ S, me, send }: { S: CrewState; me: PersonId; send: Send }) {
  const mine = checkinsFor(S, me);
  const done = checkinsDone(S, me);
  return (
    <div className="cuff-body cuff-body--list">
      <div className="cuff-grid">
        {CHECKIN_DEFS.map((d) => {
          const on = !!mine[d.id];
          return (
            <button
              key={d.id}
              type="button"
              className={`cuff-check${on ? ' is-on' : ''}`}
              aria-pressed={on}
              aria-disabled={on}
              onClick={() => !on && send('checkin', { id: d.id })}
            >
              <Icon name={on ? 'check_circle' : CHECK_ICON[d.id]} />
              <span>{SHORT[d.id]}</span>
              <small>{on ? 'Done' : 'Tap to enter'}</small>
            </button>
          );
        })}
      </div>
      <p className="cuff-foot">
        {done} of {CHECKIN_DEFS.length} done today. Mood and stress stay private to you.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ radiation and Earth

function SpaceScreen({ S, rad }: { S: CrewState; rad: Radiation | null }) {
  useTick(1000);
  const rep = S.emergency?.report;
  let earth = DELAY_SHORT[S.mode] as string;
  let earthLabel = DELAY_LABEL[S.mode] as string;
  if (rep && rep.status === 'queued') {
    earthLabel = 'Report to Earth';
    earth = 'Queued, sends by itself';
  } else if (rep && rep.earliest_reply_at) {
    const left = rep.earliest_reply_at - serverNow();
    earthLabel = 'Earliest Earth reply';
    earth = left > 0 ? `In ${duration(left)}` : 'Could arrive now';
  }
  const share = rad ? Math.min(1, rad.dose.soFar / rad.dose.limit) : 0;
  return (
    <div className="cuff-body cuff-body--list">
      {speOn(S) || S.spe_caution ? (
        <p className="cuff-title cuff-title--small">
          <Icon name="flare" />
          {speOn(S) ? 'Solar storm: go to the shelter' : 'Solar storm: follow ground instructions'}
        </p>
      ) : null}
      {rad ? (
        <div className="cuff-dose">
          <div className="spread">
            <span className="cuff-vital-name">Career dose</span>
            <span>
              <span className="num">{dose(rad.dose.soFar)}</span> <span className="cuff-unit">of {rad.dose.limit} mSv</span>
            </span>
          </div>
          <div className="cuff-bar" aria-hidden="true">
            <i style={{ width: `${share * 100}%` }} />
          </div>
          <span className="cuff-foot">
            Projected <span className="num">{dose(rad.dose.projectedTotal)}</span> mSv at mission end.
          </span>
        </div>
      ) : (
        <p className="cuff-sub">Loading the radiation dose.</p>
      )}
      <div className="cuff-earth">
        <Icon name="satellite_alt" />
        <span>
          <span className="cuff-vital-name">{earthLabel}</span>
          <span className="cuff-earth-value">{earth}</span>
        </span>
      </div>
    </div>
  );
}
