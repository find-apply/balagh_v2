import { useRef } from 'react'
import { BASE } from '../api'
import raw from '../showcase.json'
import { CHARACTERS, CLAIMS, KNOWLEDGE, LANGUAGES, PLATFORMS, REVIEWERS, STORY_SCENES } from '../labels'
import type { AudienceKnowledge, Language, Platform } from '../types'
import { Logo } from './Landing'

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
  ideas: { title: string; hook: string; evidence: string[] }[]
  chosen: number
  first: ShowScript
  final: ShowScript
  story: ShowStory | null
  videos: { template: string; id: string; url: string; seconds: number; images: number; clips: number; notes: string[]; aspect: string; example: string }[]
  timeline: string[]
}

const data = raw as { examples: Example[] }

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

/** All the videos in one swipeable strip, like a reels feed: scroll-snap on touch, arrows on desktop. */
function ReelStrip({ videos }: { videos: Example['videos'] }) {
  const strip = useRef<HTMLDivElement>(null)
  const step = (dir: number) => strip.current?.scrollBy({ left: dir * (strip.current.clientWidth * 0.8), behavior: 'smooth' })
  return (
    <div className="reels">
      <button className="reels-arrow prev" aria-label="السابق" onClick={() => step(1)}>
        ‹
      </button>
      <div className="reels-strip" ref={strip}>
        {videos.map((v) => (
          <figure key={v.url} className={v.aspect === '9:16' ? 'reel tall' : 'reel wide'}>
            <video controls preload="metadata" src={BASE + v.url} playsInline />
            <figcaption>
              <strong>{v.template}</strong> · {Math.round(v.seconds)} ث
              <span className="muted small" dir="auto">
                {v.example}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <button className="reels-arrow next" aria-label="التالي" onClick={() => step(-1)}>
        ›
      </button>
    </div>
  )
}

export function Showcase({ onStart }: { onStart: () => void }) {
  const videos = data.examples.flatMap((e) => e.videos)
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
          <span className="eyebrow">الفيديوهات</span>
          <h2>كما خرجت من بلاغ، بلا مونتاج</h2>
          <p className="muted small">
            اسحب أو استعمل الأسهم. الصوت مولَّد للحوار والشرح؛ الآية بتلاوة قارئ، والحديث يُعرض بصمت حتى يوضع تسجيل قارئ.
          </p>
          <ReelStrip videos={videos} />
        </div>
      </section>

      {data.examples.map((ex) => (
        <section className="section show-example" key={ex.id} id={ex.id}>
          <div className="section-inner">
            <h2 dir="auto">{ex.title}</h2>
            <div className="show-grid">
              <div className="card">
                <h3>1. الطلب كما كتبه المستخدم</h3>
                <Brief b={ex.brief} />
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
                      {i.evidence.map((e) => (
                        <span className="badge ok" key={e}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3>4. السيناريو</h3>
              <Script s={ex.first} label={ex.story ? 'النسخة الأولى' : 'النسخة العربية الأصلية'} />
              <h4>ما وجده المراجعون في هذه النسخة</h4>
              <Review s={ex.first} />
              {ex.story && (
                <>
                  <h4>النسخة المصحّحة المعتمدة</h4>
                  <Script s={ex.final} label="بعد التصحيح" />
                  <Review s={ex.final} />
                </>
              )}
              {!ex.story && (
                <>
                  <h4>النسخة الموطّنة للإنجليزية</h4>
                  <Script s={ex.final} label="Localized" />
                  <h4>ما وجده المراجعون في النسخة الموطّنة</h4>
                  <Review s={ex.final} />
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
