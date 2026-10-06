import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

// The one input every template reads. Built by app/video/spec.py from an approved script; times are in seconds.

export type Cue = {t0: number; t1: number; text: string; sub?: string; emph?: boolean};

/** One picture per script scene. `kind` comes from the closed list in catalog.json. */
export type Art = {
  t0: number;
  t1: number;
  kind: string;
  keyword: string;
  detail: string;
  emoji?: string;
  image?: string;
};

export type Clip = {t0: number; src: string};

export type VideoSpec = {
  lang: 'ar' | 'en';
  /** Set on a preview rendered before approval: the text of the mark drawn over every frame. */
  watermark?: string;
  duration: number;
  hook?: string;
  cues: Cue[];
  art: Art[];
  audio: Clip[];
  outro: string[];
};

/** Input of the story templates (kids, chalk): one dialogue story, built by app/video/spec.py. */
export type Line = {who: string; name: string; text: string; audio: string; t0: number; d: number};

export type StoryScene = {
  id: string;
  type: 'story' | 'text' | 'words' | 'quiz' | 'outro';
  duration: number;
  title?: string;
  board?: string;
  lines?: Line[];
  image?: string;
  // type text
  text?: string;
  quote?: string;
  source?: string;
  quoteLead?: number;
  quoteEnd?: number;
  audio?: string;
  audioAt?: number;
  silentNote?: string;
  // type words
  cards?: {word: string; meaning: string}[];
  // type quiz
  question?: string;
  choices?: string[];
  answer?: number;
  revealAt?: number;
};

export type StorySpec = {lang: 'ar' | 'en'; title: string; scenes: StoryScene[]; watermark?: string};

/** Input of the parents' teaser: shots cut from the story, built by app/video/spec.py. */
export type TeaserShot = {image: string; duration: number; lines: Line[]};
export type TeaserSpec = {
  lang: 'ar' | 'en';
  watermark?: string;
  title: string;
  intro: string;
  lesson: string;
  shots: TeaserShot[];
  source: string;
  cta: string;
  introSeconds: number;
  ctaSeconds: number;
};

/** Balagh mark plus the preview text, over every frame of a preview render. Sized for 720- and 1280-wide frames. */
export const Watermark: React.FC<{text?: string; wide?: boolean}> = ({text, wide}) => {
  if (!text) return null;
  const s = wide ? 1.1 : 0.95;
  const logo = (size: number) => (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 8 * s}}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#0c5a4a" />
        <text x="32" y="45" fontSize="34" fontWeight="700" textAnchor="middle" fill="#ffffff" fontFamily="Cairo, sans-serif">ب</text>
      </svg>
      <span style={{fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: size * 0.62, color: '#ffffff'}}>بلاغ</span>
    </span>
  );
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-24deg)', whiteSpace: 'nowrap', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 60 * s, color: 'rgba(255,255,255,0.34)', letterSpacing: 2, textShadow: '0 2px 12px rgba(0,0,0,0.35)', border: `${4 * s}px solid rgba(255,255,255,0.28)`, borderRadius: 18, padding: `${10 * s}px ${34 * s}px`}}>{text}</div>
      <div style={{position: 'absolute', top: 18 * s, left: 18 * s, display: 'flex', alignItems: 'center', gap: 12 * s, background: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: `${8 * s}px ${16 * s}px ${8 * s}px ${10 * s}px`}}>
        {logo(36 * s)}
        <span style={{fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 20 * s, color: '#ffe27a'}}>{text}</span>
      </div>
    </div>
  );
};

export const FPS = 30;
export const OUTRO_SECONDS = 3.5;

export const totalFrames = (spec: VideoSpec) => Math.max(1, Math.round((spec.duration + OUTRO_SECONDS) * FPS));
export const teaserFrames = (spec: TeaserSpec) =>
  Math.max(1, Math.round((spec.introSeconds + spec.ctaSeconds + spec.shots.reduce((a, s) => a + s.duration, 0)) * FPS));
export const storyFrames = (spec: StorySpec) => Math.max(1, spec.scenes.reduce((a, s) => a + Math.round(s.duration * FPS), 0));

/** Scene audio of a story: each line at its own start, or one clip for a text scene. */
export const SceneAudio: React.FC<{s: StoryScene}> = ({s}) => (
  <>
    {s.lines?.map((l, j) => (
      <Sequence key={j} from={Math.round(l.t0 * FPS)}>
        <Audio src={staticFile(l.audio)} />
      </Sequence>
    ))}
    {s.audio && (
      <Sequence from={Math.round((s.audioAt ?? 0) * FPS)}>
        <Audio src={staticFile(s.audio)} />
      </Sequence>
    )}
  </>
);

/** Plays each spoken line at its own start time. */
export const Clips: React.FC<{clips: Clip[]}> = ({clips}) => (
  <>
    {clips.map((c, i) => (
      <Sequence key={i} from={Math.round(c.t0 * FPS)}>
        <Audio src={staticFile(c.src)} />
      </Sequence>
    ))}
  </>
);
