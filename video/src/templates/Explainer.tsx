import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {loadFont as loadAlexandria} from '@remotion/google-fonts/Alexandria';
import {loadFont as loadPlex} from '@remotion/google-fonts/IBMPlexSansArabic';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadQuran} from '@remotion/google-fonts/AmiriQuran';
import {amiri} from '../core/theme';
import {asSrc} from '../core/ui';

/** A long-form explainer about the product, in the light "tech canvas" style of the reference video.
 *
 * Every scene but the chapter bumpers is a canvas that builds up while the narration plays: each element
 * names the narration cue it enters on (`at`, plus `dt` seconds) and, optionally, the cue it leaves on (`out`).
 * The cue times come from the narration audio (tools/build_explainer.py), so a card appears as its word is said.
 * Elements arrive and leave with a blur, scenes cross-dissolve through a blur, and the interface sounds
 * (pops, ticks, typing, whooshes) are placed from the same timeline. */

const title = loadAlexandria('normal', {weights: ['600', '700', '800'], subsets: ['arabic', 'latin']}).fontFamily;
const body = loadPlex('normal', {weights: ['400', '500', '600', '700'], subsets: ['arabic', 'latin']}).fontFamily;
const mono = loadMono('normal', {weights: ['500', '700', '800'], subsets: ['latin']}).fontFamily;
const quran = loadQuran('normal', {weights: ['400'], subsets: ['arabic']}).fontFamily;

export const FPS = 30;
const XF = 14; // frames of blur cross-dissolve between scenes
const LEAD = 0.45; // seconds of picture before the narration starts in each scene

// ---------- spec ----------

export type Tone = 'light' | 'green' | 'mint' | 'dark' | 'red' | 'gold' | 'blue' | 'ghost';
type Timed = {at?: number; dt?: number; out?: number; outDt?: number; sfx?: Sfx | null};
type Box = [number, number, number, number];

export type El = Timed & (
  | {k: 'card'; id?: string; x: number; y: number; w?: number; h?: number; label: string; sub?: string; icon?: string; tone?: Tone; mono?: boolean; size?: number; bar?: string; tilt?: number; hidden?: boolean}
  | {k: 'edge'; a: string; b: string; tone?: 'green' | 'red' | 'grey' | 'blue' | 'gold'; dashed?: boolean; bend?: number; label?: string; dot?: boolean; width?: number; fromSide?: Side; toSide?: Side}
  | {k: 'text'; x: number; y: number; w?: number; text: string; size?: number; color?: string; weight?: number; font?: 'title' | 'body' | 'mono' | 'quran' | 'amiri'; align?: 'right' | 'center' | 'left'; lh?: number}
  | {k: 'pill'; x: number; y: number; text: string; tone?: Tone; icon?: string; size?: number; anchor?: 'center' | 'right' | 'left'}
  | {k: 'stat'; x: number; y: number; value: string; label: string; tone?: Tone; size?: number; w?: number}
  | {k: 'code'; x: number; y: number; w: number; title?: string; lines: CodeLine[]}
  | {k: 'chat'; x: number; y: number; w: number; h: number; prompt: string; reply: string[]; until: number; caption?: string; tilt?: number}
  | {k: 'layers'; x: number; y: number; items: {label: string; sub?: string; tone: Tone; at: number; dt?: number}[]}
  | {k: 'list'; x: number; y: number; w: number; title?: string; items: ListItem[]}
  | {k: 'stepper'; y?: number; steps: string[]; done: (number | null)[]}
  | {k: 'wall'; x: number; y: number; cols: number; rows: number; hub: string; hubSub?: string; seed?: number}
  | {k: 'marquee'; y: number; rows: string[][]}
  | {k: 'video'; src: string; x: number; y: number; w: number; h: number; caption?: string; tilt?: number; startFrom?: number}
  | {k: 'shot'; src: string; pageW: number; pageH: number; x: number; y: number; w: number; h: number; url?: string; cam: Cam[]; marks?: Mark[]; cursor?: Cursor[]}
  | {k: 'ring'; target: string; pad?: number; tone?: 'green' | 'red'}
  | {k: 'logo'; x: number; y: number; size: number}
  | {k: 'rule'; x: number; y: number; w: number; tone?: 'green' | 'red'}
);
type Side = 'l' | 'r' | 't' | 'b';
type CodeLine = {t: string; tone?: 'dim' | 'green' | 'quran' | 'token' | 'plain'; at?: number; dt?: number; out?: number; outDt?: number};
type ListItem = {text: string; sub?: string; tag?: string; tagTone?: Tone; icon?: string; at?: number; dt?: number};
type Cam = {at: number; dt?: number; cx: number; cy: number; z: number; dur?: number};
type Mark = {at: number; dt?: number; out?: number; outDt?: number; box: Box; label?: string; tone?: 'green' | 'red'; dim?: boolean};
type Cursor = {at: number; dt?: number; x: number; y: number; click?: boolean};
type Sfx = 'pop' | 'tick' | 'whoosh' | 'type' | 'chime';

export type ExplainerScene =
  | {kind: 'chapter'; n: string; title: string; sub?: string; seconds: number}
  | {kind: 'canvas'; label?: string; title?: string; sub?: string; titleAt?: number; chrome?: boolean; center?: boolean; audio?: string; cues: number[]; seconds: number; els: El[]};

export type ExplainerSpec = {brand: string; site: string; music?: string; scenes: ExplainerScene[]};

export const explainerFrames = (spec: ExplainerSpec) => Math.max(1, spec.scenes.reduce((a, s) => a + Math.round(s.seconds * FPS), 0) + XF);

// ---------- palette, sampled from the reference ----------

const BG0 = '#f1f5f4';
const BG1 = '#d6e0de';
const INK = '#13201d';
const MUTED = '#64746f';
const LINE = '#dbe3e1';
const GREEN = '#0c9365';
const MINT = '#25c089';
const MINT_SOFT = '#e3f5ed';
const TEAL = '#10292a';
const TEAL2 = '#173a39';
const RED = '#d64545';
const GOLD = '#d39b20';
const BLUE = '#3b6fd8';

const TONES: Record<Tone, {bg: string; fg: string; sub: string; border: string; icon: string; shadow: string}> = {
  light: {bg: '#ffffff', fg: INK, sub: MUTED, border: '#ffffff', icon: GREEN, shadow: '0 18px 40px rgba(16,41,42,.12), 0 6px 0 #e3e9e8'},
  green: {bg: `linear-gradient(160deg, #19b77e, ${GREEN})`, fg: '#fff', sub: 'rgba(255,255,255,.8)', border: GREEN, icon: '#fff', shadow: '0 22px 44px rgba(12,147,101,.32), 0 7px 0 #087150'},
  mint: {bg: MINT_SOFT, fg: '#0b5e43', sub: '#3d7d66', border: '#bfe8d6', icon: GREEN, shadow: '0 14px 30px rgba(16,41,42,.08)'},
  dark: {bg: `linear-gradient(160deg, ${TEAL2}, ${TEAL})`, fg: '#fff', sub: 'rgba(255,255,255,.65)', border: TEAL, icon: MINT, shadow: '0 22px 44px rgba(16,41,42,.30), 0 7px 0 #07191a'},
  red: {bg: '#fff1f1', fg: '#a12a2a', sub: '#b85a5a', border: '#f2c4c4', icon: RED, shadow: '0 14px 30px rgba(161,42,42,.12)'},
  gold: {bg: '#fff7e2', fg: '#7a5608', sub: '#94701f', border: '#f1d793', icon: GOLD, shadow: '0 14px 30px rgba(211,155,32,.16)'},
  blue: {bg: '#eef3ff', fg: '#23439a', sub: '#4a63a8', border: '#cad7fb', icon: BLUE, shadow: '0 14px 30px rgba(59,111,216,.12)'},
  ghost: {bg: 'rgba(255,255,255,.55)', fg: MUTED, sub: MUTED, border: '#c9d4d2', icon: '#9fb0ac', shadow: 'none'},
};

