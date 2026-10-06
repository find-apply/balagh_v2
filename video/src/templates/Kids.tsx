import React from 'react';
import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile} from 'remotion';
import {WHO, currentLine, spokenParts, useDir, useT} from '../core/story';
import {LangCtx, amiri, cairo, inter, useEn} from '../core/theme';
import {FPS, SceneAudio, StoryScene, StorySpec} from '../spec';

const C = {teal: '#1f9d8a', tealDark: '#14705f', peach: '#ffc9a8', cream: '#fff7ea', yellow: '#ffd84d', ink: '#26343b'};
const PASTEL = 'linear-gradient(135deg, #fde7d3 0%, #f3f7e6 45%, #d6efe8 100%)';

const useFonts = () => {
  const en = useEn();
  return {body: en ? inter : cairo, quote: en ? inter : amiri};
};

/** Words highlight as they are spoken (weighted by word length). */
const Words: React.FC<{text: string; size: number; font?: string; color?: string; active?: string; t0: number; t1: number}> = ({text, size, font, color = C.ink, active = C.yellow, t0, t1}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  return (
    <div style={{direction: dir, textAlign: 'center', fontFamily: font ?? fonts.body, fontWeight: 800, fontSize: size, lineHeight: 1.6, color}}>
      {spokenParts(text, t, t0, t1).map((w, i) => (
        <span key={i} style={{display: 'inline-block', margin: '0 8px', padding: '0 8px', borderRadius: 14, background: w.on ? active : 'transparent'}}>{w.word}</span>
      ))}
    </div>
  );
};

/** Long lines get a smaller size so the bar stays two lines high. */
const fit = (text: string, size: number) => (text.length > 130 ? size * 0.7 : text.length > 80 ? size * 0.82 : size);

/** Subtitle bar for dialogue: speaker chip + highlighted words of the current line. */
const SubBar: React.FC<{s: StoryScene; size?: number; skipFirst?: boolean}> = ({s, size = 44, skipFirst}) => {
  const {t} = useT();
  const fonts = useFonts();
  const en = useEn();
  const cur = currentLine(s, t);
  if (!cur || (skipFirst && cur.idx === 0)) return null;
  const l = cur.line;
  return (
    <div style={{position: 'absolute', left: 60, right: 60, bottom: 36, background: 'rgba(255,255,255,.95)', borderRadius: 28, padding: '30px 30px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.18)'}}>
      <div style={{position: 'absolute', top: -18, [en ? 'left' : 'right']: 36, background: WHO[l.who] ?? C.teal, color: '#fff', fontFamily: fonts.body, fontWeight: 800, fontSize: 28, padding: '2px 22px', borderRadius: 18}}>{l.name}</div>
      <Words text={l.text} size={fit(l.text, size)} t0={l.t0 + 0.05} t1={l.t0 + l.d} />
    </div>
  );
};

const Chrome: React.FC<{children: React.ReactNode; title?: string}> = ({children, title}) => {
  const fonts = useFonts();
  const en = useEn();
  return (
    <AbsoluteFill style={{background: PASTEL}}>
      {children}
      {title && <div style={{position: 'absolute', top: 28, [en ? 'left' : 'right']: 36, background: C.teal, color: '#fff', fontFamily: fonts.body, fontWeight: 800, fontSize: 30, padding: '8px 26px', borderRadius: 24}}>{title}</div>}
    </AbsoluteFill>
  );
};

const Story: React.FC<{s: StoryScene}> = ({s}) => {
  const {f, dur} = useT();
  const sc = interpolate(f, [0, dur * FPS], [1.0, 1.08]);
  const px = interpolate(f, [0, dur * FPS], [0, -18]);
  const fade = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <Chrome title={s.title}>
      {s.image && <Img src={staticFile(s.image)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${sc}) translateX(${px}px)`, opacity: fade}} />}
      <SubBar s={s} size={44} />
    </Chrome>
  );
};

/** The verified verse or hadith, alone on a card. Words follow the narration, or reading time for the Quran. */
const Text: React.FC<{s: StoryScene}> = ({s}) => {
  const {f} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const p = spring({frame: f, fps: FPS, config: {damping: 14}});
  const quote = s.quote ?? '';
  const size = quote.length > 160 ? 40 : quote.length > 90 ? 50 : 60;
  return (
    <Chrome title={s.title}>
      <div style={{position: 'absolute', left: 90, right: 90, top: 120, bottom: 90, background: '#fff', borderRadius: 40, boxShadow: '0 18px 50px rgba(0,0,0,.18)', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.85 + p * 0.15})`, opacity: p, border: `6px solid ${C.teal}`}}>
        <div style={{fontFamily: fonts.body, fontWeight: 800, fontSize: 38, color: C.tealDark, direction: dir}}>{s.text}</div>
        <div style={{marginTop: 24}}><Words text={quote} size={size} font={fonts.quote} t0={s.quoteLead ?? 1} t1={s.quoteEnd ?? s.duration - 0.7} /></div>
        <div style={{marginTop: 26, fontFamily: fonts.body, fontWeight: 600, fontSize: 32, color: '#6b7a80', direction: dir}}>{s.source}</div>
        {s.silentNote && <div style={{marginTop: 18, fontFamily: fonts.body, fontWeight: 600, fontSize: 24, color: C.teal, direction: dir, background: C.cream, padding: '6px 18px', borderRadius: 16}}>{s.silentNote}</div>}
      </div>
    </Chrome>
  );
};

