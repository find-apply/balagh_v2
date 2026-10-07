import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { aspectOf, CLAIMS, KNOWLEDGE, LANGUAGES, LEVELS, PLATFORMS, REVIEWERS, ROLES, toMarkdown } from '../labels'
import type { AudienceSpec, LocalizeRequest, ReviewRole, Script, Video, VideoTemplate } from '../types'
import { api, BASE } from '../api'
import { reviewHash } from '../route'
import { GROUPS } from '../audiences'
import { AudienceFields } from './AudienceFields'
import { StoryView } from './StoryView'
import { TemplatePicker } from './TemplatePicker'
import { VideoPanel } from './VideoPanel'
import { VideoChecks } from './VideoChecks'

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
  /** The part shown; the workspace's stepper selects it. */
  tab: Tab
  onTab: (tab: Tab) => void
  actions?: ScriptActions
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

/** The script page shows one part at a time, chosen from the workspace's stepper; after the ideas, one long
 * page was too much to scroll. The posts live with the video they accompany. */
export type Tab = 'script' | 'template' | 'review' | 'approve' | 'video'

export function Scenes({ script }: { script: Script }) {
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

/** The newest finished preview of this version, for the reviewer to watch before signing. */
function PreviewForReview({ projectId, script, onGo }: { projectId: string; script: Script; onGo?: (part: 'video') => void }) {
  const [video, setVideo] = useState<Video | null | undefined>(undefined)
  useEffect(() => {
    api.videos(projectId, script.id).then(
      (vs) => setVideo(vs.find((v) => v.status === 'done') ?? null),
      () => setVideo(null),
    )
  }, [projectId, script.id])
  if (video === undefined) return null
  if (video === null)
    return (
      <div className="notice">
        <strong>لا معاينة لهذه النسخة بعد.</strong>
        <p className="small">
          أنشئ فيديو معاينة بعلامة مائية ليشاهده المراجع قبل أن يوقّع.{' '}
          {onGo && (
            <a href="#s-video" onClick={(e) => { e.preventDefault(); onGo('video') }}>
              إلى تبويب الفيديو ←
            </a>
          )}
        </p>
      </div>
    )
  return (
    <div className="review-preview">
      <div className="badges">
        <span className={video.preview ? 'badge warn' : 'badge ok'}>{video.preview ? 'فيديو المعاينة · بعلامة مائية' : 'الفيديو النهائي'}</span>
        <span className="badge">{Math.round(video.duration_seconds ?? 0)} ث</span>
      </div>
      <video controls preload="metadata" src={BASE + video.url} className="player" poster={video.frames[0] ? BASE + video.frames[0] : undefined} />
      <VideoChecks video={video} compact />
    </div>
  )
}

function Approvals({ projectId, script, disabled, onApprove, onGo }: { projectId: string; script: Script; disabled: boolean; onApprove?: Handlers['onApprove']; onGo?: (part: 'video') => void }) {
  const pending = script.required_approvals.filter((r) => !script.approvals.some((a) => a.role === r.role))
  const [name, setName] = useState('')
  const [role, setRole] = useState<ReviewRole | null>(null)
  const [copied, setCopied] = useState(false)
  const chosen = pending.some((r) => r.role === role) ? role : (pending[0]?.role ?? null)
  const editable = Boolean(onApprove)

  return (
    <section className="card" id="s-approve">
      <h3>الاعتماد البشري</h3>
      <p className="muted">
        {script.author === 'specialist'
          ? 'صاحب المحتوى مختص شرعي: يراجع نسخته بنفسه ويعتمدها، ويستطيع أن يرسل رابط المراجعة لغيره إن أراد رأيا ثانيا. التصدير والفيديو النهائي بعد توقيعه.'
          : 'صاحب المحتوى غير مختص: كل نسخة يراجعها مختص شرعي قبل النشر، عبر رابط المراجعة. لا يُفتح الفيديو النهائي والتصدير قبل اكتمال التوقيعات.'}
      </p>
      <PreviewForReview projectId={projectId} script={script} onGo={onGo} />
      {script.approved && (
        <div className="notice ok">
          <strong>اكتمل الاعتماد.</strong>
          <p className="small">
            الخطوة التالية: الفيديو النهائي بلا علامة مائية.{' '}
            {onGo && (
              <a href="#s-video" onClick={(e) => { e.preventDefault(); onGo('video') }}>
                أنشئ الفيديو النهائي ←
              </a>
            )}
          </p>
        </div>
      )}
      {!script.approved && script.approvals.length > 0 && script.change_requests.length === 0 && (
        <div className="notice">
          <strong>سُجّل توقيع {script.approvals.map((a) => ROLES[a.role]).join(' و')}.</strong>
          <p className="small">بانتظار: {pending.map((r) => ROLES[r.role]).join('، ')}. أرسل لهم رابط صفحة المراجع أدناه.</p>
        </div>
      )}
      {script.change_requests.length > 0 && (
        <div className="notice bad">
          <strong>طلب تعديل: هذه النسخة لا تُعتمد. صحّحها في نسخة جديدة ثم يراجعها من جديد.</strong>
          <ul>
            {script.change_requests.map((c) => (
              <li key={c.role} dir="auto">
                <b>{ROLES[c.role]} · {c.name}:</b> {c.note}
              </li>
            ))}
          </ul>
        </div>
      )}
      {script.author === 'specialist' && !script.approved && (
        <div className={`notice${script.review?.blocking || script.warnings.length ? ' bad' : ''}`}>
          <strong>قبل توقيعك: ما وجدته المراجعة الآلية.</strong>
          <p className="small">
            {!script.review
              ? 'لم تُجرَ المراجعة الآلية على هذه النسخة بعد. لا تلزمك، لكنها تدلّك على مواضع النظر.'
              : script.review.blocking
                ? `${script.review.blocking} ملاحظة مانعة لم تُصحَّح. أنت من يقرر: صحّح في نسخة جديدة، أو اعتمد النسخة كما هي وهي مسؤوليتك.`
                : 'لا ملاحظات مانعة.'}
            {script.warnings.length > 0 && ` تنبيه آلي: ${script.warnings.length === 1 ? 'مشهد يذكر' : `${script.warnings.length} مشاهد تذكر`} نصا شرعيا دون دليل موثق مرتبط به.`}
          </p>
        </div>
      )}
      <ul className="approvals">
        {script.required_approvals.map((r) => {
          const done = script.approvals.find((a) => a.role === r.role)
          return (
            <li key={r.role} className={done ? 'done' : ''}>
              <div className="badges">
                <span className={done ? 'badge ok' : 'badge warn'}>{done ? 'معتمد' : 'بانتظار الاعتماد'}</span>
                <strong>{r.role === 'creator' && script.author === 'specialist' ? 'مختص شرعي' : ROLES[r.role]}</strong>
                {r.role === 'creator' && script.author === 'specialist' && <span className="badge info">مراجعة ذاتية</span>}
              </div>
              <p className="muted small">{r.reason}</p>
              {done && (
                <p className="small">
                  {done.name} · <span dir="ltr">{new Date(done.at).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {done.note && <span className="muted"> · {done.note}</span>}
                </p>
              )}
              {!done && r.role !== 'creator' && editable && (
                <button
                  type="button"
                  className="small-button"
                  onClick={() => navigator.clipboard.writeText(`${location.origin}${location.pathname}${reviewHash(projectId, script.id, r.role)}`).then(() => setCopied(true))}
                >
                  {copied ? 'نُسخ' : `انسخ رابط صفحة ${ROLES[r.role]}`}
                </button>
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
                  {r.role === 'creator' && script.author === 'specialist' ? 'مختص شرعي (مراجعة ذاتية)' : ROLES[r.role]}
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
        <button disabled={!script.approved} onClick={() => download(script)} title="يتاح بعد اكتمال الاعتماد">
          صدّر Markdown
        </button>
        {!script.approved && <span className="muted small">التصدير يُفتح بعد اكتمال الاعتماد.</span>}
      </div>
      )}
    </section>
  )
}

export function ScriptView({ projectId, script, source, templates, disabled, tab, onTab, actions }: Props) {
  const [notes, setNotes] = useState('')
  const [showLocalize, setShowLocalize] = useState(false)
  const [compare, setCompare] = useState(false)
  const setTab = onTab
  const review = script.review
  // One quiet line instead of a row of badges: the language is in the project header, the version in its
  // list when there are several, and the approval state in the stepper and the next-step card.
  const meta = [
    script.target.dialect ?? LANGUAGES[script.target.language],
    script.target.tone,
    KNOWLEDGE[script.target.audience_knowledge],
    `مستوى ${LEVELS[script.content_level]}`,
    `${script.duration_seconds} ث`,
    script.localized_from ? 'موطَّن' : null,
  ].filter(Boolean)
  const canRevise = Boolean(notes.trim()) || (review?.blocking ?? 0) > 0

  return (
    <div className="script" id="script-top">
      <div className="script-head">
        <h2 dir="auto">{script.title}</h2>
        <p className="muted small" dir="auto">
          {script.target.audience} · {meta.join(' · ')}
        </p>
      </div>

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

      <details className="card sources" id="s-sources" open={script.references.length <= 1}>
        <summary>
          <h3>المصادر ({script.references.length})</h3>
          <span className="muted small">النص الحرفي من المصحف والصحيحين، مع التفسير أو الشرح المعتمد</span>
        </summary>
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
      </details>

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
          aspect={aspectOf(script.platforms)}
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
        <Approvals
          projectId={projectId}
          script={script}
          disabled={disabled}
          onApprove={actions?.onApprove}
          onGo={setTab}
        />
      </div>

      <div id="s-video" hidden={tab !== 'video'}>
        <VideoPanel
          projectId={projectId}
          script={script}
          template={templates?.find((t) => t.id === script.template) ?? null}
          templates={templates}
          disabled={disabled || !actions}
          onGo={setTab}
        />
      <section className="card" id="s-posts">
        <h3>نص المنشور المرافق</h3>
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
