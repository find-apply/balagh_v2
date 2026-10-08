import React from 'react';
import {Composition} from 'remotion';
import sample from '../samples/sample.json';
import storySample from '../samples/story.json';
import {FPS, StorySpec, TeaserSpec, VideoSpec, storyFrames, teaserFrames, totalFrames} from './spec';
import teaserSample from '../samples/teaser.json';
import {Teaser} from './templates/Teaser';
import {Captions} from './templates/Captions';
import {Chalk} from './templates/Chalk';
import {Geo} from './templates/Geo';
import {Kids} from './templates/Kids';
import {Explainer, ExplainerSpec, explainerFrames} from './templates/Explainer';
import explainerSample from '../samples/explainer.json';
import kursiSample from '../samples/kursi.json';

// Composition ids match the `composition` field in catalog.json. Content comes in with --props={"spec": ...}.
const metadata = ({props}: {props: {spec: VideoSpec}}) => ({durationInFrames: totalFrames(props.spec)});
const storyMetadata = ({props}: {props: {spec: StorySpec}}) => ({durationInFrames: storyFrames(props.spec)});
const defaults = {spec: sample as VideoSpec};
const storyDefaults = {spec: storySample as StorySpec};
const teaserMetadata = ({props}: {props: {spec: TeaserSpec}}) => ({durationInFrames: teaserFrames(props.spec)});
const teaserDefaults = {spec: teaserSample as TeaserSpec};
const explainerMetadata = ({props}: {props: {spec: ExplainerSpec}}) => ({durationInFrames: explainerFrames(props.spec)});
const explainerDefaults = {spec: explainerSample as ExplainerSpec};
const kursiDefaults = {spec: kursiSample as ExplainerSpec};

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
    <Composition id="Teaser" component={Teaser} fps={FPS} width={720} height={1280} durationInFrames={1}
      defaultProps={teaserDefaults} calculateMetadata={teaserMetadata} />
    <Composition id="Explainer" component={Explainer} fps={FPS} width={1920} height={1080} durationInFrames={1}
      defaultProps={explainerDefaults} calculateMetadata={explainerMetadata} />
    <Composition id="Kursi" component={Explainer} fps={FPS} width={1920} height={1080} durationInFrames={1}
      defaultProps={kursiDefaults} calculateMetadata={explainerMetadata} />
  </>
);
