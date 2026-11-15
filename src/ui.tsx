// Shared building blocks: buttons, tags, source chips, scrolling columns, sheets and dialogs.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icons';
import { MISSING, type Source } from './content';
import type { MissingKind } from './api';
import type { AlertClass } from './logic';
import { hoursText, numText, type RangeInfo, type Side } from './range';
import { serverNow, useTick } from './store';

// ------------------------------------------------------------------ buttons

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'primary' | 'secondary' | 'quiet' | 'on-alert';
  size?: 'standard' | 'xl';
  block?: boolean;
  left?: boolean;
  icon?: IconName;
}

export function Button({ kind = 'secondary', size = 'standard', block, left, icon, className, children, ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${kind}`, size === 'xl' && 'btn--xl', block && 'btn--block', left && 'btn--left', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}

// ------------------------------------------------------------------ tags

const CLASS_ICON: Record<AlertClass, IconName> = { emergency: 'report', caution: 'warning', advisory: 'info' };
const CLASS_WORD: Record<AlertClass, string> = { emergency: 'Emergency', caution: 'Caution', advisory: 'Advisory' };

/** An alert class is always colour, shape and word together. */
export function ClassTag({ cls }: { cls: AlertClass }) {
  return (
    <span className={`tag tag--${cls}`}>
      <Icon name={CLASS_ICON[cls]} />
      {CLASS_WORD[cls]}
    </span>
  );
}

export function ClassIcon({ cls, size }: { cls: AlertClass; size?: number }) {
  return <Icon name={CLASS_ICON[cls]} size={size} />;
}

/** Missing or stale data: cyan, an icon and a word. Never shown as a usual value. */
export function StateTag({ kind, word }: { kind: MissingKind; word?: string }) {
  // Not yet entered is "not yet", not missing: grey, so it is never mistaken for missing data or for "done".
  if (kind === 'not_entered')
    return (
      <span className="pill pill--none">
        <Icon name="pending" />
        {word || 'No entry yet today'}
      </span>
    );
  const m = MISSING[kind] || MISSING.sensor_off;
  return (
    <span className="tag tag--state">
      <Icon name={m.icon} />
      {word || m.word}
    </span>
  );
}

export function PlainTag({ icon, children, strong }: { icon?: IconName; children: ReactNode; strong?: boolean }) {
  return (
    <span className={`tag ${strong ? 'tag--ok' : 'tag--plain'}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ the reading against the usual range

/** The team's pill colour rule: green within the usual range, yellow outside it, always with an icon and words. */
export function RangePill({ side }: { side: Side }) {
  if (side === 'within')
    return (
      <span className="pill pill--within">
        <Icon name="check_circle_fill" />
        Within usual range
      </span>
    );
  return (
    <span className="pill pill--outside">
      <Icon name={side === 'above' ? 'arrow_upward' : 'arrow_downward'} />
      {side === 'above' ? 'Above' : 'Below'} usual range
    </span>
  );
}

/** Marks a reading that is part of the open caution. */
export function LinkPill() {
  return (
    <span className="pill pill--link">
      <Icon name="link" />
      In this caution
    </span>
  );
}

const TREND_MARK = { up: '3,19 12,13 21,5', down: '3,5 12,11 21,19', flat: '3,12 12,12 21,12' };

/** The trend: words with a small sloped line that has no arrowhead; bold only when the reading is moving. */
export function TrendLine({ dir, words, name }: { dir: 'up' | 'down' | 'flat'; words: string; name?: string }) {
  const pts = TREND_MARK[dir].split(' ').map((p) => p.split(',').map(Number));
  return (
    <p className={`trend trend--${dir}`}>
      <svg className="trend-mark" viewBox="0 0 24 24" aria-hidden="true">
        <polyline points={TREND_MARK[dir]} />
        {pts.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={2.5} />
        ))}
      </svg>
      <span>
        {name && <span className="sr-only">{name}: </span>}
        {words}
      </span>
    </p>
  );
}

/** One line for each number outside its usual range, with the pill's own icon. The unit is heard, not repeated. */
export function AmountLines({ r }: { r: RangeInfo }) {
  return (
    <>
      {r.parts
        .filter((p) => p.side !== 'within' && p.amount > 0)
        .map((p) => (
          <p key={p.label || 'one'} className="amount">
            <Icon name={p.side === 'above' ? 'arrow_upward' : 'arrow_downward'} />
            <span>
              {p.label ? `${p.label} ` : ''}
              {r.unit === 'h' ? (
                hoursText(p.amount)
              ) : (
                <>
                  <span className="num">{numText(p.amount)}</span>
                  <span className="sr-only"> {r.unit}</span>
                </>
              )}{' '}
              {p.side} your usual range
            </span>
          </p>
        ))}
    </>
  );
}

