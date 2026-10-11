import React from 'react';
import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile} from 'remotion';
import {currentLine, useDir, useT} from '../core/story';
import {LangCtx, useEn} from '../core/theme';
import {FPS, SceneAudio, StoryScene, StorySpec, Watermark} from '../spec';
import {C, Words, fit, useFonts} from './Kids';

// The picture-book story at 720×1280 for Reels, Shorts and TikTok. The feeds draw their own name, caption and
// buttons over the top ~110 px and the bottom ~230 px, so titles sit below the first and subtitles above the second.
const TOP = 110;
const BOTTOM = 230;
const PASTEL = 'linear-gradient(180deg, #fde7d3 0%, #f3f7e6 45%, #d6efe8 100%)';

const Chrome: React.FC<{children: React.ReactNode; title?: string}> = ({children, title}) => {
  const fonts = useFonts();
  const en = useEn();
  return (
    <AbsoluteFill style={{background: PASTEL}}>
      {children}
      {title && <div style={{position: 'absolute', top: TOP, [en ? 'left' : 'right']: 28, background: C.teal, color: '#fff', fontFamily: fonts.body, fontWeight: 800, fontSize: 28, padding: '6px 22px', borderRadius: 22}}>{title}</div>}
    </AbsoluteFill>
  );
};

/** Subtitle card above the feed's own caption: speaker chip, then the current line, words lit as spoken. */
const SubCard: React.FC<{s: StoryScene; size?: number; skipFirst?: boolean}> = ({s, size = 36, skipFirst}) => {
  const {t} = useT();
  const fonts = useFonts();
  const en = useEn();
  const cur = currentLine(s, t);
  if (!cur || (skipFirst && cur.idx === 0)) return null;
  const l = cur.line;
  return (
    <div style={{position: 'absolute', left: 28, right: 28, bottom: BOTTOM, background: 'rgba(255,255,255,.96)', borderRadius: 26, padding: '28px 18px 10px', boxShadow: '0 10px 30px rgba(0,0,0,.2)'}}>
      <div style={{position: 'absolute', top: -18, [en ? 'left' : 'right']: 26, background: C.teal, color: '#fff', fontFamily: fonts.body, fontWeight: 800, fontSize: 26, padding: '2px 20px', borderRadius: 16}}>{l.name}</div>
      <Words text={l.text} size={fit(l.text, size)} t0={l.t0 + 0.05} t1={l.t0 + l.d} />
    </div>
  );
};

const Story: React.FC<{s: StoryScene}> = ({s}) => {
  const {f, dur} = useT();
  const sc = interpolate(f, [0, dur * FPS], [1.0, 1.08]);
  const py = interpolate(f, [0, dur * FPS], [0, -24]);
  const fade = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <Chrome title={s.title}>
      {s.image && <Img src={staticFile(s.image)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${sc}) translateY(${py}px)`, opacity: fade}} />}
      <SubCard s={s} />
    </Chrome>
  );
};

/** The verified verse or hadith on a tall card. */
const Text: React.FC<{s: StoryScene}> = ({s}) => {
  const {f} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const p = spring({frame: f, fps: FPS, config: {damping: 14}});
  const quote = s.quote ?? '';
  const size = quote.length > 160 ? 36 : quote.length > 90 ? 44 : 52;
  return (
    <Chrome title={s.title}>
      <div style={{position: 'absolute', left: 36, right: 36, top: TOP + 70, bottom: BOTTOM - 40, background: '#fff', borderRadius: 36, boxShadow: '0 18px 50px rgba(0,0,0,.18)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.85 + p * 0.15})`, opacity: p, border: `6px solid ${C.teal}`}}>
        <div style={{fontFamily: fonts.body, fontWeight: 800, fontSize: 34, color: C.tealDark, direction: dir}}>{s.text}</div>
        <div style={{marginTop: 22}}><Words text={quote} size={size} font={fonts.quote} t0={s.quoteLead ?? 1} t1={s.quoteEnd ?? s.duration - 0.7} /></div>
        <div style={{marginTop: 24, fontFamily: fonts.body, fontWeight: 600, fontSize: 28, color: '#6b7a80', direction: dir, textAlign: 'center'}}>{s.source}</div>
        {s.silentNote && <div style={{marginTop: 16, fontFamily: fonts.body, fontWeight: 600, fontSize: 22, color: C.teal, direction: dir, background: C.cream, padding: '6px 16px', borderRadius: 14, textAlign: 'center'}}>{s.silentNote}</div>}
      </div>
    </Chrome>
  );
};

