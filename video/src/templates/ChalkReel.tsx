import React from 'react';
import {AbsoluteFill, Sequence, spring} from 'remotion';
import {useDir, useT} from '../core/story';
import {LangCtx} from '../core/theme';
import {FPS, SceneAudio, StoryScene, StorySpec, Watermark} from '../spec';
import {Board, CH, Caption, ChalkWords, Doodle, DoodleProps, Polaroid, RoughBox, Sticker, fit, useFonts} from './Chalk';

// The chalkboard story at 720×1280 for Reels, Shorts and TikTok: a portrait photo pinned at the top of the
// board, the spoken line chalked under it, above the feed's own caption and buttons (the bottom ~230 px).
const TOP = 110;
const BOTTOM = 230;

// Doodles sit in the narrow margins beside the photo (x < 100 or x > 620), clear of the speaker's name and line.
const DOODLES: DoodleProps[][] = [
  [{shape: 'heart', x: 22, y: 640, size: 76, color: CH.pink, at: 3.0, rot: -10}],
  [{shape: 'question', x: 628, y: 300, size: 80, at: 0.8}, {shape: 'question', x: 22, y: 560, size: 70, at: 1.4, color: CH.blue, rot: -12}],
  [{shape: 'spark', x: 630, y: 340, size: 70, at: 1.0}, {shape: 'star', x: 24, y: 620, size: 72, at: 1.8, color: CH.orange}],
  [{shape: 'heart', x: 628, y: 600, size: 76, at: 1.2, color: CH.pink}],
  [{shape: 'star', x: 630, y: 320, size: 70, at: 0.8}, {shape: 'heart', x: 22, y: 600, size: 72, at: 1.4, color: CH.pink, rot: -8}],
];

const Story: React.FC<{s: StoryScene; n: number}> = ({s, n}) => (
  <Board titleTop={TOP - 20} title={s.board}>
    {s.image && <Polaroid src={s.image} dur={s.duration} top={TOP + 50} w={520} h={640} />}
    {DOODLES[n % DOODLES.length].map((d, i) => <Doodle key={i} {...d} />)}
    <Caption s={s} size={40} side={34} bottom={BOTTOM} />
  </Board>
);

const Text: React.FC<{s: StoryScene}> = ({s}) => {
  const {f} = useT();
  const fonts = useFonts();
  const p = spring({frame: f, fps: FPS, config: {damping: 14}});
  const dir = useDir();
  const quote = s.quote ?? '';
  const size = quote.length > 160 ? 40 : quote.length > 90 ? 48 : 58;
  return (
    <Board titleTop={TOP - 20} title={s.title}>
      <div style={{position: 'absolute', top: TOP + 110, left: 40, right: 40, textAlign: 'center', direction: dir, opacity: p}}>
        <div style={{fontFamily: fonts.chalk, fontWeight: 700, fontSize: 40, color: CH.blue, filter: 'url(#chalk)'}}>{s.text}</div>
        <div style={{marginTop: 24}}><ChalkWords text={quote} size={size} t0={s.quoteLead ?? 1} t1={s.quoteEnd ?? s.duration - 0.7} font={fonts.quote} /></div>
        <svg width="420" height="26" style={{marginTop: 28}}><path d="M4 14 Q 60 2 110 14 T 210 14 T 310 14 T 416 14" stroke={CH.yellow} strokeWidth="5" fill="none" filter="url(#chalk)" strokeLinecap="round" /></svg>
        <div style={{fontFamily: fonts.chalk, fontSize: 34, color: CH.orange, filter: 'url(#chalk)', marginTop: 4}}>{s.source}</div>
        {s.silentNote && <div style={{fontFamily: fonts.chalk, fontSize: 28, color: CH.blue, filter: 'url(#chalk)', marginTop: 14}}>{s.silentNote}</div>}
      </div>
    </Board>
  );
};

const WordsScene: React.FC<{s: StoryScene}> = ({s}) => (
  <Board titleTop={TOP - 20} title={s.title}>
    <div style={{position: 'absolute', top: TOP + 100, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46}}>
      {(s.cards ?? []).map((c, i) => <Sticker key={i} word={c.word} meaning={c.meaning} delay={1.2 + i * 2.6} rot={i ? 2.5 : -2.5} tint={i ? '#ffe9a8' : '#cfeedd'} />)}
    </div>
    <Caption s={s} size={38} side={34} bottom={BOTTOM} />
  </Board>
);

const Quiz: React.FC<{s: StoryScene}> = ({s}) => {
  const {t} = useT();
  const fonts = useFonts();
  const dir = useDir();
  const at = s.revealAt ?? s.duration;
  const rv = Math.max(0, Math.min(1, (t - at) / 0.6));
  return (
    <Board titleTop={TOP - 20} title={s.title}>
      <div style={{position: 'absolute', top: TOP + 90, left: 40, right: 40, textAlign: 'center', direction: dir, fontFamily: fonts.chalk, fontWeight: 700, fontSize: 48, lineHeight: 1.55, color: CH.white, filter: 'url(#chalk)'}}>{s.question}</div>
      <div style={{position: 'absolute', top: TOP + 360, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
        {(s.choices ?? []).map((c, i) => <RoughBox key={i} label={c} reveal={rv} state={rv > 0 ? (i === (s.answer ?? 0) ? 'right' : 'wrong') : 'idle'} />)}
      </div>
      <Caption s={s} size={38} side={34} bottom={BOTTOM} skipFirst />
    </Board>
  );
};

const Outro: React.FC<{s: StoryScene}> = ({s}) => {
  const fonts = useFonts();
  const l = s.lines?.[0];
  return (
    <Board>
      {s.image && <Polaroid src={s.image} dur={s.duration} rot={1.8} top={TOP + 20} w={480} h={580} />}
      <Doodle shape="heart" x={22} y={TOP + 420} size={76} at={0.8} color={CH.pink} rot={-10} />
      <Doodle shape="heart" x={618} y={TOP + 460} size={64} at={1.3} color={CH.pink} rot={8} />
      <Doodle shape="star" x={320} y={TOP + 650} size={70} at={1.8} />
      {l && (
        <div style={{position: 'absolute', left: 34, right: 34, bottom: BOTTOM, textAlign: 'center'}}>
          <ChalkWords text={l.text} size={fit(l.text, 48)} color={CH.yellow} t0={l.t0} t1={l.t0 + l.d} font={fonts.quote} />
        </div>
      )}
    </Board>
  );
};

export const ChalkReel: React.FC<{spec: StorySpec}> = ({spec}) => {
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
        <Watermark text={spec.watermark} />
      </AbsoluteFill>
    </LangCtx.Provider>
  );
};
