// One tablet. It shows the view its person has chosen, and switches to the emergency by itself.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PersonId } from './api';
import { heartOnFor, type AlertClass } from './logic';
import {
  act,
  applyDisplay,
  initialPerson,
  initialSize,
  initialTheme,
  params,
  startPolling,
  useShared,
  type Size,
  type Theme,
} from './store';
import { Dock, StatusBar, Strips, tabletLine, type ViewId } from './views/Chrome';
import { CrewOverview } from './views/Crew';
import { Cuff } from './views/Cuff';
import { EmergencyView } from './views/Emergency';
import { MyHealth, type Selection } from './views/MyHealth';
import { CheckIns, DataSharing, DemoSheet, EarthSheet } from './views/Other';
import { RadiationView } from './views/Radiation';
import { Wall } from './views/Wall';

const TITLES: Record<Exclude<ViewId, 'emergency'>, string> = {
  crew: 'Crew overview',
  health: 'My health',
  checkins: 'Check-ins',
  radiation: 'Radiation exposure',
  sharing: 'My data sharing',
};

const home = (p: PersonId): ViewId => (p === 'sam' ? 'crew' : 'health');

export default function App() {
  if (params.get('wall')) return <Wall />;
  if (params.get('device') === 'cuff') return <Cuff />;
  return <Tablet />;
}

function Tablet() {
  const { S, rad, storms, link, actionError } = useShared();
  const [me, setMeState] = useState<PersonId>(initialPerson);
  const [view, setView] = useState<ViewId>(() => home(initialPerson()));
  const [sel, setSel] = useState<Selection>({ kind: 'ind', key: '' });
  const [selPerson, setSelPerson] = useState<PersonId>('lena');
  const [sheet, setSheet] = useState<null | 'demo' | 'earth'>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [size, setSize] = useState<Size>(initialSize);
  const seenEmergency = useRef<number | null>(null);
  const seenHeart = useRef<number | null>(null);

  useEffect(() => startPolling(), []);
  useEffect(() => applyDisplay(theme, size), [theme, size]);

  // An emergency opens by itself, over whatever was open. A caution or an advisory never moves the person.
  const emergencyId = S?.emergency?.id ?? null;
  useEffect(() => {
    if (emergencyId !== null && seenEmergency.current !== emergencyId) {
      seenEmergency.current = emergencyId;
      setView('emergency');
      setSheet(null);
    } else if (emergencyId === null) {
      seenEmergency.current = null;
      setView((v) => (v === 'emergency' ? home(me) : v));
    }
  }, [emergencyId, me]);

  // When a result about this person arrives, the quick check is ready beside their indicators.
  const heartId = S && heartOnFor(S, me) ? S.heart!.id : null;
  useEffect(() => {
    if (heartId !== null && seenHeart.current !== heartId) {
      seenHeart.current = heartId;
      setSel({ kind: 'heart' });
    } else if (heartId === null) {
      seenHeart.current = null;
      setSel((s) => (s.kind === 'heart' ? { kind: 'ind', key: '' } : s));
    }
  }, [heartId]);

  const send = useCallback((type: string, extra?: Record<string, unknown>) => void act(type, me, extra), [me]);

  const setMe = useCallback((p: PersonId) => {
    setMeState(p);
    seenEmergency.current = null;
    seenHeart.current = null;
    setView(home(p));
    setSel({ kind: 'ind', key: '' });
    const next = new URLSearchParams(window.location.search);
    next.set('as', p);
    window.history.replaceState(null, '', `?${next.toString()}`);
  }, []);

  if (!S) {
    return (
      <div className="app">
        <div className="loading" style={{ gridRow: '1 / -1' }}>
          <p className="hero-title">{link === 'lost' ? 'No answer from the habitat server' : 'Connecting to the habitat server'}</p>
          <p className="muted">
            {link === 'lost'
              ? 'Start it with "python run.py" in the crew-tablet folder, then this screen fills in by itself.'
              : 'This takes a moment.'}
          </p>
        </div>
      </div>
    );
  }

  const onLamp = (cls: AlertClass) => {
    if (cls === 'emergency') {
      if (S.emergency) setView('emergency');
      return;
    }
    if (me === 'sam' && ((cls === 'caution' && S.doctor_woken) || (cls === 'advisory' && S.advisories.some((a) => !a.dismissed)))) {
      setView('crew');
      return;
    }
    setView('health');
    if (cls === 'caution' && heartOnFor(S, me)) setSel({ kind: 'heart' });
  };

  const reviewCount = S.advisories.filter((a) => !a.dismissed).length + S.closed.filter((c) => c.outcome === 'not_known').length;
  const shown: ViewId = view === 'emergency' && !S.emergency ? home(me) : view === 'crew' && me !== 'sam' ? 'health' : view;

  return (
    <div className="app" data-view={shown}>
      <StatusBar S={S} rad={rad} me={me} onLamp={onLamp} onEarth={() => setSheet('earth')} onDemo={() => setSheet('demo')} />
      <Strips S={S} me={me} view={shown} link={link} actionError={actionError} onEmergency={() => setView('emergency')} />
      <main className="main">
        {shown !== 'emergency' && (
          <div className="viewhead">
            <h1>{TITLES[shown]}</h1>
            <div className="viewhead-side">{tabletLine(me)}</div>
          </div>
        )}
        {shown === 'emergency' && <EmergencyView S={S} rad={rad} me={me} send={send} />}
        {shown === 'crew' && (
          <CrewOverview S={S} rad={rad} me={me} selPerson={selPerson} setSelPerson={setSelPerson} send={send} go={setView} />
        )}
        {shown === 'health' && <MyHealth S={S} rad={rad} me={me} sel={sel} setSel={setSel} send={send} go={setView} />}
        {shown === 'checkins' && <CheckIns S={S} send={send} />}
        {shown === 'radiation' && <RadiationView S={S} rad={rad} />}
        {shown === 'sharing' && <DataSharing S={S} me={me} />}
      </main>
      <Dock S={S} me={me} view={shown} reviewCount={reviewCount} onGo={setView} onGetDoctor={() => send('get_doctor')} />
      {sheet === 'demo' && (
        <DemoSheet
          S={S}
          me={me}
          storms={storms}
          theme={theme}
          size={size}
          setMe={setMe}
          setTheme={setTheme}
          setSize={setSize}
          send={send}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'earth' && <EarthSheet S={S} send={send} onClose={() => setSheet(null)} />}
    </div>
  );
}
