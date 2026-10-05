import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {amiri, cairo} from './theme';

const FPS = 30;
const C = {teal: '#1f9d8a', tealDark: '#14705f', peach: '#ffc9a8', cream: '#fff7ea', yellow: '#ffd84d', ink: '#26343b'};
const PASTEL = 'linear-gradient(135deg, #fde7d3 0%, #f3f7e6 45%, #d6efe8 100%)';

const useT = () => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  return {t: f / fps, f, dur: durationInFrames / fps};
};

/** Words highlight as they are spoken (weighted by word length). */
const Words: React.FC<{text: string; size: number; font?: string; color?: string; active?: string; align?: 'center' | 'right'; lead?: number; t0?: number; t1?: number}> = ({text, size, font = cairo, color = C.ink, active = C.yellow, align = 'center', lead = 0.25, t0, t1}) => {
  const {t, dur} = useT();
  const words = text.split(' ');
  const w = words.map((x) => x.length + 1);
  const total = w.reduce((a, b) => a + b, 0);
  const a = t0 !== undefined ? t0 : lead;
  const b = t1 !== undefined ? t1 : dur - 0.7;
  const spoken = Math.max(0, Math.min(1, (t - a) / Math.max(0.1, b - a)));
  let acc = 0;
  return (
    <div style={{direction: 'rtl', textAlign: align, fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.6, color}}>
      {words.map((x, i) => {
        const start = acc / total, end = (acc + w[i]) / total; acc += w[i];
        const on = spoken >= start && spoken < end + 0.02;
        return <span key={i} style={{display: 'inline-block', margin: '0 8px', padding: '0 8px', borderRadius: 14, background: on ? active : 'transparent', transition: 'none'}}>{x}</span>;
      })}
    </div>
  );
};

const WHO: Record<string, string> = {narr: '#7a8a93', salim: '#1f9d8a', maryam: '#e0679a', nour: '#e0a21a'};

/** Subtitle bar for dialogue: speaker chip + highlighted words of the current line. */
const SubBar: React.FC<{s: any; size?: number; skipFirst?: boolean}> = ({s, size = 44, skipFirst}) => {
  const {t} = useT();
  const L = s.lines as any[];
  let idx = 0;
  L.forEach((l, i) => { if (t >= l.t0) idx = i; });
  const l = L[idx];
  if (skipFirst && idx === 0) return null;
  return (
    <div style={{position: 'absolute', left: 60, right: 60, bottom: 36, background: 'rgba(255,255,255,.95)', borderRadius: 28, padding: '30px 30px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.18)'}}>
      <div style={{position: 'absolute', top: -18, right: 36, background: WHO[l.who], color: '#fff', fontFamily: cairo, fontWeight: 800, fontSize: 28, padding: '2px 22px', borderRadius: 18}}>{l.name}</div>
      <Words text={l.text} size={size} t0={l.t0 + 0.05} t1={l.t0 + l.d} />
    </div>
  );
};

const Chrome: React.FC<{children: React.ReactNode; title?: string}> = ({children, title}) => (
  <AbsoluteFill style={{background: PASTEL}}>
    {children}
    {title && <div style={{position: 'absolute', top: 28, right: 36, background: C.teal, color: '#fff', fontFamily: cairo, fontWeight: 800, fontSize: 30, padding: '8px 26px', borderRadius: 24}}>{title}</div>}
  </AbsoluteFill>
);

const Story: React.FC<{s: any}> = ({s}) => {
  const {f, dur} = useT();
  const sc = s.zoom === 'in' ? interpolate(f, [0, dur * 30], [1.0, 1.18]) : interpolate(f, [0, dur * 30], [1.0, 1.08]);
  const px = interpolate(f, [0, dur * 30], [0, -18]);
  const fade = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <Chrome title="اسْتَمِعْ وَتَعَلَّمْ">
      <Img src={staticFile(s.image)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${sc}) translateX(${px}px)`, opacity: fade}} />
      <SubBar s={s} size={44} />
    </Chrome>
  );
};

const Hadith: React.FC<{s: any}> = ({s}) => {
  const {f} = useT();
  const p = spring({frame: f, fps: FPS, config: {damping: 14}});
  return (
    <Chrome title="حَدِيثٌ شَرِيفٌ">
      <div style={{position: 'absolute', left: 90, right: 90, top: 120, bottom: 90, background: '#fff', borderRadius: 40, boxShadow: '0 18px 50px rgba(0,0,0,.18)', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.85 + p * 0.15})`, opacity: p, border: `6px solid ${C.teal}`}}>
        <div style={{fontFamily: cairo, fontWeight: 800, fontSize: 38, color: C.tealDark, direction: 'rtl'}}>{s.text}</div>
        <div style={{marginTop: 24}}><Words text={s.quote} size={60} font={amiri} lead={s.quoteLead ?? 1.2} /></div>
        <div style={{marginTop: 26, fontFamily: cairo, fontWeight: 600, fontSize: 32, color: '#6b7a80', direction: 'rtl'}}>{s.source}</div>
      </div>
    </Chrome>
  );
};

