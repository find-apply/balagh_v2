import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {amiri, cairo, inter} from '../core/theme';
import {Clips, OUTRO_SECONDS, VideoSpec, Watermark} from '../spec';

const FPS = 30;
const GOLD = '#e2bf62', GOLD2 = '#f6e3a6';
const PAL = [
  {a: '#0f5a4e', b: '#06241f', glow: '#2fbf9f'},   // emerald
  {a: '#1b3f7a', b: '#091a38', glow: '#5b9bff'},   // sapphire
  {a: '#6a1b34', b: '#260711', glow: '#ff7a9a'},   // garnet
  {a: '#3d2a73', b: '#140d33', glow: '#a78bff'},   // amethyst
];

const star = (cx: number, cy: number, R: number, r: number, n = 8, rot = -Math.PI / 2) =>
  Array.from({length: n * 2}, (_, i) => {
    const rad = i % 2 ? r : R, a = rot + (i * Math.PI) / n;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }).join(' ');

const useT = () => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  return {f, t: f / fps, dur: durationInFrames / fps};
};

/** Tiled geometric background. kinds: star | hex | lattice */
const Pattern: React.FC<{kind: string; pal: number}> = ({kind, pal}) => {
  const {f} = useT();
  const P = PAL[pal % PAL.length];
  const id = `pat-${kind}-${pal}`;
  const size = kind === 'hex' ? 104 : kind === 'lattice' ? 90 : 120;
  const h = kind === 'hex' ? 180 : size;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 38%, ${P.a} 0%, ${P.b} 78%)`}}>
      <svg width="720" height="1280" style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={id} width={size} height={h} patternUnits="userSpaceOnUse" patternTransform={`translate(${f * 0.35} ${f * 0.2}) rotate(${f * 0.02})`}>
            {kind === 'star' && <>
              <polygon points={star(60, 60, 46, 24)} fill="none" stroke={GOLD} strokeWidth="1.6" />
              <polygon points={star(60, 60, 22, 11, 8, -Math.PI / 2 + Math.PI / 8)} fill="none" stroke={GOLD} strokeWidth="1.2" />
              {[[0, 0], [120, 0], [0, 120], [120, 120]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 14} L${x + 14} ${y} L${x} ${y + 14} L${x - 14} ${y} Z`} fill="none" stroke={GOLD} strokeWidth="1.2" />)}
            </>}
            {kind === 'hex' && [[52, 30], [0, 120], [104, 120]].map(([x, y], i) => (
              <g key={i}>
                <polygon points={star(x, y, 50, 50, 3, 0).split(' ').length ? Array.from({length: 6}, (_, k) => `${(x + Math.cos(k * Math.PI / 3 + Math.PI / 6) * 56).toFixed(1)},${(y + Math.sin(k * Math.PI / 3 + Math.PI / 6) * 56).toFixed(1)}`).join(' ') : ''} fill="none" stroke={GOLD} strokeWidth="1.5" />
                <circle cx={x} cy={y} r="16" fill="none" stroke={GOLD} strokeWidth="1.2" />
              </g>
            ))}
            {kind === 'lattice' && <>
              <path d="M0 45 L45 0 L90 45 L45 90 Z" fill="none" stroke={GOLD} strokeWidth="1.6" />
              <circle cx="45" cy="45" r="11" fill="none" stroke={GOLD} strokeWidth="1.3" />
              <circle cx="45" cy="45" r="4" fill={GOLD} />
            </>}
          </pattern>
        </defs>
        <rect width="720" height="1280" fill={`url(#${id})`} opacity="0.2" />
      </svg>
    </AbsoluteFill>
  );
};

const Corner: React.FC<{x: number; y: number; sx: number; sy: number}> = ({x, y, sx, sy}) => (
  <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke={GOLD} strokeWidth="3">
    <path d="M0 80 L0 0 L80 0" />
    <path d="M14 66 L14 14 L66 14" strokeWidth="1.6" />
    <path d="M0 34 Q 34 34 34 0" />
    <polygon points={star(46, 46, 16, 8)} fill={GOLD} stroke="none" />
  </g>
);

