import { useState } from 'react'
import type { FormEvent, MouseEvent, ReactNode } from 'react'
import { CLAIMS, KNOWLEDGE, LANGUAGES, LEVELS, PLATFORMS, REVIEWERS, ROLES, toMarkdown } from '../labels'
import type { AudienceSpec, LocalizeRequest, ReviewRole, Script, VideoTemplate } from '../types'
import { GROUPS } from '../audiences'
import { AudienceFields } from './AudienceFields'
import { StoryView } from './StoryView'
import { TemplatePicker } from './TemplatePicker'
import { VideoPanel } from './VideoPanel'

/** What a reader can do to a script. Leaving `actions` out shows the script read-only, as the admin does. */
export interface ScriptActions {
  onReview: () => void
  onRevise: (notes: string | null) => void
  onLocalize: (body: LocalizeRequest) => void
  onApprove: (role: ReviewRole, name: string) => void
  onTemplate: (template: VideoTemplate) => void
  onStory: (notes: string | null) => void
}

interface Props {
  projectId: string
  script: Script
  source: Script | null
  templates: VideoTemplate[] | null
  disabled: boolean
  actions?: ScriptActions
  shareUrl: string
}

type Handlers = Pick<ScriptActions, 'onReview' | 'onLocalize' | 'onApprove'>