// ---------- timing ----------

type Clock = {cues: number[]};
const CueCtx = React.createContext<Clock>({cues: [0]});
/** Seconds into the scene at which cue `at` (+dt) happens. */
const cueTime = (cues: number[], at = 0, dt = 0) => (at < 0 ? 0 : LEAD + (cues[Math.min(at, cues.length - 1)] ?? 0) + dt);
const useCue = () => {
  const {cues} = React.useContext(CueCtx);
  return (at = 0, dt = 0) => cueTime(cues, at, dt);
};

const useT = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {frame, t: frame / fps, fps};
};

/** Arrival and departure of any element: a short spring out of a blur, and back into one. */
const useLife = (e: Timed) => {
  const {frame, fps} = useT();
  const cue = useCue();
  const t0 = cue(e.at ?? 0, e.dt ?? 0);
  const f0 = Math.round(t0 * fps);
  const p = spring({frame: frame - f0, fps, config: {damping: 15, stiffness: 150, mass: 0.7}});
  const f1 = e.out != null ? Math.round(cue(e.out, e.outDt ?? 0) * fps) : null;
  const q = f1 == null ? 0 : interpolate(frame, [f1, f1 + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const visible = frame >= f0 - 1 && q < 1;
  const blur = (1 - p) * 12 + q * 12;
  return {
    visible, p, t0, f0,
    style: {opacity: Math.min(1, p * 1.4) * (1 - q), filter: blur > 0.3 ? `blur(${blur}px)` : undefined, transform: `translateY(${(1 - p) * 18}px) scale(${0.93 + 0.07 * p - 0.04 * q})`} as React.CSSProperties,
  };
};

// ---------- icons (40×40 line set) ----------

const ICONS: Record<string, React.ReactNode> = {
  doc: <path d="M10 4h13l8 8v24H10z M23 4v8h8 M15 20h11M15 26h11" />,
  search: <><circle cx="18" cy="18" r="10" /><path d="M26 26l9 9" /></>,
  chip: <><rect x="10" y="10" width="20" height="20" rx="4" /><path d="M16 4v6M24 4v6M16 30v6M24 30v6M4 16h6M4 24h6M30 16h6M30 24h6" /><rect x="15" y="15" width="10" height="10" rx="2" /></>,
  book: <path d="M6 8c5-2 9-2 14 1 5-3 9-3 14-1v24c-5-2-9-2-14 1-5-3-9-3-14-1z M20 9v24" />,
  scroll: <path d="M10 6h20a4 4 0 014 4v2h-6 M10 6a4 4 0 00-4 4v20a4 4 0 004 4h16a4 4 0 004-4V10 M14 15h10M14 21h10M14 27h6" />,
  check: <path d="M8 21l8 8 16-18" />,
  cross: <path d="M11 11l18 18M29 11L11 29" />,
  shield: <path d="M20 4l13 5v10c0 9-6 15-13 17-7-2-13-8-13-17V9z M14 20l4 4 8-8" />,
  person: <><circle cx="20" cy="14" r="7" /><path d="M6 36c2-8 8-11 14-11s12 3 14 11" /></>,
  users: <><circle cx="14" cy="14" r="6" /><circle cx="28" cy="16" r="5" /><path d="M4 34c1-7 5-10 10-10s9 3 10 10M24 34c1-5 3-8 7-8s6 2 7 8" /></>,
  video: <><rect x="5" y="10" width="22" height="20" rx="3" /><path d="M27 17l9-5v16l-9-5z" /></>,
  globe: <><circle cx="20" cy="20" r="14" /><path d="M6 20h28M20 6c5 5 5 23 0 28M20 6c-5 5-5 23 0 28" /></>,
  pen: <path d="M8 32l3-9 17-17 6 6-17 17z M24 10l6 6" />,
  lock: <><rect x="9" y="18" width="22" height="16" rx="3" /><path d="M14 18v-5a6 6 0 0112 0v5" /></>,
  unlock: <><rect x="9" y="18" width="22" height="16" rx="3" /><path d="M14 18v-5a6 6 0 0111.5-2.4" /></>,
  key: <><circle cx="13" cy="20" r="6" /><path d="M19 20h16M30 20v5M35 20v4" /></>,
  mic: <><rect x="14" y="4" width="12" height="20" rx="6" /><path d="M8 20c0 7 5 11 12 11s12-4 12-11M20 31v6" /></>,
  wave: <path d="M5 20h4l3-8 4 16 4-22 4 26 4-16 3 4h4" />,
  spark: <path d="M20 4l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" />,
  brain: <path d="M20 6c-6 0-9 4-9 8-4 0-6 3-6 7 0 4 3 7 7 7v3c0 3 3 5 8 5s8-2 8-5v-3c4 0 7-3 7-7 0-4-2-7-6-7 0-4-3-8-9-8z M20 6v30" />,
  db: <><ellipse cx="20" cy="9" rx="12" ry="4" /><path d="M8 9v22c0 2 5 4 12 4s12-2 12-4V9M8 20c0 2 5 4 12 4s12-2 12-4" /></>,
  layers: <path d="M20 5l14 7-14 7-14-7z M6 20l14 7 14-7M6 28l14 7 14-7" />,
  chat: <path d="M6 8h28v18H18l-8 7v-7H6z" />,
  question: <><circle cx="20" cy="20" r="14" /><path d="M15 16a5 5 0 1110 0c0 4-5 4-5 8M20 29v.5" /></>,
  alert: <><path d="M20 5l16 28H4z" /><path d="M20 16v8M20 28v.5" /></>,
  scale: <path d="M20 5v30M10 35h20M6 12h28M10 12l-5 11h10zM30 12l-5 11h10z" />,
  film: <><rect x="5" y="7" width="30" height="26" rx="3" /><path d="M5 14h30M5 26h30M12 7v7M20 7v7M28 7v7M12 26v7M20 26v7M28 26v7" /></>,
  child: <><circle cx="20" cy="11" r="5" /><path d="M12 36l3-14h10l3 14M14 24l-6-4M26 24l6-4" /></>,
  home: <path d="M6 19l14-12 14 12M10 16v18h20V16" />,
  play: <path d="M13 9l18 11-18 11z" />,
  link: <path d="M17 23l6-6M14 26l-3 3a5 5 0 01-7-7l6-6a5 5 0 017 0M26 14l3-3a5 5 0 017 7l-6 6a5 5 0 01-7 0" />,
  code: <path d="M14 12l-8 8 8 8M26 12l8 8-8 8M23 8l-6 24" />,
  flag: <path d="M8 36V6h20l-4 7 4 7H8" />,
  heart: <path d="M20 34S6 25 6 15c0-5 4-8 8-8 3 0 5 2 6 4 1-2 3-4 6-4 4 0 8 3 8 8 0 10-14 19-14 19z" />,
  sun: <><circle cx="20" cy="20" r="6" /><path d="M20 4v5M20 31v5M4 20h5M31 20h5M9 9l3 3M28 28l3 3M9 31l3-3M28 12l3-3" /></>,
  star: <path d="M20 5l4.5 9.5 10.5 1.5-7.5 7 2 10.5L20 28.5 10.5 33.5l2-10.5-7.5-7 10.5-1.5z" />,
  cal: <><rect x="6" y="9" width="28" height="25" rx="3" /><path d="M6 16h28M13 5v7M27 5v7" /></>,
  mail: <><rect x="5" y="9" width="30" height="22" rx="3" /><path d="M5 11l15 11 15-11" /></>,
  bell: <path d="M10 28V18a10 10 0 0120 0v10l3 3H7z M17 34a3 3 0 006 0" />,
  folder: <path d="M5 11h11l3 4h16v18H5z" />,
  tag: <path d="M6 20V6h14l14 14-14 14z M13 13h.1" />,
  quote: <path d="M8 26c0-6 3-11 9-13M8 26a4 4 0 108 0 4 4 0 00-8 0M23 26c0-6 3-11 9-13M23 26a4 4 0 108 0 4 4 0 00-8 0" />,
  gear: <><circle cx="20" cy="20" r="5" /><path d="M20 4v6M20 30v6M4 20h6M30 20h6M8.7 8.7l4.2 4.2M27.1 27.1l4.2 4.2M8.7 31.3l4.2-4.2M27.1 12.9l4.2-4.2" /></>,
};
const Icon: React.FC<{name?: string; color?: string; size?: number; w?: number}> = ({name = 'doc', color = GREEN, size = 40, w = 2.6}) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
    {ICONS[name] ?? ICONS.doc}
  </svg>
);

// ---------- background and chrome ----------

const Backdrop: React.FC<{dark?: boolean}> = ({dark}) => {
  const {frame} = useT();
  const drift = (frame * 0.15) % 320;
  const c = dark ? 'rgba(37,192,137,.10)' : 'rgba(16,41,42,.045)';
  return (
    <AbsoluteFill style={{background: dark ? `radial-gradient(ellipse at 70% 30%, ${TEAL2} 0%, ${TEAL} 70%)` : `radial-gradient(ellipse at 55% 40%, ${BG0} 0%, #e7eeec 55%, ${BG1} 100%)`}}>
      <svg width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={dark ? 'cd' : 'cl'} width="320" height="320" patternUnits="userSpaceOnUse" patternTransform={`translate(${-drift} 0)`}>
            <path d="M0 60h90l30 30h80l20-20h100M40 320v-70l40-40h90l30 30v80M200 0v40l30 30h90M0 200h50l20 20v100" fill="none" stroke={c} strokeWidth="2" />
            <circle cx="90" cy="60" r="3.5" fill={c} /><circle cx="200" cy="90" r="3.5" fill={c} /><circle cx="170" cy="210" r="3.5" fill={c} /><circle cx="230" cy="70" r="3.5" fill={c} />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill={`url(#${dark ? 'cd' : 'cl'})`} />
      </svg>
      <AbsoluteFill style={{background: dark ? 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.35) 100%)' : 'radial-gradient(ellipse at center, transparent 55%, rgba(16,41,42,.08) 100%)'}} />
    </AbsoluteFill>
  );
};

const Brand: React.FC<{brand: string; site: string; dark?: boolean}> = ({brand, site, dark}) => (
  <div style={{position: 'absolute', top: 34, left: 52, display: 'flex', alignItems: 'center', gap: 12, direction: 'ltr'}}>
    <div style={{width: 38, height: 38, borderRadius: 11, background: dark ? MINT : GREEN, color: dark ? TEAL : '#fff', display: 'grid', placeItems: 'center', fontFamily: title, fontWeight: 800, fontSize: 21}}>ب</div>
    <div style={{fontFamily: title, fontWeight: 800, fontSize: 21, color: dark ? '#fff' : INK}}>{brand}</div>
    <div style={{fontFamily: body, fontSize: 18, color: dark ? 'rgba(255,255,255,.6)' : MUTED}}>· {site}</div>
  </div>
);

/** The chapter pill at the top right: "03 · المشكلة". */
const ChapterPill: React.FC<{label: string}> = ({label}) => {
  const [n, ...rest] = label.split(' ');
  return (
    <div style={{position: 'absolute', top: 30, right: 52, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.85)', borderRadius: 999, padding: '8px 20px 8px 20px', boxShadow: '0 6px 18px rgba(16,41,42,.08)', direction: 'rtl'}}>
      <span style={{fontFamily: mono, fontWeight: 800, fontSize: 18, color: GREEN}}>{n}</span>
      <span style={{fontFamily: title, fontWeight: 700, fontSize: 19, color: INK}}>{rest.join(' ')}</span>
    </div>
  );
};

const Title: React.FC<{title: string; sub?: string; at?: number; center?: boolean}> = ({title: text, sub, at = 0, center}) => {
  const a = useLife({at, dt: 0});
  const b = useLife({at, dt: 0.35});
  return (
    <div style={{position: 'absolute', top: center ? 330 : 100, right: center ? 0 : 96, left: center ? 0 : undefined, textAlign: center ? 'center' : 'right', direction: 'rtl'}}>
      <div style={{fontFamily: title, fontWeight: 800, fontSize: center ? 92 : 62, lineHeight: 1.2, color: INK, ...a.style}}>{text}</div>
      {sub && <div style={{marginTop: 10, fontFamily: body, fontWeight: 600, fontSize: center ? 32 : 26, color: GREEN, ...b.style}}>{sub}</div>}
    </div>
  );
};

// ---------- elements ----------

type Geo = Record<string, {x: number; y: number; w: number; h: number}>;
const GeoCtx = React.createContext<Geo>({});

const RichText: React.FC<{text: string}> = ({text}) => {
  // <g>…</g> green highlight, <r>…</r> red highlight, <b>…</b> bold green word
  const parts = text.split(/(<[grb]>.*?<\/[grb]>)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^<([grb])>(.*)<\/[grb]>$/);
        if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
        if (m[1] === 'b') return <span key={i} style={{color: GREEN}}>{m[2]}</span>;
        const red = m[1] === 'r';
        return <span key={i} style={{background: red ? '#ffd9d9' : '#c8f1de', color: red ? '#a12a2a' : '#06603f', borderRadius: 10, padding: '0 10px', boxShadow: `inset 0 -3px 0 ${red ? RED : MINT}`}}>{m[2]}</span>;
      })}
    </>
  );
};

