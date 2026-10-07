import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { BASE } from '../api'
import raw from '../showcase.json'
import { CHARACTERS, CLAIMS, KNOWLEDGE, LANGUAGES, PLATFORMS, REVIEWERS, STORY_SCENES } from '../labels'
import type { AudienceKnowledge, Language, Platform } from '../types'
import { Logo } from './Landing'
import { Reveal } from './reveal'

/** Two real runs, as the user entered them and as they came out, including what the reviewers caught. */
interface ShowScript {
  id: string
  title: string
  hook: string
  version: number
  scenes: { t: string; voiceover: string; screen: string }[]
  references: { source: string; usage: string; text: string; sharh: string | null; tafsir: string[] }[]
  review: { severity: string; reviewer: string; scene: number; issue: string; fix: string }[]
  claims: { status: string; claim: string; note: string }[]
  unverified: string[]
  approved: boolean
  cta: string
}

interface ShowStory {
  title: string
  scenes: {
    kind: string
    lines: { who: string; text: string }[]
    quote: string
    source: string
    cards: { word: string; meaning: string }[]
    question: string
    choices: string[]
  }[]
}

interface Example {
  id: string
  title: string
  project: string
  script: string
  brief: { idea: string | null; audience: string; language: string; knowledge: string; tone: string | null; platforms: string[]; duration: number | null }
  ideas: { title: string; hook: string; evidence: string[]; locus?: string; mentions?: string[] }[]
  /** When the ideas were drawn from a video or a file. */
  source?: { kind: string; label: string; url: string | null; summary: string }
  chosen: number
  first: ShowScript
  final: ShowScript
  story: ShowStory | null
  /** The newest version after several correction rounds, when the story of the example continues past `final`. */
  latest?: ShowScript
  videos: { template: string; id: string; url: string; seconds: number; images: number; clips: number; notes: string[]; aspect: string; example: string }[]
  timeline: string[]
}

interface Guard {
  title: string
  input: string
  outcome: 'referred' | 'unverified'
  text: string
}

interface Feedback {
  note: string
  items: { name: string; role: string; text: string; done?: string }[]
}

const data = raw as { examples: Example[]; guards: Guard[]; stats: { value: string; label: string }[]; feedback: Feedback }

function Brief({ b }: { b: Example['brief'] }) {
  return (
    <dl className="show-params">
      <dt>الموضوع</dt>
      <dd dir="auto">{b.idea}</dd>
      <dt>الجمهور</dt>
      <dd>{b.audience}</dd>
      <dt>اللغة</dt>
      <dd>{LANGUAGES[b.language as Language]}</dd>
      <dt>المعرفة بالإسلام</dt>
      <dd>{KNOWLEDGE[b.knowledge as AudienceKnowledge]}</dd>
      <dt>الأسلوب</dt>
      <dd>{b.tone ?? 'تلقائي'}</dd>
      <dt>المنصات</dt>
      <dd>{b.platforms.map((p) => PLATFORMS[p as Platform]).join('، ')}</dd>
      <dt>المدة</dt>
      <dd>{b.duration ? `${b.duration} ث` : 'تلقائية'}</dd>
    </dl>
  )
}

