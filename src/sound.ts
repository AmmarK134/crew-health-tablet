// Sounds: Lena's watch alarm, and the crew doctor's warning.
//
// Browsers let a page play sound only after someone has tapped it (or pressed a key) at least once. So the
// first tap or key press anywhere unlocks sound. A sound asked for before that waits, and plays on that tap.
// Sound can be turned off per browser (watch page, or Display in the demo controls).

import { useSyncExternalStore } from 'react';

export type SoundName = 'lena' | 'sam';

const FILE: Record<SoundName, string> = {
  lena: `${import.meta.env.BASE_URL}sounds/lena-alert.wav`,
  sam: `${import.meta.env.BASE_URL}sounds/sam-warning.wav`,
};
const NAMES: SoundName[] = ['lena', 'sam'];

interface Job {
  left: number;
  gap: number;
  onEach?: () => void;
  timer?: number;
}

export interface SoundState {
  /** Sound is allowed in this browser tab (someone has tapped the page). */
  unlocked: boolean;
  /** The person has not turned sound off. */
  enabled: boolean;
  /** A sound is playing or waiting to repeat. */
  playing: boolean;
}

const els: Partial<Record<SoundName, HTMLAudioElement>> = {};
const jobs: Partial<Record<SoundName, Job>> = {};
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem('crew-sound') !== 'off';
  } catch {
    return true;
  }
}

let state: SoundState = { unlocked: false, enabled: readStored(), playing: false };

/** What was played, for the walkthrough checks. */
const played: string[] = [];
(window as unknown as { __crewSound: string[] }).__crewSound = played;

function emit(patch: Partial<SoundState> = {}) {
  state = { ...state, ...patch, playing: Object.keys(jobs).length > 0 };
  listeners.forEach((l) => l());
}

function el(name: SoundName): HTMLAudioElement {
  let a = els[name];
  if (!a) {
    a = new Audio(FILE[name]);
    a.preload = 'auto';
    a.addEventListener('ended', () => next(name));
    els[name] = a;
  }
  return a;
}

function activation() {
  const ua = (navigator as unknown as { userActivation?: { isActive: boolean; hasBeenActive: boolean } }).userActivation;
  return ua ? ua.isActive || ua.hasBeenActive : null;
}

function start(name: SoundName) {
  const j = jobs[name];
  if (!j || !state.enabled) return;
  const a = el(name);
  a.muted = false;
  a.currentTime = 0;
  if (j.onEach) j.onEach();
  played.push(`start:${name}`);
  a.play().then(
    () => played.push(name),
    (err: Error) => {
      played.push(`refused:${name}:${err && err.name}`);
      // Not allowed yet: keep the job and try again on the next tap.
      if (err && err.name === 'NotAllowedError' && state.unlocked) emit({ unlocked: false });
    },
  );
}

function next(name: SoundName) {
  const j = jobs[name];
  if (!j) return;
  j.left -= 1;
  if (j.left <= 0) {
    delete jobs[name];
    emit();
    return;
  }
  j.timer = window.setTimeout(() => start(name), j.gap);
}

/** Called on the first tap or key press: allow sound, and start anything that was waiting. */
export function unlockSound() {
  if (state.unlocked) return;
  if (activation() === false) return; // this event does not count as a tap yet (for example a touch still down)
  emit({ unlocked: true });
  NAMES.forEach((n) => {
    if (jobs[n]) {
      start(n);
      return;
    }
    // Safari allows an element to play later only if it has played once inside a tap: play it silently now.
    const a = el(n);
    a.muted = true;
    a.play().then(
      () => {
        if (!jobs[n]) {
          a.pause();
          a.currentTime = 0;
        }
        a.muted = false;
      },
      () => {
        a.muted = false;
      },
    );
  });
}

/** Play a sound, a number of times with a gap between, calling onEach as each one starts (for vibration). */
export function playSound(name: SoundName, opts: { times?: number; gap?: number; onEach?: () => void } = {}) {
  stopSound(name);
  jobs[name] = { left: opts.times ?? 1, gap: opts.gap ?? 3000, onEach: opts.onEach };
  emit();
  if (state.unlocked || activation()) {
    if (!state.unlocked) emit({ unlocked: true });
    start(name);
  }
}

export function stopSound(name: SoundName) {
  const j = jobs[name];
  if (j) {
    window.clearTimeout(j.timer);
    delete jobs[name];
  }
  const a = els[name];
  if (a && !a.paused && !a.muted) {
    a.pause();
    played.push(`stop:${name}`);
  }
  if (a) a.currentTime = 0;
  emit();
}

export function setSoundEnabled(on: boolean) {
  try {
    window.localStorage.setItem('crew-sound', on ? 'on' : 'off');
  } catch {
    /* a convenience only */
  }
  if (!on) NAMES.forEach(stopSound);
  emit({ enabled: on });
}

/** A short buzz on devices that can vibrate (Android phones and tablets). Others ignore it. */
export function vibrate(pattern: number[]) {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}

['pointerup', 'click', 'keydown', 'touchend'].forEach((t) => window.addEventListener(t, unlockSound, true));

export function subscribeSound(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const soundState = () => state;

export const useSound = () => useSyncExternalStore(subscribeSound, soundState);