const CardEl: React.FC<{e: Extract<El, {k: 'card'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible || e.hidden) return null;
  const st = TONES[e.tone ?? 'light'];
  const w = e.w ?? 200, h = e.h ?? 132;
  const s = e.size ?? 1;
  const horizontal = w > h * 2.1;
  return (
    <div style={{position: 'absolute', left: e.x - w / 2, top: e.y - h / 2, width: w, height: h, ...life.style, transform: `${life.style.transform} ${e.tilt ? `perspective(900px) rotateY(${e.tilt}deg)` : ''}`}}>
      <div style={{width: '100%', height: '100%', borderRadius: 22 * Math.min(1, s), background: st.bg, border: e.tone === 'ghost' ? `2px dashed ${st.border}` : `1.5px solid ${st.border}`, boxShadow: st.shadow, color: st.fg, display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'center', justifyContent: horizontal ? 'flex-start' : 'center', gap: horizontal ? 18 : 8, padding: horizontal ? '0 26px' : '12px 14px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden', direction: 'rtl'}}>
        {e.bar && <span style={{position: 'absolute', right: 0, top: 14, bottom: 14, width: 6, borderRadius: 3, background: e.bar}} />}
        {e.icon && <Icon name={e.icon} color={st.icon} size={(horizontal ? 38 : 44) * s} />}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: horizontal ? 'flex-start' : 'center', gap: 4, minWidth: 0}}>
          <div style={{fontFamily: e.mono ? mono : title, fontWeight: 800, fontSize: 24 * s, lineHeight: 1.3, textAlign: horizontal ? 'right' : 'center', direction: e.mono ? 'ltr' : 'rtl', unicodeBidi: 'plaintext', whiteSpace: horizontal && e.label.length <= 28 ? 'nowrap' : undefined}}>{e.label}</div>
          {e.sub && <div style={{fontFamily: body, fontWeight: 500, fontSize: 17 * s, color: st.sub, textAlign: horizontal ? 'right' : 'center', lineHeight: 1.4, unicodeBidi: 'plaintext'}}>{e.sub}</div>}
        </div>
      </div>
    </div>
  );
};

const anchor = (g: {x: number; y: number; w: number; h: number}, side: Side) => {
  switch (side) {
    case 'l': return {x: g.x - g.w / 2, y: g.y};
    case 'r': return {x: g.x + g.w / 2, y: g.y};
    case 't': return {x: g.x, y: g.y - g.h / 2};
    default: return {x: g.x, y: g.y + g.h / 2};
  }
};