const WordsScene: React.FC<{s: any}> = ({s}) => {
  const {t, dur} = useT();
  return (
    <Chrome title="نَفْهَمُ مَعًا">
      <div style={{position: 'absolute', top: 90, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 50}}>
        {s.cards.map((c: any, i: number) => {
          const show = spring({frame: Math.max(0, (t - (1.2 + i * 2.6)) * FPS), fps: FPS, config: {damping: 13}});
          return (
            <div key={i} style={{width: 470, background: '#fff', borderRadius: 34, padding: '28px 24px', textAlign: 'center', boxShadow: '0 12px 36px rgba(0,0,0,.16)', transform: `scale(${show})`, opacity: show, direction: 'rtl'}}>
              <div style={{fontFamily: amiri, fontWeight: 700, fontSize: 92, color: C.tealDark}}>{c.word}</div>
              <div style={{fontFamily: cairo, fontWeight: 600, fontSize: 36, color: C.ink, marginTop: 6}}>{c.meaning}</div>
            </div>
          );
        })}
      </div>
      <SubBar s={s} size={36} />
    </Chrome>
  );
};

const Quiz: React.FC<{s: any}> = ({s}) => {
  const {t, dur} = useT();
  const at = s.lines[1].t0;
  const reveal = t >= at;
  const p = spring({frame: reveal ? (t - at) * FPS : 0, fps: FPS, config: {damping: 10}});
  return (
    <Chrome title="سُؤَالٌ">
      <div style={{position: 'absolute', top: 110, left: 80, right: 80, direction: 'rtl', textAlign: 'center', fontFamily: cairo, fontWeight: 800, fontSize: 54, color: C.ink, lineHeight: 1.6}}>{s.question}</div>
      <div style={{position: 'absolute', top: 360, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 60}}>
        {s.choices.map((c: string, i: number) => {
          const right = reveal && i === s.answer, wrong = reveal && i !== s.answer;
          return (
            <div key={i} style={{width: 420, padding: '30px 20px', borderRadius: 34, textAlign: 'center', fontFamily: cairo, fontWeight: 800, fontSize: 56, direction: 'rtl', color: right ? '#fff' : C.ink, background: right ? '#2fb344' : '#fff', border: `6px solid ${right ? '#2fb344' : C.peach}`, opacity: wrong ? 0.35 : 1, transform: `scale(${right ? 1 + p * 0.08 : 1})`, boxShadow: '0 12px 30px rgba(0,0,0,.14)'}}>
              {c} {right && '✓'}
            </div>
          );
        })}
      </div>
      <SubBar s={s} size={40} skipFirst />
    </Chrome>
  );
};

const Outro: React.FC<{s: any}> = ({s}) => {
  const {f, dur} = useT();
  const sc = interpolate(f, [0, dur * 30], [1.0, 1.1]);
  return (
    <Chrome>
      <Img src={staticFile(s.image)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${sc})`, filter: 'brightness(.85)'}} />
      <div style={{position: 'absolute', left: 80, right: 80, top: 70, background: 'rgba(255,255,255,.95)', borderRadius: 34, padding: '20px 30px', boxShadow: '0 12px 36px rgba(0,0,0,.25)'}}>
        <Words text={s.lines[0].text} size={64} font={amiri} color={C.tealDark} t0={s.lines[0].t0} t1={s.lines[0].t0 + s.lines[0].d} />
      </div>
    </Chrome>
  );
};

const MAP: Record<string, React.FC<{s: any}>> = {story: Story, hadith: Hadith, words: WordsScene, quiz: Quiz, outro: Outro};

export const Kids: React.FC<{kids: any}> = ({kids}) => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {kids.scenes.map((s: any, i: number) => {
        const dur = Math.round(s.duration * FPS);
        const Comp = MAP[s.type];
        const el = (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Comp s={s} />
            {s.lines
              ? s.lines.map((l: any, j: number) => (
                  <Sequence key={j} from={Math.round(l.t0 * FPS)}><Audio src={staticFile(l.audio)} /></Sequence>
                ))
              : <Sequence from={9}><Audio src={staticFile(s.audio)} /></Sequence>}
          </Sequence>
        );
        from += dur;
        return el;
      })}
    </AbsoluteFill>
  );
};
