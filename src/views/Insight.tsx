// The mock AI insight box: under each crew member's indicators (about their own data), and in the crew
// doctor's view for each person (a doctor version). Answers are scripted in src/insight.ts from the server's
// demo data and the sources already in the app. No diagnosis, no made-up percentages.

import { useEffect, useRef, useState } from 'react';
import type { CrewState, PersonId, Radiation } from '../api';
import { NAMES, type Source } from '../content';
import { Icon } from '../icons';
import { answer, intentOf, SUGGESTIONS, type Answer, type Audience, type Ctx, type Intent } from '../insight';
import { Button, SourceChip } from '../ui';

const MOCK: Source = {
  label: 'Mock AI',
  simulated: true,
  title: 'Mock AI insight',
  body: "Scripted for the demo, in the style of evidence-based clinical assistants: each answer is put together from this person's demo readings and the sources already cited in the app. It is not a language model, gives no diagnosis and no made-up percentages, and a real version would need clinical validation. The crew doctor decides.",
  links: [],
};

interface Turn {
  id: number;
  q: string;
  intent: Intent;
  a: Answer | null; // null while "thinking"
}

function AnswerCard({ a, live }: { a: Answer; live?: boolean }) {
  return (
    <div className="ai-answer">
      <div className="ai-answer-head">
        <span className="ai-answer-title">{a.title}</span>
        {live && <span className="muted">Updated live</span>}
      </div>
      <ul className="ai-lines">
        {a.lines.map((l, i) => (
          <li key={i}>
            {l.text} {l.src && <SourceChip source={l.src} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiInsight({ S, rad, pid, audience }: { S: CrewState; rad: Radiation | null; pid: PersonId; audience: Audience }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const seq = useRef(0);
  const ctx = useRef<Ctx>({ S, rad, pid, audience });
  ctx.current = { S, rad, pid, audience };
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const ask = (q: string, intent: Intent) => {
    const id = ++seq.current;
    setTurns((t) => [...t.slice(-2), { id, q, intent, a: null }]);
    // A short pause, so it reads like an assistant looking things up. The answer uses the data as it is then.
    timers.current.push(
      window.setTimeout(() => setTurns((t) => t.map((x) => (x.id === id ? { ...x, a: answer(ctx.current, intent) } : x))), 650),
    );
  };

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    setText('');
    ask(q, intentOf(q));
  };

  const name = NAMES[pid];
  const whose = audience === 'self' ? 'your' : `${name}'s`;
  return (
    <section className="panel panel-pad ai" aria-label={audience === 'self' ? 'AI insight on my data' : `AI insight on ${name}'s data`}>
      <div className="ai-head">
        <Icon name="neurology" size={28} />
        <h3>AI insight</h3>
        <SourceChip source={MOCK} />
      </div>
      <p className="muted">
        {audience === 'self'
          ? 'Answers about your own readings, with the evidence behind them.'
          : `For the crew doctor: ${name}'s readings with the evidence behind them. Mood and stress are private and never used.`}
      </p>

      <AnswerCard a={answer({ S, rad, pid, audience }, 'summary')} live />

      {turns.map((t) => (
        <div key={t.id} className="ai-turn">
          <p className="ai-q">
            <Icon name="chat_bubble" />
            <span>{t.q}</span>
          </p>
          {t.a ? (
            <AnswerCard a={t.a} />
          ) : (
            <p className="ai-thinking" role="status">
              Looking at {whose} readings and the evidence…
            </p>
          )}
        </div>
      ))}

      <div className="chips" aria-label="Suggested questions">
        {SUGGESTIONS[audience]
          .filter((s) => s.intent !== 'summary')
          .map((s) => (
            <button key={s.q} type="button" className="chip" onClick={() => ask(s.q, s.intent)}>
              {s.q}
            </button>
          ))}
      </div>

      <div className="ai-ask">
        <input
          className="input"
          type="text"
          aria-label={audience === 'self' ? 'Ask about your data' : `Ask about ${name}'s data`}
          placeholder={audience === 'self' ? 'Ask about your data' : `Ask about ${name}'s data`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <Button kind="primary" icon="send" onClick={submit} disabled={!text.trim()}>
          Ask
        </Button>
      </div>
      <p className="ai-foot">Mock AI for the demo. No diagnosis and no made-up percentages; the crew doctor decides.</p>
    </section>
  );
}