function Script({ s, label }: { s: ShowScript; label: string }) {
  return (
    <details className="show-script" open={false}>
      <summary>
        {label}: <strong dir="auto">{s.title}</strong> <span className="muted small">نسخة {s.version}</span>
      </summary>
      <p className="hook" dir="auto">
        {s.hook}
      </p>
      <ol className="scenes" dir={/[a-z]/i.test(s.scenes[0]?.voiceover ?? '') && !/[؀-ۿ]/.test(s.scenes[0]?.voiceover ?? '') ? 'ltr' : 'rtl'}>
        {s.scenes.map((sc) => (
          <li key={sc.t}>
            <div className="time">{sc.t} ث</div>
            <div className="scene-body">
              <p className="voice">{sc.voiceover}</p>
              {sc.screen && (
                <p className="onscreen">
                  <span className="tag">على الشاشة</span> {sc.screen}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {s.references.map((r) => (
        <div className="reference" key={r.source}>
          <div className="badges">
            <span className="badge">{r.usage === 'quoted' ? 'اقتباس حرفي' : 'بالمعنى'}</span>
            <strong>{r.source}</strong>
          </div>
          <p className="scripture" dir="auto">
            {r.text}
          </p>
          {r.sharh && (
            <details className="tafsir">
              <summary>
                <span className="badge">شرح</span> الموسوعة الحديثية
              </summary>
              <p dir="rtl">{r.sharh}</p>
            </details>
          )}
          {r.tafsir.map((t, i) => (
            <details className="tafsir" key={i}>
              <summary>
                <span className="badge">تفسير</span> تفسير الميسر
              </summary>
              <p dir="rtl">{t}</p>
            </details>
          ))}
        </div>
      ))}
      {s.unverified.length > 0 && (
        <div className="notice warn">
          <strong>وقائع لم يُتحقق منها</strong>
          <ul>
            {s.unverified.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
  )
}

function Review({ s }: { s: ShowScript }) {
  if (!s.review.length && !s.claims.length) return <p className="notice ok">لا ملاحظات مانعة.</p>
  return (
    <>
      {s.review.length > 0 && (
        <ul className="findings">
          {s.review.map((f, i) => (
            <li key={i} className={f.severity}>
              <div className="badges">
                <span className={f.severity === 'blocking' ? 'badge bad' : 'badge'}>{f.severity === 'blocking' ? 'مانعة' : 'اقتراح'}</span>
                <span className="badge">{REVIEWERS[f.reviewer as keyof typeof REVIEWERS]}</span>
                {f.scene > 0 && <span className="badge">المشهد {f.scene}</span>}
              </div>
              <p>{f.issue}</p>
              <p className="muted">التصحيح: {f.fix}</p>
            </li>
          ))}
        </ul>
      )}
      {s.claims.length > 0 && (
        <table>
          <tbody>
            {s.claims.map((c, i) => (
              <tr key={i}>
                <td>
                  <span className={`badge claim-${c.status}`}>{CLAIMS[c.status as keyof typeof CLAIMS]}</span>
                </td>
                <td>
                  {c.claim}
                  {c.note && <div className="muted small">{c.note}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function Story({ story }: { story: ShowStory }) {
  return (
    <details className="show-script">
      <summary>
        قصة الأطفال: <strong dir="auto">{story.title}</strong>
      </summary>
      <ol className="scenes story" dir="rtl">
        {story.scenes.map((sc, i) => (
          <li key={i}>
            <div className="time">{STORY_SCENES[sc.kind as keyof typeof STORY_SCENES]}</div>
            <div className="scene-body">
              {sc.kind === 'text' ? (
                <>
                  <p className="scripture">«{sc.quote}»</p>
                  <p className="muted small">{sc.source}</p>
                </>
              ) : (
                sc.lines.map((l, j) => (
                  <p className="voice" key={j}>
                    <span className="tag">{CHARACTERS[l.who] ?? l.who}</span> {l.text}
                  </p>
                ))
              )}
              {sc.cards.length > 0 && (
                <ul className="plain">
                  {sc.cards.map((c) => (
                    <li key={c.word}>
                      <strong>{c.word}</strong>: {c.meaning}
                    </li>
                  ))}
                </ul>
              )}
              {sc.question && (
                <p className="onscreen">
                  <span className="tag">السؤال</span> {sc.question} — {sc.choices.join(' / ')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}

/** All the videos in one swipeable strip, like a reels feed: scroll-snap on touch, drag and arrows on desktop.
 * The reel nearest the centre is the active one; the others step back. Hovering a reel plays it muted; a click
 * on the picture turns the sound on. */
function ReelStrip({ videos }: { videos: Example['videos'] }) {
  const strip = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [edge, setEdge] = useState({ start: true, end: false })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)

  useEffect(() => {
    const el = strip.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      let best = 0
      let dist = Infinity
      Array.from(el.children).forEach((c, i) => {
        const b = c.getBoundingClientRect()
        const d = Math.abs(b.left + b.width / 2 - cx)
        if (d < dist) {
          dist = d
          best = i
        }
      })
      setActive(best)
      // In a right-to-left strip Chrome reports scrollLeft as a negative number.
      const x = Math.abs(el.scrollLeft)
      const max = el.scrollWidth - el.clientWidth
      setEdge({ start: x < 6, end: x > max - 6 })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [videos])

  const goTo = (i: number) => (strip.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  const step = (dir: number) => goTo(Math.max(0, Math.min(videos.length - 1, active + dir)))

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !strip.current) return
    drag.current = { x: e.clientX, left: strip.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !strip.current) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 5) return
    d.moved = true
    setDragging(true)
    strip.current.scrollLeft = d.left - dx
  }
  const endDrag = () => {
    if (drag.current?.moved) {
      // land on the nearest reel once the mouse lets go
      setTimeout(() => goTo(active), 0)
    }
    drag.current = null
    setDragging(false)
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragging) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className={`reels${edge.start ? ' at-start' : ''}${edge.end ? ' at-end' : ''}`}>
      <button className="reels-arrow prev" aria-label="السابق" onClick={() => step(-1)} disabled={active === 0}>
        ‹
      </button>
      <div
        className={`reels-strip${dragging ? ' dragging' : ''}`}
        ref={strip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        {videos.map((v, i) => (
          <Reel key={v.url} v={v} active={i === active} onFocus={() => goTo(i)} />
        ))}
      </div>
      <button className="reels-arrow next" aria-label="التالي" onClick={() => step(1)} disabled={active === videos.length - 1}>
        ›
      </button>
      <div className="reels-dots" role="tablist" aria-label="الفيديوهات">
        {videos.map((v, i) => (
          <button key={v.url} role="tab" aria-selected={i === active} aria-label={`${v.template} · ${v.example}`} className={i === active ? 'on' : ''} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  )
}

/** The one video playing with sound, so that starting another stops it and a hover preview does not talk over it. */
let loud: HTMLVideoElement | null = null
const TAKE_OVER = 'balagh:reel-play'

function Reel({ v, active, onFocus }: { v: Example['videos'][number]; active: boolean; onFocus: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [sound, setSound] = useState(false)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    // another reel started with sound: this one stops and goes back to its poster
    const stop = (e: Event) => {
      const el = video.current
      if (!el || (e as CustomEvent<HTMLVideoElement>).detail === el) return
      if (!el.paused) el.pause()
      el.currentTime = 0
      el.muted = true
      setSound(false)
    }
    window.addEventListener(TAKE_OVER, stop)
    return () => window.removeEventListener(TAKE_OVER, stop)
  }, [])
  const hoverPlay = () => {
    const el = video.current
    if (!el || sound) return
    if (loud && loud !== el && !loud.paused) return
    el.muted = true
    el.play().catch(() => undefined)
  }
  const hoverStop = () => {
    const el = video.current
    if (!el || sound) return
    el.pause()
    el.currentTime = 0
  }
  const toggleSound = () => {
    const el = video.current
    if (!el) return
    if (!active) onFocus()
    el.muted = sound
    setSound(!sound)
    if (!sound) {
      loud = el
      window.dispatchEvent(new CustomEvent(TAKE_OVER, { detail: el }))
    } else if (loud === el) {
      loud = null
    }
    if (el.paused) el.play().catch(() => undefined)
  }
  return (
    <figure className={`reel ${v.aspect === '9:16' ? 'tall' : 'wide'}${active ? ' active' : ''}${playing ? ' playing' : ''}`} onMouseEnter={hoverPlay} onMouseLeave={hoverStop}>
      <div className="reel-frame">
        {/* the poster is one of the stills the automatic check took of this video */}
        <video
          ref={video}
          controls={sound}
          preload="metadata"
          poster={`${BASE}${v.url.replace(/\.mp4$/, '_f1.jpg')}`}
          src={`${BASE}${v.url}`}
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setSound(false)
            if (loud === video.current) loud = null
          }}
        />
        {!sound && (
          <button type="button" className="reel-play" onClick={toggleSound} aria-label={`شغّل مع الصوت: ${v.template}`}>
            <span className="reel-play-icon" aria-hidden="true">
              {playing ? '🔇' : '▶'}
            </span>
            <span className="reel-play-time">{Math.round(v.seconds)} ث</span>
          </button>
        )}
      </div>
      <figcaption>
        <strong>{v.template}</strong> · {Math.round(v.seconds)} ث
        <span className="muted small" dir="auto">
          {v.example}
        </span>
      </figcaption>
    </figure>
  )
}

export function Showcase({ onStart }: { onStart: () => void }) {
  // Reels (9:16) in one strip, episodes (16:9) in another: each group swipes on its own.
  const all = data.examples.flatMap((e) => e.videos)
  const order = data.examples.map((e) => e.title)
  const byExample = (a: Example['videos'][number], b: Example['videos'][number]) => order.indexOf(a.example) - order.indexOf(b.example)
  const reels = all.filter((v) => v.aspect === '9:16').sort(byExample)
  const episodes = all.filter((v) => v.aspect !== '9:16')
  return (
    <div className="landing showcase">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="links">
            <a href="#">الرئيسية</a>
            <a href={`${BASE}/docs`} target="_blank" rel="noreferrer">
              API
            </a>
          </nav>
          <button className="primary" onClick={onStart}>
            ابدأ مشروعا
          </button>
        </div>
      </header>

      <section className="section">
        <div className="section-inner">
          <span className="eyebrow">أمثلة حقيقية</span>
          <h2>ما كتبه المستخدم، وما خرج من بلاغ</h2>
          <p className="lead">
            مشروعان نُفّذا على هذا الموقع كما هما، بلا تنقيح: الطلب بمعاييره، والأفكار، والسيناريو، وما أمسكه المراجعون، والفيديو
            النهائي. يمكنك فتح كل مشروع في لوحة العمل.
          </p>
        </div>
      </section>

      <section className="section alt" id="reels">
        <div className="section-inner">
          <Reveal>
            <span className="eyebrow">الفيديوهات</span>
            <h2>كما خرجت من بلاغ، بلا مونتاج</h2>
          </Reveal>
          <p className="muted small">
            اسحب أو استعمل الأسهم. الصوت مولَّد للحوار والشرح؛ الآية بتلاوة قارئ، والحديث يُعرض بصمت حتى يوضع تسجيل قارئ.
          </p>
          <Reveal className="stats show-stats" stagger>
            {data.stats.map((r, i) => (
              <div className="stat" key={r.label} style={{ '--i': i } as React.CSSProperties}>
                <strong>{r.value}</strong>
                <span>{r.label}</span>
              </div>
            ))}
          </Reveal>
          <h3 className="strip-title">ريلز عمودية (9:16) · TikTok وReels وShorts</h3>
          <ReelStrip videos={reels} />
          <h3 className="strip-title">حلقات أفقية (16:9) · YouTube</h3>
          <ReelStrip videos={episodes} />
        </div>
      </section>

      {data.examples.map((ex) => (
        <section className="section show-example" key={ex.id} id={`ex-${ex.id}`}>
          <div className="section-inner">
            <h2 dir="auto">{ex.title}</h2>
            <div className="show-grid">
              <div className="card">
                <h3>1. الطلب كما كتبه المستخدم</h3>
                <Brief b={ex.brief} />
                {ex.source && (
                  <p className="notice" dir="auto">
                    <strong>{ex.source.kind === 'youtube' ? 'مصدر الإلهام: فيديو يوتيوب' : 'مصدر الإلهام: ملف'}</strong>{' '}
                    {ex.source.url ? <a href={ex.source.url} target="_blank" rel="noreferrer">{ex.source.label}</a> : ex.source.label}
                    <br />
                    <span className="small">{ex.source.summary}</span>
                  </p>
                )}
              </div>
              <div className="card">
                <h3>2. ما جرى</h3>
                <ol className="show-timeline">
                  {ex.timeline.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
                <a className="button" href={`#/p/${ex.project}/${ex.script}`}>
                  افتح المشروع في لوحة العمل
                </a>
              </div>
            </div>

            <div className="card">
              <h3>3. الأفكار الثلاث (اختيرت الفكرة {ex.chosen})</h3>
              <ul className="plain show-ideas">
                {ex.ideas.map((i, n) => (
                  <li key={i.title} className={n + 1 === ex.chosen ? 'chosen' : ''}>
                    <strong dir="auto">{i.title}</strong>
                    <span className="muted" dir="auto">
                      {' '}
                      {i.hook}
                    </span>
                    <div className="badges">
                      {i.locus && <span className="badge info">من المصدر: {i.locus}</span>}
                      {i.evidence.map((e) => (
                        <span className="badge ok" key={e}>
                          {e}
                        </span>
                      ))}
                      {(i.mentions ?? []).map((m) => (
                        <span className="badge" key={m} title="ذكرها المصدر وهي خارج نطاق مصادرنا الحالية، فلم تُستعمل">
                          خارج النطاق: {m.slice(0, 40)}…
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3>4. السيناريو</h3>
              <Script s={ex.first} label={ex.final.id === ex.first.id ? 'السيناريو' : ex.story ? 'النسخة الأولى' : 'النسخة العربية الأصلية'} />
              <h4>ما وجده المراجعون في هذه النسخة</h4>
              <Review s={ex.first} />
              {ex.story && (
                <>
                  <h4>النسخة المصحّحة المعتمدة</h4>
                  <Script s={ex.final} label="بعد التصحيح" />
                  <Review s={ex.final} />
                </>
              )}
              {!ex.story && ex.final.id !== ex.first.id && (
                <>
                  <h4>{ex.id === 'adults' ? 'النسخة الموطّنة للإنجليزية' : 'النسخة المصحّحة المعتمدة'}</h4>
                  <Script s={ex.final} label={ex.id === 'adults' ? 'Localized' : 'بعد التصحيح'} />
                  <h4>ما وجده المراجعون فيها</h4>
                  <Review s={ex.final} />
                </>
              )}
              {ex.latest && (
                <>
                  <h4>بعد أربع جولات تصحيح: النسخة {ex.latest.version}</h4>
                  <Script s={ex.latest} label="Localized, revised" />
                  <Review s={ex.latest} />
                  <p className="notice warn">
                    تنتظر توقيع مراجع شرعي ومراجع لغوي بالاسم. الفيديو الموطّن لا يُصيَّر قبل ذلك: هذا هو التصميم لا نقصا فيه.
                  </p>
                </>
              )}
            </div>

            {ex.story && (
              <div className="card">
                <h3>5. القصة التي كُتبت للقالب</h3>
                <Story story={ex.story} />
              </div>
            )}

          </div>
        </section>
      ))}

      <section className="section alt" id="guards">
        <div className="section-inner">
          <span className="eyebrow">ما يرفضه بلاغ</span>
          <h2>طلبان لم يُولَّد لهما ما طُلب</h2>
          <div className="show-grid">
            {data.guards.map((g) => (
              <div className="card" key={g.title}>
                <h3>{g.title}</h3>
                <p className="muted small">ما طُلب</p>
                <p dir="auto">
                  <strong>{g.input}</strong>
                </p>
                <p className="muted small">ما حدث</p>
                <div className={g.outcome === 'referred' ? 'notice referral' : 'notice warn'} dir="auto">
                  <strong>{g.outcome === 'referred' ? 'أُحيل إلى مختص، ولم يُولَّد محتوى' : 'عُلِّم غير موثّق ولم يُستعمل'}</strong>
                  <p>{g.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="feedback">
        <div className="section-inner">
          <span className="eyebrow">آراء أولية</span>
          <h2>ما قاله طلاب علم بعد المشاهدة</h2>
          <p className="muted">{data.feedback.note}</p>
          <div className="show-grid">
            {data.feedback.items.map((f) => (
              <blockquote className="card quote" key={f.name}>
                <p dir="auto">«{f.text}»</p>
                <footer>
                  <strong>{f.name}</strong> · {f.role}
                </footer>
                {f.done && <p className="notice ok small">{f.done}</p>}
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="section-inner">
          <h2>جرّب بموضوعك</h2>
          <p>اختر جمهورك ومنصتك، واترك الباقي لبلاغ.</p>
          <button className="primary big light" onClick={onStart}>
            ابدأ مشروعا ←
          </button>
        </div>
      </section>
    </div>
  )
}
