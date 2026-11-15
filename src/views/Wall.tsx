// All four tablets side by side, for demonstrations. Each one is the real tablet in its own frame,
// so what you see here is exactly what each crew member would see, staying in step through the server.

import { useEffect, useState } from 'react';
import type { Mode, PersonId } from '../api';
import { MODE_NAME, NAMES, PEOPLE, TABLET_ROLE } from '../content';
import { act, applyDisplay, initialSize, initialTheme, startPolling, unit, useShared } from '../store';
import { Button, Seg } from '../ui';

const TABLET_W = 1280;
const TABLET_H = 800;

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

export function Wall() {
  const { S } = useShared();
  const { w, h } = useWindowSize();
  const theme = initialTheme();
  useEffect(() => {
    startPolling();
    applyDisplay(theme, initialSize());
  }, [theme]);

  // The header, gaps and captions are sized in rem, so these numbers are multiplied by the root unit.
  const u = unit();
  const gap = 16 * u;
  const head = 84 * u;
  const label = 36 * u;
  const scale = Math.max(0.2, Math.min((w - gap * 3) / 2 / TABLET_W, (h - head - gap * 3 - label * 2) / 2 / TABLET_H));
  const busy = !!S && (!!S.heart || !!S.emergency);
  const who: PersonId = 'lena';

  return (
    <div className="wall">
      <header className="wall-head">
        <div className="sb-brand">
          <span className="sb-name">Crew Health</span>
          <span className="tag tag--plain">Demo data</span>
        </div>
        <div className="wall-actions">
          <Button kind="primary" icon="ecg_heart" disabled={busy} onClick={() => void act('demo_start_s2', who)}>
            Start heart scenario
          </Button>
          <Button icon="flare" onClick={() => void act('spe_start', who, { event: 'demo' })}>
            Start solar storm
          </Button>
          {S && (
            <Seg<Mode>
              label="Mission setting"
              value={S.mode}
              onChange={(mode) => void act('mode', who, { mode })}
              options={[
                { value: 'station', label: MODE_NAME.station },
                { value: 'moon', label: MODE_NAME.moon },
                { value: 'mars', label: MODE_NAME.mars },
              ]}
            />
          )}
          <Button icon="restart_alt" onClick={() => void act('reset', who)}>
            Reset everything
          </Button>
          <a className="btn btn--quiet" href="?as=lena">
            <span>One tablet</span>
          </a>
        </div>
      </header>
      <div className="wall-grid" style={{ gap: '1rem' }}>
        {PEOPLE.map((p) => (
          <figure key={p} className="wall-cell" style={{ width: TABLET_W * scale }}>
            <figcaption style={{ height: '2.25rem' }}>
              <b>{NAMES[p]}</b>
              <span className="muted">{TABLET_ROLE[p]}</span>
            </figcaption>
            <div className="wall-frame" style={{ width: TABLET_W * scale, height: TABLET_H * scale }}>
              <iframe
                title={`${NAMES[p]}'s tablet`}
                src={`?as=${p}&embed=1&theme=${theme}`}
                width={TABLET_W}
                height={TABLET_H}
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