const EdgeEl: React.FC<{e: Extract<El, {k: 'edge'}>}> = ({e}) => {
  const geo = React.useContext(GeoCtx);
  const {frame, fps} = useT();
  const cue = useCue();
  const A = geo[e.a], B = geo[e.b];
  const life = useLife({...e, sfx: null});
  if (!A || !B || !life.visible) return null;
  const horiz = Math.abs(B.x - A.x) > Math.abs(B.y - A.y);
  const sa = e.fromSide ?? (horiz ? (B.x > A.x ? 'r' : 'l') : (B.y > A.y ? 'b' : 't'));
  const sb = e.toSide ?? (horiz ? (B.x > A.x ? 'l' : 'r') : (B.y > A.y ? 't' : 'b'));
  const p1 = anchor(A, sa), p2 = anchor(B, sb);
  const bend = e.bend ?? 0;
  const k = 0.5;
  const c1 = sa === 'l' || sa === 'r' ? {x: p1.x + (p2.x - p1.x) * k, y: p1.y + bend} : {x: p1.x + bend, y: p1.y + (p2.y - p1.y) * k};
  const c2 = sb === 'l' || sb === 'r' ? {x: p2.x - (p2.x - p1.x) * k, y: p2.y + bend} : {x: p2.x + bend, y: p2.y - (p2.y - p1.y) * k};
  const d = `M${p1.x} ${p1.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) * 1.25 + Math.abs(bend);
  const t0 = cue(e.at ?? 0, e.dt ?? 0) * fps;
  const draw = interpolate(frame - t0, [0, fps * 0.55], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const color = {green: MINT, red: RED, grey: '#b7c3c0', blue: BLUE, gold: GOLD}[e.tone ?? 'green'];
  const dotP = interpolate(frame - t0 - fps * 0.5, [0, fps * 1.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const pt = (u: number) => {
    const v = 1 - u;
    return {x: v * v * v * p1.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * p2.x, y: v * v * v * p1.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * p2.y};
  };
  const dot = pt(dotP), mid = pt(0.5);
  return (
    <>
      <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: life.style.opacity}}>
        <path d={d} fill="none" stroke={color} strokeWidth={e.width ?? 4} strokeLinecap="round" strokeDasharray={e.dashed ? '2 12' : `${len}`} strokeDashoffset={e.dashed ? 0 : len * (1 - draw)} opacity={e.dashed ? draw : 1} />
        <circle cx={p1.x} cy={p1.y} r={6} fill="#fff" stroke={color} strokeWidth={3} opacity={draw} />
        <circle cx={p2.x} cy={p2.y} r={6} fill="#fff" stroke={color} strokeWidth={3} opacity={draw >= 1 ? 1 : 0} />
        {e.dot !== false && dotP > 0 && dotP < 1 && <circle cx={dot.x} cy={dot.y} r={8} fill={color} style={{filter: `drop-shadow(0 0 8px ${color})`}} />}
      </svg>
      {e.label && draw > 0.6 && (
        <div style={{position: 'absolute', left: mid.x, top: mid.y, transform: 'translate(-50%,-50%)', opacity: interpolate(draw, [0.6, 1], [0, 1])}}>
          <PillBox text={e.label} tone={e.tone === 'red' ? 'red' : e.tone === 'gold' ? 'gold' : 'mint'} size={0.85} />
        </div>
      )}
    </>
  );
};

const PillBox: React.FC<{text: string; tone?: Tone; icon?: string; size?: number}> = ({text, tone = 'green', icon, size = 1}) => {
  const st = tone === 'green' ? {bg: GREEN, fg: '#fff', icon: '#fff', border: GREEN} : tone === 'dark' ? {bg: TEAL, fg: '#fff', icon: MINT, border: TEAL} : {bg: TONES[tone].bg, fg: TONES[tone].fg, icon: TONES[tone].icon, border: TONES[tone].border};
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: 10 * size, background: st.bg, color: st.fg, border: `1.5px solid ${st.border}`, borderRadius: 999, padding: `${9 * size}px ${20 * size}px`, fontFamily: title, fontWeight: 700, fontSize: 22 * size, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(16,41,42,.14)', direction: 'rtl'}}>
      {icon && <Icon name={icon} color={st.icon} size={24 * size} w={3.4} />}
      <span style={{unicodeBidi: 'plaintext'}}>{text}</span>
    </div>
  );
};

const PillEl: React.FC<{e: Extract<El, {k: 'pill'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  const tx = e.anchor === 'right' ? '-100%' : e.anchor === 'left' ? '0' : '-50%';
  return (
    <div style={{position: 'absolute', left: e.x, top: e.y, transform: `translate(${tx}, -50%)`}}>
      <div style={life.style}><PillBox text={e.text} tone={e.tone} icon={e.icon} size={e.size} /></div>
    </div>
  );
};

const TextEl: React.FC<{e: Extract<El, {k: 'text'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  const font = {title, body, mono, quran, amiri}[e.font ?? 'body'];
  const align = e.align ?? 'right';
  const w = e.w ?? 1400;
  const left = align === 'right' ? e.x - w : align === 'center' ? e.x - w / 2 : e.x;
  return (
    <div style={{position: 'absolute', left, top: e.y, width: w, textAlign: align, direction: e.font === 'mono' ? 'ltr' : 'rtl', fontFamily: font, fontWeight: e.weight ?? (e.font === 'title' ? 800 : 500), fontSize: e.size ?? 30, color: e.color ?? INK, lineHeight: e.lh ?? (e.font === 'quran' ? 2.1 : 1.5), ...life.style}}>
      <RichText text={e.text} />
    </div>
  );
};

const StatEl: React.FC<{e: Extract<El, {k: 'stat'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  const s = e.size ?? 1;
  const color = e.tone === 'red' ? RED : e.tone === 'gold' ? GOLD : e.tone === 'dark' ? TEAL : GREEN;
  const w = e.w ?? 420 * s;
  return (
    <div style={{position: 'absolute', left: e.x - w / 2, top: e.y, width: w, textAlign: 'center', ...life.style}}>
      <div style={{fontFamily: mono, fontWeight: 800, fontSize: 120 * s, color, lineHeight: 1, letterSpacing: -2, direction: 'ltr'}}>{e.value}</div>
      <div style={{fontFamily: title, fontWeight: 700, fontSize: 28 * s, color: INK, marginTop: 14 * s, lineHeight: 1.4}}>{e.label}</div>
    </div>
  );
};

const CodeEl: React.FC<{e: Extract<El, {k: 'code'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  return (
    <div style={{position: 'absolute', left: e.x - e.w / 2, top: e.y, width: e.w, borderRadius: 22, background: `linear-gradient(170deg, ${TEAL2}, ${TEAL})`, boxShadow: '0 30px 60px rgba(16,41,42,.30), 0 8px 0 #07191a', overflow: 'hidden', ...life.style}}>
      <div style={{height: 50, display: 'flex', alignItems: 'center', gap: 9, padding: '0 22px', borderBottom: '1px solid rgba(255,255,255,.08)', direction: 'ltr'}}>
        <span style={{width: 13, height: 13, borderRadius: 7, background: '#ff6b6b'}} /><span style={{width: 13, height: 13, borderRadius: 7, background: '#ffc94d'}} /><span style={{width: 13, height: 13, borderRadius: 7, background: MINT}} />
        {e.title && <span style={{marginLeft: 14, fontFamily: mono, fontSize: 17, color: 'rgba(255,255,255,.55)'}}>{e.title}</span>}
      </div>
      <div style={{padding: '22px 34px 30px', display: 'flex', flexDirection: 'column', gap: 10}}>
        {e.lines.map((l, i) => <CodeRow key={i} l={l} />)}
      </div>
    </div>
  );
};

const CodeRow: React.FC<{l: CodeLine}> = ({l}) => {
  const life = useLife({at: l.at ?? 0, dt: l.dt ?? 0, out: l.out, outDt: l.outDt});
  if (!life.visible) return null;
  const tone = l.tone ?? 'plain';
  const style: React.CSSProperties =
    tone === 'quran' ? {fontFamily: quran, fontSize: 38, color: '#bff5dc', lineHeight: 2.0, direction: 'rtl', textAlign: 'right'}
    : tone === 'token' ? {fontFamily: mono, fontWeight: 800, fontSize: 40, color: GOLD, direction: 'ltr', textAlign: 'right'}
    : tone === 'dim' ? {fontFamily: mono, fontSize: 19, color: 'rgba(255,255,255,.45)', direction: 'rtl', textAlign: 'right'}
    : tone === 'green' ? {fontFamily: title, fontWeight: 700, fontSize: 26, color: MINT, direction: 'rtl', textAlign: 'right'}
    : {fontFamily: body, fontWeight: 500, fontSize: 28, color: '#fff', lineHeight: 1.6, direction: 'rtl', textAlign: 'right'};
  return <div style={{...style, ...life.style, transform: undefined}}>{tone === 'token' ? <span style={{background: 'rgba(211,155,32,.15)', border: `2px dashed ${GOLD}`, borderRadius: 12, padding: '2px 16px'}}>{l.t}</span> : l.t}</div>;
};

const ChatEl: React.FC<{e: Extract<El, {k: 'chat'}>}> = ({e}) => {
  const life = useLife(e);
  const {t} = useT();
  const cue = useCue();
  if (!life.visible) return null;
  const t1 = cue(e.at ?? 0, (e.dt ?? 0) + 0.9);
  const t2 = cue(e.until, 0);
  const all = e.reply.join('\n');
  const n = Math.floor(interpolate(t, [t1, t2], [0, all.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const shown = all.slice(0, n).split('\n');
  return (
    <div style={{position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h, ...life.style, transform: `${life.style.transform} perspective(1400px) rotateY(${e.tilt ?? 0}deg)`}}>
      <div style={{width: '100%', height: '100%', borderRadius: 26, background: '#fff', boxShadow: '0 40px 80px rgba(16,41,42,.22), 0 8px 0 #e3e9e8', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
        <div style={{height: 54, background: '#f3f6f5', display: 'flex', alignItems: 'center', gap: 9, padding: '0 22px', direction: 'ltr', borderBottom: `1px solid ${LINE}`}}>
          <span style={{width: 13, height: 13, borderRadius: 7, background: '#ff6b6b'}} /><span style={{width: 13, height: 13, borderRadius: 7, background: '#ffc94d'}} /><span style={{width: 13, height: 13, borderRadius: 7, background: MINT}} />
          <span style={{marginLeft: 14, fontFamily: title, fontWeight: 700, fontSize: 18, color: MUTED}}>AI Chat</span>
        </div>
        <div style={{flex: 1, padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 18, direction: 'rtl'}}>
          <div style={{alignSelf: 'flex-start', maxWidth: '82%', background: MINT_SOFT, color: '#0b5e43', borderRadius: '22px 22px 6px 22px', padding: '14px 22px', fontFamily: body, fontWeight: 600, fontSize: 24, lineHeight: 1.5}}>{e.prompt}</div>
          {n > 0 && (
            <div style={{alignSelf: 'flex-end', width: '92%', background: '#f6f8f8', border: `1px solid ${LINE}`, borderRadius: '22px 22px 22px 6px', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 12}}>
              {shown.map((line, i) => (
                <div key={i} style={{fontFamily: /[ًٌٍَُِّْ]/.test(line) ? amiri : body, fontWeight: 500, fontSize: /[ًٌٍَُِّْ]/.test(line) ? 27 : 23, color: INK, lineHeight: 1.6}}>
                  {line}{i === shown.length - 1 && n < all.length && <span style={{display: 'inline-block', width: 3, height: 26, background: GREEN, marginRight: 4, verticalAlign: 'middle'}} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {e.caption && <div style={{position: 'absolute', bottom: -48, left: 0, right: 0, textAlign: 'center', fontFamily: body, fontSize: 20, color: MUTED}}>{e.caption}</div>}
    </div>
  );
};

const LayersEl: React.FC<{e: Extract<El, {k: 'layers'}>}> = ({e}) => (
  <>
    {e.items.map((it, i) => <Layer key={i} x={e.x} y={e.y - i * 120} it={it} z={i} />)}
  </>
);

const Layer: React.FC<{x: number; y: number; z: number; it: {label: string; sub?: string; tone: Tone; at: number; dt?: number}}> = ({x, y, it, z}) => {
  const life = useLife({at: it.at, dt: it.dt});
  if (!life.visible) return null;
  const st = TONES[it.tone];
  const drop = (1 - life.p) * -120;
  return (
    <>
      <div style={{position: 'absolute', left: x - 210, top: y - 210 + drop, width: 420, height: 420, zIndex: z, opacity: life.style.opacity, filter: life.style.filter}}>
        <div style={{width: 300, height: 300, margin: 60, borderRadius: 34, background: st.bg, border: `2px solid ${st.border}`, transform: 'rotateX(58deg) rotateZ(-45deg)', boxShadow: `0 ${18}px 0 ${it.tone === 'dark' ? '#07191a' : it.tone === 'green' ? '#087150' : '#cfd9d7'}, 0 40px 60px rgba(16,41,42,.25)`}} />
      </div>
      <div style={{position: 'absolute', left: x + 200, top: y - 22 + drop * 0.4, display: 'flex', alignItems: 'center', gap: 18, zIndex: 20, ...life.style, transform: undefined}}>
        <span style={{width: 70, height: 2, background: '#9fb0ac'}} />
        <div style={{direction: 'rtl'}}>
          <div style={{fontFamily: title, fontWeight: 800, fontSize: 32, color: INK}}>{it.label}</div>
          {it.sub && <div style={{fontFamily: body, fontWeight: 600, fontSize: 22, color: GREEN}}>{it.sub}</div>}
        </div>
      </div>
    </>
  );
};

const ListEl: React.FC<{e: Extract<El, {k: 'list'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  return (
    <div style={{position: 'absolute', left: e.x - e.w / 2, top: e.y, width: e.w, background: '#fff', borderRadius: 24, boxShadow: '0 22px 50px rgba(16,41,42,.13), 0 6px 0 #e3e9e8', padding: '22px 30px', direction: 'rtl', ...life.style}}>
      {e.title && <div style={{fontFamily: title, fontWeight: 800, fontSize: 24, color: INK, marginBottom: 10}}>{e.title}</div>}
      {e.items.map((it, i) => <ListRow key={i} it={it} last={i === e.items.length - 1} />)}
    </div>
  );
};

const ListRow: React.FC<{it: ListItem; last: boolean}> = ({it, last}) => {
  const life = useLife({at: it.at ?? 0, dt: it.dt ?? 0});
  const tag = it.tagTone ?? 'mint';
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: last ? 'none' : `1px solid ${LINE}`, opacity: life.visible ? life.style.opacity : 0, filter: life.style.filter}}>
      {it.icon && <Icon name={it.icon} color={GREEN} size={30} />}
      <div style={{flex: 1}}>
        <div style={{fontFamily: body, fontWeight: 600, fontSize: 23, color: INK, lineHeight: 1.45}}>{it.text}</div>
        {it.sub && <div style={{fontFamily: body, fontSize: 17, color: MUTED, marginTop: 2}}>{it.sub}</div>}
      </div>
      {it.tag && <span style={{background: TONES[tag].bg, color: TONES[tag].fg, border: `1.5px solid ${TONES[tag].border}`, borderRadius: 999, padding: '4px 16px', fontFamily: title, fontWeight: 700, fontSize: 18, whiteSpace: 'nowrap', transform: `scale(${0.6 + 0.4 * life.p})`}}>{it.tag}</span>}
    </div>
  );
};

const StepperEl: React.FC<{e: Extract<El, {k: 'stepper'}>}> = ({e}) => {
  const life = useLife(e);
  const {t} = useT();
  const cue = useCue();
  if (!life.visible) return null;
  const doneAt = e.done.map((d) => (d == null ? Infinity : d < 0 ? -1 : cue(d)));
  const active = doneAt.findIndex((d) => t < d);
  return (
    <div style={{position: 'absolute', top: e.y ?? 100, left: 0, right: 0, display: 'flex', justifyContent: 'center', ...life.style}}>
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0, direction: 'rtl', background: 'rgba(255,255,255,.75)', padding: '10px 18px', borderRadius: 999, boxShadow: '0 8px 24px rgba(16,41,42,.08)'}}>
        {e.steps.map((s, i) => {
          const done = t >= doneAt[i];
          const on = i === active;
          const p = done ? Math.min(1, (t - doneAt[i]) * 4) : 0;
          return (
            <React.Fragment key={s}>
              {i > 0 && <span style={{width: 34, height: 3, borderRadius: 2, background: t >= doneAt[i - 1] ? MINT : '#cfd9d7'}} />}
              <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, background: on ? GREEN : 'transparent', color: on ? '#fff' : done ? GREEN : MUTED, fontFamily: title, fontWeight: 700, fontSize: 20, transition: 'none'}}>
                <span style={{width: 28, height: 28, borderRadius: 14, display: 'grid', placeItems: 'center', background: done ? MINT : on ? '#fff' : '#e3e9e8', color: on ? GREEN : '#fff', fontFamily: mono, fontWeight: 800, fontSize: 15}}>
                  {done ? <span style={{transform: `scale(${0.4 + 0.6 * p})`, display: 'grid'}}><Icon name="check" color="#fff" size={20} w={4} /></span> : <span style={{color: on ? GREEN : MUTED}}>{i + 1}</span>}
                </span>
                {s}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const WALL_ICONS = ['book', 'scroll', 'globe', 'users', 'video', 'mic', 'shield', 'chat', 'search', 'doc', 'child', 'quote', 'pen', 'star', 'heart', 'play', 'film', 'flag', 'layers', 'sun', 'person', 'cal', 'tag', 'link'];
const WallEl: React.FC<{e: Extract<El, {k: 'wall'}>}> = ({e}) => {
  const {frame, fps} = useT();
  const cue = useCue();
  const life = useLife(e);
  if (!life.visible) return null;
  const t0 = cue(e.at ?? 0, e.dt ?? 0) * fps;
  const S = 74, G = 18;
  const W = e.cols * S + (e.cols - 1) * G, H = e.rows * S + (e.rows - 1) * G;
  const cx = (e.cols - 1) / 2, cy = (e.rows - 1) / 2;
  let seed = e.seed ?? 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const tiles: React.ReactNode[] = [];
  const lines: React.ReactNode[] = [];
  for (let r = 0; r < e.rows; r++) for (let c = 0; c < e.cols; c++) {
    if (Math.abs(c - cx) < 1.6 && Math.abs(r - cy) < 1.1) continue;
    const d = Math.hypot(c - cx, r - cy);
    const p = spring({frame: frame - t0 - d * 3, fps, config: {damping: 14, stiffness: 160}});
    const v = rnd();
    const dark = v > 0.86, green = v > 0.78 && !dark;
    const icon = WALL_ICONS[Math.floor(rnd() * WALL_ICONS.length)];
    const x = c * (S + G), y = r * (S + G);
    if (v > 0.9 && p > 0.5) lines.push(<line key={`${r}-${c}`} x1={W / 2} y1={H / 2} x2={x + S / 2} y2={y + S / 2} stroke={MINT} strokeWidth={2.5} opacity={0.7 * Math.min(1, p)} />);
    tiles.push(
      <div key={`${r}-${c}`} style={{position: 'absolute', left: x, top: y, width: S, height: S, borderRadius: 18, background: dark ? TEAL : green ? GREEN : '#fff', boxShadow: '0 8px 18px rgba(16,41,42,.10)', display: 'grid', placeItems: 'center', opacity: Math.min(1, p), transform: `scale(${0.5 + 0.5 * p})`, filter: p < 0.95 ? `blur(${(1 - p) * 6}px)` : undefined}}>
        <Icon name={icon} color={dark ? MINT : green ? '#fff' : '#5b6d68'} size={34} w={2.4} />
      </div>,
    );
  }
  return (
    <div style={{position: 'absolute', left: e.x - W / 2, top: e.y - H / 2, width: W, height: H, opacity: life.style.opacity}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>{lines}</svg>
      {tiles}
      <div style={{position: 'absolute', left: W / 2 - 120, top: H / 2 - 82, width: 240, height: 164, borderRadius: 30, background: `linear-gradient(160deg, ${TEAL2}, ${TEAL})`, boxShadow: '0 30px 60px rgba(16,41,42,.35), 0 8px 0 #07191a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fff'}}>
        <div style={{width: 64, height: 64, borderRadius: 18, background: MINT, color: TEAL, display: 'grid', placeItems: 'center', fontFamily: title, fontWeight: 800, fontSize: 38}}>ب</div>
        <div style={{fontFamily: title, fontWeight: 800, fontSize: 30}}>{e.hub}</div>
        {e.hubSub && <div style={{fontFamily: body, fontSize: 17, color: 'rgba(255,255,255,.65)'}}>{e.hubSub}</div>}
      </div>
    </div>
  );
};

const MarqueeEl: React.FC<{e: Extract<El, {k: 'marquee'}>}> = ({e}) => {
  const {frame} = useT();
  const life = useLife(e);
  if (!life.visible) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: e.y, opacity: (life.style.opacity as number) * 0.55, filter: 'blur(1.2px)'}}>
      {e.rows.map((row, i) => (
        <div key={i} style={{display: 'flex', gap: 22, marginBottom: 26, transform: `translateX(${(i % 2 ? -1 : 1) * (frame * 1.1) - 400 - i * 140}px)`, whiteSpace: 'nowrap', direction: 'rtl'}}>
          {[...row, ...row, ...row].map((s, j) => (
            <span key={j} style={{background: j % 4 === 1 ? MINT_SOFT : '#fff', color: j % 4 === 1 ? GREEN : MUTED, borderRadius: 14, padding: '12px 24px', fontFamily: body, fontWeight: 600, fontSize: 24, boxShadow: '0 6px 14px rgba(16,41,42,.06)'}}>{s}</span>
          ))}
        </div>
      ))}
    </div>
  );
};

const VideoEl: React.FC<{e: Extract<El, {k: 'video'}>}> = ({e}) => {
  const life = useLife(e);
  const {fps} = useT();
  const cue = useCue();
  if (!life.visible) return null;
  const from = Math.round(cue(e.at ?? 0, e.dt ?? 0) * fps);
  return (
    <div style={{position: 'absolute', left: e.x, top: e.y, width: e.w, ...life.style, transform: `${life.style.transform} perspective(1600px) rotateY(${e.tilt ?? 0}deg)`}}>
      <div style={{width: e.w, height: e.h, borderRadius: 24, overflow: 'hidden', background: TEAL, boxShadow: '0 30px 60px rgba(16,41,42,.25), 0 7px 0 #cfd9d7'}}>
        <Sequence from={from} layout="none">
          <OffthreadVideo src={asSrc(e.src)} muted startFrom={Math.round((e.startFrom ?? 0) * fps)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </Sequence>
      </div>
      {e.caption && <div style={{marginTop: 18, textAlign: 'center'}}><PillBox text={e.caption} tone="light" size={0.85} /></div>}
    </div>
  );
};

/** A real page of the site in a browser window, filmed by a camera that pans and zooms between cues. */
const ShotEl: React.FC<{e: Extract<El, {k: 'shot'}>}> = ({e}) => {
  const life = useLife(e);
  const {t, frame, fps} = useT();
  const cue = useCue();
  if (!life.visible) return null;
  const BAR = 50;
  const vw = e.w, vh = e.h - BAR;
  // camera: hold each keyframe, glide to the next one over `dur` seconds
  let cam = e.cam[0];
  let cx = cam.cx, cy = cam.cy, z = cam.z;
  for (let i = 1; i < e.cam.length; i++) {
    const k = e.cam[i];
    const s = cue(k.at, k.dt ?? 0);
    const u = interpolate(t, [s, s + (k.dur ?? 1.1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
    if (u <= 0) break;
    cx = cx + (k.cx - cx) * u; cy = cy + (k.cy - cy) * u; z = z + (k.z - z) * u;
    cam = k;
  }
  // keep the camera inside the page
  const halfW = vw / 2 / z, halfH = vh / 2 / z;
  cx = Math.min(Math.max(cx, halfW), e.pageW - halfW);
  cy = Math.min(Math.max(cy, halfH), Math.max(halfH, e.pageH - halfH));
  const toScreen = (x: number, y: number) => ({x: (x - cx) * z + vw / 2, y: (y - cy) * z + vh / 2});
  // cursor
  let cur: {x: number; y: number} | null = null;
  let clickAge = 99;
  if (e.cursor?.length) {
    let c = {x: e.cursor[0].x, y: e.cursor[0].y};
    const tStart = cue(e.cursor[0].at, e.cursor[0].dt ?? 0);
    for (let i = 0; i < e.cursor.length; i++) {
      const k = e.cursor[i];
      const s = cue(k.at, k.dt ?? 0);
      const u = interpolate(t, [s, s + 0.7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
      if (u <= 0) break;
      c = {x: c.x + (k.x - c.x) * u, y: c.y + (k.y - c.y) * u};
      if (k.click && t >= s + 0.7) clickAge = t - (s + 0.7);
    }
    if (t >= tStart) cur = toScreen(c.x, c.y);
  }
  return (
    <div style={{position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h, borderRadius: 22, overflow: 'hidden', background: '#fff', boxShadow: '0 34px 70px rgba(16,41,42,.22), 0 7px 0 #cfd9d7', ...life.style}}>
      <div style={{height: BAR, background: '#f3f6f5', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', direction: 'ltr'}}>
        <span style={{width: 13, height: 13, borderRadius: 7, background: '#ff6b6b'}} /><span style={{width: 13, height: 13, borderRadius: 7, background: '#ffc94d'}} /><span style={{width: 13, height: 13, borderRadius: 7, background: MINT}} />
        <div style={{marginLeft: 18, flex: 1, maxWidth: 760, height: 30, borderRadius: 9, background: '#fff', border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', fontFamily: mono, fontSize: 16, color: MUTED}}>
          <Icon name="lock" color={GREEN} size={16} w={3} />{e.url ?? 'balagh.space'}
        </div>
      </div>
      <div style={{position: 'relative', width: vw, height: vh, overflow: 'hidden', background: '#f7f6f2'}}>
        <Img src={asSrc(e.src)} style={{position: 'absolute', left: 0, top: 0, width: e.pageW, height: e.pageH, transformOrigin: '0 0', transform: `translate(${vw / 2 - cx * z}px, ${vh / 2 - cy * z}px) scale(${z})`, maxWidth: 'none'}} />
        {(e.marks ?? []).map((m, i) => <MarkBox key={i} m={m} toScreen={toScreen} z={z} />)}
        {cur && (
          <div style={{position: 'absolute', left: cur.x, top: cur.y, pointerEvents: 'none'}}>
            {clickAge < 0.6 && <span style={{position: 'absolute', left: -30 - clickAge * 30, top: -30 - clickAge * 30, width: 60 + clickAge * 60, height: 60 + clickAge * 60, borderRadius: '50%', border: `4px solid ${MINT}`, opacity: 1 - clickAge / 0.6}} />}
            <svg width="34" height="40" viewBox="0 0 34 40" style={{filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.3))', transform: `scale(${clickAge < 0.15 ? 0.85 : 1})`, transformOrigin: '0 0'}}><path d="M2 2l28 16-12 3-6 13z" fill="#13201d" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" /></svg>
          </div>
        )}
      </div>
    </div>
  );
};

const MarkBox: React.FC<{m: Mark; toScreen: (x: number, y: number) => {x: number; y: number}; z: number}> = ({m, toScreen, z}) => {
  const life = useLife({at: m.at, dt: m.dt, out: m.out, outDt: m.outDt});
  if (!life.visible) return null;
  const a = toScreen(m.box[0], m.box[1]);
  const w = m.box[2] * z, h = m.box[3] * z;
  const color = m.tone === 'red' ? RED : MINT;
  const pad = 10;
  const o = life.style.opacity as number;
  return (
    <>
      <div style={{position: 'absolute', left: a.x - pad, top: a.y - pad, width: w + pad * 2, height: h + pad * 2, borderRadius: 14, border: `4px solid ${color}`, boxShadow: m.dim === false ? `0 0 24px ${color}66` : `0 0 0 3000px rgba(16,41,42,${0.32 * o}), 0 0 24px ${color}88`, opacity: o}} />
      {m.label && (
        <div style={{position: 'absolute', left: a.x + w / 2, top: a.y - pad - 30, transform: 'translate(-50%,-100%)', ...life.style}}>
          <PillBox text={m.label} tone={m.tone === 'red' ? 'red' : 'green'} size={0.95} />
        </div>
      )}
    </>
  );
};

const RingEl: React.FC<{e: Extract<El, {k: 'ring'}>}> = ({e}) => {
  const geo = React.useContext(GeoCtx);
  const life = useLife(e);
  const g = geo[e.target];
  if (!g || !life.visible) return null;
  const pad = e.pad ?? 12;
  const color = e.tone === 'red' ? RED : MINT;
  return <div style={{position: 'absolute', left: g.x - g.w / 2 - pad, top: g.y - g.h / 2 - pad, width: g.w + pad * 2, height: g.h + pad * 2, borderRadius: 30, border: `4px solid ${color}`, boxShadow: `0 0 30px ${color}55`, opacity: life.style.opacity, filter: life.style.filter}} />;
};

const LogoEl: React.FC<{e: Extract<El, {k: 'logo'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  return (
    <div style={{position: 'absolute', left: e.x - e.size / 2, top: e.y - e.size / 2, width: e.size, height: e.size, borderRadius: e.size * 0.26, background: `linear-gradient(160deg, #19b77e, ${GREEN})`, boxShadow: '0 30px 60px rgba(12,147,101,.35), 0 10px 0 #087150', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: title, fontWeight: 800, fontSize: e.size * 0.55, ...life.style}}>ب</div>
  );
};

