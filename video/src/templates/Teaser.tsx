import React from 'react';
import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import {WHO, spokenParts, useDir, useT} from '../core/story';
import {LangCtx, amiri, cairo, inter, useEn} from '../core/theme';
import {FPS, SceneAudio, TeaserShot, TeaserSpec} from '../spec';

// The parents' teaser: vertical, 20-30 s, cut from the children's story. Same palette as the Kids template.
const C = {teal: '#1f9d8a', tealDark: '#14705f', yellow: '#ffd84d', ink: '#26343b', cream: '#fff7ea'};
const PASTEL = 'linear-gradient(160deg, #fde7d3 0%, #f3f7e6 45%, #d6efe8 100%)';

const useFonts = () => {
  const en = useEn();
  return {body: en ? inter : cairo, quote: en ? inter : amiri};
};

const Cover: React.FC<{src: string; from?: number; to?: number; blur?: number}> = ({src, from = 1, to = 1.12, blur = 0}) => {
  const {f, dur} = useT();
  const sc = interpolate(f, [0, dur * FPS], [from, to]);
  return <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${sc})`, filter: blur ? `blur(${blur}px) brightness(.75)` : undefined}} />;
};

const Card: React.FC<{children: React.ReactNode; top?: number; bottom?: number; delay?: number}> = ({children, top, bottom, delay = 0}) => {
  const f = useCurrentFrame();
  const p = spring({frame: f - delay, fps: FPS, config: {damping: 14}});
  return (
    <div style={{position: 'absolute', left: 40, right: 40, top, bottom, background: 'rgba(255,255,255,.95)', borderRadius: 30, padding: '24px 28px', boxShadow: '0 12px 36px rgba(0,0,0,.25)', opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
      {children}
    </div>
  );
};

const Intro: React.FC<{spec: TeaserSpec}> = ({spec}) => {
  const fonts = useFonts();
  const dir = useDir();
  return (
    <AbsoluteFill style={{background: PASTEL}}>
      {spec.shots[0] && <Cover src={spec.shots[0].image} blur={6} from={1.1} to={1.2} />}
      <Card top={380}>
        <div style={{direction: dir, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: 40, color: C.teal}}>{spec.intro}</div>
        <div style={{direction: dir, textAlign: 'center', fontFamily: fonts.quote, fontWeight: 700, fontSize: 56, color: C.ink, lineHeight: 1.5, marginTop: 16}}>{spec.title}</div>
      </Card>
    </AbsoluteFill>
  );
};

const Shot: React.FC<{shot: TeaserShot; label?: string}> = ({shot, label}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const en = useEn();
  const l = shot.lines[0];
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Cover src={shot.image} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 520, background: 'linear-gradient(transparent, rgba(0,0,0,.65))'}} />
      {label && <div style={{position: 'absolute', top: 60, [en ? 'left' : 'right']: 40, background: C.teal, color: '#fff', fontFamily: fonts.body, fontWeight: 800, fontSize: 30, padding: '8px 26px', borderRadius: 24}}>{label}</div>}
      <Card bottom={90}>
        <div style={{position: 'absolute', top: -20, [en ? 'left' : 'right']: 30, background: WHO[l.who] ?? C.teal, color: '#fff', fontFamily: fonts.body, fontWeight: 800, fontSize: 26, padding: '2px 20px', borderRadius: 18}}>{l.name}</div>
        <div style={{direction: dir, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: l.text.length > 90 ? 32 : 40, lineHeight: 1.6, color: C.ink, paddingTop: 10}}>
          {spokenParts(l.text, t, l.t0 + 0.05, l.t0 + l.d).map((w, i) => (
            <span key={i} style={{display: 'inline-block', margin: '0 6px', padding: '0 6px', borderRadius: 12, background: w.on ? C.yellow : 'transparent'}}>{w.word}</span>
          ))}
        </div>
      </Card>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{spec: TeaserSpec}> = ({spec}) => {
  const fonts = useFonts();
  const dir = useDir();
  const last = spec.shots[spec.shots.length - 1];
  return (
    <AbsoluteFill style={{background: PASTEL}}>
      {last && <Cover src={last.image} blur={6} from={1.1} to={1.18} />}
      {spec.source && (
        <Card top={300}>
          <div style={{direction: dir, textAlign: 'center', fontFamily: fonts.body, fontWeight: 600, fontSize: 30, color: C.tealDark, lineHeight: 1.6}}>{spec.source}</div>
        </Card>
      )}
      <Card top={spec.source ? 520 : 440} delay={8}>
        <div style={{direction: dir, textAlign: 'center', fontFamily: fonts.body, fontWeight: 800, fontSize: 44, color: C.ink, lineHeight: 1.5}}>{spec.cta}</div>
      </Card>
    </AbsoluteFill>
  );
};

export const Teaser: React.FC<{spec: TeaserSpec}> = ({spec}) => {
  let from = 0;
  const seq = (dur: number, el: React.ReactNode, key: string) => {
    const frames = Math.round(dur * FPS);
    const out = <Sequence key={key} from={from} durationInFrames={frames}>{el}</Sequence>;
    from += frames;
    return out;
  };
  return (
    <LangCtx.Provider value={{en: spec.lang === 'en'}}>
      <AbsoluteFill style={{background: '#000'}}>
        {seq(spec.introSeconds, <Intro spec={spec} />, 'intro')}
        {spec.shots.map((s, i) => seq(s.duration, <><Shot shot={s} label={i === spec.shots.length - 1 ? spec.lesson : undefined} /><SceneAudio s={{id: `t${i}`, type: 'story', duration: s.duration, lines: s.lines}} /></>, `shot${i}`))}
        {seq(spec.ctaSeconds, <Cta spec={spec} />, 'cta')}
      </AbsoluteFill>
    </LangCtx.Provider>
  );
};
