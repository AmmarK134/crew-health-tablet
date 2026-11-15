// Radiation exposure: career dose against NASA's 600 millisievert limit, with measured dose rates
// and real solar particle events from the team's radiation module.

import type { CrewState, Radiation } from '../api';
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

        {rad.breakdown && (
          <section className="panel panel-pad stack stack--tight" aria-label="Dose by particle type">
            <div className="spread">
              <span>Today's dose by particle type, at the station</span>
              <SourceChip source={SRC.neutrons} />
            </div>
            <SplitBar share={rad.breakdown.neutrons_share} a="Charged particles" b="Neutrons" />
          </section>
        )}
      </Scroll>
    </div>
  );
}