const RuleEl: React.FC<{e: Extract<El, {k: 'rule'}>}> = ({e}) => {
  const life = useLife(e);
  if (!life.visible) return null;
  return <div style={{position: 'absolute', left: e.x - e.w / 2, top: e.y, width: e.w * life.p, height: 5, borderRadius: 3, background: e.tone === 'red' ? RED : MINT, opacity: life.style.opacity}} />;
};

const Element: React.FC<{e: El}> = ({e}) => {
  switch (e.k) {
    case 'card': return <CardEl e={e} />;
    case 'edge': return <EdgeEl e={e} />;
    case 'text': return <TextEl e={e} />;
    case 'pill': return <PillEl e={e} />;
    case 'stat': return <StatEl e={e} />;
    case 'code': return <CodeEl e={e} />;
    case 'chat': return <ChatEl e={e} />;
    case 'layers': return <LayersEl e={e} />;
    case 'list': return <ListEl e={e} />;
    case 'stepper': return <StepperEl e={e} />;
    case 'wall': return <WallEl e={e} />;
    case 'marquee': return <MarqueeEl e={e} />;
    case 'video': return <VideoEl e={e} />;
    case 'shot': return <ShotEl e={e} />;
    case 'ring': return <RingEl e={e} />;
    case 'logo': return <LogoEl e={e} />;
    case 'rule': return <RuleEl e={e} />;
  }
};

