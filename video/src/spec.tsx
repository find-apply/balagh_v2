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
  // type words
  cards?: {word: string; meaning: string}[];
  // type quiz
  question?: string;
  choices?: string[];
  answer?: number;
  revealAt?: number;
};

export type StorySpec = {lang: 'ar' | 'en'; title: string; scenes: StoryScene[]};

export const FPS = 30;
export const OUTRO_SECONDS = 3.5;

export const totalFrames = (spec: VideoSpec) => Math.max(1, Math.round((spec.duration + OUTRO_SECONDS) * FPS));
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
