import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence} from 'remotion';
import {BG, C, amiri, cairo, LangCtx} from './theme';
import {BigText, CaptionStage, Fill, Medallion, ReplyCard, Zoom, asSrc, useIn} from './ui';

type Scene = any;
const FPS = 30;

const Title = ({s}: {s: Scene}) => (
  <Fill bg={BG.blue}>
    <BigText lines={s.lines ?? [s.text]} size={s.size ?? 96} />
    {s.medallion && <Medallion text={s.medallion} image={s.medallionImage} delay={10} />}
  </Fill>
);

const Medallions = ({s}: {s: Scene}) => (
  <Fill bg={BG.blue}>
    <div style={{position: 'relative', width: 640, height: 760}}>
      {(s.names as string[]).map((n, i) => {
        const pos = [{l: 190, t: 20}, {l: 20, t: 250}, {l: 360, t: 330}, {l: 190, t: 520}][i % 4];
        return <div key={i} style={{position: 'absolute', left: pos.l, top: pos.t}}><Medallion text={n} size={s.size ?? 250} delay={i * 8} /></div>;
      })}
    </div>
  </Fill>
);

const Quote = ({s, dur}: {s: Scene; dur: number}) => (
  <Fill bg={BG.white}>
    <div style={{display: 'flex', alignItems: 'center', gap: 20, direction: 'rtl'}}>
      <div style={{width: 300, height: 520, position: 'relative'}}>
        {s.image && <Img src={asSrc(s.image)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />}
        {s.medallionOnFace && <div style={{position: 'absolute', top: 40, left: 90}}><Medallion text="" size={90} image={s.medallionOnFace} /></div>}
      </div>
      <BigText lines={s.lines} color={C.blue} size={s.size ?? 64} font="reem" />
    </div>
  </Fill>
);

const Book = ({s, dur}: {s: Scene; dur: number}) => {
  const p = useIn();
  return (
    <Fill bg={BG.white}>
      <Zoom dur={dur} from={1} to={s.zoom ?? 1.5} origin={s.zoomOrigin ?? '50% 60%'}>
        <div style={{position: 'relative', width: 640, height: 900}}>
          {s.page && (
            <Img src={asSrc(s.page)} style={{position: 'absolute', right: 0, top: 0, width: 520, borderRadius: 16, border: '4px solid #8b3a3a', opacity: p}} />
          )}
          {s.cover && (
            <Img src={asSrc(s.cover)} style={{position: 'absolute', left: -20, bottom: 0, width: 330, boxShadow: '0 10px 40px rgba(0,0,0,.4)', transform: `translateX(${(1 - p) * -200}px)`}} />
          )}
          {s.highlight && (
            <div style={{position: 'absolute', right: 20, top: s.highlight.top, width: 480, height: s.highlight.height, background: C.red, opacity: 0.55 * p, mixBlendMode: 'multiply'}} />
          )}
        </div>
      </Zoom>
    </Fill>
  );
};

const Comment = ({s}: {s: Scene}) => (
  <Fill bg={BG.blue}><ReplyCard user={s.user} text={s.text} /></Fill>
);

const Footage = ({s, dur}: {s: Scene; dur: number}) => (
  <Fill bg={BG.dark}>
    <Zoom dur={dur} from={1} to={1.12}>
      <Img src={asSrc(s.image)} style={{width: 720, height: 1280, objectFit: 'cover'}} />
    </Zoom>
    {s.caption && (
      <div style={{position: 'absolute', bottom: 120, width: '100%', direction: 'rtl', textAlign: 'center', fontFamily: cairo, fontWeight: 800, fontSize: 48, color: '#fff', textShadow: '0 3px 14px #000'}}>{s.caption}</div>
    )}
  </Fill>
);

const Verse = ({s}: {s: Scene}) => (
  <Fill bg={BG.white}>
    {s.medallion && <Medallion text={s.medallion} image={s.medallionImage} dark size={300} />}
    <BigText lines={s.lines} color={C.ink} font="amiri" size={s.size ?? 76} delay={8} />
    {s.source && <div style={{fontFamily: cairo, fontSize: 30, color: '#666', direction: 'rtl'}}>{s.source}</div>}
  </Fill>
);

const Outro = ({s}: {s: Scene}) => (
  <Fill bg={BG.blue}>
    <BigText lines={s.lines} size={s.size ?? 80} />
  </Fill>
);

const Captions = ({s, dur}: {s: Scene; dur: number}) => (
  <Fill bg={BG.blue}>
    <CaptionStage cues={s.cues} visuals={s.visuals} hook={s.hook} speaker={s.speaker} total={dur / FPS} />
  </Fill>
);

const MAP: Record<string, React.FC<any>> = {title: Title, medallions: Medallions, quote: Quote, book: Book, comment: Comment, footage: Footage, verse: Verse, captions: Captions, outro: Outro};

export const Reel: React.FC<{reel: any}> = ({reel}) => {
  let from = 0;
  return (
    <LangCtx.Provider value={{en: reel.lang === 'en'}}>
    <AbsoluteFill style={{background: '#000'}}>
      {reel.scenes.map((s: Scene, i: number) => {
        const dur = Math.round(s.duration * FPS);
        const Comp = MAP[s.type];
        const el = (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {Comp ? <Comp s={s} dur={dur} /> : null}
            {s.audio && <Audio src={asSrc(s.audio)} />}
          </Sequence>
        );
        from += dur;
        return el;
      })}
      {reel.voiceover && <Audio src={asSrc(reel.voiceover)} />}
      {reel.music && <Audio src={asSrc(reel.music)} volume={reel.musicVolume ?? 0.12} />}
    </AbsoluteFill>
    </LangCtx.Provider>
  );
};