/** Word cards stacked one above the other, each popping in as it is explained. */
const WordsScene: React.FC<{s: StoryScene}> = ({s}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  return (
    <Chrome title={s.title}>
      <div style={{position: 'absolute', top: TOP + 90, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
        {(s.cards ?? []).map((c, i) => {
          const show = spring({frame: Math.max(0, (t - (1.2 + i * 2.6)) * FPS), fps: FPS, config: {damping: 13}});
          return (
            <div key={i} style={{width: 560, background: '#fff', borderRadius: 32, padding: '22px 20px', textAlign: 'center', boxShadow: '0 12px 36px rgba(0,0,0,.16)', transform: `scale(${show})`, opacity: show, direction: dir}}>
              <div style={{fontFamily: fonts.quote, fontWeight: 700, fontSize: c.word.length > 10 ? 58 : 80, color: C.tealDark}}>{c.word}</div>
              <div style={{fontFamily: fonts.body, fontWeight: 600, fontSize: 32, color: C.ink, marginTop: 4}}>{c.meaning}</div>
            </div>
          );
        })}
      </div>
      <SubCard s={s} size={34} />
    </Chrome>
  );
};

/** The question, then its choices stacked; the right one turns green when revealed. */
const Quiz: React.FC<{s: StoryScene}> = ({s}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const at = s.revealAt ?? s.duration;
  const reveal = t >= at;
  const p = spring({frame: reveal ? (t - at) * FPS : 0, fps: FPS, config: {damping: 10}});
  return (
    <Chrome title={s.title}>
      <div style={{position: 'absolute', top: TOP + 80, left: 40, right: 40, direction: dir, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: 46, color: C.ink, lineHeight: 1.55}}>{s.question}</div>
      <div style={{position: 'absolute', top: TOP + 360, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
        {(s.choices ?? []).map((c, i) => {
          const right = reveal && i === (s.answer ?? 0), wrong = reveal && i !== (s.answer ?? 0);
          return (
            <div key={i} style={{width: 560, padding: '24px 18px', borderRadius: 30, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: 42, direction: dir, color: right ? '#fff' : C.ink, background: right ? '#2fb344' : '#fff', border: `6px solid ${right ? '#2fb344' : C.peach}`, opacity: wrong ? 0.35 : 1, transform: `scale(${right ? 1 + p * 0.06 : 1})`, boxShadow: '0 12px 30px rgba(0,0,0,.14)'}}>
              {c} {right && '✓'}
            </div>
          );
        })}
      </div>
      <SubCard s={s} size={34} skipFirst />
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
        <div style={{position: 'absolute', left: 36, right: 36, top: TOP + 20, background: 'rgba(255,255,255,.95)', borderRadius: 30, padding: '18px 20px', boxShadow: '0 12px 36px rgba(0,0,0,.25)'}}>
          <Words text={l.text} size={fit(l.text, 46)} font={fonts.quote} color={C.tealDark} t0={l.t0} t1={l.t0 + l.d} />
        </div>
      )}
    </Chrome>
  );
};

const MAP: Record<StoryScene['type'], React.FC<{s: StoryScene}>> = {story: Story, text: Text, words: WordsScene, quiz: Quiz, outro: Outro};

export const KidsReel: React.FC<{spec: StorySpec}> = ({spec}) => {
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
        <Watermark text={spec.watermark} />
      </AbsoluteFill>
    </LangCtx.Provider>
  );
};
