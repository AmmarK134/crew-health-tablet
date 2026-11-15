// Wrist cuff concept: a small display on the forearm that carries what must reach a person wherever
// they are, and anything that takes one or two taps. The tablet stays the main device: everything
// shown here is also on the tablet (project rule "Tablet first").

import { useEffect, useRef, useState } from 'react';
import type { CrewState, PersonId } from '../api';
import { ACTION, NAMES, QUICK, ROSTER_WORD, nextResponse } from '../content';
import { clockSeconds } from '../format';
import { Icon } from '../icons';
import { heartOnFor, myAction, myStatus } from '../logic';
import { act, applyDisplay, initialPerson, initialSize, initialTheme, serverNow, startPolling, useShared, useTick } from '../store';
import { ClassTag } from '../ui';

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

function alertKey(S: CrewState, me: PersonId): string {
  if (S.emergency) return `e${S.emergency.id}`;
  if (heartOnFor(S, me)) return `h${S.heart!.id}${S.heart!.stage}`;
  if (S.spe_caution) return `s${S.spe_caution.at}`;
  return '';
}

export function Cuff() {
  const { S, link } = useShared();
  const me = initialPerson();
  const [buzz, setBuzz] = useState(false);
  const seen = useRef('');
  useEffect(() => {
    startPolling();
    applyDisplay(initialTheme(), initialSize());
  }, []);
  const key = S ? alertKey(S, me) : '';
  useEffect(() => {
    if (key && key !== seen.current) {
      setBuzz(true);
      const t = window.setTimeout(() => setBuzz(false), 900);
      seen.current = key;
      return () => window.clearTimeout(t);
    }
    seen.current = key;
  }, [key]);

  const send = (type: string, extra?: Record<string, unknown>) => void act(type, me, extra);

  return (
    <div className="cuff-page">
      <div className={`cuff${buzz ? ' is-buzzing' : ''}`}>
        <div className="cuff-strap" aria-hidden="true" />
        <div className="cuff-screen">
          <div className="cuff-top">
            <span>{NAMES[me]}</span>
            <Time />
          </div>
          {!S ? (
            <div className="cuff-body">
              <p className="cuff-title">{link === 'lost' ? 'No link to the habitat server' : 'Connecting'}</p>
            </div>
          ) : (
            <CuffBody S={S} me={me} send={send} />
          )}
        </div>
        <div className="cuff-strap" aria-hidden="true" />
      </div>
      <p className="cuff-note">
        {buzz ? 'Vibrating on the wrist. ' : ''}
        Wrist cuff concept. Everything here is also on the tablet, which stays the main device.
      </p>
      <a className="btn btn--quiet" href={`?as=${me}`}>
        <Icon name="tablet" />
        <span>Open {NAMES[me]}'s tablet</span>
      </a>
    </div>
  );
}

function CuffBody({ S, me, send }: { S: CrewState; me: PersonId; send: (type: string, extra?: Record<string, unknown>) => void }) {
  const e = S.emergency;
  if (e) {
    const isPatient = e.patient === me;
    const mine = e.roster[me];
    const next = isPatient ? null : nextResponse(e.kind, mine);
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
      </div>
    );
  }
  if (heartOnFor(S, me)) {
    const h = S.heart!;
    if (h.stage === 'caution') {
      return (
        <div className="cuff-body" role="alert">
          <ClassTag cls="caution" />
          <p className="cuff-title">Chest discomfort, pressure or pain right now?</p>
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
          {h.stage === 'monitored' ? 'Monitored. Check again in 1 hour.' : 'The crew doctor is reviewing your result.'} Details on your tablet.
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
  const inds = S.indicators[me] || [];
  const status = myStatus(S, me, inds);
  const hr = inds.find((i) => i.key === 'hr');
  const done = S.checkin_defs.filter((d) => S.checkins[d.id]).length;
  const asked = S.doctor_woken && S.doctor_woken.by === me;
  return (
    <div className="cuff-body">
      <p className="cuff-title">
        <Icon name={status.kind === 'ok' ? 'check' : 'sensors_off'} />
        {status.title}
      </p>
      <p className="cuff-sub">
        {hr && hr.state !== 'missing' ? `Resting heart rate ${hr.value} ${hr.unit}. ` : 'Heart rate: sensor off. '}
        Check-ins {done} of {S.checkin_defs.length} done.
      </p>
      <button type="button" className="cuff-btn" onClick={() => send('get_doctor')} disabled={me === 'sam'}>
        <Icon name={asked ? 'check_circle' : 'stethoscope'} />
        {me === 'sam' ? 'You are the crew doctor' : asked ? 'Crew doctor told' : 'Get crew doctor'}
      </button>
    </div>
  );
}
