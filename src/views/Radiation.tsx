// Radiation exposure: career dose against NASA's 600 millisievert limit, with measured dose rates
// and real solar particle events from the team's radiation module.

import type { CrewState, NeutronBreakdown, Radiation } from '../api';
import { DailyBars, DoseProjection, DoseTrack, SplitBar } from '../charts';
import { L, SRC, type Source } from '../content';
import { day, dose } from '../format';
import { Icon } from '../icons';
import { radAlert, speOn } from '../logic';
import { ClassTag, Fact, PlainTag, Scroll, SourceChip } from '../ui';

function rateSource(r: Radiation): Source {
  const mode = r.mission.mode;
  const links = { mars: [L.zeitlin, L.hassler], moon: [L.zhang, L.zeitlin], station: [] }[mode];
  return {
    label: { mars: 'Curiosity detector', moon: "Chang'e 4 lander", station: 'NASA, space station' }[mode],
    title: 'Expected daily dose by mission phase',
    body:
      'The projection uses published dose rates for each phase: about 1.84 mSv per day in deep space and about 0.64 mSv per day on the Mars surface (Curiosity radiation detector), about 1.37 mSv per day on the Moon surface (Chang’e 4), and about 0.5 mSv per day on the International Space Station. Prior career dose and mission day are demo values.',
    links: r.source === 'real' ? [...links, L.radlab] : links,
  };
}

function recentSource(r: Radiation): Source {
  if (r.recent.source === 'real' && r.recent.dates) {
    const d = r.recent.dates;
    return {
      label: 'NASA RadLab',
      title: `${r.mission.instrument}: measured dose rate`,
      body: `Daily mean dose rate, ${day(d[0])} to ${day(d[d.length - 1])}, from NASA's RadLab collection of space radiation measurements.`,
      links: [L.radlab],
    };
  }
  return {
    label: 'Simulated',
    simulated: true,
    title: 'Simulated dose rate',
    body: 'Simulated around the published rate for this location. Measured data can be loaded with the radiation module (python -m radiation.radlab fetch-events).',
    links: [L.radlab],
  };
}