// ---------- scenes ----------

const Canvas: React.FC<{s: Extract<ExplainerScene, {kind: 'canvas'}>; brand: string; site: string}> = ({s, brand, site}) => {
  const {frame} = useT();
  const geo: Geo = {};
  for (const e of s.els) if (e.k === 'card' && e.id) geo[e.id] = {x: e.x, y: e.y, w: e.w ?? 200, h: e.h ?? 132};
  // edges are drawn under everything else, like the reference's connectors
  const order = [...s.els.filter((e) => e.k === 'edge' || e.k === 'marquee'), ...s.els.filter((e) => e.k !== 'edge' && e.k !== 'marquee')];
  const push = 1 + Math.min(frame, 900) * 0.00004; // a barely visible push-in keeps still scenes alive
  return (
    <CueCtx.Provider value={{cues: s.cues}}>
      <GeoCtx.Provider value={geo}>
        <AbsoluteFill style={{direction: 'ltr', overflow: 'hidden'}}>
          <Backdrop />
          <AbsoluteFill style={{transform: `scale(${push})`}}>
            {order.map((e, i) => <Element key={i} e={e} />)}
          </AbsoluteFill>
          {s.title && <Title title={s.title} sub={s.sub} at={s.titleAt ?? 0} center={s.center} />}
          {s.chrome !== false && <Brand brand={brand} site={site} />}
          {s.chrome !== false && s.label && <ChapterPill label={s.label} />}
        </AbsoluteFill>
      </GeoCtx.Provider>
    </CueCtx.Provider>
  );
};

