import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {BG, LangCtx} from '../core/theme';
import {BigText, CaptionStage, Fill} from '../core/ui';
import {Visual} from '../core/visuals';
import {Art, Clips, FPS, OUTRO_SECONDS, VideoSpec} from '../spec';

/** Maps a scene's art onto the animated visuals drawn in core/visuals.tsx. */
const toVisual = (a: Art): Visual => {
  const base = {t0: a.t0, t1: a.t1};
  switch (a.kind) {
    case 'meter_down': return {...base, kind: 'meter', title: a.keyword, from: 100, to: 7};
    case 'meter_up': return {...base, kind: 'meter', title: a.keyword, from: 7, to: 100};
    case 'compare': return {...base, kind: 'compare', labelA: a.keyword, labelB: a.detail, emojiA: a.emoji || '📱', emojiB: '❤️'};
    case 'medallions': return {...base, kind: 'medallions', names: [a.keyword, a.detail].filter(Boolean)};
    case 'lock': return {...base, kind: 'lock', label: a.keyword};
    case 'warning': return {...base, kind: 'warning', label: a.keyword};
    case 'dua': return {...base, kind: 'dua'};
    case 'storm': return {...base, kind: 'storm', label: a.keyword};
    case 'door': return {...base, kind: 'door', label: a.keyword};
    case 'verse': return {...base, kind: 'verse', label: a.keyword};
    case 'phones': return {...base, kind: 'phoneStorm'};
    case 'image': return a.image ? {...base, kind: 'photo', src: a.image} : {...base, kind: 'word', text: a.keyword};
    default: return {...base, kind: 'word', text: a.keyword};
  }
};

export const Captions: React.FC<{spec: VideoSpec}> = ({spec}) => {
  const main = Math.round(spec.duration * FPS);
  return (
    <LangCtx.Provider value={{en: spec.lang === 'en'}}>
      <AbsoluteFill style={{background: '#000'}}>
        <Sequence durationInFrames={main}>
          <Fill bg={BG.blue}>
            <CaptionStage cues={spec.cues} visuals={spec.art.map(toVisual)} hook={spec.hook} total={spec.duration} />
          </Fill>
        </Sequence>
        <Sequence from={main} durationInFrames={Math.round(OUTRO_SECONDS * FPS)}>
          <Fill bg={BG.blue}>
            <BigText lines={spec.outro} size={56} />
          </Fill>
        </Sequence>
        <Clips clips={spec.audio} />
      </AbsoluteFill>
    </LangCtx.Provider>
  );
};