const Frame: React.FC = () => (
  <svg width="720" height="1280" style={{position: 'absolute', inset: 0}}>
    <rect x="22" y="22" width="676" height="1236" fill="none" stroke={GOLD} strokeWidth="3" />
    <rect x="32" y="32" width="656" height="1216" fill="none" stroke={GOLD} strokeWidth="1.2" opacity=".7" />
    <Corner x={22} y={22} sx={1} sy={1} /><Corner x={698} y={22} sx={-1} sy={1} />
    <Corner x={22} y={1258} sx={1} sy={-1} /><Corner x={698} y={1258} sx={-1} sy={-1} />
  </svg>
);

/** Central 8-point-star medallion that carries the keyword. */
const Medallion: React.FC<{kw: string; sub?: string; pal: number; en: boolean}> = ({kw, sub, pal, en}) => {
  const {f} = useT();
  const P = PAL[pal % PAL.length];
  const p = spring({frame: f, fps: FPS, config: {damping: 12, stiffness: 80}});
  const rot = f * 0.25;
  const font = en ? inter : amiri;
  const words = kw.split(' ');
  const size = en ? (kw.length > 14 ? 38 : kw.length > 8 ? 46 : 58) : (kw.length > 14 ? 54 : kw.length > 8 ? 70 : 92);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 170, height: 620, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.6 + p * 0.4})`, opacity: p}}>
      <svg width="640" height="640" viewBox="0 0 640 640" style={{position: 'absolute'}}>
        {[0, 1, 2].map((i) => {
          const r = ((f + i * 30) % 90) / 90;
          return <circle key={i} cx="320" cy="320" r={150 + r * 170} fill="none" stroke={P.glow} strokeWidth="2.5" opacity={(1 - r) * 0.5} />;
        })}
        <g transform={`rotate(${rot} 320 320)`}>
          <polygon points={star(320, 320, 300, 232)} fill="none" stroke={GOLD} strokeWidth="2.5" strokeDasharray="10 8" />
        </g>
        <g transform={`rotate(${-rot * 0.6} 320 320)`}>
          <polygon points={star(320, 320, 262, 170)} fill={`${P.b}d9`} stroke={GOLD} strokeWidth="5" />
        </g>
        <polygon points={star(320, 320, 232, 150, 8, -Math.PI / 2 + Math.PI / 8)} fill="none" stroke={GOLD2} strokeWidth="1.8" opacity=".8" />
        <circle cx="320" cy="320" r="118" fill="none" stroke={GOLD} strokeWidth="2" />
      </svg>
      <div style={{position: 'relative', width: 300, textAlign: 'center', direction: en ? 'ltr' : 'rtl', fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1.3, color: GOLD2, textShadow: `0 0 28px ${P.glow}aa`}}>{kw}</div>
      {sub && <div style={{position: 'absolute', bottom: -8, width: '100%', textAlign: 'center', direction: en ? 'ltr' : 'rtl', fontFamily: en ? inter : cairo, fontWeight: 600, fontSize: 28, color: '#fff', opacity: .9}}>{sub}</div>}
    </div>
  );
};

const Segment: React.FC<{seg: any; en: boolean}> = ({seg, en}) => {
  const {f} = useT();
  const fade = interpolate(f, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <Pattern kind={seg.pattern ?? 'star'} pal={seg.pal ?? 0} />
      <Medallion kw={seg.kw} sub={seg.sub} pal={seg.pal ?? 0} en={en} />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{cues: any[]; en: boolean}> = ({cues, en}) => {
  const {t, f} = useT();
  const idx = cues.findIndex((c) => t >= c.t0 && t < c.t1);
  const c = cues[idx];
  if (!c) return null;
  const words = c.text.split(' ');
  const w = words.map((x: string) => x.length + 1), total = w.reduce((a: number, b: number) => a + b, 0);
  const spoken = Math.max(0, Math.min(1, (t - c.t0) / Math.max(0.1, c.t1 - c.t0 - 0.2)));
  const pop = spring({frame: Math.round((t - c.t0) * FPS), fps: FPS, config: {damping: 16}});
  let acc = 0;
  return (
    <div style={{position: 'absolute', left: 44, right: 44, top: 830, minHeight: 250, background: 'linear-gradient(rgba(4,10,20,.78), rgba(4,10,20,.55))', border: `1.5px solid ${GOLD}`, borderRadius: 18, padding: '24px 26px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateY(${(1 - pop) * 18}px)`, opacity: pop}}>
      <div style={{direction: en ? 'ltr' : 'rtl', textAlign: 'center', fontFamily: en ? inter : amiri, fontWeight: 700, fontSize: en ? (c.emph ? 44 : 38) : (c.emph ? (words.length > 10 ? 46 : 58) : 52), lineHeight: 1.55, color: '#fff'}}>
        {words.map((x: string, i: number) => {
          const s0 = acc / total, e0 = (acc + w[i]) / total; acc += w[i];
          const on = spoken >= s0 && spoken < e0 + 0.02;
          return <span key={i} style={{display: 'inline-block', margin: '0 7px', color: on || (c.emph && spoken > e0) ? GOLD : '#fff', borderBottom: on ? `3px solid ${GOLD}` : '3px solid transparent'}}>{x}</span>;
        })}
      </div>
      {c.sub && <div style={{position: 'absolute', top: 'calc(100% + 10px)', left: 0, right: 0, textAlign: 'center', fontFamily: cairo, fontSize: 24, lineHeight: 1.3, color: GOLD2}}>{c.sub}</div>}
    </div>
  );
};

