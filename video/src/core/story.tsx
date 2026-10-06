import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {Line, StoryScene} from '../spec';
import {LangCtx} from './theme';

export const useT = () => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  return {t: f / fps, f, dur: durationInFrames / fps};
};

export const useDir = () => (React.useContext(LangCtx).en ? 'ltr' : 'rtl');

/** The line being spoken at time t (the last one that has started). */
export const currentLine = (s: StoryScene, t: number): {line: Line; idx: number} | null => {
  const L = s.lines ?? [];
  if (!L.length) return null;
  let idx = 0;
  L.forEach((l, i) => { if (t >= l.t0) idx = i; });
  return {line: L[idx], idx};
};

/** Fraction of a text spoken at time t, for word highlighting weighted by word length. */
export const spokenParts = (text: string, t: number, t0: number, t1: number) => {
  const words = text.split(' ');
  const w = words.map((x) => x.length + 1);
  const total = w.reduce((a, b) => a + b, 0);
  const spoken = Math.max(0, Math.min(1, (t - t0) / Math.max(0.1, t1 - t0)));
  let acc = 0;
  return words.map((x, i) => {
    const start = acc / total, end = (acc + w[i]) / total;
    acc += w[i];
    return {word: x, start, end, on: spoken >= start && spoken < end + 0.02, shown: spoken >= start - 0.001, spoken, total};
  });
};

export const WHO: Record<string, string> = {narr: '#7a8a93', salim: '#1f9d8a', maryam: '#e0679a', nour: '#e0a21a'};
