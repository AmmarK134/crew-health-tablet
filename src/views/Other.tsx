// Check-ins, My data sharing, and the two sheets (demo controls and the Earth link).

import { useEffect } from 'react';
import type { CrewState, Mode, PersonId, StormEvent } from '../api';
import { Ring } from '../charts';
import { DELAY_NOTE, DELAY_TEXT, MODE_NAME, NAMES, PEOPLE, TABLET_ROLE } from '../content';
import { clock, day } from '../format';
import { Icon } from '../icons';
import { loadStorms, type Size, type Theme } from '../store';
import { Button, ClassTag, PlainTag, Scroll, Seg, Sheet } from '../ui';

type Send = (type: string, extra?: Record<string, unknown>) => void;

// ------------------------------------------------------------------ check-ins

export function CheckIns({ S, send }: { S: CrewState; send: Send }) {
  const defs = S.checkin_defs;
  const done = defs.filter((d) => S.checkins[d.id]).length;
  const streak = done === defs.length ? S.streak + 1 : S.streak;
  return (
    <div className="view view--wide-left">
      <Scroll>
        <section className="panel" aria-label="Today's check-ins">
          <div className="panel-head">
            <h3>Today</h3>
            <span className="muted">Tap a check-in when you have done it</span>
          </div>
          {defs.map((d) => {
            const on = !!S.checkins[d.id];
            return (
              <button key={d.id} type="button" className="row row--check" aria-pressed={on} onClick={() => send('checkin', { id: d.id })}>
                <span className={`box${on ? ' is-on' : ''}`}>{on && <Icon name="check" />}</span>
                <span>
                  <span className="row-title">{d.label}</span>
                  <span className="row-sub">{on ? 'Done today' : d.sub.replace(' · ', ', ').replace(/\bmin\b/, 'minutes').replace(/\bs\b/, 'seconds')}</span>
                </span>
                <span className="row-state">{on ? 'Done' : 'To do'}</span>
              </button>
            );
          })}
        </section>
      </Scroll>
      <Scroll>
        <section className="panel panel-pad progress" aria-label="Progress">
          <Ring done={done} total={defs.length} />
          <div className="stack stack--tight">
            <p className="streak">
              <span className="num">{streak}</span> day check-in streak
            </p>
            <p className="muted">Credit is for completing check-ins, never for the results.</p>
            <p className="small-line">
              <Icon name="lock" /> Mood entries are private to you. The crew doctor sees that you checked in, never what you wrote.
            </p>
          </div>
        </section>
      </Scroll>
    </div>
  );
}

// ------------------------------------------------------------------ my data sharing

export function DataSharing({ S, me }: { S: CrewState; me: PersonId }) {
  const log = (S.access_log[me] || []).slice(0, 10);
  const e = S.emergency;
  const sharedNow = !!e && e.kind === 'heart' && e.patient === me;
  return (
    <div className="view view--even">
      <Scroll>
        <section className="panel panel-pad stack" aria-label="What is shared now">
          {sharedNow ? (
            <>
              <div className="rowline">
                <Icon name="share" size={32} />
                <h2>Shared with the whole crew now</h2>
              </div>
              <p className="detail-lead">Emergency data only, while the emergency is active.</p>
            </>
          ) : (
            <>
              <div className="rowline">
                <Icon name="shield_lock" size={32} />
                <h2>Nothing extra is shared now</h2>
              </div>
              <p className="detail-lead">Only you and the crew doctor see your indicators.</p>
            </>
          )}
          <div className="facts">
            <div className="fact">
              <div className="label">Shared in an emergency</div>
              <ul className="todo">
                <li>Heart indicators and the heart alert</li>
                <li>Your location</li>
                <li>Your response status</li>
              </ul>
            </div>
            <div className="fact">
              <div className="label">Never shared</div>
              <ul className="todo">
                <li>Mood check-ins</li>
                <li>Your journal</li>
              </ul>
            </div>
          </div>
          <p className="muted">Sharing ends when the emergency ends. Every view of your data is recorded here.</p>
        </section>

        {me === 'lena' && S.access_closed_notice && (
          <div className="alert alert--advisory">
            <div className="alert-head">
              <ClassTag cls="advisory" />
              <span className="alert-title">Crew access to your data closed at {clock(S.access_closed_notice.at)}</span>
            </div>
            <p className="small">
              Shared during the emergency: {S.access_closed_notice.data}, with {S.access_closed_notice.shared_with}. Your mood
              check-ins and journal were never shared.
            </p>
          </div>
        )}
      </Scroll>
      <Scroll>
        <section className="panel panel-pad stack" aria-label="Who has seen my data">
          <h3>Who has seen my data</h3>
          {log.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={i}>
                      <td className="num">{clock(l.at)}</td>
                      <td>{l.who}</td>
                      <td>{l.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nobody has viewed your data today.</p>
          )}
          <p className="small-line">
            <Icon name="lock" /> Your journal is never shown to anyone.
          </p>
        </section>
      </Scroll>
    </div>
  );
}

// ------------------------------------------------------------------ mission setting (shared by both sheets)

function MissionSetting({ S, send }: { S: CrewState; send: Send }) {
  return (
    <div className="sheet-section">
      <h3>Mission setting</h3>
      <Seg<Mode>
        label="Mission setting"
        block
        tall
        value={S.mode}
        onChange={(mode) => send('mode', { mode })}
        options={[
          { value: 'station', label: MODE_NAME.station },
          { value: 'moon', label: MODE_NAME.moon },
          { value: 'mars', label: MODE_NAME.mars },
        ]}
      />
      <p>
        Communications to Earth: {DELAY_TEXT[S.mode].toLowerCase()}. {DELAY_NOTE[S.mode]}
      </p>
    </div>
  );
}

