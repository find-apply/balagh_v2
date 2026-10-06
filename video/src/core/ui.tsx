import React from 'react';
import {Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Visual, renderVisual} from './visuals';
import {amiri, cairo, reem, inter, useEn, C} from './theme';

export const useIn = (delay = 0) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - delay, fps, config: {damping: 14, stiffness: 110}});
};

export const asSrc = (p: string) => (/^https?:|^data:/.test(p) ? p : staticFile(p));

/** Round calligraphy medallion (name inside a ring). Pass `image` to use a real calligraphy PNG instead. */
export const Medallion: React.FC<{text: string; size?: number; dark?: boolean; image?: string; delay?: number}> = ({
  text, size = 260, dark = false, image, delay = 0,
}) => {
  const p = useIn(delay);
  const fg = dark ? C.ink : '#eaf2fb';
  const en = useEn();
  const f = useCurrentFrame();
  const float = Math.sin((f + delay * 7) / 18) * 6;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      transform: `scale(${p}) translateY(${float}px)`, opacity: p,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: dark ? 'rgba(255,255,255,0.7)' : 'radial-gradient(circle at 35% 30%, #aeb8c6, #6f7c8d 70%)',
      border: `${size * 0.035}px double ${fg}`,
      boxShadow: dark ? '0 6px 24px rgba(0,0,0,.15)' : '0 0 40px rgba(180,220,255,.7)',
    }}>
      {image ? (
        <Img src={asSrc(image)} style={{width: '70%', height: '70%', objectFit: 'contain'}} />
      ) : (
        <span style={{fontFamily: en ? inter : amiri, fontWeight: 700, fontSize: size * (en ? (!text.includes(' ') && text.length > 7 ? 0.15 : 0.2) : text.length > 6 ? 0.25 : 0.34), color: fg, lineHeight: 1.1, textAlign: 'center', padding: size * 0.12}}>
          {text}
        </span>
      )}
    </div>
  );
};

export const BigText: React.FC<{lines: string[]; color?: string; size?: number; font?: 'amiri' | 'reem' | 'cairo'; delay?: number}> = ({
  lines, color = '#fff', size = 84, font = 'reem', delay = 0,
}) => {
  const en = useEn();
  const fam = en ? inter : {amiri, reem, cairo}[font];
  return (
    <div style={{direction: en ? 'ltr' : 'rtl', textAlign: 'center', padding: '0 50px'}}>
      {lines.map((l, i) => {
        const p = useIn(delay + i * 6);
        return (
          <div key={i} style={{
            fontFamily: fam, fontSize: size, color, lineHeight: 1.35, fontWeight: 700,
            opacity: p, transform: `translateY(${(1 - p) * 40}px)`,
            textShadow: color === '#fff' ? '0 4px 20px rgba(0,0,0,.25)' : 'none',
          }}>{l}</div>
        );
      })}
    </div>
  );
};

export const Fill: React.FC<{bg: string; children: React.ReactNode}> = ({bg, children}) => (
  <div style={{position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, overflow: 'hidden'}}>
    {children}
  </div>
);

export const Zoom: React.FC<{children: React.ReactNode; from?: number; to?: number; dur: number; origin?: string}> = ({
  children, from = 1, to = 1.35, dur, origin = '50% 50%',
}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], [from, to], {extrapolateRight: 'clamp'});
  return <div style={{transform: `scale(${s})`, transformOrigin: origin}}>{children}</div>;
};

export const ReplyCard: React.FC<{user: string; text: string}> = ({user, text}) => {
  const p = useIn();
  return (
    <div style={{
      direction: 'rtl', width: 580, background: '#fff', borderRadius: 28, padding: '28px 34px',
      boxShadow: '0 10px 40px rgba(0,0,0,.25)', transform: `scale(${p})`, opacity: p,
    }}>
      <div style={{fontFamily: cairo, fontSize: 26, color: '#777', direction: 'ltr', textAlign: 'left'}}>
        Reply to {user}'s <b style={{color: '#555'}}>comment</b>
      </div>
      <div style={{fontFamily: cairo, fontWeight: 800, fontSize: 40, color: '#111', lineHeight: 1.5, marginTop: 10}}>{text}</div>
    </div>
  );
};

