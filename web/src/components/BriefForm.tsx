import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AudienceSpec, Brief, Platform } from '../types'
import { GROUPS } from '../audiences'
import { AudienceFields, PlatformPicker } from './AudienceFields'
import { ChoiceField } from './ChoiceField'
import { KNOWLEDGE, LANGUAGES, PLATFORMS } from '../labels'

const TOPICS = [
  'لماذا يبتلي الله الناس؟',
  'الصدق وأثره في حياة المسلم',
  'بر الوالدين في زمن الانشغال',
  'ما معنى التوحيد؟',
  'لماذا يصلي المسلمون خمس مرات؟',
  'حسن الخلق مع الجار',
]

const DURATIONS = [
  { label: '15 ث', value: '15' },
  { label: '30 ث', value: '30' },
  { label: '45 ث', value: '45' },
  { label: '60 ث', value: '60' },
  { label: '90 ث', value: '90' },
  { label: '3 دقائق', value: '180' },
]

const LAST_KEY = 'balagh.lastBrief'

/** A complete brief a first-time visitor can run as is, to see the whole flow before writing their own. */
const EXAMPLE: Brief = {
  idea: 'الصدق في البيع: لماذا يرزق الله التاجر الصادق؟',
  audience: GROUPS[1].label,
  language: 'ar',
  dialect: 'الدارجة الجزائرية',
  audience_knowledge: GROUPS[1].knowledge,
  tone: null,
  platforms: ['tiktok'],
  duration_seconds: 45,
}

const MOD = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

const DEFAULT_AUDIENCE: AudienceSpec = {
  audience: GROUPS[0].label,
  language: 'ar',
  dialect: null,
  audience_knowledge: GROUPS[0].knowledge,
  tone: null,
}

/** The audience and format of the last submitted brief, so repeat generations start where the user left off. */
function lastBrief(): Brief | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null')
  } catch {
    return null
  }
}

interface Props {
  disabled: boolean
  /** Prefills the form, e.g. when reusing a project's brief. */
  initial?: Brief | null
  onSubmit: (brief: Brief) => void
}