/** A mission phase name inside a sentence. Place names (Mars, Moon) keep their capital letter. */
const phaseWords = (name: string) => (/^(Mars|Moon|Earth)\b/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

export function RadiationView({ S, rad }: { S: CrewState; rad: Radiation | null }) {
  if (!rad) {
    return (
      <div className="loading">
        <p className="hero-title">Loading radiation data</p>
        <p className="muted">Asking the habitat server for the dose projection.</p>
      </div>
    );
  }
  const d = rad.dose;
  const ra = radAlert(rad);
  const storm = rad.storm;
  return (
    <div className="view view--even">
      <Scroll>
        <section className="panel panel-pad stack stack--loose" aria-label="Career dose">
          <div className="stack stack--tight">
            <div className="rowline">
              {speOn(S) ? <ClassTag cls="emergency" /> : S.spe_caution ? <ClassTag cls="caution" /> : ra ? <ClassTag cls="advisory" /> : null}
              <span className="muted">
                {rad.mission.label.replace('~', 'about ')}. Day {rad.mission.today} of {rad.mission.totalDays}, {phaseWords(rad.mission.phaseToday)}.
              </span>
            </div>
            <p className="detail-lead">{ra || rad.headline}</p>
          </div>

          <DoseTrack rad={rad} />

          <div className="stats">
            <div className="stat">
              <div className="label">Career dose so far</div>
              <div className="stat-value">
                <span className="num">{dose(d.soFar)}</span> mSv
              </div>
            </div>
            <div className="stat">
              <div className="label">Projected at mission end</div>
              <div className="stat-value">
                <span className="num">{dose(d.projectedTotal)}</span> mSv
              </div>
            </div>
            <div className="stat">
              <div className="label">
                Career limit <SourceChip source={SRC.limit} />
              </div>
              <div className="stat-value">
                <span className="num">{dose(d.limit)}</span> mSv
              </div>
            </div>
            <div className="stat">
              <div className="label">Limit reached</div>
              <div className="stat-value">{d.limitDay ? <>Day <span className="num">{d.limitDay}</span></> : 'Not reached'}</div>
            </div>
          </div>
        </section>

        {storm && (
          <section className="panel panel-pad stack stack--tight" aria-label="Solar particle event">
            <div className="rowline">
              <Icon name="flare" />
              <h3>Solar particle event{storm.date ? `, ${day(storm.date)}` : ' (demo)'}</h3>
              {storm.eventSource === 'real' ? <PlainTag>Recorded by NASA</PlainTag> : <PlainTag>Demo data</PlainTag>}
            </div>
            <p>
              {storm.doseSource === 'real'
                ? storm.detected
                  ? `Extra dose measured here: ${storm.extraDose} mSv. Only days above normal variation are counted, and solar protons are weighted at 1.5.`
                  : 'No increase above normal day-to-day variation was measured at this location. Storms seen near Earth often miss Mars.'
                : `Extra dose ${storm.extraDose} mSv from a simulated profile. There is no measured data for this date.`}
            </p>
            {storm.link && (
              <a className="source-link" href={storm.link} target="_blank" rel="noopener noreferrer">
                <Icon name="open_in_new" />
                <span>This event in NASA's space weather database</span>
              </a>
            )}
          </section>
        )}

        <section className="panel panel-pad" aria-label="What to do and why">
          <div className="facts">
            <div className="fact">
              <div className="label">What to do</div>
              <ul className="todo">
                {rad.actions.map((a) => (
                  <li key={a.text}>{a.text}</li>
                ))}
              </ul>
            </div>
            <Fact label="Why it matters in space" note={`NASA: ${rad.nasaRisk}`}>
              Space radiation passes through the hull and the body, raising lifetime cancer risk. Solar storms can add a large dose
              within hours.
            </Fact>
          </div>
          <p className="glossary">
            mSv means millisievert, the unit for radiation dose to the body. Crew member, prior career dose and mission day are demo values.
          </p>
        </section>
      </Scroll>

      <Scroll>
        <section className="panel panel-pad stack stack--tight" aria-label="Career dose projection">
          <DoseProjection rad={rad} />
          <div className="chart-foot">
            <SourceChip source={rateSource(rad)} />
          </div>
        </section>

        <section className="panel panel-pad stack stack--tight" aria-label="Daily dose">
          <DailyBars rad={rad} />
          <div className="chart-foot">
            <SourceChip source={recentSource(rad)} />
          </div>
        </section>

        {rad.breakdown && rad.breakdown.rows ? (
          <NeutronCard b={rad.breakdown} />
        ) : rad.breakdown ? (
          <section className="panel panel-pad stack stack--tight" aria-label="Dose by particle type">
            <div className="spread">
              <span>Today's dose by particle type, at the station</span>
              <SourceChip source={SRC.neutrons} />
            </div>
            <SplitBar share={rad.breakdown.neutrons_share} a="Charged particles" b="Neutrons" />
          </section>
        ) : null}
      </Scroll>
    </div>
  );
}

// ------------------------------------------------------------------ Canadian neutron measurements

function csaSource(b: NeutronBreakdown): Source {
  const mean = Math.round((b.neutron_msv_per_day || 0) * 1000);
  const range = b.range_usv_per_day ? ` (range ${b.range_usv_per_day[0]} to ${b.range_usv_per_day[1]})` : '';
  return {
    label: 'CSA Radi-N2',
    title: 'Canadian neutron measurements on the space station',
    body: `Radi-N and Radi-N2 bubble detectors (Bubble Technology Industries, Chalk River, Ontario) measured neutron dose on the International Space Station during the missions of Robert Thirsk, Chris Hadfield and David Saint-Jacques. ${b.sessions} week-long sessions, ${b.first} to ${b.last}: ${mean} µSv per day on average${range}. Dataset released by the Canadian Space Agency for the 2019 Space Apps Challenge. ${
      b.added_to_total
        ? 'Added to the measured dose, because silicon detectors mostly miss neutrons.'
        : 'The station total here is the published value of about 0.5 mSv per day, so the Canadian data sets the neutron share.'
    } Next: the agency's CANS detector will measure neutrons continuously.`,
    links: [L.radin2, L.csa],
  };
}

/** Station dose by particle type, with the neutron part measured by Canadian bubble detectors on three missions. */
function NeutronCard({ b }: { b: NeutronBreakdown }) {
  const rows = b.rows || [];
  const mean = Math.round((b.neutron_msv_per_day || 0) * 1000);
  const groups: { mission: string; experiment: string; rows: typeof rows }[] = [];
  rows.forEach((x) => {
    let g = groups.find((y) => y.mission === x.mission);
    if (!g) groups.push((g = { mission: x.mission, experiment: x.experiment, rows: [] }));
    g.rows.push(x);
  });
  const W = 280;
  const H = 52;
  const max = 250;
  const X = (v: number) => 10 + (Math.min(v, max) / max) * (W - 20);
  return (
    <section className="panel panel-pad stack" aria-label="Dose by particle type, measured by Canadian detectors">
      <div className="spread">
        <span>Daily dose by particle type, at the station: neutrons measured by Canadian detectors</span>
        <SourceChip source={csaSource(b)} />
      </div>
      <SplitBar share={b.neutrons_share} a="Charged particles" b="Neutrons" />
      <div className="n-stats">
        <div className="n-stat">
          <span className="label">Neutrons, measured</span>
          <b>
            <span className="num">{mean}</span> <span className="unit">µSv per day</span>
          </b>
        </div>
        <div className="n-stat">
          <span className="label">Charged particles</span>
          <b>
            <span className="num">{Math.round((b.charged_msv_per_day || 0) * 1000)}</span> <span className="unit">µSv per day</span>
          </b>
        </div>
        <div className="n-stat">
          <span className="label">Bubble-detector readings</span>
          <b>
            <span className="num">{b.sessions}</span>{' '}
            <span className="unit">
              {(b.first || '').slice(0, 4)} to {(b.last || '').slice(0, 4)}
            </span>
          </b>
        </div>
      </div>
      <div className="label">Measured on three Canadian missions</div>
      <ul className="n-missions">
        {groups.map((g) => {
          const [who, exp] = g.mission.split(', ');
          const avg = Math.round(g.rows.reduce((t, x) => t + x.usv_per_day, 0) / g.rows.length);
          const years = Array.from(new Set(g.rows.map((x) => x.start.slice(0, 4)))).join(' to ');
          return (
            <li key={g.mission} className="n-mission">
              <div className="n-who">
                <b>{who}</b>
                <span className="muted">
                  {exp ? `${exp}, ` : ''}
                  {years}
                </span>
                <span className="n-meta">
                  <PlainTag>{g.experiment}</PlainTag>
                  <span>
                    {g.rows.length} {g.rows.length === 1 ? 'reading' : 'readings'}, average <b className="num">{avg}</b> µSv per day
                  </span>
                </span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${who}: ${g.rows.length} weekly readings, average ${avg} microsieverts per day`}>
                <line x1={X(0)} x2={X(max)} y1={20} y2={20} className="n-axis" />
                <line x1={X(mean)} x2={X(mean)} y1={4} y2={36} className="n-mean" />
                {g.rows.map((x, i) => (
                  <circle key={i} cx={X(x.usv_per_day)} cy={20 + (i % 2 ? 6 : -6)} r={6} className="n-dot">
                    <title>
                      Week of {x.start}: {x.usv_per_day} µSv per day
                    </title>
                  </circle>
                ))}
                {[0, 100, 200].map((t) => (
                  <text key={t} x={X(t)} y={H - 2} textAnchor="middle" className="n-tick">
                    {t}
                  </text>
                ))}
              </svg>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Each dot is one week-long bubble-detector reading. Dashed line: the average of all {b.sessions} readings ({mean} µSv per day). µSv means
        microsievert, a thousandth of a millisievert.
      </p>
    </section>
  );
}