function download(script: Script) {
  const url = URL.createObjectURL(new Blob([toMarkdown(script)], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${script.title}.md`
  a.click()
  URL.revokeObjectURL(url)
}

/** The script page shows one part at a time; after the ideas, one long page was too much to scroll. */
type Tab = 'script' | 'template' | 'review' | 'approve' | 'video' | 'posts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'script', label: 'السيناريو والمصادر' },
  { id: 'template', label: 'القالب والقصة' },
  { id: 'review', label: 'المراجعة' },
  { id: 'approve', label: 'الاعتماد' },
  { id: 'video', label: 'الفيديو' },
  { id: 'posts', label: 'المنشورات' },
]

/** A tab link inside the page: switches the part shown and scrolls back to the top of the script. */
function TabLink({ to, go, className, children }: { to: Tab; go: (t: Tab) => void; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    go(to)
    document.getElementById('script-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <a className={className} href={`#s-${to}`} onClick={onClick}>
      {children}
    </a>
  )
}

function Scenes({ script }: { script: Script }) {
  return (
    <ol className="scenes" dir={script.target.language === 'en' ? 'ltr' : 'rtl'}>
      {script.scenes.map((s, i) => (
        <li key={i}>
          <div className="time">
            {s.start_second}-{s.end_second} ث
          </div>
          <div className="scene-body">
            {s.voiceover && (
              <p className="voice">
                {s.voiceover}
              </p>
            )}
            {s.on_screen_text && (
              <p className="onscreen">
                <span className="tag">على الشاشة</span> {s.on_screen_text}
              </p>
            )}
            <p className="muted small">
              <span className="tag">الصورة</span> {s.visual}
            </p>
            {s.evidence_ids.length > 0 && (
              <div className="badges">
                {s.evidence_ids.map((id) => (
                  <span className="badge ok" key={id}>
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function LocalizeForm({ script, disabled, onLocalize }: { script: Script; disabled: boolean; onLocalize: Handlers['onLocalize'] }) {
  const [target, setTarget] = useState<AudienceSpec>({
    audience: GROUPS[4].label,
    language: script.target.language === 'ar' ? 'en' : 'ar',
    dialect: null,
    audience_knowledge: GROUPS[4].knowledge,
    tone: null,
  })
  const [notes, setNotes] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onLocalize({ ...target, platforms: null, duration_seconds: null, notes: notes.trim() || null })
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h4>توطين لجمهور آخر</h4>
      <p className="muted small">يتغير أسلوب الشرح والأمثلة. المعنى والنصوص الشرعية لا تتغير.</p>
      <AudienceFields value={target} onChange={setTarget} />
      <label className="field">
        <span>ملاحظات (اختياري)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button className="primary" disabled={disabled}>
        وطّن السيناريو
      </button>
    </form>
  )
}

function Approvals({ script, disabled, onApprove, shareUrl }: { script: Script; disabled: boolean; onApprove?: Handlers['onApprove']; shareUrl: string }) {
  const pending = script.required_approvals.filter((r) => !script.approvals.some((a) => a.role === r.role))
  const [name, setName] = useState('')
  const [role, setRole] = useState<ReviewRole | null>(null)
  const [copied, setCopied] = useState(false)
  const chosen = pending.some((r) => r.role === role) ? role : (pending[0]?.role ?? null)
  const others = pending.some((r) => r.role !== 'creator')
  const editable = Boolean(onApprove)

  return (
    <section className="card" id="s-approve">
      <h3>الاعتماد البشري</h3>
      <p className="muted">
        المراجعة على قدر الخطر: يحدد بلاغ من يلزم اعتماده لهذه النسخة، ولا يُفتح التصدير قبل اكتماله.
      </p>
      <ul className="approvals">
        {script.required_approvals.map((r) => {
          const done = script.approvals.find((a) => a.role === r.role)
          return (
            <li key={r.role} className={done ? 'done' : ''}>
              <div className="badges">
                <span className={done ? 'badge ok' : 'badge warn'}>{done ? 'معتمد' : 'بانتظار الاعتماد'}</span>
                <strong>{ROLES[r.role]}</strong>
              </div>
              <p className="muted small">{r.reason}</p>
              {done && (
                <p className="small">
                  {done.name} · <span dir="ltr">{new Date(done.at).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {editable && chosen && (
        <form
          className="row approve"
          onSubmit={(e) => {
            e.preventDefault()
            onApprove?.(chosen, name.trim())
          }}
        >
          <label className="field">
            <span>بصفة</span>
            <select value={chosen} onChange={(e) => setRole(e.target.value as ReviewRole)}>
              {pending.map((r) => (
                <option key={r.role} value={r.role}>
                  {ROLES[r.role]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>اسم المعتمِد</span>
            <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" />
          </label>
          <button className="primary" disabled={disabled}>
            أعتمد هذه النسخة
          </button>
        </form>
      )}
      {editable && (
      <div className="actions">
        {others && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl).then(() => setCopied(true))
            }}
          >
            {copied ? 'نُسخ الرابط' : 'انسخ رابط المراجعة للمراجع'}
          </button>
        )}
        <button disabled={!script.approved} onClick={() => download(script)} title="يتاح بعد اكتمال الاعتماد">
          صدّر Markdown
        </button>
      </div>
      )}
    </section>
  )
}

/** The one action that moves this version forward, so the flow never stalls on a long page. */
function NextStep({ script, disabled, onReview, go }: { script: Script; disabled: boolean; onReview: Handlers['onReview']; go: (t: Tab) => void }) {
  const blocking = script.review?.blocking ?? 0
  if (!script.review)
    return (
      <div className="next">
        <div>
          <strong>الخطوة التالية: المراجعة الآلية</strong>
          <p className="muted small">ثلاثة مراجعين يفحصون السيناريو: علمي، وجمهور، ومعنى.</p>
        </div>
        <button className="primary" disabled={disabled} onClick={onReview}>
          راجع آليا
        </button>
      </div>
    )
  if (blocking > 0)
    return (
      <div className="next bad">
        <div>
          <strong>{blocking} ملاحظة مانعة</strong>
          <p className="small">صحّحها في نسخة جديدة قبل الاعتماد.</p>
        </div>
        <TabLink to="review" go={go} className="button">
          اعرض الملاحظات
        </TabLink>
      </div>
    )
  if (!script.approved)
    return (
      <div className="next">
        <div>
          <strong>الخطوة التالية: الاعتماد البشري</strong>
          <p className="muted small">لا يُفتح التصدير قبل أن يوقّع كل من تتطلبه هذه النسخة.</p>
        </div>
        <TabLink to="approve" go={go} className="button primary">
          اذهب إلى الاعتماد
        </TabLink>
      </div>
    )
  if (!script.template)
    return (
      <div className="next ok">
        <div>
          <strong>النسخة معتمدة. الخطوة التالية: قالب الفيديو</strong>
          <p className="small">اختر من المكتبة القالب الذي يُحوَّل به السيناريو إلى فيديو، أو صدّر النص.</p>
        </div>
        <TabLink to="template" go={go} className="button primary">
          اختر قالبا
        </TabLink>
      </div>
    )
  return (
    <div className="next ok">
      <div>
        <strong>النسخة معتمدة وجاهزة للفيديو</strong>
        <p className="small">أنشئ الفيديو بالقالب المختار، أو صدّر النص، أو وطّنه لجمهور آخر.</p>
      </div>
      <TabLink to="video" go={go} className="button primary">
        أنشئ الفيديو
      </TabLink>
    </div>
  )
}

export function ScriptView({ projectId, script, source, templates, disabled, actions, shareUrl }: Props) {
  const [notes, setNotes] = useState('')
  const [showLocalize, setShowLocalize] = useState(false)
  const [compare, setCompare] = useState(false)
  const [tab, setTab] = useState<Tab>('script')
  const review = script.review
  const canRevise = Boolean(notes.trim()) || (review?.blocking ?? 0) > 0

  return (
    <div className="script" id="script-top">
      <div className="script-head">
        <div className="badges">
          <span className="badge">{LANGUAGES[script.target.language]}</span>
          {script.target.dialect && <span className="badge">{script.target.dialect}</span>}
          {script.target.tone && <span className="badge">{script.target.tone}</span>}
          <span className="badge">{KNOWLEDGE[script.target.audience_knowledge]}</span>
          <span className={`badge level-${script.content_level}`}>{LEVELS[script.content_level]}</span>
          <span className="badge">{script.duration_seconds} ث</span>
          <span className="badge">نسخة {script.version}</span>
          {script.localized_from && <span className="badge info">موطَّن</span>}
          {script.approved ? <span className="badge ok">معتمد</span> : <span className="badge warn">غير معتمد</span>}
        </div>
        <h2 dir="auto">{script.title}</h2>
        <p className="muted" dir="auto">
          الجمهور: {script.target.audience}
        </p>
        <nav className="jump" aria-label="أجزاء السيناريو">
          {TABS.map((t) => (
            <TabLink key={t.id} to={t.id} go={setTab} className={tab === t.id ? 'on' : undefined}>
              {t.label}
              {t.id === 'script' && ` (${script.references.length})`}
            </TabLink>
          ))}
        </nav>
      </div>

      {actions && <NextStep script={script} disabled={disabled} onReview={actions.onReview} go={setTab} />}

      <div hidden={tab !== 'script'}>
      <section className="card" id="s-script">
        <h3>السيناريو</h3>
        {script.warnings.length > 0 && (
          <div className="notice warn">
            <strong>تنبيهات آلية</strong>
            <ul>
              {script.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {script.review_note && (
          <div className="notice">
            <strong>للمراجع:</strong>
            <p dir="auto">{script.review_note}</p>
          </div>
        )}

        {source && (
          <label className="toggle">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> قارن مع الأصل
          </label>
        )}
        {compare && source ? (
          <div className="compare">
            <div>
              <h4>الأصل · {LANGUAGES[source.target.language]}</h4>
              <Scenes script={source} />
            </div>
            <div>
              <h4>الموطَّن · {LANGUAGES[script.target.language]}</h4>
              <Scenes script={script} />
            </div>
          </div>
        ) : (
          <Scenes script={script} />
        )}

        <p dir="auto">
          <span className="tag">الدعوة إلى الفعل</span> {script.call_to_action}
        </p>
        <p className="muted small" dir="auto">
          <span className="tag">الصوت</span> {script.audio}
        </p>
      </section>

      <section className="card" id="s-sources">
        <h3>المصادر</h3>
        {script.unverified_claims.length > 0 && (
          <div className="notice warn">
            <strong>وقائع لم يُتحقق منها</strong>
            <p className="small">
              وقائع من السيرة أو التاريخ ذكرها السيناريو وليست في المصادر التي يفحصها النظام. يتحقق منها المراجع البشري.
            </p>
            <ul>
              {script.unverified_claims.map((c) => (
                <li key={c} dir="auto">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {script.references.length === 0 && <p className="muted">هذا السيناريو لا يقتبس نصا شرعيا.</p>}
        {script.references.map((r) => (
          <div className="reference" key={r.evidence_id}>
            <div className="badges">
              <span className="badge ok">{r.evidence_id}</span>
              <span className="badge">{r.usage === 'quoted' ? 'اقتباس حرفي' : 'بالمعنى'}</span>
              <strong>{r.source}</strong>
            </div>
            <p className="scripture" dir="rtl">
              {r.translation_source ? r.arabic : r.text}
            </p>
            {r.translation_source && (
              <p className="translation" dir="ltr">
                {r.text}
                <small>{r.translation_source}</small>
              </p>
            )}
            {r.sharh && (
              <details className="tafsir">
                <summary>
                  <span className="badge">شرح</span> {r.sharh.source}
                  <span className="badge ok">{r.sharh.grade}</span>
                  <span className="badge">{r.sharh.attribution}</span>
                </summary>
                <p dir="rtl">{r.sharh.text}</p>
                <small className="muted">
                  شرح السيناريو لهذا الحديث يجب أن يتبع هذا الشرح. الشرح كلام الشارح، لا لفظ الحديث.
                </small>
              </details>
            )}
            {r.tafsir.map((t) => (
              <details className="tafsir" key={t.source}>
                <summary>
                  <span className="badge">تفسير</span> {t.source}
                </summary>
                <p dir="rtl">{t.text}</p>
                <small className="muted">
                  شرح السيناريو لهذه الآية يجب أن يتبع هذا التفسير. التفسير كلام المفسّر، لا نص القرآن.
                </small>
              </details>
            ))}
          </div>
        ))}
      </section>

      {script.localized_from && (
        <section className="card">
          <h3>ما الذي تغيّر في التوطين</h3>
          <ul className="notes">
            {script.adaptation_notes.map((n, i) => (
              <li key={i} dir="auto">
                <strong>{n.change}</strong>
                <span className="muted">{n.reason}</span>
              </li>
            ))}
          </ul>
          {script.terminology.length > 0 && (
            <>
              <h4>المصطلحات المعتمدة</h4>
              <table>
                <tbody>
                  {script.terminology.map((t) => (
                    <tr key={t.term_ar}>
                      <td>{t.term_ar}</td>
                      <td dir="ltr">{t.approved_en}</td>
                      <td>
                        <span className={t.status === 'used' ? 'badge ok' : 'badge warn'}>
                          {t.status === 'used' ? 'مستعمل' : 'غير موجود'}
                        </span>
                      </td>
                      <td className="muted small">{t.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
      </div>

      <div id="s-template" hidden={tab !== 'template'}>
        <TemplatePicker
          templates={templates}
          chosen={script.template}
          disabled={disabled || !actions}
          onPick={(t) => actions?.onTemplate(t)}
        />
        <StoryView script={script} disabled={disabled || !actions} onRewrite={(notes) => actions?.onStory(notes)} />
      </div>

      <div hidden={tab !== 'review'}>
      <section className="card" id="s-review">
        <h3>المراجعة</h3>
        {!review && <p className="muted">لم تُراجَع هذه النسخة بعد.</p>}
        {review && (
          <>
            <p className={review.blocking ? 'notice bad' : 'notice ok'}>
              {review.blocking
                ? `${review.blocking} ملاحظة مانعة يجب تصحيحها قبل النشر.`
                : 'لا توجد ملاحظات مانعة.'}{' '}
              <span className="muted small">{review.note}</span>
            </p>
            <ul className="findings">
              {review.findings.map((f, i) => (
                <li key={i} className={f.severity}>
                  <div className="badges">
                    <span className={f.severity === 'blocking' ? 'badge bad' : 'badge'}>
                      {f.severity === 'blocking' ? 'مانعة' : 'اقتراح'}
                    </span>
                    <span className="badge">{REVIEWERS[f.reviewer]}</span>
                    {f.scene > 0 && <span className="badge">المشهد {f.scene}</span>}
                  </div>
                  <p>{f.issue}</p>
                  <p className="muted">التصحيح: {f.fix}</p>
                </li>
              ))}
            </ul>
            {review.claims.length > 0 && (
              <>
                <h4>
                  حفظ المعنى: {review.claims.filter((c) => c.status === 'preserved').length} من{' '}
                  {review.claims.filter((c) => c.status !== 'added').length} ادعاء محفوظ
                </h4>
                <table>
                  <tbody>
                    {review.claims.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`badge claim-${c.status}`}>{CLAIMS[c.status]}</span>
                        </td>
                        <td>
                          {c.claim}
                          {c.note && <div className="muted small">{c.note}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
        {actions && (
          <>
        <label className="field">
          <span>ملاحظات المراجع البشري (اختياري)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="actions">
          <button disabled={disabled} onClick={actions!.onReview}>
            {review ? 'أعد المراجعة الآلية' : 'راجع آليا'}
          </button>
          <button
            disabled={disabled || !canRevise}
            onClick={() => {
              actions!.onRevise(notes.trim() || null)
              setNotes('')
            }}
          >
            صحّح في نسخة جديدة
          </button>
          <button disabled={disabled} onClick={() => setShowLocalize((v) => !v)}>
            وطّن لجمهور آخر
          </button>
        </div>
        {showLocalize && <LocalizeForm script={script} disabled={disabled} onLocalize={actions!.onLocalize} />}
          </>
        )}
      </section>
      </div>

      <div hidden={tab !== 'approve'}>
        <Approvals script={script} disabled={disabled} onApprove={actions?.onApprove} shareUrl={shareUrl} />
      </div>

      <div id="s-video" hidden={tab !== 'video'}>
        <VideoPanel
          projectId={projectId}
          script={script}
          template={templates?.find((t) => t.id === script.template) ?? null}
          templates={templates}
          disabled={disabled || !actions}
        />
      </div>

      <div hidden={tab !== 'posts'}>
      <section className="card" id="s-posts">
        <h3>المنشورات</h3>
        {script.posts.map((p) => (
          <div className="post" key={p.platform}>
            <strong>{PLATFORMS[p.platform]}</strong>
            <p dir="auto">{p.caption}</p>
            <p className="muted small" dir="auto">
              {p.hashtags.join(' ')}
            </p>
          </div>
        ))}
      </section>
      </div>
    </div>
  )
}
