import React from 'react';
import {Composition} from 'remotion';
import {Kids} from './Kids';
import {Chalk} from './Chalk';
import kids from '../kids.json';

const FPS = 30;
const total = (kids.scenes as any[]).reduce((a, s) => a + Math.round(s.duration * FPS), 0);

export const Root: React.FC = () => (
  <>
    <Composition id="Kids" component={Kids} durationInFrames={total} fps={FPS} width={1280} height={720} defaultProps={{kids}} />
    <Composition id="Chalk" component={Chalk} durationInFrames={total} fps={FPS} width={1280} height={720} defaultProps={{kids}} />
  </>
);