// ------------------------------------------------------------------ scrolling column

/** A list or procedure that may be longer than the screen. Says "More below" in words while anything is hidden. */
export function Scroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [scrolls, setScrolls] = useState(false);
  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 28);
    setScrolls(el.scrollHeight - el.clientHeight > 4);
  }, []);
  useLayoutEffect(check);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check]);
  return (
    <div className={`scroll${className ? ` ${className}` : ''}`}>
      <div className="scroll-body" ref={ref} onScroll={check} tabIndex={scrolls ? 0 : undefined}>
        {children}
      </div>
      {more && (
        <button
          type="button"
          className="more-below"
          onClick={() => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.75, behavior: 'smooth' })}
        >
          <Icon name="arrow_downward" />
          More below
        </button>
      )}
    </div>
  );
}

/** On a narrow screen the detail sits below the list. After a row is tapped, bring the detail into view. */
export function revealDetail() {
  if (!window.matchMedia('(max-width: 1100px)').matches) return;
  window.setTimeout(() => {
    const detail = document.querySelector('.view > :last-child');
    detail?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

// ------------------------------------------------------------------ overlays

function useOverlay(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () =>
      node ? Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex="0"]')) : [];
    (node?.querySelector<HTMLElement>('[data-autofocus]') || focusable()[0] || node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
    // The overlay is mounted once; onClose is stable enough for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

interface OverlayProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeWord?: string;
}

/** A panel that slides in from the right edge and leaves the view behind it in place. */
export function Sheet({ title, onClose, children, closeWord = 'Close' }: OverlayProps) {
  const ref = useOverlay(onClose);
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="close" onClick={onClose}>
            <Icon name="close" />
            {closeWord}
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

export function Dialog({ title, onClose, children, small, closeWord }: OverlayProps & { small?: boolean }) {
  const ref = useOverlay(onClose);
  return createPortal(
    <>
      <div className="scrim dialog-scrim" onClick={onClose} />
      <div className={`dialog${small ? ' dialog--small' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="dialog-head">
          <h2>{title}</h2>
          {closeWord && (
            <button type="button" className="close" onClick={onClose}>
              <Icon name="close" />
              {closeWord}
            </button>
          )}
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

// ------------------------------------------------------------------ sources

/** A small chip that opens the source behind a number or a claim. */
export function SourceChip({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`source${source.simulated ? ' source--demo' : ''}`}
        aria-haspopup="dialog"
        aria-label={`Source: ${source.label}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Icon name="info" />
        {source.label}
      </button>
      {open && (
        <Dialog title={source.title} onClose={() => setOpen(false)} small closeWord="Close">
          <p>{source.body}</p>
          {source.simulated && <p className="muted">This is demo content, not a measurement.</p>}
          {source.links.length > 0 && (
            <ul className="stack stack--tight">
              {source.links.map((l) => (
                <li key={l.u}>
                  <a className="source-link" href={l.u} target="_blank" rel="noopener noreferrer">
                    <Icon name="open_in_new" />
                    <span>{l.t}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </>
  );
}

// ------------------------------------------------------------------ small pieces

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  block,
  tall,
}: {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (v: T) => void;
  label: string;
  block?: boolean;
  tall?: boolean;
}) {
  return (
    <div className={`seg${block ? ' seg--block' : ''}${tall ? ' seg--tall' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A live countdown on the server's clock, with the seconds written as a word. */
export function Countdown({ end, total, caption }: { end: number; total: number; caption: ReactNode }) {
  useTick(100);
  const left = Math.max(0, end - serverNow());
  return (
    <div className="countdown" role="timer" aria-live="off">
      <div className="countdown-figure">
        <span className="countdown-num num">{Math.ceil(left)}</span>
        <span className="countdown-unit">{Math.ceil(left) === 1 ? 'second' : 'seconds'}</span>
      </div>
      <div className="countdown-caption">{caption}</div>
      <div className="countdown-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.min(1, left / total)})` }} />
      </div>
    </div>
  );
}

/** A label above a sentence. */
export function Fact({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="fact">
      <div className="label">{label}</div>
      <div>{children}</div>
      {note && <div className="fact-note">{note}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
      </label>
      {children}
      {hint && <div className="fact-note">{hint}</div>}
    </div>
  );
}

/** Reasons that can be tapped instead of typed. Tapping fills the field; the text can still be edited. */
export function ReasonChips({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="chips" role="group" aria-label="Quick reasons">
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={value === o} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