const Progress: React.FC<{total: number}> = ({total}) => {
  const {t} = useT();
  const n = 9, k = Math.min(1, t / total) * n;
  return (
    <svg width="720" height="70" style={{position: 'absolute', left: 0, top: 1160}}>
      {Array.from({length: n}, (_, i) => (
        <polygon key={i} points={star(100 + i * 65, 36, 17, 9)} fill={k > i ? GOLD : 'none'} stroke={GOLD} strokeWidth="1.6" opacity={k > i ? 1 : 0.5} />
      ))}
    </svg>
  );
};

const Hook: React.FC<{text: string; en: boolean}> = ({text, en}) => {
  const {t} = useT();
  const o = interpolate(t, [0, 0.4, 3, 3.5], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', top: 84, left: 60, right: 60, textAlign: 'center', direction: en ? 'ltr' : 'rtl', opacity: o, transform: `translateY(${(1 - o) * -24}px)`}}>
      <div style={{display: 'inline-block', background: GOLD2, color: '#1b2a24', borderRadius: 14, padding: '14px 34px', fontFamily: en ? inter : cairo, fontWeight: 800, fontSize: en ? 36 : 42, border: `3px double #8a6d1f`, boxShadow: '0 10px 30px rgba(0,0,0,.4)'}}>{text}</div>
    </div>
  );
};

const GeoMain: React.FC<{s: any; en: boolean}> = ({s, en}) => (
  <AbsoluteFill>
    {s.segs.map((g: any, i: number) => (
      <Sequence key={i} from={Math.round(g.t0 * FPS)} durationInFrames={Math.round((g.t1 - g.t0) * FPS) + 10}><Segment seg={g} en={en} /></Sequence>
    ))}
    <Frame />
    {s.hook && <Hook text={s.hook} en={en} />}
    <Caption cues={s.cues} en={en} />
    {s.speaker && <div style={{position: 'absolute', top: 1105, width: '100%', textAlign: 'center', fontFamily: en ? inter : cairo, fontWeight: 600, fontSize: 26, color: GOLD2, direction: en ? 'ltr' : 'rtl'}}>{s.speaker}</div>}
    <Progress total={s.duration} />
  </AbsoluteFill>
);

const GeoOutro: React.FC<{s: any; en: boolean}> = ({s, en}) => (
  <AbsoluteFill>
    <Pattern kind="star" pal={0} />
    <Frame />
    <Medallion kw={s.lines[0]} sub={s.lines[1]} pal={0} en={en} />
  </AbsoluteFill>
);

const PATTERNS = ['star', 'hex', 'lattice'];

export const Geo: React.FC<{spec: VideoSpec}> = ({spec}) => {
  const en = spec.lang === 'en';
  const main = {
    duration: spec.duration,
    hook: spec.hook,
    cues: spec.cues,
    segs: spec.art.map((a, i) => ({t0: a.t0, t1: a.t1, kw: a.keyword, sub: a.detail || null, pattern: PATTERNS[i % 3], pal: i % 4})),
  };
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Sequence durationInFrames={Math.round(spec.duration * FPS)}><GeoMain s={main} en={en} /></Sequence>
      <Sequence from={Math.round(spec.duration * FPS)} durationInFrames={Math.round(OUTRO_SECONDS * FPS)}><GeoOutro s={{lines: spec.outro}} en={en} /></Sequence>
      <Clips clips={spec.audio} />
      <Watermark text={spec.watermark} />
    </AbsoluteFill>
  );
};
