import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import reel from '../reel.json';

const FPS = 30;
const total = (reel.scenes as any[]).reduce((a, s) => a + Math.round(s.duration * FPS), 0);

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={Math.max(total, 1)}
    fps={FPS}
    width={720}
    height={1280}
    defaultProps={{reel}}
  />
);
