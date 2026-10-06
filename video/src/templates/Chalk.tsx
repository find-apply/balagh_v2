import React from 'react';
import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile} from 'remotion';
import {loadFont as loadAref} from '@remotion/google-fonts/ArefRuqaa';
import {loadFont as loadPatrick} from '@remotion/google-fonts/PatrickHand';
import {currentLine, spokenParts, useDir, useT} from '../core/story';
import {LangCtx, amiri, cairo, inter, useEn} from '../core/theme';
import {FPS, SceneAudio, StoryScene, StorySpec, Watermark} from '../spec';

const aref = loadAref('normal', {weights: ['400', '700'], subsets: ['arabic']}).fontFamily;
const patrick = loadPatrick('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;
const CH = {white: '#f6f3e8', yellow: '#ffe27a', pink: '#ff9ec7', blue: '#8fd3ff', green: '#9be8a8', orange: '#ffb26b'};
const WHO: Record<string, string> = {narr: CH.white, salim: CH.green, maryam: CH.pink, nour: CH.yellow};
const BOARD = 'radial-gradient(ellipse at 30% 20%, #3b6a5c 0%, #2b5247 45%, #1f3d35 100%)';

const useFonts = () => {
  const en = useEn();
  return {chalk: en ? patrick : aref, quote: en ? patrick : amiri, body: en ? inter : cairo};
};

/** Board, wooden frame, chalk dust and the wobbly-chalk SVG filter. */
const Board: React.FC<{title?: string; children: React.ReactNode}> = ({title, children}) => {
  const {f} = useT();
  const fonts = useFonts();
  const en = useEn();
  const wipe = interpolate(f, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#6b4423'}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" />
        </filter>
      </svg>
      <div style={{position: 'absolute', inset: 22, borderRadius: 10, background: BOARD, boxShadow: 'inset 0 0 90px rgba(0,0,0,.55), 0 0 0 6px #4a2f17'}} />
      {/* Chalk dust: a static noise image (public/dust.png); an SVG turbulence filter here made every frame slow. */}
      <Img src={staticFile('dust.png')} style={{position: 'absolute', left: 22, top: 22, width: 1236, height: 676, opacity: 0.18, mixBlendMode: 'screen'}} />
      <div style={{position: 'absolute', left: 22, right: 22, bottom: 22, height: 14, background: 'linear-gradient(#a98457, #7a5a34)'}} />
      <div style={{position: 'absolute', inset: 22, overflow: 'hidden', borderRadius: 10}}>{children}</div>
      {title && (
        <div style={{position: 'absolute', top: 46, [en ? 'left' : 'right']: 64, fontFamily: fonts.chalk, fontWeight: 700, fontSize: 40, color: CH.yellow, filter: 'url(#chalk)', borderBottom: `4px solid ${CH.yellow}`, paddingBottom: 2, direction: en ? 'ltr' : 'rtl'}}>{title}</div>
      )}
      <div style={{position: 'absolute', top: 22, bottom: 22, left: `${wipe * 100}%`, right: 22, background: 'rgba(255,255,255,.07)', width: `${(1 - wipe) * 100}%`, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

/** Chalk text: words pop in as they are spoken, current word underlined. */
const ChalkWords: React.FC<{text: string; size: number; color?: string; t0: number; t1: number; font?: string}> = ({text, size, color = CH.white, t0, t1, font}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  return (
    <div style={{direction: dir, textAlign: 'center', fontFamily: font ?? fonts.chalk, fontWeight: 700, fontSize: size, lineHeight: 1.65, color, filter: 'url(#chalk)', textShadow: '0 0 8px rgba(255,255,255,.25)'}}>
      {spokenParts(text, t, t0, t1).map((w, i) => {
        const pop = w.shown ? Math.min(1, (w.spoken - w.start) * w.total / 1.2 + 0.4) : 0;
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 9px', opacity: w.shown ? 1 : 0.28, transform: `scale(${0.9 + 0.1 * pop})`, borderBottom: w.on ? `5px solid ${CH.yellow}` : '5px solid transparent', color: w.on ? CH.yellow : color}}>{w.word}</span>
        );
      })}
    </div>
  );
};

/** Long lines get a smaller size so two lines still fit under the picture. */
const fit = (text: string, size: number) => (text.length > 130 ? size * 0.7 : text.length > 80 ? size * 0.82 : size);

const Caption: React.FC<{s: StoryScene; size?: number; skipFirst?: boolean}> = ({s, size = 54, skipFirst}) => {
  const {t} = useT();
  const fonts = useFonts();
  const en = useEn();
  const cur = currentLine(s, t);
  if (!cur || (skipFirst && cur.idx === 0)) return null;
  const l = cur.line;
  return (
    <div style={{position: 'absolute', left: 70, right: 70, bottom: 54}}>
      <div style={{position: 'absolute', top: -68, [en ? 'left' : 'right']: 6, fontFamily: fonts.chalk, fontWeight: 700, fontSize: 46, color: WHO[l.who] ?? CH.white, filter: 'url(#chalk)', direction: en ? 'ltr' : 'rtl', borderBottom: `4px solid ${WHO[l.who] ?? CH.white}`}}>{l.name}</div>
      <ChalkWords text={l.text} size={fit(l.text, size)} t0={l.t0 + 0.05} t1={l.t0 + l.d} />
    </div>
  );
};

const SHAPES: Record<string, {d: string; len: number; vb: string}> = {
  heart: {d: 'M50 88 C 8 56 8 20 32 18 C 44 17 50 28 50 28 C 50 28 56 17 68 18 C 92 20 92 56 50 88 Z', len: 300, vb: '0 0 100 100'},
  star: {d: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z', len: 330, vb: '0 0 100 100'},
  question: {d: 'M26 34 C 26 8 74 8 74 34 C 74 54 50 56 50 72 M50 88 L50 90', len: 220, vb: '0 0 100 100'},
  spark: {d: 'M50 6 L50 94 M6 50 L94 50 M20 20 L80 80 M80 20 L20 80', len: 420, vb: '0 0 100 100'},
};

type DoodleProps = {shape: string; x: number; y: number; size?: number; at?: number; color?: string; rot?: number};

/** A chalk doodle that draws itself starting at `at` seconds. */
const Doodle: React.FC<DoodleProps> = ({shape, x, y, size = 130, at = 0.8, color = CH.yellow, rot = 0}) => {
  const {t} = useT();
  const sh = SHAPES[shape];
  const k = Math.max(0, Math.min(1, (t - at) / 0.9));
  return (
    <svg width={size} height={size} viewBox={sh.vb} style={{position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg)`, opacity: k > 0 ? 1 : 0, overflow: 'visible'}}>
      <path d={sh.d} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={sh.len} strokeDashoffset={sh.len * (1 - k)} filter="url(#chalk)" />
    </svg>
  );
};

// Doodle sets cycle through the story scenes so each one gets a different decoration.
const DOODLES: DoodleProps[][] = [
  [{shape: 'heart', x: 30, y: 200, color: CH.pink, at: 3.6, rot: -10}],
  [{shape: 'question', x: 1120, y: 140, size: 150, at: 0.8}, {shape: 'question', x: 20, y: 300, size: 110, at: 1.4, color: CH.blue, rot: -12}],
  [{shape: 'spark', x: 1110, y: 180, size: 120, at: 1.0}, {shape: 'star', x: 35, y: 150, size: 110, at: 1.8, color: CH.orange}],
  [{shape: 'heart', x: 1110, y: 180, size: 130, at: 1.2, color: CH.pink}],
  [{shape: 'star', x: 1110, y: 140, size: 120, at: 0.8}, {shape: 'heart', x: 30, y: 250, size: 120, at: 1.4, color: CH.pink, rot: -8}, {shape: 'star', x: 1130, y: 340, size: 80, at: 2.0, color: CH.blue}],
];

const Polaroid: React.FC<{src: string; dur: number; rot?: number; w?: number; h?: number}> = ({src, dur, rot = -2.2, w = 760, h = 430}) => {
  const {f} = useT();
  const p = spring({frame: f, fps: FPS, config: {damping: 12, stiffness: 90}});
  const kb = interpolate(f, [0, dur * FPS], [1.02, 1.12]);
  const wob = Math.sin(f / 26) * 0.5;
  return (
    <div style={{position: 'absolute', top: 52, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - p) * -260}px) rotate(${rot + wob}deg)`, opacity: Math.min(1, p * 1.5)}}>
      <div style={{position: 'relative', background: '#fffdf6', padding: '14px 14px 14px', boxShadow: '0 14px 30px rgba(0,0,0,.5)'}}>
        <div style={{width: w, height: h, overflow: 'hidden'}}>
          <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`}} />
        </div>
        {[-1, 1].map((sd) => <div key={sd} style={{position: 'absolute', top: -16, left: sd < 0 ? 40 : undefined, right: sd > 0 ? 40 : undefined, width: 110, height: 34, background: 'rgba(255,226,140,.8)', transform: `rotate(${sd * 8}deg)`}} />)}
      </div>
    </div>
  );
};

const Story: React.FC<{s: StoryScene; n: number}> = ({s, n}) => (
  <Board title={s.board}>
    {s.image && <Polaroid src={s.image} dur={s.duration} />}
    {DOODLES[n % DOODLES.length].map((d, i) => <Doodle key={i} {...d} />)}
    <Caption s={s} />
  </Board>
);

const Text: React.FC<{s: StoryScene}> = ({s}) => {
  const {f} = useT();
  const fonts = useFonts();
  const p = spring({frame: f, fps: FPS, config: {damping: 14}});
  const dir = useDir();
  const quote = s.quote ?? '';
  const size = quote.length > 160 ? 46 : quote.length > 90 ? 58 : 74;
  return (
    <Board title={s.title}>
      <div style={{position: 'absolute', top: 120, left: 80, right: 80, textAlign: 'center', direction: dir, opacity: p}}>
        <div style={{fontFamily: fonts.chalk, fontWeight: 700, fontSize: 44, color: CH.blue, filter: 'url(#chalk)'}}>{s.text}</div>
        <div style={{marginTop: 26}}><ChalkWords text={quote} size={size} t0={s.quoteLead ?? 1} t1={s.quoteEnd ?? s.duration - 0.7} font={fonts.quote} /></div>
        <svg width="520" height="26" style={{marginTop: 30}}><path d="M4 14 Q 70 2 130 14 T 260 14 T 390 14 T 516 14" stroke={CH.yellow} strokeWidth="5" fill="none" filter="url(#chalk)" strokeLinecap="round" /></svg>
        <div style={{fontFamily: fonts.chalk, fontSize: 38, color: CH.orange, filter: 'url(#chalk)', marginTop: 4}}>{s.source}</div>
        {s.silentNote && <div style={{fontFamily: fonts.chalk, fontSize: 30, color: CH.blue, filter: 'url(#chalk)', marginTop: 16}}>{s.silentNote}</div>}
      </div>
    </Board>
  );
};

const Sticker: React.FC<{word: string; meaning: string; delay: number; rot: number; tint: string}> = ({word, meaning, delay, rot, tint}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const p = spring({frame: Math.max(0, (t - delay) * FPS), fps: FPS, config: {damping: 11}});
  return (
    <div style={{width: 470, background: tint, padding: '30px 20px 26px', textAlign: 'center', direction: dir, boxShadow: '0 14px 26px rgba(0,0,0,.45)', transform: `rotate(${rot}deg) scale(${p})`, opacity: p, position: 'relative'}}>
      <div style={{position: 'absolute', top: -14, left: '50%', marginLeft: -55, width: 110, height: 30, background: 'rgba(255,255,255,.55)', transform: 'rotate(-3deg)'}} />
      <div style={{fontFamily: fonts.quote, fontWeight: 700, fontSize: word.length > 10 ? 66 : 96, color: '#1d2d2a'}}>{word}</div>
      <div style={{fontFamily: fonts.body, fontWeight: 600, fontSize: 36, color: '#33413d', marginTop: 4}}>{meaning}</div>
    </div>
  );
};

const WordsScene: React.FC<{s: StoryScene}> = ({s}) => (
  <Board title={s.title}>
    <div style={{position: 'absolute', top: 110, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 56}}>
      {(s.cards ?? []).map((c, i) => <Sticker key={i} word={c.word} meaning={c.meaning} delay={1.2 + i * 2.6} rot={i ? 2.5 : -2.5} tint={i ? '#ffe9a8' : '#cfeedd'} />)}
    </div>
    <Caption s={s} size={42} />
  </Board>
);

const RoughBox: React.FC<{label: string; state: 'idle' | 'right' | 'wrong'; reveal: number}> = ({label, state, reveal}) => {
  const fonts = useFonts();
  const dir = useDir();
  const col = state === 'right' ? CH.green : state === 'wrong' ? '#ff8a8a' : CH.white;
  return (
    <div style={{position: 'relative', width: 430, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: state === 'wrong' ? 0.55 : 1}}>
      <svg width="430" height="150" style={{position: 'absolute', inset: 0}}>
        <rect x="8" y="8" width="414" height="134" rx="26" fill="none" stroke={col} strokeWidth="6" filter="url(#chalk)" />
        {state === 'right' && <path d="M40 78 L88 118 L170 36" fill="none" stroke={CH.green} strokeWidth="12" strokeLinecap="round" strokeDasharray="220" strokeDashoffset={220 * (1 - reveal)} filter="url(#chalk)" />}
        {state === 'wrong' && <g stroke="#ff8a8a" strokeWidth="9" strokeLinecap="round" filter="url(#chalk)" opacity={reveal}><path d="M44 36 L96 108" /><path d="M96 36 L44 108" /></g>}
      </svg>
      <span style={{fontFamily: fonts.chalk, fontWeight: 700, fontSize: label.length > 14 ? 44 : 60, color: col, filter: 'url(#chalk)', direction: dir, marginLeft: 40, padding: '0 20px'}}>{label}</span>
    </div>
  );
};

const Quiz: React.FC<{s: StoryScene}> = ({s}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const at = s.revealAt ?? s.duration;
  const rv = Math.max(0, Math.min(1, (t - at) / 0.6));
  return (
    <Board title={s.title}>
      <div style={{position: 'absolute', top: 120, left: 80, right: 80, textAlign: 'center', direction: dir, fontFamily: fonts.chalk, fontWeight: 700, fontSize: 56, lineHeight: 1.6, color: CH.white, filter: 'url(#chalk)'}}>{s.question}</div>
      <div style={{position: 'absolute', top: 340, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 70}}>
        {(s.choices ?? []).map((c, i) => <RoughBox key={i} label={c} reveal={rv} state={rv > 0 ? (i === (s.answer ?? 0) ? 'right' : 'wrong') : 'idle'} />)}
      </div>
      <Caption s={s} size={44} skipFirst />
    </Board>
  );
};

const Outro: React.FC<{s: StoryScene}> = ({s}) => {
  const fonts = useFonts();
  const l = s.lines?.[0];
  return (
    <Board>
      {s.image && <Polaroid src={s.image} dur={s.duration} rot={1.8} w={620} h={350} />}
      <Doodle shape="heart" x={120} y={140} size={150} at={0.8} color={CH.pink} rot={-10} />
      <Doodle shape="heart" x={1010} y={170} size={130} at={1.3} color={CH.pink} rot={8} />
      <Doodle shape="star" x={1050} y={400} size={90} at={1.8} />
      {l && (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center'}}>
          <ChalkWords text={l.text} size={fit(l.text, 60)} color={CH.yellow} t0={l.t0} t1={l.t0 + l.d} font={fonts.quote} />
        </div>
      )}
    </Board>
  );
};

export const Chalk: React.FC<{spec: StorySpec}> = ({spec}) => {
  let from = 0;
  let stories = 0;
  return (
    <LangCtx.Provider value={{en: spec.lang === 'en'}}>
      <AbsoluteFill style={{background: '#000'}}>
        {spec.scenes.map((s, i) => {
          const dur = Math.round(s.duration * FPS);
          let body: React.ReactNode;
          if (s.type === 'story') body = <Story s={s} n={stories++} />;
          else if (s.type === 'text') body = <Text s={s} />;
          else if (s.type === 'words') body = <WordsScene s={s} />;
          else if (s.type === 'quiz') body = <Quiz s={s} />;
          else body = <Outro s={s} />;
          const el = (
            <Sequence key={i} from={from} durationInFrames={dur}>
              {body}
              <SceneAudio s={s} />
            </Sequence>
          );
          from += dur;
          return el;
        })}
        <Watermark text={spec.watermark} wide />
      </AbsoluteFill>
    </LangCtx.Provider>
  );
};
