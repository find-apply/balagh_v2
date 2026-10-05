import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadAref} from '@remotion/google-fonts/ArefRuqaa';
import {amiri, cairo} from './theme';

const aref = loadAref('normal', {weights: ['400', '700'], subsets: ['arabic']}).fontFamily;
const FPS = 30;
const CH = {white: '#f6f3e8', yellow: '#ffe27a', pink: '#ff9ec7', blue: '#8fd3ff', green: '#9be8a8', orange: '#ffb26b'};
const WHO: Record<string, string> = {narr: CH.white, salim: CH.green, maryam: CH.pink, nour: CH.yellow};
const BOARD = 'radial-gradient(ellipse at 30% 20%, #3b6a5c 0%, #2b5247 45%, #1f3d35 100%)';

const useT = () => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  return {t: f / fps, f, dur: durationInFrames / fps};
};

/** Board, wooden frame, chalk dust and the wobbly-chalk SVG filter. */
const Board: React.FC<{title?: string; children: React.ReactNode}> = ({title, children}) => {
  const {f} = useT();
  const wipe = interpolate(f, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#6b4423'}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" />
        </filter>
        <filter id="dust">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="9" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.15" />
        </filter>
      </svg>
      <div style={{position: 'absolute', inset: 22, borderRadius: 10, background: BOARD, boxShadow: 'inset 0 0 90px rgba(0,0,0,.55), 0 0 0 6px #4a2f17'}} />
      <svg width="1280" height="720" style={{position: 'absolute', inset: 0, opacity: 0.18, mixBlendMode: 'screen'}}><rect x="22" y="22" width="1236" height="676" filter="url(#dust)" /></svg>
      <div style={{position: 'absolute', left: 22, right: 22, bottom: 22, height: 14, background: 'linear-gradient(#a98457, #7a5a34)'}} />
      <div style={{position: 'absolute', inset: 22, overflow: 'hidden', borderRadius: 10}}>{children}</div>
      {title && (
        <div style={{position: 'absolute', top: 46, right: 64, fontFamily: aref, fontWeight: 700, fontSize: 40, color: CH.yellow, filter: 'url(#chalk)', borderBottom: `4px solid ${CH.yellow}`, paddingBottom: 2, direction: 'rtl'}}>{title}</div>
      )}
      <div style={{position: 'absolute', top: 22, bottom: 22, left: `${wipe * 100}%`, right: 22, background: 'rgba(255,255,255,.07)', width: `${(1 - wipe) * 100}%`, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

/** Chalk text: words pop in as they are spoken, current word underlined. */
const ChalkWords: React.FC<{text: string; size: number; color?: string; t0: number; t1: number; font?: string; align?: 'center' | 'right'}> = ({text, size, color = CH.white, t0, t1, font = aref, align = 'center'}) => {
  const {t} = useT();
  const words = text.split(' ');
  const w = words.map((x) => x.length + 1);
  const total = w.reduce((a, b) => a + b, 0);
  const spoken = Math.max(0, Math.min(1, (t - t0) / Math.max(0.1, t1 - t0)));
  let acc = 0;
  return (
    <div style={{direction: 'rtl', textAlign: align, fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1.65, color, filter: 'url(#chalk)', textShadow: '0 0 8px rgba(255,255,255,.25)'}}>
      {words.map((x, i) => {
        const start = acc / total, end = (acc + w[i]) / total; acc += w[i];
        const on = spoken >= start && spoken < end + 0.02;
        const shown = spoken >= start - 0.001;
        const pop = shown ? Math.min(1, (spoken - start) * total / 1.2 + 0.4) : 0;
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 9px', opacity: shown ? 1 : 0.28, transform: `scale(${0.9 + 0.1 * pop})`, borderBottom: on ? `5px solid ${CH.yellow}` : '5px solid transparent', color: on ? CH.yellow : color}}>{x}</span>
        );
      })}
    </div>
  );
};

const Caption: React.FC<{s: any; size?: number; skipFirst?: boolean}> = ({s, size = 58, skipFirst}) => {
  const {t} = useT();
  const L = s.lines as any[];
  let idx = 0;
  L.forEach((l, i) => { if (t >= l.t0) idx = i; });
  if (skipFirst && idx === 0) return null;
  const l = L[idx];
  return (
    <div style={{position: 'absolute', left: 70, right: 70, bottom: 54}}>
      <div style={{position: 'absolute', top: -68, right: 6, fontFamily: aref, fontWeight: 700, fontSize: 46, color: WHO[l.who], filter: 'url(#chalk)', direction: 'rtl', borderBottom: `4px solid ${WHO[l.who]}`}}>{l.name}</div>
      <ChalkWords text={l.text} size={size} t0={l.t0 + 0.05} t1={l.t0 + l.d} />
    </div>
  );
};

const SHAPES: Record<string, {d: string; len: number; vb: string}> = {
  heart: {d: 'M50 88 C 8 56 8 20 32 18 C 44 17 50 28 50 28 C 50 28 56 17 68 18 C 92 20 92 56 50 88 Z', len: 300, vb: '0 0 100 100'},
  star: {d: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z', len: 330, vb: '0 0 100 100'},
  question: {d: 'M26 34 C 26 8 74 8 74 34 C 74 54 50 56 50 72 M50 88 L50 90', len: 220, vb: '0 0 100 100'},
  spark: {d: 'M50 6 L50 94 M6 50 L94 50 M20 20 L80 80 M80 20 L20 80', len: 420, vb: '0 0 100 100'},
};

/** A chalk doodle that draws itself starting at `at` seconds. */
const Doodle: React.FC<{shape: string; x: number; y: number; size?: number; at?: number; color?: string; rot?: number}> = ({shape, x, y, size = 130, at = 0.8, color = CH.yellow, rot = 0}) => {
  const {t} = useT();
  const sh = SHAPES[shape];
  const k = Math.max(0, Math.min(1, (t - at) / 0.9));
  return (
    <svg width={size} height={size} viewBox={sh.vb} style={{position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg)`, opacity: k > 0 ? 1 : 0, overflow: 'visible'}}>
      <path d={sh.d} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={sh.len} strokeDashoffset={sh.len * (1 - k)} filter="url(#chalk)" />
    </svg>
  );
};

const DOODLES: Record<string, any[]> = {
  s1: [{shape: 'heart', x: 30, y: 200, color: CH.pink, at: 3.6, rot: -10}],
  s2: [{shape: 'question', x: 1120, y: 140, size: 150, at: 0.8}, {shape: 'question', x: 20, y: 300, size: 110, at: 1.4, color: CH.blue, rot: -12}],
  s3: [{shape: 'spark', x: 1110, y: 180, size: 120, at: 1.0}, {shape: 'star', x: 35, y: 150, size: 110, at: 1.8, color: CH.orange}],
  s6: [{shape: 'heart', x: 1110, y: 180, size: 130, at: 1.2, color: CH.pink}],
  s7: [{shape: 'star', x: 1110, y: 140, size: 120, at: 0.8}, {shape: 'heart', x: 30, y: 250, size: 120, at: 1.4, color: CH.pink, rot: -8}, {shape: 'star', x: 1130, y: 340, size: 80, at: 2.0, color: CH.blue}],
};

const Polaroid: React.FC<{src: string; dur: number; rot?: number; w?: number; h?: number}> = ({src, dur, rot = -2.2, w = 760, h = 430}) => {
  const {f} = useT();
  const p = spring({frame: f, fps: FPS, config: {damping: 12, stiffness: 90}});
  const kb = interpolate(f, [0, dur * FPS], [1.02, 1.12]);
  const wob = Math.sin(f / 26) * 0.5;
  return (
    <div style={{position: "absolute", top: 52, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `translateY(${(1 - p) * -260}px) rotate(${rot + wob}deg)`, opacity: Math.min(1, p * 1.5)}}>
      <div style={{position: 'relative', background: '#fffdf6', padding: '14px 14px 14px', boxShadow: '0 14px 30px rgba(0,0,0,.5)'}}>
        <div style={{width: w, height: h, overflow: 'hidden'}}>
          <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`}} />
        </div>
        {[-1, 1].map((sd) => <div key={sd} style={{position: 'absolute', top: -16, left: sd < 0 ? 40 : undefined, right: sd > 0 ? 40 : undefined, width: 110, height: 34, background: 'rgba(255,226,140,.8)', transform: `rotate(${sd * 8}deg)`}} />)}
      </div>
    </div>
  );
};

const Story: React.FC<{s: any; dur: number}> = ({s, dur}) => (
  <Board title="سَبُّورَةُ الدَّرْسِ">
    <Polaroid src={s.image} dur={dur} />
    {(DOODLES[s.id] || []).map((d, i) => <Doodle key={i} {...d} />)}
    <Caption s={s} />
  </Board>
);

const Hadith: React.FC<{s: any}> = ({s}) => {
  const {f, t} = useT();
  const p = spring({frame: f, fps: FPS, config: {damping: 14}});
  const lead = s.quoteLead ?? 1.2;
  const total = s.duration - 0.7;
  return (
    <Board title="حَدِيثٌ شَرِيفٌ">
      <div style={{position: 'absolute', top: 120, left: 80, right: 80, textAlign: 'center', direction: 'rtl', opacity: p}}>
        <div style={{fontFamily: aref, fontWeight: 700, fontSize: 44, color: CH.blue, filter: 'url(#chalk)'}}>{s.text}</div>
        <div style={{marginTop: 26}}><ChalkWords text={s.quote} size={74} t0={lead} t1={total - 0.4} font={amiri} /></div>
        <svg width="520" height="26" style={{marginTop: 30}}><path d="M4 14 Q 70 2 130 14 T 260 14 T 390 14 T 516 14" stroke={CH.yellow} strokeWidth="5" fill="none" filter="url(#chalk)" strokeLinecap="round" /></svg>
        <div style={{fontFamily: aref, fontSize: 38, color: CH.orange, filter: 'url(#chalk)', marginTop: 4}}>{s.source}</div>
      </div>
    </Board>
  );
};

const Sticker: React.FC<{word: string; meaning: string; delay: number; rot: number; tint: string}> = ({word, meaning, delay, rot, tint}) => {
  const {t} = useT();
  const p = spring({frame: Math.max(0, (t - delay) * FPS), fps: FPS, config: {damping: 11}});
  return (
    <div style={{width: 470, background: tint, padding: '30px 20px 26px', textAlign: 'center', direction: 'rtl', boxShadow: '0 14px 26px rgba(0,0,0,.45)', transform: `rotate(${rot}deg) scale(${p})`, opacity: p, position: 'relative'}}>
      <div style={{position: 'absolute', top: -14, left: '50%', marginLeft: -55, width: 110, height: 30, background: 'rgba(255,255,255,.55)', transform: 'rotate(-3deg)'}} />
      <div style={{fontFamily: amiri, fontWeight: 700, fontSize: 96, color: '#1d2d2a'}}>{word}</div>
      <div style={{fontFamily: cairo, fontWeight: 600, fontSize: 36, color: '#33413d', marginTop: 4}}>{meaning}</div>
    </div>
  );
};

const WordsScene: React.FC<{s: any}> = ({s}) => (
  <Board title="نَفْهَمُ مَعًا">
    <div style={{position: 'absolute', top: 110, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 56}}>
      {s.cards.map((c: any, i: number) => <Sticker key={i} word={c.word} meaning={c.meaning} delay={1.2 + i * 2.6} rot={i ? 2.5 : -2.5} tint={i ? '#ffe9a8' : '#cfeedd'} />)}
    </div>
    <Caption s={s} size={42} />
  </Board>
);

const RoughBox: React.FC<{label: string; state: 'idle' | 'right' | 'wrong'; reveal: number}> = ({label, state, reveal}) => {
  const col = state === 'right' ? CH.green : state === 'wrong' ? '#ff8a8a' : CH.white;
  return (
    <div style={{position: 'relative', width: 430, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: state === 'wrong' ? 0.55 : 1}}>
      <svg width="430" height="150" style={{position: 'absolute', inset: 0}}>
        <rect x="8" y="8" width="414" height="134" rx="26" fill="none" stroke={col} strokeWidth="6" filter="url(#chalk)" />
        {state === 'right' && <path d="M40 78 L88 118 L170 36" fill="none" stroke={CH.green} strokeWidth="12" strokeLinecap="round" strokeDasharray="220" strokeDashoffset={220 * (1 - reveal)} filter="url(#chalk)" />}
        {state === 'wrong' && <g stroke="#ff8a8a" strokeWidth="9" strokeLinecap="round" filter="url(#chalk)" opacity={reveal}><path d="M44 36 L96 108" /><path d="M96 36 L44 108" /></g>}
      </svg>
      <span style={{fontFamily: aref, fontWeight: 700, fontSize: 64, color: col, filter: 'url(#chalk)', direction: 'rtl', marginLeft: 40}}>{label}</span>
    </div>
  );
};

const Quiz: React.FC<{s: any}> = ({s}) => {
  const {t} = useT();
  const at = s.lines[1].t0;
  const rv = Math.max(0, Math.min(1, (t - at) / 0.6));
  return (
    <Board title="سُؤَالٌ">
      <div style={{position: 'absolute', top: 120, left: 80, right: 80, textAlign: 'center', direction: 'rtl', fontFamily: aref, fontWeight: 700, fontSize: 62, lineHeight: 1.6, color: CH.white, filter: 'url(#chalk)'}}>{s.question}</div>
      <div style={{position: 'absolute', top: 340, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 70}}>
        {s.choices.map((c: string, i: number) => <RoughBox key={i} label={c} reveal={rv} state={rv > 0 ? (i === s.answer ? 'right' : 'wrong') : 'idle'} />)}
      </div>
      <Caption s={s} size={44} skipFirst />
    </Board>
  );
};

const Outro: React.FC<{s: any; dur: number}> = ({s, dur}) => (
  <Board>
    <Polaroid src={s.image} dur={dur} rot={1.8} w={620} h={350} />
    <Doodle shape="heart" x={120} y={140} size={150} at={0.8} color={CH.pink} rot={-10} />
    <Doodle shape="heart" x={1010} y={170} size={130} at={1.3} color={CH.pink} rot={8} />
    <Doodle shape="star" x={1050} y={400} size={90} at={1.8} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center'}}>
      <ChalkWords text={s.lines[0].text} size={66} color={CH.yellow} t0={s.lines[0].t0} t1={s.lines[0].t0 + s.lines[0].d} font={amiri} />
    </div>
  </Board>
);

const MAP: Record<string, React.FC<any>> = {story: Story, hadith: Hadith, words: WordsScene, quiz: Quiz, outro: Outro};

export const Chalk: React.FC<{kids: any}> = ({kids}) => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {kids.scenes.map((s: any, i: number) => {
        const dur = Math.round(s.duration * FPS);
        const Comp = MAP[s.type];
        const el = (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Comp s={s} dur={s.duration} />
            {s.lines
              ? s.lines.map((l: any, j: number) => <Sequence key={j} from={Math.round(l.t0 * FPS)}><Audio src={staticFile(l.audio)} /></Sequence>)
              : <Sequence from={9}><Audio src={staticFile(s.audio)} /></Sequence>}
          </Sequence>
        );
        from += dur;
        return el;
      })}
    </AbsoluteFill>
  );
};
