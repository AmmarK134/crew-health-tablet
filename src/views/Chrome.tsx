// The parts that stay on screen in every view: the status bar, the strips under it, and the dock.

import type { CrewState, PersonId, Radiation } from '../api';
import { ACTION, DELAY_LABEL, DELAY_SHORT, MODE_NAME, NAMES, TABLET_ROLE } from '../content';
import { clock, clockSeconds, duration } from '../format';
import { Icon, type IconName } from '../icons';
import { alertCounts, myAction, type AlertClass } from '../logic';
import { dismissError, lastHeardAt, serverNow, useTick, type LinkState } from '../store';
import { Button, ClassIcon } from '../ui';

export type ViewId = 'emergency' | 'crew' | 'health' | 'checkins' | 'radiation' | 'sharing';

function Clock() {
  useTick(500);
  return <span className="sb-value num">{clockSeconds(serverNow())}</span>;
}

function EarthCell({ S }: { S: CrewState }) {
  useTick(1000);
  const rep = S.emergency?.report;
  let label: string = DELAY_LABEL[S.mode];
  let value: string = DELAY_SHORT[S.mode];
  if (rep && rep.status === 'queued') {
    label = 'Report to Earth';
    value = 'Queued';
  } else if (rep && rep.earliest_reply_at) {
    const left = rep.earliest_reply_at - serverNow();
    label = left > 0 ? 'Earliest Earth reply' : 'Report to Earth';
    value = left > 0 ? `In ${duration(left)}` : 'Reply could arrive';
  }
  return (
    <span className="sb-cell">
      <span className="sb-label">{label}</span>
      <span className="sb-value">{value}</span>
    </span>
  );
}

const LAMPS: { cls: AlertClass; word: string }[] = [
  { cls: 'emergency', word: 'Emergency' },
  { cls: 'caution', word: 'Caution' },
  { cls: 'advisory', word: 'Advisory' },
];

interface StatusBarProps {
  S: CrewState;
  rad: Radiation | null;
  me: PersonId;
  onLamp: (cls: AlertClass) => void;
  onEarth: () => void;
  onDemo: () => void;
}

export function StatusBar({ S, rad, me, onLamp, onEarth, onDemo }: StatusBarProps) {
  const counts = alertCounts(S, rad, me);
  return (
    <header className="statusbar">
      <div className="sb-brand">
        <svg className="sb-mark" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M2 15h5l2.5-7 4.5 13 3-9 1.5 3H26" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sb-name">Crew Health</span>
        <span className="tag tag--plain">Demo data</span>
      </div>
      <div className="sb-cell sb-cell--day">
        <span className="sb-label">
          {MODE_NAME[S.mode]}, mission day {S.mission_day}
        </span>
        <Clock />
      </div>
      <div className="sb-space" />
      <div className="sb-alerts" role="group" aria-label="Active alerts">
        {LAMPS.map(({ cls, word }) => (
          <button
            key={cls}
            type="button"
            className={`lamp lamp--${cls}${counts[cls] ? ' is-on' : ''}`}
            onClick={() => onLamp(cls)}
          >
            <ClassIcon cls={cls} />
            <span className="lamp-word">{word}</span>
            <span className="num">{counts[cls]}</span>
            <span className="sr-only"> active</span>
          </button>
        ))}
      </div>
      <button type="button" className="sb-button" onClick={onEarth} aria-haspopup="dialog">
        <Icon name="satellite_alt" />
        <EarthCell S={S} />
      </button>
      <button type="button" className="sb-button sb-button--framed" onClick={onDemo} aria-haspopup="dialog">
        <Icon name="tablet" />
        <span className="sb-cell">
          <span className="sb-label">Demo tablet</span>
          <span className="sb-value">{NAMES[me]}</span>
        </span>
        <Icon name="tune" />
        <span className="sr-only">Open demo controls</span>
      </button>
    </header>
  );
}

// ------------------------------------------------------------------ strips

interface StripsProps {
  S: CrewState;
  me: PersonId;
  view: ViewId;
  link: LinkState;
  actionError: string | null;
  onEmergency: () => void;
}

export function Strips({ S, me, view, link, actionError, onEmergency }: StripsProps) {
  const e = S.emergency;
  return (
    <div className="strips">
      {link === 'lost' && (
        <div className="strip strip--lost" role="status">
          <Icon name="schedule" />
          <span className="strip-text">
            Stale: this tablet cannot reach the habitat server. Showing the last data received, from{' '}
            <span className="num">{clockSeconds(lastHeardAt() / 1000)}</span> on this tablet's clock.
          </span>
        </div>
      )}
      {actionError && (
        <div className="strip strip--error" role="alert">
          <Icon name="sync_problem" />
          <span className="strip-text">{actionError}</span>
          <Button kind="quiet" onClick={dismissError}>
            Dismiss
          </Button>
        </div>
      )}
      {e && view !== 'emergency' && (
        <div className="strip strip--emergency" role="alert">
          <Icon name="report" size={28} />
          <span className="strip-text">
            Emergency: {e.what}. {myAction(S, me, ACTION)}
          </span>
          <Button kind="on-alert" onClick={onEmergency}>
            Back to emergency
          </Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ dock

interface DockProps {
  S: CrewState;
  me: PersonId;
  view: ViewId;
  reviewCount: number;
  onGo: (v: ViewId) => void;
  onGetDoctor: () => void;
}

export function Dock({ S, me, view, reviewCount, onGo, onGetDoctor }: DockProps) {
  const items: { id: ViewId; label: string; icon: IconName; emergency?: boolean; count?: number }[] = [];
  if (S.emergency) items.push({ id: 'emergency', label: 'Emergency', icon: 'report', emergency: true });
  if (me === 'sam') items.push({ id: 'crew', label: 'Crew overview', icon: 'groups', count: reviewCount });
  items.push(
    { id: 'health', label: 'My health', icon: 'monitor_heart' },
    { id: 'checkins', label: 'Check-ins', icon: 'task_alt' },
    { id: 'radiation', label: 'Radiation', icon: 'flare' },
    { id: 'sharing', label: 'My data sharing', icon: 'shield_lock' },
  );
  const asked = S.doctor_woken && S.doctor_woken.by === me ? S.doctor_woken : null;
  return (
    <nav className="dock" aria-label="Views">
      <div className="dock-items">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`dock-item${it.emergency ? ' dock-item--emergency' : ''}`}
            aria-current={view === it.id ? 'page' : undefined}
            onClick={() => onGo(it.id)}
          >
            <Icon name={it.icon} />
            <span>{it.label}</span>
            {!!it.count && (
              <span className="dock-count" aria-label={`${it.count} to review`}>
                {it.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {me !== 'sam' && (
        <>
          <div className="dock-guard" aria-hidden="true" />
          <button type="button" className="btn btn--xl btn--doctor" onClick={onGetDoctor}>
            <Icon name={asked ? 'check_circle' : 'stethoscope'} />
            <span className="doctor-text">
              <span>Get crew doctor</span>
              {asked && <span className="doctor-note">Sam was told at {clock(asked.at)}</span>}
            </span>
          </button>
        </>
      )}
    </nav>
  );
}

export const tabletLine = (me: PersonId) => `${NAMES[me]}, ${TABLET_ROLE[me].toLowerCase()}`;
