import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ChoiceField } from '../components/ChoiceField'
import { LANGUAGES } from '../labels'
import type { Language } from '../types'
import { kidsApi, KidsError } from './api'
import type { AgeBand, GuardianRole, Story } from './types'

const STORAGE_KEY = 'balagh.kids.story'

const AGES: { value: AgeBand; label: string }[] = [
  { value: '4-6', label: '4 إلى 6 سنوات' },
  { value: '7-9', label: '7 إلى 9 سنوات' },
  { value: '10-12', label: '10 إلى 12 سنة' },
]
const TOPICS = ['الصدق', 'بر الوالدين', 'شكر النعمة', 'الرفق بالحيوان', 'مساعدة الجار', 'الأمانة']
const DIALECTS: Record<Language, string[]> = {
  ar: ['الفصحى المبسطة', 'الدارجة الجزائرية', 'العامية المصرية', 'اللهجة الخليجية'],
  en: ['Plain simple English', 'British English', 'American English'],
}
const DURATIONS = [
  { label: 'دقيقتان', value: '120' },
  { label: '3 دقائق', value: '180' },
  { label: '4 دقائق', value: '240' },
  { label: '5 دقائق', value: '300' },
]
const ROLES: Record<GuardianRole, string> = { educator: 'مربٍّ أو معلم', parent: 'ولي أمر' }

function toMarkdown(s: Story): string {
  const lines = [`# ${s.title}`, '', `- العمر: ${s.request.age_band}`, `- المدة: ${s.duration_seconds} ثانية`, `- العبرة: ${s.moral}`, '']
  lines.push('## الشخصيات', '', ...s.characters.map((c) => `- ${c.name} (${c.age}): ${c.trait}`), '', '## القصة', '')
  s.scenes.forEach((sc, i) => {
    lines.push(`### المشهد ${i + 1} (${sc.start_second}-${sc.end_second} ث)`, '', `*${sc.setting}*`, '')
    if (sc.narration) lines.push(`الراوي: ${sc.narration}`, '')
    sc.dialogue.forEach((d) => lines.push(`**${d.speaker}:** ${d.line}`, ''))
  })
  lines.push('## المصادر', '', ...s.references.map((r) => `- ${r.source}: ${r.arabic}`), '')
  lines.push('## للأهل', '', `سؤال بعد المشاهدة: ${s.closing_question}`, '', s.parent_note, '')
  lines.push('## إعلان قصير للأهل', '', s.teaser.hook, '', s.teaser.voiceover, '', s.teaser.caption, '')
  if (s.approval) lines.push('## الاعتماد', '', `${ROLES[s.approval.role]}: ${s.approval.name}`, '')
  lines.push('---', '', s.notice)
  return lines.join('\n')
}

