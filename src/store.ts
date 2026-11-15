// One shared copy of the server state for this tablet. Every view reads from here.
// The tablet asks the server for the state once a second, exactly as the original front end does,
// so several tablets stay in step with each other.

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  fetchRadiation,
  fetchState,
  fetchStorms,
  postAction,
  type CrewState,
  type PersonId,
  type Radiation,
  type StormEvent,
} from './api';

export type LinkState = 'connecting' | 'live' | 'lost';

export interface Shared {
  S: CrewState | null;
  rad: Radiation | null;
  storms: StormEvent[] | null;
  link: LinkState;
  actionError: string | null;
}

let shared: Shared = { S: null, rad: null, storms: null, link: 'connecting', actionError: null };
let lastOk = 0; // local clock, milliseconds
const listeners = new Set<() => void>();
let stateHash = '';
let radKey = '';
let clockOffset = 0; // server seconds minus local seconds
let started = false;
let failures = 0;
let errorTimer: number | undefined;

function emit(patch: Partial<Shared>) {
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
}

/** Current time on the server's clock, in seconds. Countdowns use this so every tablet agrees. */
export const serverNow = () => Date.now() / 1000 + clockOffset;

/** When this tablet last heard from the server (local clock, milliseconds). */
export const lastHeardAt = () => lastOk;

/** Which storm the radiation figures should include, if any. */
function stormFor(S: CrewState): string | null {
  if (S.emergency && S.emergency.kind === 'spe') return S.emergency.event || 'demo';
  if (S.spe_caution) return S.spe_caution.event || 'demo';
  return null;
}

function accept(S: CrewState) {
  clockOffset = S.now - Date.now() / 1000;
  failures = 0;
  const { now: _now, ...rest } = S;
  const hash = JSON.stringify(rest);
  lastOk = Date.now();
  const patch: Partial<Shared> = {};
  if (shared.link !== 'live') patch.link = 'live';
  if (hash !== stateHash) {
    stateHash = hash;
    patch.S = S;
  }
  if (patch.S || patch.link) emit(patch);
  const key = `${S.mode}|${stormFor(S) ?? ''}`;
  if (key !== radKey) {
    radKey = key;
    void loadRadiation(S);
  }
}

async function loadRadiation(S: CrewState) {
  const key = radKey;
  try {
    const rad = await fetchRadiation(S.mode, stormFor(S));
    if (key === radKey) emit({ rad });
  } catch {
    if (key === radKey) radKey = ''; // try again on the next poll
  }
}

async function poll() {
  try {
    accept(await fetchState());
  } catch {
    failures += 1;
    if (failures >= 3 && shared.link !== 'lost') emit({ link: 'lost' });
  }
}

export function startPolling() {
  if (started) return;
  started = true;
  void poll();
  window.setInterval(poll, 1000);
}

export async function loadStorms() {
  try {
    const r = await fetchStorms();
    emit({ storms: r.events || [] });
  } catch {
    emit({ storms: [] });
  }
}

/** Send one action to the server and take its reply as the new state. */
export async function act(type: string, who: PersonId, extra: Record<string, unknown> = {}) {
  try {
    const S = await postAction(type, who, extra);
    accept(S);
    if (shared.actionError) emit({ actionError: null });
    if (type === 'reset') {
      radKey = '';
      void poll();
    }
    return true;
  } catch {
    window.clearTimeout(errorTimer);
    emit({ actionError: 'Not sent. This tablet cannot reach the habitat server. Check the connection and try again.' });
    errorTimer = window.setTimeout(() => emit({ actionError: null }), 8000);
    return false;
  }
}

export const dismissError = () => emit({ actionError: null });

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useShared(): Shared {
  return useSyncExternalStore(subscribe, () => shared);
}

/** Re-render on a timer. Used by clocks and countdowns only. */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((n) => (n + 1) % 1_000_000), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

// ---------------------------------------------------------------- display settings for this tablet

export type Theme = 'dark' | 'light';
export type Size = 'standard' | 'large';

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage is a convenience only */
  }
}

export const params = new URLSearchParams(window.location.search);

export function initialTheme(): Theme {
  const v = params.get('theme') || readStored('crew-theme');
  return v === 'light' ? 'light' : 'dark';
}

export function initialSize(): Size {
  const v = params.get('size') || readStored('crew-size');
  return v === 'large' ? 'large' : 'standard';
}

/** How many real pixels one design pixel takes: the root font size over 16. */
export const unit = () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;

export function applyDisplay(theme: Theme, size: Size) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.size = size;
  store('crew-theme', theme);
  store('crew-size', size);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#17171b' : '#f6f6f6');
  // "Large" changes the root font size, which a chart's own size observer cannot see: ask charts to re-measure.
  window.dispatchEvent(new Event('resize'));
}

export function initialPerson(): PersonId {
  const v = params.get('as');
  return v === 'sam' || v === 'ravi' || v === 'maya' ? v : 'lena';
}
