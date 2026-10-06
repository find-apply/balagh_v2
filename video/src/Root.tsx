import React from 'react';
import {Composition} from 'remotion';
import sample from '../samples/sample.json';
import storySample from '../samples/story.json';
import {FPS, StorySpec, VideoSpec, storyFrames, totalFrames} from './spec';
import {Captions} from './templates/Captions';
import {Chalk} from './templates/Chalk';
import {Geo} from './templates/Geo';
import {Kids} from './templates/Kids';

// Composition ids match the `composition` field in catalog.json. Content comes in with --props={"spec": ...}.
const metadata = ({props}: {props: {spec: VideoSpec}}) => ({durationInFrames: totalFrames(props.spec)});
const storyMetadata = ({props}: {props: {spec: StorySpec}}) => ({durationInFrames: storyFrames(props.spec)});
const defaults = {spec: sample as VideoSpec};
const storyDefaults = {spec: storySample as StorySpec};

export const Root: React.FC = () => (
  <>
    <Composition id="Captions" component={Captions} fps={FPS} width={720} height={1280} durationInFrames={1}
      defaultProps={defaults} calculateMetadata={metadata} />
    <Composition id="Geo" component={Geo} fps={FPS} width={720} height={1280} durationInFrames={1}
      defaultProps={defaults} calculateMetadata={metadata} />
    <Composition id="Kids" component={Kids} fps={FPS} width={1280} height={720} durationInFrames={1}
      defaultProps={storyDefaults} calculateMetadata={storyMetadata} />
    <Composition id="Chalk" component={Chalk} fps={FPS} width={1280} height={720} durationInFrames={1}
      defaultProps={storyDefaults} calculateMetadata={storyMetadata} />
  </>
);