function download(story: Story) {
  const url = URL.createObjectURL(new Blob([toMarkdown(story)], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${story.title}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function Busy() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="busy" role="status">
      <span className="spinner" /> يكتب بلاغ القصة ويتحقق من النصوص <span className="muted">({seconds} ث، نحو دقيقة)</span>
    </div>
  )
}

export function KidsPage() {
  const [story, setStory] = useState<Story | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unsuitable, setUnsuitable] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [age, setAge] = useState<AgeBand>('7-9')
  const [language, setLanguage] = useState<Language>('ar')
  const [dialect, setDialect] = useState<string | null>(null)
  const [duration, setDuration] = useState<string | null>(null)
  const [ownCharacters, setOwnCharacters] = useState(false)
  const [characters, setCharacters] = useState([
    { name: '', trait: '' },
    { name: '', trait: '' },
  ])
  const [name, setName] = useState('')
  const [role, setRole] = useState<GuardianRole>('educator')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) kidsApi.get(saved).then(setStory, () => localStorage.removeItem(STORAGE_KEY))
  }, [])

  async function run(task: () => Promise<Story>) {
    setBusy(true)
    setError(null)
    setUnsuitable(null)
    try {
      const result = await task()
      localStorage.setItem(STORAGE_KEY, result.id)
      setStory(result)
    } catch (e) {
      if (e instanceof KidsError && e.unsuitable) setUnsuitable(e.message)
      else setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const given = characters.filter((c) => c.name.trim() && c.trait.trim())
    run(() =>
      kidsApi.create({
        topic: topic.trim() || null,
        age_band: age,
        language,
        dialect,
        characters: ownCharacters && given.length ? given : null,
        duration_seconds: duration ? Number(duration) : null,
      }),
    )
  }

  const reuseCharacters = () => {
    if (!story) return
    setCharacters(story.characters.slice(0, 4).map((c) => ({ name: c.name, trait: `${c.age}، ${c.trait}` })))
    setOwnCharacters(true)
    setTopic('')
    localStorage.removeItem(STORAGE_KEY)
    setStory(null)
  }

  return (
    <>
      <p className="notice warn">
        <strong>تجريبي.</strong> قصص الأطفال مولَّدة بالذكاء الاصطناعي ولم يراجعها مربٍّ بعد. لا تُعرض على طفل قبل أن يراجعها
        ويعتمدها مربٍّ أو ولي أمر.
      </p>
      {busy && <Busy />}
      {error && <div className="notice bad">{error}</div>}
      {unsuitable && (
        <div className="notice referral" dir="auto">
          <strong>هذا الموضوع لا يناسب قصة للأطفال</strong>
          <p>{unsuitable}</p>
        </div>
      )}

      {!story && (
        <form className="card" onSubmit={submit}>
          <h2>قصة للأطفال بشخصيات ثابتة</h2>
          <p className="muted">قصة في بضع دقائق بدل الفيديو القصير، ونصها الشرعي موثّق من المصادر.</p>

          <div className="field">
            <span>الموضوع</span>
            <div className="chips">
              <button type="button" className={topic.trim() ? 'chip auto' : 'chip on auto'} onClick={() => setTopic('')}>
                ✦ اقترح موضوعا
              </button>
              {TOPICS.map((t) => (
                <button type="button" key={t} className={topic === t ? 'chip on' : 'chip'} onClick={() => setTopic(t)}>
                  {t}
                </button>
              ))}
            </div>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="أو اكتب موضوعا" />
          </div>

          <div className="field">
            <span>عمر الأطفال</span>
            <div className="chips">
              {AGES.map((a) => (
                <button type="button" key={a.value} className={age === a.value ? 'chip on' : 'chip'} onClick={() => setAge(a.value)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>اللغة</span>
            <div className="chips">
              {(Object.keys(LANGUAGES) as Language[]).map((l) => (
                <button
                  type="button"
                  key={l}
                  className={language === l ? 'chip on' : 'chip'}
                  onClick={() => {
                    setLanguage(l)
                    setDialect(null)
                  }}
                >
                  {LANGUAGES[l]}
                </button>
              ))}
            </div>
          </div>
          <ChoiceField
            key={language}
            label="اللهجة"
            auto="تلقائي"
            options={DIALECTS[language].map((d) => ({ label: d, value: d }))}
            value={dialect}
            onChange={setDialect}
          />

          <div className="field">
            <span>الشخصيات</span>
            <div className="chips">
              <button type="button" className={ownCharacters ? 'chip auto' : 'chip on auto'} onClick={() => setOwnCharacters(false)}>
                ✦ اقترح الشخصيات
              </button>
              <button type="button" className={ownCharacters ? 'chip on' : 'chip'} onClick={() => setOwnCharacters(true)}>
                شخصياتي الثابتة
              </button>
            </div>
            {ownCharacters && (
              <>
                {characters.map((c, i) => (
                  <div className="row" key={i}>
                    <input
                      style={{ flex: 1 }}
                      value={c.name}
                      placeholder="الاسم"
                      onChange={(e) => setCharacters(characters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      style={{ flex: 3 }}
                      value={c.trait}
                      placeholder="من هو وما طبعه؟ مثال: ولد عمره 8 سنوات، فضولي ويسأل كثيرا"
                      onChange={(e) => setCharacters(characters.map((x, j) => (j === i ? { ...x, trait: e.target.value } : x)))}
                    />
                  </div>
                ))}
                {characters.length < 4 && (
                  <button type="button" onClick={() => setCharacters([...characters, { name: '', trait: '' }])}>
                    أضف شخصية
                  </button>
                )}
                <small className="muted">استعمل الشخصيات نفسها في كل قصة لتصنع سلسلة.</small>
              </>
            )}
          </div>

          <ChoiceField
            label="مدة القصة"
            auto="تلقائي حسب العمر"
            options={DURATIONS}
            value={duration}
            onChange={setDuration}
            type="number"
            min={60}
            max={600}
            customPlaceholder="بالثواني، من 60 إلى 600"
          />

          <button className="primary big" disabled={busy}>
            اكتب القصة
          </button>
        </form>
      )}

      {story && (
        <div className="script">
          <section className="card">
            <div className="badges">
              <span className="badge">{story.request.age_band} سنة</span>
              <span className="badge">{LANGUAGES[story.request.language]}</span>
              <span className="badge">{Math.round(story.duration_seconds / 60)} دقائق</span>
              {story.approved ? <span className="badge ok">معتمد</span> : <span className="badge warn">غير معتمد</span>}
            </div>
            <h2 dir="auto">{story.title}</h2>
            <p className="hook" dir="auto">
              {story.moral}
            </p>
            <div className="badges">
              {story.characters.map((c) => (
                <span className="badge info" key={c.name} title={`${c.trait} ${c.catchphrase}`}>
                  {c.name} · {c.age}
                </span>
              ))}
            </div>
            {story.warnings.length > 0 && (
              <div className="notice warn">
                <strong>تنبيهات آلية</strong>
                <ul>
                  {story.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <ol className="scenes" dir={story.request.language === 'en' ? 'ltr' : 'rtl'}>
              {story.scenes.map((s, i) => (
                <li key={i}>
                  <div className="time">
                    {s.start_second}-{s.end_second} ث
                  </div>
                  <div className="scene-body">
                    <p className="muted small">
                      <span className="tag">المشهد</span> {s.setting}
                    </p>
                    {s.narration && <p className="voice">{s.narration}</p>}
                    {s.dialogue.map((d, j) => (
                      <p key={j}>
                        <strong>{d.speaker}:</strong> {d.line}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h3>المصادر</h3>
            {story.references.length === 0 && <p className="muted">هذه القصة لا تقتبس نصا شرعيا.</p>}
            {story.references.map((r) => (
              <div className="reference" key={r.evidence_id}>
                <div className="badges">
                  <span className="badge ok">موثّق</span>
                  <span className="badge">{r.usage === 'quoted' ? 'اقتباس حرفي' : 'بالمعنى'}</span>
                  <strong>{r.source}</strong>
                </div>
                <p className="scripture" dir="rtl">
                  {r.translation_source ? r.arabic : r.text}
                </p>
              </div>
            ))}
            {story.unverified.map((u) => (
              <p key={u} className="small">
                <span className="badge bad">غير موثّق</span> {u}
              </p>
            ))}
          </section>

          <section className="card">
            <h3>للأهل والمربين</h3>
            <p dir="auto">
              <span className="tag">سؤال بعد المشاهدة</span> {story.closing_question}
            </p>
            <p className="muted" dir="auto">
              {story.parent_note}
            </p>
            <h4>إعلان قصير للأهل (20-30 ثانية)</h4>
            <p className="hook" dir="auto">
              {story.teaser.hook}
            </p>
            <p dir="auto">{story.teaser.voiceover}</p>
            <p className="muted small" dir="auto">
              {story.teaser.caption}
            </p>
          </section>

          <section className="card">
            <h3>اعتماد المربي</h3>
            <p className="muted">كل قصة للأطفال يعتمدها مربٍّ أو ولي أمر باسمه قبل تصديرها.</p>
            {story.approval ? (
              <p className="notice ok">
                {ROLES[story.approval.role]}: {story.approval.name} · {new Date(story.approval.at).toLocaleString('ar')}
              </p>
            ) : (
              <form
                className="row approve"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(() => kidsApi.approve(story.id, role, name.trim()))
                }}
              >
                <label className="field">
                  <span>بصفة</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as GuardianRole)}>
                    {(Object.keys(ROLES) as GuardianRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLES[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>اسم المعتمِد</span>
                  <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <button className="primary" disabled={busy}>
                  أعتمد هذه القصة
                </button>
              </form>
            )}
            <div className="actions">
              <button disabled={!story.approved} onClick={() => download(story)} title="يتاح بعد الاعتماد">
                صدّر Markdown
              </button>
              <button onClick={reuseCharacters}>قصة جديدة بالشخصيات نفسها</button>
              <button
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY)
                  setStory(null)
                }}
              >
                قصة جديدة
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