const WordsScene: React.FC<{s: StoryScene}> = ({s}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  return (
    <Chrome title={s.title}>
      <div style={{position: 'absolute', top: 90, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 50}}>
        {(s.cards ?? []).map((c, i) => {
          const show = spring({frame: Math.max(0, (t - (1.2 + i * 2.6)) * FPS), fps: FPS, config: {damping: 13}});
          return (
            <div key={i} style={{width: 470, background: '#fff', borderRadius: 34, padding: '28px 24px', textAlign: 'center', boxShadow: '0 12px 36px rgba(0,0,0,.16)', transform: `scale(${show})`, opacity: show, direction: dir}}>
              <div style={{fontFamily: fonts.quote, fontWeight: 700, fontSize: c.word.length > 10 ? 64 : 92, color: C.tealDark}}>{c.word}</div>
              <div style={{fontFamily: fonts.body, fontWeight: 600, fontSize: 36, color: C.ink, marginTop: 6}}>{c.meaning}</div>
            </div>
          );
        })}
      </div>
      <SubBar s={s} size={36} />
    </Chrome>
  );
};

const Quiz: React.FC<{s: StoryScene}> = ({s}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const at = s.revealAt ?? s.duration;
  const reveal = t >= at;
  const p = spring({frame: reveal ? (t - at) * FPS : 0, fps: FPS, config: {damping: 10}});
  return (
    <Chrome title={s.title}>
      <div style={{position: 'absolute', top: 110, left: 80, right: 80, direction: dir, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: 54, color: C.ink, lineHeight: 1.6}}>{s.question}</div>
      <div style={{position: 'absolute', top: 360, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 60}}>
        {(s.choices ?? []).map((c, i) => {
          const right = reveal && i === (s.answer ?? 0), wrong = reveal && i !== (s.answer ?? 0);
          return (
            <div key={i} style={{width: 420, padding: '30px 20px', borderRadius: 34, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: 48, direction: dir, color: right ? '#fff' : C.ink, background: right ? '#2fb344' : '#fff', border: `6px solid ${right ? '#2fb344' : C.peach}`, opacity: wrong ? 0.35 : 1, transform: `scale(${right ? 1 + p * 0.08 : 1})`, boxShadow: '0 12px 30px rgba(0,0,0,.14)'}}>
              {c} {right && '✓'}
            </div>
          );
        })}
      </div>
      <SubBar s={s} size={40} skipFirst />
    </Chrome>
  );
};

const Outro: React.FC<{s: StoryScene}> = ({s}) => {
  const {f, dur} = useT();
  const fonts = useFonts();
  const sc = interpolate(f, [0, dur * FPS], [1.0, 1.1]);
  const l = s.lines?.[0];
  return (
    <Chrome>
      {s.image && <Img src={staticFile(s.image)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${sc})`, filter: 'brightness(.85)'}} />}
      {l && (
        <div style={{position: 'absolute', left: 80, right: 80, top: 70, background: 'rgba(255,255,255,.95)', borderRadius: 34, padding: '20px 30px', boxShadow: '0 12px 36px rgba(0,0,0,.25)'}}>
          <Words text={l.text} size={fit(l.text, 56)} font={fonts.quote} color={C.tealDark} t0={l.t0} t1={l.t0 + l.d} />
        </div>
      )}
    </Chrome>
  );
};

const MAP: Record<StoryScene['type'], React.FC<{s: StoryScene}>> = {story: Story, text: Text, words: WordsScene, quiz: Quiz, outro: Outro};

export const Kids: React.FC<{spec: StorySpec}> = ({spec}) => {
  let from = 0;
  return (
    <LangCtx.Provider value={{en: spec.lang === 'en'}}>
      <AbsoluteFill style={{background: '#000'}}>
        {spec.scenes.map((s, i) => {
          const dur = Math.round(s.duration * FPS);
          const Comp = MAP[s.type];
          const el = (
            <Sequence key={i} from={from} durationInFrames={dur}>
              <Comp s={s} />
              <SceneAudio s={s} />
            </Sequence>
          );
          from += dur;
          return el;
        })}
      </AbsoluteFill>
    </LangCtx.Provider>
  );
};
