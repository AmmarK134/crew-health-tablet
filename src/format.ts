// Small helpers for showing times and numbers.
// Times use the 24-hour clock. Durations are written in words, not single letters.

const two = (n: number) => String(n).padStart(2, '0');

/** A server time (seconds) as 14:08. */
export function clock(t: number | null | undefined): string {
  if (t == null) return '--:--';
  const d = new Date(t * 1000);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** A server time (seconds) as 14:08:33. */
export function clockSeconds(t: number): string {
  const d = new Date(t * 1000);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A length of time in plain words: "40 seconds", "14 minutes", "2 hours 5 minutes". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 90) return plural(s, 'second');
  const m = Math.round(s / 60);
  if (m < 90) return plural(m, 'minute');
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${plural(h, 'hour')} ${plural(rest, 'minute')}` : plural(h, 'hour');
}

/** Whole numbers with a thin thousands separator; one decimal only when it carries meaning. */
export function dose(v: number): string {
  return Math.round(v).toLocaleString('en-GB');
}

export function fixed(v: number, digits = 2): string {
  return v.toFixed(digits);
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** 2022-08-23 as 23 Aug 2022. */
export function day(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y}`;
}

export function sentenceCase(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