const Chapter: React.FC<{s: Extract<ExplainerScene, {kind: 'chapter'}>; brand: string; site: string}> = ({s, brand, site}) => {
  const {frame, fps} = useT();
  const n = spring({frame: frame - 2, fps, config: {damping: 16, stiffness: 120}});
  const tt = spring({frame: frame - 8, fps, config: {damping: 16, stiffness: 120}});
  const rule = interpolate(frame, [12, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const sub = spring({frame: frame - 18, fps, config: {damping: 16, stiffness: 120}});
  const fade = (p: number): React.CSSProperties => ({opacity: p, filter: p < 0.97 ? `blur(${(1 - p) * 12}px)` : undefined, transform: `translateY(${(1 - p) * 20}px)`});
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Backdrop dark />
      <Brand brand={brand} site={site} dark />
      <div style={{position: 'absolute', right: 150, top: 250, textAlign: 'right', direction: 'rtl', transform: `scale(${1 + frame * 0.0006})`, transformOrigin: 'right center'}}>
        <svg width="420" height="210" direction="ltr" style={{display: 'block', marginRight: -12, marginLeft: 'auto', direction: 'ltr', ...fade(n)}} viewBox="0 0 420 210">
          <text x="410" y="185" textAnchor="end" fontFamily={mono} fontWeight={800} fontSize="220" fill="none" stroke={MINT} strokeWidth="3.5" letterSpacing="-6">{s.n}</text>
        </svg>
        <div style={{fontFamily: title, fontWeight: 800, fontSize: 120, color: '#fff', lineHeight: 1.15, marginTop: 6, ...fade(tt)}}>{s.title}</div>
        <div style={{height: 5, width: 420 * rule, background: MINT, borderRadius: 3, marginTop: 26, marginRight: 0, marginLeft: 'auto'}} />
        {s.sub && <div style={{fontFamily: body, fontWeight: 500, fontSize: 36, color: 'rgba(255,255,255,.78)', marginTop: 24, ...fade(sub)}}>{s.sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

/** The blur cross-dissolve: a scene comes in out of a blur and leaves into one, overlapping the next by XF frames. */
const Through: React.FC<{dur: number; first: boolean; children: React.ReactNode}> = ({dur, first, children}) => {
  const {frame} = useT();
  const i = first ? 1 : interpolate(frame, [0, XF], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const o = interpolate(frame, [dur, dur + XF], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const blur = (1 - i) * 16 + (1 - o) * 16;
  return <AbsoluteFill style={{opacity: Math.min(i, o), filter: blur > 0.3 ? `blur(${blur}px)` : undefined, transform: `scale(${1 + (1 - i) * 0.02 - (1 - o) * 0.02})`}}>{children}</AbsoluteFill>;
};

// ---------- sound ----------

const SFX_FILES: Record<Sfx, string> = {pop: 'explainer/sfx/pop.wav', tick: 'explainer/sfx/tick.wav', whoosh: 'explainer/sfx/whoosh.wav', type: 'explainer/sfx/type.wav', chime: 'explainer/sfx/chime.wav'};
const SFX_VOL: Record<Sfx, number> = {pop: 0.13, tick: 0.14, whoosh: 0.16, type: 0.06, chime: 0.2};
const DEFAULT_SFX: Partial<Record<El['k'], Sfx>> = {card: 'pop', pill: 'pop', stat: 'pop', code: 'pop', chat: 'pop', list: 'pop', video: 'pop', shot: 'whoosh', logo: 'pop', wall: 'whoosh'};

/** Every interface sound of a scene, as [seconds into the scene, sound]. */
const sceneSounds = (s: ExplainerScene): [number, Sfx][] => {
  if (s.kind === 'chapter') return [[0, 'whoosh']];
  const out: [number, Sfx][] = [[0.05, 'whoosh']];
  const at = (a = 0, d = 0) => cueTime(s.cues, a, d);
  for (const e of s.els) {
    const kind = e.sfx === undefined ? DEFAULT_SFX[e.k] : e.sfx;
    if (kind) out.push([at(e.at, e.dt), kind]);
    if (e.k === 'list') for (const it of e.items) if (it.tag) out.push([at(it.at, it.dt), 'tick']);
    if (e.k === 'layers') for (const it of e.items) out.push([at(it.at, it.dt), 'pop']);
    if (e.k === 'code') for (const l of e.lines) if (l.at != null && l.at > (e.at ?? 0)) out.push([at(l.at, l.dt), 'pop']);
    if (e.k === 'stepper') e.done.forEach((d) => d != null && d >= 0 && out.push([at(d), 'tick']));
    if (e.k === 'shot') for (const c of e.cursor ?? []) if (c.click) out.push([at(c.at, (c.dt ?? 0) + 0.7), 'tick']);
    if (e.k === 'chat') {
      const t1 = at(e.at, (e.dt ?? 0) + 0.9), t2 = at(e.until);
      for (let t = t1; t < t2; t += 0.11) out.push([t, 'type']);
    }
  }
  // thin out sounds that would pile up on each other
  out.sort((a, b) => a[0] - b[0]);
  const kept: [number, Sfx][] = [];
  for (const x of out) if (!kept.some((k) => Math.abs(k[0] - x[0]) < (x[1] === 'type' ? 0.05 : 0.14) && k[1] !== 'type')) kept.push(x);
  return kept;
};

// ---------- root ----------

export const Explainer: React.FC<{spec: ExplainerSpec}> = ({spec}) => {
  let from = 0;
  const total = explainerFrames(spec);
  const seqs = spec.scenes.map((s, i) => {
    const dur = Math.round(s.seconds * FPS);
    const node = (
      <Sequence key={i} from={from} durationInFrames={dur + XF}>
        <Through dur={dur} first={i === 0}>
          {s.kind === 'chapter' ? <Chapter s={s} brand={spec.brand} site={spec.site} /> : <Canvas s={s} brand={spec.brand} site={spec.site} />}
        </Through>
        {s.kind === 'canvas' && s.audio && <Sequence from={Math.round(LEAD * FPS)}><Audio src={asSrc(s.audio)} /></Sequence>}
        {sceneSounds(s).map(([t, k], j) => (
          <Sequence key={`s${j}`} from={Math.max(0, Math.round(t * FPS))} durationInFrames={Math.round(1.5 * FPS)}>
            <Audio src={asSrc(SFX_FILES[k])} volume={SFX_VOL[k]} />
          </Sequence>
        ))}
      </Sequence>
    );
    from += dur;
    return node;
  });
  return (
    <AbsoluteFill style={{background: TEAL}}>
      {seqs}
      {spec.music && <Audio src={asSrc(spec.music)} loop volume={(f) => 0.13 * interpolate(f, [0, 60, total - 90, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />}
    </AbsoluteFill>
  );
};
