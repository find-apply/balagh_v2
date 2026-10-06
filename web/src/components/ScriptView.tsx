import { useState } from 'react'
import type { FormEvent } from 'react'
import { CLAIMS, KNOWLEDGE, LANGUAGES, LEVELS, PLATFORMS, REVIEWERS, ROLES, toMarkdown } from '../labels'
import type { AudienceSpec, LocalizeRequest, ReviewRole, Script, VideoTemplate } from '../types'
import { GROUPS } from '../audiences'
import { AudienceFields } from './AudienceFields'
import { StoryView } from './StoryView'
import { TemplatePicker } from './TemplatePicker'
import { VideoPanel } from './VideoPanel'

interface Props {
  projectId: string
  script: Script
  source: Script | null
  templates: VideoTemplate[] | null
  disabled: boolean
  onReview: () => void
  onRevise: (notes: string | null) => void
  onLocalize: (body: LocalizeRequest) => void
  onTemplate: (template: VideoTemplate) => void
  onStory: (notes: string | null) => void
  onApprove: (role: ReviewRole, name: string) => void
  shareUrl: string
}

function download(script: Script) {
  const url = URL.createObjectURL(new Blob([toMarkdown(script)], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${script.title}.md`
  a.click()
  URL.revokeObjectURL(url)
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
            {s.art.keyword && (
              <p className="muted small">
                <span className="tag">رسم القالب</span> {[s.art.emoji, s.art.keyword, s.art.detail].filter(Boolean).join(' · ')}
              </p>
            )}
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

function LocalizeForm({ script, disabled, onLocalize }: Pick<Props, 'script' | 'disabled' | 'onLocalize'>) {
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

function Approvals({ script, disabled, onApprove, shareUrl }: Pick<Props, 'script' | 'disabled' | 'onApprove' | 'shareUrl'>) {
  const pending = script.required_approvals.filter((r) => !script.approvals.some((a) => a.role === r.role))
  const [name, setName] = useState('')
  const [role, setRole] = useState<ReviewRole | null>(null)
  const [copied, setCopied] = useState(false)
  const chosen = pending.some((r) => r.role === role) ? role : (pending[0]?.role ?? null)
  const others = pending.some((r) => r.role !== 'creator')

  return (
    <section className="card">
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
                  {done.name} · {new Date(done.at).toLocaleString('ar')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {chosen && (
        <form
          className="row approve"
          onSubmit={(e) => {
            e.preventDefault()
            onApprove(chosen, name.trim())
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
    </section>
  )
}

export function ScriptView({
  projectId, script, source, templates, disabled, onReview, onRevise, onLocalize, onTemplate, onStory, onApprove, shareUrl,
}: Props) {
  const template = templates?.find((t) => t.id === script.template) ?? null
  const [notes, setNotes] = useState('')
  const [showLocalize, setShowLocalize] = useState(false)
  const [compare, setCompare] = useState(false)
  const review = script.review
  const canRevise = Boolean(notes.trim()) || (review?.blocking ?? 0) > 0

  return (
    <div className="script">
      <section className="card">
        <div className="badges">
          <span className="badge">{LANGUAGES[script.target.language]}</span>
          {script.target.dialect && <span className="badge">{script.target.dialect}</span>}
          {script.target.tone && <span className="badge">{script.target.tone}</span>}
          <span className="badge">{KNOWLEDGE[script.target.audience_knowledge]}</span>
          <span className={`badge level-${script.content_level}`}>{LEVELS[script.content_level]}</span>
          <span className="badge">{script.duration_seconds} ث</span>
          <span className="badge">نسخة {script.version}</span>
          {template && <span className="badge info">قالب: {template.name}</span>}
          {script.localized_from && <span className="badge info">موطَّن</span>}
          {script.approved ? <span className="badge ok">معتمد</span> : <span className="badge warn">غير معتمد</span>}
        </div>
        <h2 dir="auto">{script.title}</h2>
        <p className="muted" dir="auto">
          الجمهور: {script.target.audience}
        </p>

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

      <section className="card">
        <h3>المصادر</h3>
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

      <section className="card">
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
        <label className="field">
          <span>ملاحظات المراجع البشري (اختياري)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="actions">
          <button disabled={disabled} onClick={onReview}>
            {review ? 'أعد المراجعة الآلية' : 'راجع آليا'}
          </button>
          <button
            disabled={disabled || !canRevise}
            onClick={() => {
              onRevise(notes.trim() || null)
              setNotes('')
            }}
          >
            صحّح في نسخة جديدة
          </button>
          <button disabled={disabled} onClick={() => setShowLocalize((v) => !v)}>
            وطّن لجمهور آخر
          </button>
        </div>
        {showLocalize && <LocalizeForm script={script} disabled={disabled} onLocalize={onLocalize} />}
      </section>

      <StoryView script={script} disabled={disabled} onRewrite={onStory} />

      <Approvals script={script} disabled={disabled} onApprove={onApprove} shareUrl={shareUrl} />

      <TemplatePicker templates={templates} chosen={script.template} disabled={disabled} onPick={onTemplate} />

      <VideoPanel projectId={projectId} script={script} template={template} disabled={disabled} />

      <section className="card">
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
  )
}
