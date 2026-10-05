import React from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BG, C, amiri, useFam, useEn, inter} from './theme';
import {Medallion, asSrc} from './ui';

export type Visual = {t0: number; t1: number; kind: string; [k: string]: any};

const Full: React.FC<{bg: string; children?: React.ReactNode}> = ({bg, children}) => (
  <div style={{position: 'absolute', inset: 0, background: bg, overflow: 'hidden'}}>{children}</div>
);

const useP = (delay = 0, damping = 12) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - delay, fps, config: {damping, stiffness: 120}});
};

const Emoji: React.FC<{e: string; x: number; y: number; size?: number; delay?: number; float?: number}> = ({e, x, y, size = 80, delay = 0, float = 10}) => {
  const f = useCurrentFrame();
  const p = useP(delay);
  return (
    <div style={{position: 'absolute', left: x, top: y + Math.sin((f + delay * 5) / 12) * float, fontSize: size, transform: `scale(${p}) rotate(${(1 - p) * -25}deg)`, opacity: p}}>{e}</div>
  );
};

export const PhoneSvg: React.FC<{w?: number; dark?: boolean}> = ({w = 220, dark = true}) => (
  <svg width={w} height={w * 1.65} viewBox="0 0 150 240">
    <rect x="10" y="5" width="130" height="230" rx="24" fill={dark ? '#10243d' : '#e8eef6'} stroke={dark ? '#eaf2fb' : '#10243d'} strokeWidth="6" />
    <rect x="24" y="30" width="102" height="170" rx="8" fill="#2aa0f0" opacity=".9" />
    <circle cx="75" cy="218" r="8" fill={dark ? '#eaf2fb' : '#10243d'} />
  </svg>
);