export function BriefForm({ disabled, initial, onSubmit }: Props) {
  const [start] = useState(() => initial ?? lastBrief())
  const [idea, setIdea] = useState(initial?.idea ?? '')
  const [audience, setAudience] = useState<AudienceSpec>(() =>
    start
      ? {
          audience: start.audience,
          language: start.language,
          dialect: start.dialect,
          audience_knowledge: start.audience_knowledge,
          tone: start.tone,
        }
      : DEFAULT_AUDIENCE,
  )
  const [platforms, setPlatforms] = useState<Platform[]>(start?.platforms ?? ['youtube_shorts'])
  const [duration, setDuration] = useState<string | null>(start?.duration_seconds ? String(start.duration_seconds) : null)
  const remembered = !initial && start !== null
  // Bumping it remounts the audience pickers, whose group and region selections are local to them.
  const [formKey, setFormKey] = useState(0)

  const send = () => {
    if (disabled || platforms.length === 0) return
    const brief: Brief = {
      ...audience,
      idea: idea.trim() || null,
      platforms,
      duration_seconds: duration ? Number(duration) : null,
    }
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ ...brief, idea: null }))
    } catch {
      // Not remembering the brief is harmless.
    }
    onSubmit(brief)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send()
  }

  const resetPrefs = () => {
    try {
      localStorage.removeItem(LAST_KEY)
    } catch {
      // Ignore; the form is reset either way.
    }
    setAudience(DEFAULT_AUDIENCE)
    setPlatforms(['youtube_shorts'])
    setDuration(null)
    setFormKey((k) => k + 1)
  }

  const summary: [string, string, boolean][] = [
    ['الموضوع', idea.trim() || 'يقترحه بلاغ', !idea.trim()],
    ['الجمهور', audience.audience || 'غير محدد', false],
    ['اللغة', `${LANGUAGES[audience.language]}${audience.dialect ? ` · ${audience.dialect}` : ''}`, false],
    ['المعرفة بالإسلام', KNOWLEDGE[audience.audience_knowledge], false],
    ['الأسلوب', audience.tone ?? 'تلقائي', !audience.tone],
    ['المنصات', platforms.map((p) => PLATFORMS[p]).join('، ') || '—', false],
    ['المدة', duration ? `${duration} ث` : 'يقترحها بلاغ', !duration],
  ]

  return (
    <form className="brief" onSubmit={submit}>
      <div className="brief-main">
        <div className="page-head">
          <h1>توليد جديد</h1>
          <p className="muted">
            اكتب موضوعا واختر جمهورك، والباقي يضبطه بلاغ تلقائيا.
            {remembered && (
              <>
                {' '}
                استعدنا إعداداتك الأخيرة.{' '}
                <button type="button" className="link inline" onClick={resetPrefs}>
                  ابدأ من الإعدادات الافتراضية
                </button>
              </>
            )}
            {initial && ' الموجز منسوخ من مشروع سابق، عدّل ما تريد.'}
          </p>
        </div>

        <section className="card form-section">
          <header className="section-head">
            <span className="num">1</span>
            <div>
              <h2>عمّ يتحدث الفيديو؟</h2>
              <p className="muted small">اكتب فكرتك، أو اختر موضوعا جاهزا، أو اتركها فارغة ليقترح بلاغ.</p>
            </div>
          </header>
          <div className="field">
            <textarea
              className="topic"
              rows={3}
              value={idea}
              maxLength={500}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="مثال: كيف يتعامل المسلم مع القلق من المستقبل؟"
            />
            <div className="chips">
              <span className="muted small">مواضيع جاهزة:</span>
              <button
                type="button"
                className="chip small example"
                title="يملأ الموضوع والجمهور والمنصة والمدة بمثال كامل"
                onClick={() => {
                  setIdea(EXAMPLE.idea ?? '')
                  setAudience({ audience: EXAMPLE.audience, language: EXAMPLE.language, dialect: EXAMPLE.dialect, audience_knowledge: EXAMPLE.audience_knowledge, tone: EXAMPLE.tone })
                  setPlatforms(EXAMPLE.platforms)
                  setDuration(String(EXAMPLE.duration_seconds))
                  setFormKey((k) => k + 1)
                }}
              >
                ★ جرّب مثالا كاملا
              </button>
              {TOPICS.map((t) => (
                <button type="button" key={t} className={idea === t ? 'chip small on' : 'chip small'} onClick={() => setIdea(idea === t ? '' : t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card form-section">
          <header className="section-head">
            <span className="num">2</span>
            <div>
              <h2>لمن، وأين يُنشر؟</h2>
              <p className="muted small">الجمهور واللغة والمنصات. التفاصيل الدقيقة في الخيارات المتقدمة.</p>
            </div>
          </header>
          <AudienceFields
            key={formKey}
            value={audience}
            onChange={setAudience}
            advancedChanged={Number(duration !== null)}
            advanced={
              <ChoiceField
                label="مدة الفيديو"
                auto="تلقائي"
                options={DURATIONS}
                value={duration}
                onChange={setDuration}
                type="number"
                min={5}
                max={600}
                customPlaceholder="بالثواني، من 5 إلى 600"
                hint="في الوضع التلقائي يقترح بلاغ مدة لكل فكرة حسب المنصات."
              />
            }
          >
            <div className="field">
              <span>المنصات</span>
              <PlatformPicker key={formKey} value={platforms} onChange={setPlatforms} />
              {platforms.length === 0 && <small className="error-text">اختر منصة واحدة على الأقل.</small>}
            </div>
          </AudienceFields>
        </section>
      </div>

      <aside className="brief-aside">
        <div className="card summary">
          <h3>ملخص الموجز</h3>
          <dl>
            {summary.map(([k, v, auto]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd dir="auto" className={auto ? 'auto' : ''}>
                  {auto && <span aria-hidden="true">✦ </span>}
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <button className="primary big block-button" disabled={disabled || platforms.length === 0}>
            {idea.trim() ? 'اقترح 3 أفكار' : 'اقترح عليّ 3 أفكار'}
          </button>
          <p className="kbd-hint muted small">
            أو <kbd>{MOD}</kbd> + <kbd>Enter</kbd> من خانة الموضوع
          </p>
          <ul className="assure">
            <li>ثلاث أفكار في نحو 45 ثانية</li>
            <li>كل آية وحديث يُبحث عنه في القرآن والصحيحين</li>
            <li>ما لا يوثّق يُعلَّم ولا يُستعمل</li>
          </ul>
        </div>
      </aside>
    </form>
  )
}