export function EarthSheet({ S, send, onClose }: { S: CrewState; send: Send; onClose: () => void }) {
  const rep = S.emergency?.report;
  return (
    <Sheet title="Earth link" onClose={onClose}>
      <div className="sheet-section">
        <div className="rowline">
          <Icon name="satellite_alt" size={32} />
          <span className="hero-title">{DELAY_TEXT[S.mode]}</span>
        </div>
        <p>
          Earth adds to the crew's own response. Reports send by themselves, and nobody waits for a reply before acting.
        </p>
      </div>
      {rep && (
        <div className="sheet-section">
          <h3>Report to Earth</h3>
          <p>
            {rep.status === 'queued'
              ? `Queued at ${clock(rep.queued_at)}. It sends by itself when the link is up.`
              : `Sent at ${clock(rep.sent_at)}. Earliest possible reply ${clock(rep.earliest_reply_at)}. Continue without waiting.`}
          </p>
        </div>
      )}
      <MissionSetting S={S} send={send} />
    </Sheet>
  );
}

// ------------------------------------------------------------------ demo controls

interface DemoProps {
  S: CrewState;
  me: PersonId;
  storms: StormEvent[] | null;
  theme: Theme;
  size: Size;
  setMe: (p: PersonId) => void;
  setTheme: (t: Theme) => void;
  setSize: (s: Size) => void;
  send: Send;
  onClose: () => void;
}

export function DemoSheet({ S, me, storms, theme, size, setMe, setTheme, setSize, send, onClose }: DemoProps) {
  useEffect(() => {
    void loadStorms();
  }, []);
  const busy = !!S.heart || !!S.emergency;
  const run = (type: string, extra?: Record<string, unknown>) => {
    send(type, extra);
    onClose();
  };
  const years = Array.from(new Set((storms || []).map((s) => s.date.slice(0, 4))));
  return (
    <Sheet title="Demo controls" onClose={onClose}>
      <div className="sheet-section">
        <h3>Whose tablet this is</h3>
        <div className="people">
          {PEOPLE.map((p) => (
            <button
              key={p}
              type="button"
              className="person-pick"
              aria-pressed={p === me}
              onClick={() => {
                setMe(p);
                onClose();
              }}
            >
              <span className="row-title">{NAMES[p]}</span>
              <span className="row-sub">{TABLET_ROLE[p]}</span>
            </button>
          ))}
        </div>
        <p>Open this page in several windows, one per person, to see the tablets stay in step.</p>
      </div>

      <div className="sheet-section">
        <h3>Heart scenario</h3>
        <Button kind="primary" block left icon="ecg_heart" disabled={busy} onClick={() => run('demo_start_s2')}>
          Issue a low-confidence heart result for Lena
        </Button>
        <p>{busy ? 'A scenario is already running. Reset everything to start again.' : 'Lena sees a caution and the crew doctor a quiet advisory. Nobody else is told.'}</p>
      </div>

      <div className="sheet-section">
        <h3>Solar particle event</h3>
        <p>Replay a real storm from NASA's space weather database, or a simulated one. On the Moon or Mars the whole crew is alerted.</p>
        <Button block left icon="flare" onClick={() => run('spe_start', { event: 'demo' })}>
          Demo event (simulated)
        </Button>
        {storms === null && <p>Loading recorded storms.</p>}
        {storms && storms.length === 0 && <p>No recorded storms are cached on the habitat server.</p>}
        {years.map((y) => (
          <div key={y} className="storm-year">
            <span className="label num">{y}</span>
            <div className="chips">
              {(storms || [])
                .filter((s) => s.date.startsWith(y))
                .map((s) => (
                  <button key={s.id} type="button" className="chip" onClick={() => run('spe_start', { event: s.id })} title={s.instruments.join(', ')}>
                    {day(s.date).replace(` ${y}`, '')}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <MissionSetting S={S} send={send} />

      <div className="sheet-section">
        <h3>Display</h3>
        <Seg<Theme>
          label="Theme"
          block
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark', icon: 'dark_mode' },
            { value: 'light', label: 'Light', icon: 'light_mode' },
          ]}
        />
        <Seg<Size>
          label="Size of text and buttons"
          block
          value={size}
          onChange={setSize}
          options={[
            { value: 'standard', label: 'Standard size', icon: 'touch_app' },
            { value: 'large', label: 'Large size', icon: 'format_size' },
          ]}
        />
        <p>Large raises text and every button together, for gloves, vibration or tired eyes.</p>
      </div>

      <div className="sheet-section">
        <h3>More screens</h3>
        <a className="btn btn--secondary btn--block btn--left" href="?wall=1">
          <Icon name="grid_view" />
          <span>All four tablets side by side</span>
        </a>
        <a className="btn btn--secondary btn--block btn--left" href={`?device=cuff&as=${me}`}>
          <Icon name="watch" />
          <span>Wrist cuff concept for {NAMES[me]}</span>
        </a>
      </div>

      <div className="sheet-section">
        <h3>Start again</h3>
        <Button block left icon="restart_alt" onClick={() => run('reset')}>
          Reset everything
        </Button>
        <div>
          <PlainTag>Demo data</PlainTag>
        </div>
        <p>Every value is for a fictional crew. Treatment detail is mock content. This is not a medical device.</p>
      </div>
    </Sheet>
  );
}