/** Night photo with slow zoom and blue tint. */
export const Photo: React.FC<{src: string; dur: number}> = ({src, dur}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], [1.05, 1.3]);
  return (
    <Full bg="#050b1a">
      <Img src={asSrc(src)} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`, filter: 'saturate(.7) brightness(.8)'}} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(rgba(10,79,168,.55), rgba(11,120,209,.35))'}} />
    </Full>
  );
};

/** Phone with notifications raining in. */
export const PhoneStorm: React.FC<{bg?: string; count?: boolean}> = ({bg = BG.blue, count}) => {
  const fam = useFam();
  const f = useCurrentFrame();
  const p = useP(0);
  const shake = Math.sin(f * 1.7) * 2.2;
  const icons = [['🔔', 60, 150], ['💬', 520, 190], ['▶️', 80, 470], ['❤️', 530, 500], ['📷', 300, 90], ['🎵', 300, 640]] as const;
  const badge = count ? Math.min(99, Math.floor(f / 3)) : 0;
  return (
    <Full bg={bg}>
      {icons.map(([e, x, y], i) => <Emoji key={i} e={e} x={x} y={y} delay={i * 5} size={74} />)}
      <div style={{position: 'absolute', left: 0, right: 0, top: 290, display: 'flex', justifyContent: 'center', transform: `scale(${0.6 + p * 0.4}) rotate(${shake}deg)`}}>
        <PhoneSvg w={220} />
      </div>
      {count && (
        <div style={{position: 'absolute', left: 430, top: 275, minWidth: 76, height: 76, borderRadius: 38, background: '#ff3b30', color: '#fff', fontFamily: fam, fontWeight: 800, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', boxShadow: '0 0 30px rgba(255,59,48,.7)'}}>{badge}</div>
      )}
    </Full>
  );
};

/** Three phones popping in on white. */
export const PhoneRow: React.FC = () => (
  <Full bg={BG.white}>
    <div style={{position: 'absolute', top: 210, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 34}}>
      {[0, 1, 2].map((i) => {
        const p = useP(i * 8);
        return <div key={i} style={{transform: `translateY(${(1 - p) * 120}px) scale(${p})`, opacity: p}}><PhoneSvg w={170} dark={false} /></div>;
      })}
    </div>
  </Full>
);

/** Faith battery draining. */
export const FaithMeter: React.FC<{dur: number; title?: string; from?: number; to?: number}> = ({dur, title = 'مستوى الإيمان', from = 100, to = 7}) => {
  const fam = useFam();
  const f = useCurrentFrame();
  const pct = interpolate(f, [10, dur - 10], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const color = pct > 55 ? '#34c759' : pct > 25 ? '#ff9f0a' : '#ff3b30';
  const w = 380;
  return (
    <Full bg="linear-gradient(#0b1a33, #060d1c)">
      <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontFamily: fam, fontWeight: 800, fontSize: 64, color: '#eaf2fb'}}>{title}</div>
      <div style={{position: 'absolute', top: 290, left: (720 - w - 30) / 2, display: 'flex', alignItems: 'center'}}>
        <div style={{width: w, height: 190, borderRadius: 34, border: '9px solid #eaf2fb', padding: 12, boxSizing: 'border-box'}}>
          <div style={{width: `${pct}%`, height: '100%', borderRadius: 18, background: color, boxShadow: `0 0 40px ${color}`}} />
        </div>
        <div style={{width: 26, height: 70, background: '#eaf2fb', borderRadius: '0 12px 12px 0', marginLeft: -2}} />
      </div>
      <div style={{position: 'absolute', top: 530, width: '100%', textAlign: 'center', fontFamily: fam, fontWeight: 800, fontSize: 110, color}}>{Math.round(pct)}%</div>
    </Full>
  );
};

/** Floating medallions (Dīn / Khuluq / ʿAqīda...). */
export const Medallions: React.FC<{names: string[]; src?: string; dur: number}> = ({names, src, dur}) => {
  const pos = names.length === 1 ? [[200, 380]] : [[210, 120], [40, 400], [380, 440], [210, 640]];
  return (
    <>
      {src ? <Photo src={src} dur={dur} /> : <Full bg={BG.blue} />}
      {names.map((n, i) => (
        <div key={i} style={{position: 'absolute', left: pos[i][0], top: pos[i][1]}}><Medallion text={n} size={names.length === 1 ? 320 : 270} delay={i * 8} /></div>
      ))}
    </>
  );
};

/** Padlock closing with ripples. */
export const Lock: React.FC<{label?: string; white?: boolean; emoji?: string; openEmoji?: string}> = ({label, white = true, emoji = '🔒', openEmoji = '🔓'}) => {
  const fam = useFam();
  const f = useCurrentFrame();
  const p = useP(4, 9);
  const ink = white ? C.blueDark : '#fff';
  return (
    <Full bg={white ? BG.white : BG.blue}>
      {[0, 1, 2].map((i) => {
        const r = ((f + i * 20) % 60) / 60;
        return <div key={i} style={{position: 'absolute', left: 360 - 150 - r * 180, top: 330 - 150 - r * 180 + 90, width: 300 + r * 360, height: 300 + r * 360, borderRadius: '50%', border: `4px solid ${ink}`, opacity: (1 - r) * 0.35}} />;
      })}
      <div style={{position: 'absolute', top: 250, width: '100%', textAlign: 'center', fontSize: 230, transform: `scale(${0.4 + p * 0.6}) rotate(${(1 - p) * -18}deg)`}}>{f > 14 ? emoji : openEmoji}</div>
      {label && <div style={{position: 'absolute', top: 560, width: '100%', textAlign: 'center', fontFamily: fam, fontWeight: 800, fontSize: 70, color: ink, opacity: p}}>{label}</div>}
    </Full>
  );
};

/** Pulsing warning on dark red. */
export const Warning: React.FC<{label?: string}> = ({label}) => {
  const fam = useFam();
  const f = useCurrentFrame();
  const pulse = 1 + Math.sin(f / 5) * 0.08;
  return (
    <Full bg="radial-gradient(circle at 50% 35%, #5a0f14, #1a0507)">
      <div style={{position: 'absolute', inset: 0, background: `repeating-linear-gradient(45deg, rgba(255,200,0,.08) 0 40px, transparent 40px 80px)`}} />
      <div style={{position: 'absolute', top: 230, width: '100%', textAlign: 'center', fontSize: 260, transform: `scale(${pulse})`}}>⚠️</div>
      {label && <div style={{position: 'absolute', top: 580, width: '100%', textAlign: 'center', fontFamily: fam, fontWeight: 800, fontSize: 64, color: '#ffd60a', direction: 'rtl'}}>{label}</div>}
    </Full>
  );
};

/** Code-drawn waves with a bound figure being carried. */
export const Waves: React.FC = () => {
  const f = useCurrentFrame();
  const wave = (amp: number, len: number, speed: number, y: number, fill: string) => {
    let d = `M0 ${y}`;
    for (let x = 0; x <= 720; x += 10) d += ` L${x} ${y + Math.sin((x / len) * Math.PI * 2 + f / speed) * amp}`;
    return <path d={`${d} L720 1280 L0 1280 Z`} fill={fill} />;
  };
  const bob = Math.sin(f / 14) * 14;
  return (
    <Full bg="linear-gradient(#0a4fa8, #082a5e)">
      <div style={{position: 'absolute', top: 290 + bob, width: '100%', textAlign: 'center', fontSize: 190, transform: `rotate(${Math.sin(f / 18) * 6}deg)`}}>🧍</div>
      <div style={{position: 'absolute', top: 450 + bob, width: '100%', textAlign: 'center', fontSize: 80}}>⛓️</div>
      <svg width="720" height="1280" style={{position: 'absolute', inset: 0}}>
        {wave(26, 160, 8, 470, 'rgba(42,160,240,.55)')}
        {wave(22, 120, -6, 520, 'rgba(11,120,209,.75)')}
        {wave(18, 200, 10, 575, 'rgba(10,79,168,.95)')}
      </svg>
      <Emoji e="💧" x={90} y={150} size={60} delay={10} />
      <Emoji e="💧" x={560} y={250} size={50} delay={20} />
    </Full>
  );
};

/** Huge keyword on blue/white. */
export const Word: React.FC<{text: string; white?: boolean}> = ({text, white}) => {
  const p = useP(0, 10);
  return (
    <Full bg={white ? BG.white : BG.blue}>
      <div style={{position: 'absolute', top: 280, width: '100%', textAlign: 'center', fontFamily: useEn() ? inter : amiri, fontWeight: 700, fontSize: 150, color: white ? C.blueDark : '#fff', transform: `scale(${0.5 + p * 0.5})`, opacity: p}}>{text}</div>
    </Full>
  );
};

const SPOTS = [[70, 90, 16], [120, 60, 12], [100, 130, 20], [135, 105, 11], [80, 55, 10], [115, 160, 14], [75, 150, 12], [150, 140, 9]];

/** T-shirt that collects stains, gets scrubbed, glows. */
export const Shirt: React.FC<{dur: number; s0?: number; s1?: number; bubbles?: boolean; magnify?: boolean; glow?: boolean}> = ({dur, s0 = 0, s1 = 0, bubbles, magnify, glow}) => {
  const f = useCurrentFrame();
  const p = useP(0, 12);
  const count = interpolate(f, [8, dur - 8], [s0, s1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const clean = s1 < s0;
  const ang = f / 14;
  return (
    <Full bg={BG.blue}>
      <div style={{position: 'absolute', top: 230, width: '100%', display: 'flex', justifyContent: 'center', transform: `scale(${0.6 + p * 0.4}) rotate(${Math.sin(f / 22) * 2}deg)`}}>
        <svg width="560" height="560" viewBox="0 0 200 200" style={{filter: glow || clean ? 'drop-shadow(0 0 28px rgba(255,255,255,.8))' : 'drop-shadow(0 8px 20px rgba(0,0,0,.35))'}}>
          <path d="M60 20 L90 20 Q100 40 110 20 L140 20 L190 55 L165 90 L145 78 L145 180 L55 180 L55 78 L35 90 L10 55 Z" fill="#ffffff" stroke="#cfe3f7" strokeWidth="2" />
          <clipPath id="shirtClip"><path d="M60 20 L90 20 Q100 40 110 20 L140 20 L190 55 L165 90 L145 78 L145 180 L55 180 L55 78 L35 90 L10 55 Z" /></clipPath>
          <g clipPath="url(#shirtClip)">
            {SPOTS.map(([x, y, r], i) => {
              const a = Math.max(0, Math.min(1, count - i));
              return <circle key={i} cx={x} cy={y} r={r * (0.6 + 0.4 * a)} fill="#7a4b2a" opacity={a * 0.75} />;
            })}
          </g>
        </svg>
      </div>
      {magnify && <div style={{position: 'absolute', left: 300 + Math.cos(ang) * 130, top: 330 + Math.sin(ang) * 100, fontSize: 120}}>🔍</div>}
      {bubbles && [0, 1, 2, 3, 4, 5].map((i) => {
        const y = 700 - ((f * 5 + i * 90) % 520);
        return <div key={i} style={{position: 'absolute', left: 90 + i * 100 + Math.sin((f + i * 9) / 10) * 20, top: y, fontSize: 56 + (i % 3) * 14, opacity: 0.9}}>🫧</div>;
      })}
      {(glow || clean) && [0, 1, 2].map((i) => <Emoji key={i} e="✨" x={90 + i * 230} y={150 + (i % 2) * 380} size={70} delay={i * 6} />)}
    </Full>
  );
};

/** Raised hands with rising light. */
export const Dua: React.FC = () => {
  const f = useCurrentFrame();
  const p = useP(0, 10);
  return (
    <Full bg="radial-gradient(circle at 50% 40%, #1c6fd0, #082a5e)">
      {[0, 1, 2].map((i) => {
        const r = ((f + i * 25) % 75) / 75;
        return <div key={i} style={{position: 'absolute', left: 360 - 120 - r * 200, top: 400 - 120 - r * 200, width: 240 + r * 400, height: 240 + r * 400, borderRadius: '50%', border: '4px solid #fff', opacity: (1 - r) * 0.4}} />;
      })}
      <div style={{position: 'absolute', top: 280, width: '100%', textAlign: 'center', fontSize: 260, transform: `scale(${0.5 + p * 0.5})`}}>🤲</div>
      {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{position: 'absolute', left: 120 + i * 120, top: 360 - ((f * 3 + i * 70) % 300), fontSize: 50, opacity: 0.85}}>✨</div>)}
    </Full>
  );
};

/** Shirt shrinks while the heart (faith) grows. */
export const Compare: React.FC<{dur: number; labelA?: string; labelB?: string}> = ({dur, labelA = 'الثوب', labelB = 'الإيمان'}) => {
  const f = useCurrentFrame();
  const fam = useFam();
  const t = interpolate(f, [10, dur * 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pulse = 1 + Math.sin(f / 7) * 0.04;
  return (
    <Full bg={BG.blue}>
      <div style={{position: 'absolute', top: 260, left: 40, width: 320, textAlign: 'center', transform: `scale(${1 - t * 0.45})`, transformOrigin: '50% 0'}}>
        <div style={{fontSize: 180}}>👕</div>
        <div style={{fontFamily: fam, fontWeight: 800, fontSize: 44, color: '#fff'}}>{labelA}</div>
      </div>
      <div style={{position: 'absolute', top: 240, right: 20, width: 360, textAlign: 'center', transform: `scale(${(0.55 + t * 0.85) * pulse})`, transformOrigin: '50% 0'}}>
        <div style={{fontSize: 200, filter: 'drop-shadow(0 0 40px rgba(255,80,100,.9))'}}>❤️</div>
        <div style={{fontFamily: fam, fontWeight: 800, fontSize: 48, color: '#ffe14d'}}>{labelB}</div>
      </div>
    </Full>
  );
};

/** Man holding meat; a hungry dog circles and lunges. */
export const Dog: React.FC<{dur: number; chase?: boolean; label?: string; labelAt?: number; lungeAt?: number}> = ({dur, chase, label, labelAt = 0, lungeAt = -1}) => {
  const f = useCurrentFrame();
  const fam = useFam();
  const p = useP(0, 10);
  const cx = 360, cy = 470;
  const R = interpolate(f, [0, dur], [340, 190], {extrapolateRight: 'clamp'});
  const a = (f / 11) * (1 + f / dur);
  let dx = cx + Math.cos(a) * R - 85, dy = cy + Math.sin(a) * R * 0.55 - 30;
  const lf = f - lungeAt * 30;
  const lunging = lungeAt >= 0 && lf >= 0 && lf < 26;
  if (lunging) {
    const k = Math.sin((lf / 26) * Math.PI);
    dx = dx + (cx + 70 - dx) * k; dy = dy + (cy + 40 - dy) * k;
  }
  const flip = Math.sin(a) < 0 ? -1 : 1;
  const showLabel = label && f >= labelAt * 30;
  return (
    <Full bg={BG.blue}>
      <div style={{position: 'absolute', left: cx - 150 + (lunging ? Math.sin(lf) * 6 : 0), top: cy - 230, fontSize: 300, transform: `scale(${p})`}}>🧍</div>
      <div style={{position: 'absolute', left: cx + 30, top: cy - 20, fontSize: 150, transform: `scale(${p}) rotate(${lunging ? -20 : 0}deg)`}}>🥩</div>
      {showLabel && (
        <div style={{position: 'absolute', left: cx - 110, top: cy - 300, background: '#fff', color: C.blueDark, fontFamily: fam, fontWeight: 800, fontSize: 40, padding: '8px 26px', borderRadius: 22, boxShadow: '0 6px 24px rgba(0,0,0,.3)', whiteSpace: 'nowrap', transform: `scale(${Math.min(1, (f - labelAt * 30) / 8 + 0.2)})`}}>{label}</div>
      )}
      {chase && <div style={{position: 'absolute', left: dx, top: dy, fontSize: 170, transform: `scaleX(${-flip})`}}>🐕</div>}
      {lunging && <div style={{position: 'absolute', left: 520, top: 260, fontSize: 90}}>❗</div>}
    </Full>
  );
};

/** Eyes watching from every direction. */
export const Paths: React.FC = () => {
  const f = useCurrentFrame();
  const cx = 360, cy = 470;
  return (
    <Full bg="linear-gradient(#0b1a33, #060d1c)">
      <svg width="720" height="1280" style={{position: 'absolute', inset: 0}}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const ang = (i / 6) * Math.PI * 2 + 0.3;
          const x = cx + Math.cos(ang) * 330, y = cy + Math.sin(ang) * 330;
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2aa0f0" strokeWidth="6" strokeDasharray="14 12" strokeDashoffset={-f * 2} opacity=".7" />;
        })}
      </svg>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const ang = (i / 6) * Math.PI * 2 + 0.3;
        return <Emoji key={i} e="👁️" x={cx + Math.cos(ang) * 290 - 40} y={cy + Math.sin(ang) * 290 - 40} size={80} delay={i * 6} float={4} />;
      })}
      <div style={{position: 'absolute', left: cx - 70, top: cy - 100, fontSize: 150}}>🧍</div>
    </Full>
  );
};

/** One big eye and a faint ghost: an enemy who sees you but you don't see. */
export const Eye: React.FC = () => {
  const f = useCurrentFrame();
  const p = useP(0, 10);
  const pulse = 1 + Math.sin(f / 8) * 0.06;
  return (
    <Full bg="linear-gradient(#0b1a33, #060d1c)">
      <div style={{position: 'absolute', left: 120 + (Math.sin(f / 30) + 1) * 220, top: 560, fontSize: 150, opacity: 0.14}}>🐕</div>
      <div style={{position: 'absolute', top: 180, width: '100%', textAlign: 'center', fontSize: 320, transform: `scale(${p * pulse})`, filter: 'drop-shadow(0 0 50px rgba(255,255,255,.35))'}}>👁️</div>
    </Full>
  );
};

export const renderVisual = (v: Visual) => {
  const dur = Math.round((v.t1 - v.t0) * 30);
  switch (v.kind) {
    case 'photo': return <Photo src={v.src} dur={dur} />;
    case 'phoneStorm': return <PhoneStorm count={v.count} />;
    case 'phoneRow': return <PhoneRow />;
    case 'meter': return <FaithMeter dur={dur} title={v.title} from={v.from} to={v.to} />;
    case 'medallions': return <Medallions names={v.names} src={v.src} dur={dur} />;
    case 'lock': return <Lock label={v.label} white={v.white !== false} emoji={v.emoji} openEmoji={v.openEmoji} />;
    case 'warning': return <Warning label={v.label} />;
    case 'waves': return <Waves />;
    case 'shirt': return <Shirt dur={dur} s0={v.s0} s1={v.s1} bubbles={v.bubbles} magnify={v.magnify} glow={v.glow} />;
    case 'dua': return <Dua />;
    case 'dog': return <Dog dur={dur} chase={v.chase} label={v.label} labelAt={v.labelAt} lungeAt={v.lungeAt} />;
    case 'paths': return <Paths />;
    case 'eye': return <Eye />;
    case 'compare': return <Compare dur={dur} labelA={v.labelA} labelB={v.labelB} />;
    case 'word': return <Word text={v.text} white={v.white} />;
    default: return null;
  }
};