export type Cue = {t0: number; t1: number; text: string; sub?: string; emph?: boolean; icon?: 'phone' | 'door'};

const Phone: React.FC<{p: number}> = ({p}) => (
  <svg width="120" height="192" viewBox="0 0 150 240" style={{transform: `scale(${p})`, opacity: p}}>
    <rect x="10" y="5" width="130" height="230" rx="24" fill="#10243d" stroke="#eaf2fb" strokeWidth="6" />
    <rect x="24" y="30" width="102" height="170" rx="8" fill="#2aa0f0" opacity=".85" />
    <circle cx="75" cy="218" r="8" fill="#eaf2fb" />
  </svg>
);

/** Timed lines synced to the voiceover over a sequence of animated visuals. t0/t1 are seconds from scene start. */
export const CaptionStage: React.FC<{cues: Cue[]; visuals?: Visual[]; hook?: string; speaker?: string; total: number}> = ({cues, visuals = [], hook, speaker, total}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const en = useEn();
  const fam = en ? inter : cairo;
  const dir = en ? 'ltr' : 'rtl';
  const idx = cues.findIndex((c) => t >= c.t0 && t < c.t1);
  const cue = cues[idx];
  const local = cue ? Math.round((t - cue.t0) * fps) : 0;
  const p = spring({frame: local, fps, config: {damping: 16, stiffness: 140}});
  const hookP = interpolate(t, [0, 0.4, 3, 3.4], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      {visuals.map((v, i) => {
        // The hook card sits over the first visual's spot for 3.4 s, so that visual waits for it to leave.
        const wait = hook && i === 0 ? 3.4 : 0;
        const from = Math.round((v.t0 + wait) * fps);
        const dur = Math.round((v.t1 - v.t0 - wait) * fps);
        return (
          <Sequence key={i} from={from} durationInFrames={dur + 10}>
            <FadeIn>{renderVisual(v)}</FadeIn>
          </Sequence>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 620, background: 'linear-gradient(transparent, rgba(4,12,30,.82) 55%)'}} />
      {hook && (
        <div style={{position: 'absolute', top: 90, width: '100%', direction: dir, textAlign: 'center', padding: '0 70px', boxSizing: 'border-box', opacity: hookP, transform: `translateY(${(1 - hookP) * -30}px)`}}>
          <div style={{display: 'inline-block', background: '#fff', borderRadius: 28, padding: '18px 36px', fontFamily: fam, fontWeight: 800, fontSize: 44, color: C.blueDark, boxShadow: '0 10px 40px rgba(0,0,0,.3)'}}>{hook}</div>
        </div>
      )}
      {cue && (
        <div style={{position: 'absolute', top: 940, left: 0, width: '100%', transform: 'translateY(-50%)'}}>
          <div style={{direction: dir, textAlign: 'center', padding: '0 46px', fontFamily: fam, fontWeight: 800,
            fontSize: en ? (cue.emph ? 54 : 46) : (cue.emph ? 70 : 58), lineHeight: 1.5, color: cue.emph ? '#ffe14d' : '#fff',
            opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${cue.emph ? 0.9 + p * 0.1 : 1})`, textShadow: '0 4px 22px rgba(0,0,0,.6)'}}>{cue.text}</div>
          {cue.sub && <div style={{direction: dir, textAlign: 'center', fontFamily: fam, fontWeight: 600, fontSize: 32, color: 'rgba(255,255,255,.8)', marginTop: 6, opacity: p}}>{cue.sub}</div>}
        </div>
      )}
      {speaker && (
        <div style={{position: 'absolute', bottom: 105, width: '100%', direction: dir, textAlign: 'center', fontFamily: fam, fontWeight: 600, fontSize: 28, color: 'rgba(255,255,255,.85)'}}>{speaker}</div>
      )}
      <div style={{position: 'absolute', bottom: 60, left: 60, right: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.25)'}}>
        <div style={{width: `${Math.min(1, t / total) * 100}%`, height: '100%', borderRadius: 3, background: '#fff'}} />
      </div>
    </>
  );
};

const FadeIn: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', inset: 0, opacity: interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'})}}>{children}</div>;
};
