import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api, ApiError, BASE } from '../api'
import { Logo } from './Landing'
import { Scenes } from './ScriptView'
import { VideoChecks } from './VideoChecks'
import { VideoFeedback } from './VideoFeedback'
import { StoryView } from './StoryView'
import { CLAIMS, KNOWLEDGE, LANGUAGES, LEVELS, REVIEWERS, ROLES } from '../labels'
import type { Project, ReviewRole, Script, Video } from '../types'

const ROLE_HELP: Record<ReviewRole, string> = {
  scholar: 'تفحص: هل النص الشرعي سليم ومنسوب صحيحا؟ هل الشرح موافق للتفسير أو شرح الحديث المرفق ولا يتجاوزه؟ هل فيه خلاف قُدّم على أنه قطعي، أو ما لا يليق؟',
  language: 'تفحص: هل اللغة طبيعية لهذا الجمهور؟ هل المصطلحات المعتمدة مستعملة؟ هل الأمثلة والخطاب يناسبان ثقافته دون أن يتغير المعنى؟',
  creator: 'أنت صاحب المحتوى: تتحمل مسؤولية ما يُنشر.',
}

/** One page for a reviewer who arrives from a link: the preview, the texts with their commentary, the script,
 * what the automatic review found, and one decision: approve or ask for changes. No workspace around it. */
export function ReviewPage({ projectId, scriptId, role: roleHint, invite }: { projectId: string; scriptId: string; role: string | null; invite: string | null }) {
  const [project, setProject] = useState<Project | null>(null)
  const [video, setVideo] = useState<Video | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // The fixed "to your decision" button goes away once the decision card itself is on screen.
  const [decisionSeen, setDecisionSeen] = useState(false)
  useEffect(() => {
    if (!project) return
    const card = document.getElementById('decision')
    if (!card || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setDecisionSeen(e.isIntersecting), { threshold: 0.15 })
    io.observe(card)
    return () => io.disconnect()
  }, [project])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'approved' | 'changes' | null>(null)

  useEffect(() => {
    api.getProject(projectId).then(setProject, (e) => setError(e instanceof ApiError && e.status === 404 ? 'هذا الرابط لا يشير إلى نسخة موجودة.' : String(e)))
    api.videos(projectId, scriptId).then((vs) => setVideo(vs.find((v) => v.status === 'done') ?? null), () => setVideo(null))
  }, [projectId, scriptId])

  const script: Script | undefined = project?.scripts[scriptId]
  if (error) return <Shell><div className="notice bad">{error}</div></Shell>
  if (!project || !script) return <Shell><p className="muted">يفتح النسخة…</p></Shell>

  const pending = script.required_approvals.filter((r) => !script.approvals.some((a) => a.role === r.role))
  const role: ReviewRole = (['scholar', 'language', 'creator'].includes(roleHint ?? '') ? roleHint : pending[0]?.role ?? 'scholar') as ReviewRole
  const already = script.approvals.find((a) => a.role === role)
  const requested = script.change_requests.find((c) => c.role === role)
  const source = script.localized_from ? (project.scripts[script.localized_from] ?? null) : null
  // Every role but the creator's signs only from an invitation link; without one the page is for reading.
  const canSign = role === 'creator' || !!invite

  const act = async (kind: 'approve' | 'changes', e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const updated = kind === 'approve'
        ? await api.approve(projectId, scriptId, role, name.trim(), note.trim() || undefined, invite)
        : await api.requestChanges(projectId, scriptId, role, name.trim(), note.trim(), invite)
      setProject({ ...project, scripts: { ...project.scripts, [scriptId]: updated } })
      setDone(kind === 'approve' ? 'approved' : 'changes')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <header className="rv-head">
        <span className="eyebrow">مراجعة نسخة · {ROLES[role]}</span>
        <h1 dir="auto">{script.title}</h1>
        <div className="badges">
          <span className="badge">{script.target.audience}</span>
          <span className="badge">{LANGUAGES[script.target.language]}</span>
          <span className="badge">{KNOWLEDGE[script.target.audience_knowledge]}</span>
          <span className={`badge level-${script.content_level}`}>{LEVELS[script.content_level]}</span>
          <span className="badge">نسخة {script.version}</span>
        </div>
        <p className="muted">{ROLE_HELP[role]}</p>
      </header>

      {done === 'approved' && (
        <div className="notice ok">
          <strong>شكرا، سُجّل اعتمادك باسمك.</strong>
          <p>{script.approved ? 'اكتملت الاعتمادات: يستطيع صانع المحتوى الآن إنشاء الفيديو النهائي بلا علامة مائية.' : 'ينتظر هذه النسخة توقيع أدوار أخرى، ثم يُنشأ الفيديو النهائي.'}</p>
        </div>
      )}
      {done === 'changes' && (
        <div className="notice warn">
          <strong>سُجّل طلب التعديل باسمك.</strong>
          <p>لن تُعتمد هذه النسخة. سيصحّحها صانع المحتوى في نسخة جديدة ويرسل لك رابطها.</p>
        </div>
      )}

      <section className="card">
        <h3>1. المعاينة</h3>
        {video === undefined && <p className="muted">يحمّل الفيديو…</p>}
        {video === null && <p className="muted">لا معاينة لهذه النسخة بعد؛ راجع النص أدناه، وسيُرسل لك الفيديو حين يجهز.</p>}
        {video && (
          <>
            <div className="badges">
              <span className={video.preview ? 'badge warn' : 'badge ok'}>{video.preview ? 'معاينة بعلامة مائية' : 'فيديو نهائي'}</span>
              <span className="badge">{Math.round(video.duration_seconds ?? 0)} ث</span>
            </div>
            <video controls preload="metadata" src={BASE + video.url} className="player rv-player" poster={video.frames[0] ? BASE + video.frames[0] : undefined} />
            <VideoChecks video={video} />
            <VideoFeedback videoId={video.id} />
          </>
        )}
      </section>

      <section className="card">
        <h3>2. النص الشرعي وشرحه المعتمد</h3>
        {script.references.length === 0 && <p className="muted">هذه النسخة لا تقتبس نصا شرعيا.</p>}
        {script.references.map((r) => (
          <div className="reference" key={r.evidence_id}>
            <div className="badges">
              <span className="badge">{r.usage === 'quoted' ? 'اقتباس حرفي' : 'بالمعنى'}</span>
              <strong>{r.source}</strong>
            </div>
            <p className="scripture" dir="rtl">{r.translation_source ? r.arabic : r.text}</p>
            {r.translation_source && (
              <p className="translation" dir="ltr">
                {r.text}
                <small>{r.translation_source}</small>
              </p>
            )}
            {r.sharh && (
              <div className="rv-commentary">
                <div className="badges">
                  <span className="badge">شرح</span> <span className="muted small">{r.sharh.source} · {r.sharh.grade}</span>
                </div>
                <p dir="rtl">{r.sharh.text}</p>
              </div>
            )}
            {r.tafsir.map((t) => (
              <div className="rv-commentary" key={t.source}>
                <div className="badges">
                  <span className="badge">تفسير</span> <span className="muted small">{t.source}</span>
                </div>
                <p dir="rtl">{t.text}</p>
              </div>
            ))}
          </div>
        ))}
        {script.unverified_claims.length > 0 && (
          <div className="notice warn">
            <strong>وقائع ذكرها النص ولم يُتحقق منها آليا</strong>
            <ul>
              {script.unverified_claims.map((c) => (
                <li key={c} dir="auto">{c}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h3>3. السيناريو</h3>
        <p className="hook" dir="auto">{script.hook}</p>
        <Scenes script={script} />
        <p dir="auto"><span className="tag">الدعوة إلى الفعل</span> {script.call_to_action}</p>
        {source && (
          <details className="rv-source">
            <summary>الأصل الذي وُطّنت منه هذه النسخة ({LANGUAGES[source.target.language]})</summary>
            <Scenes script={source} />
          </details>
        )}
      </section>

      {script.story && (
        <details className="card rv-fold">
          <summary><h3>4. قصة الأطفال</h3><span className="muted small">الحوار الذي يُسمع في الفيديو؛ النص الشرعي فيه من المرجع حرفيا</span></summary>
          <StoryView script={script} disabled onRewrite={() => {}} />
        </details>
      )}

      <details className="card rv-fold" open={(script.review?.blocking ?? 0) > 0}>
        <summary>
          <h3>{script.story ? '5' : '4'}. ما وجده المراجع الآلي</h3>
          <span className="muted small">
            {!script.review ? 'لم تُراجَع آليا بعد' : script.review.findings.length === 0 ? 'لا ملاحظات' : `${script.review.findings.length} ملاحظة، منها ${script.review.blocking} مانعة`}
          </span>
        </summary>
        {!script.review && <p className="muted">لم تُراجَع آليا بعد.</p>}
        {script.review && script.review.findings.length === 0 && script.review.claims.length === 0 && (
          <p className="notice ok">لا ملاحظات آلية. {script.review.note}</p>
        )}
        {script.review && script.review.findings.length > 0 && (
          <ul className="findings">
            {script.review.findings.map((f, i) => (
              <li key={i} className={f.severity}>
                <div className="badges">
                  <span className={f.severity === 'blocking' ? 'badge bad' : 'badge'}>{f.severity === 'blocking' ? 'مانعة' : 'اقتراح'}</span>
                  <span className="badge">{REVIEWERS[f.reviewer]}</span>
                  {f.scene > 0 && <span className="badge">المشهد {f.scene}</span>}
                </div>
                <p>{f.issue}</p>
                <p className="muted">التصحيح: {f.fix}</p>
              </li>
            ))}
          </ul>
        )}
        {script.review && script.review.claims.length > 0 && (
          <table>
            <tbody>
              {script.review.claims.map((c, i) => (
                <tr key={i}>
                  <td><span className={`badge claim-${c.status}`}>{CLAIMS[c.status]}</span></td>
                  <td>{c.claim}{c.note && <div className="muted small">{c.note}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      <section className="card rv-decision" id="decision">
        <h3>{script.story ? '6' : '5'}. قرارك بصفتك {ROLES[role]}</h3>
        {already && !done && (
          <p className="notice ok">
            سبق أن اعتمد هذه النسخة {already.name} بهذه الصفة في <span dir="ltr">{new Date(already.at).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' })}</span>.
          </p>
        )}
        {requested && !done && (
          <p className="notice warn">طلب {requested.name} تعديلا على هذه النسخة: «{requested.note}». تُصحَّح في نسخة جديدة.</p>
        )}
        {!done && !already && !requested && !canSign && (
          <p className="notice warn">
            {role === 'scholar'
              ? 'هذا الرابط للاطلاع فقط. التوقيع بصفة المراجع الشرعي يكون من رابط دعوة تصدره المنصة لأحد مختصيها.'
              : 'هذا الرابط للاطلاع فقط. التوقيع بهذه الصفة يكون من رابط الدعوة الذي يرسله صانع المحتوى.'}
          </p>
        )}
        {!done && !already && !requested && canSign && (
          <form className="rv-form" onSubmit={(e) => act('approve', e)}>
            <label className="field">
              <span>اسمك وصفتك (يُسجَّلان مع القرار)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عبد الله بن أحمد، أستاذ العلوم الإسلامية" required minLength={2} />
            </label>
            <label className="field">
              <span>ملاحظاتك (اختيارية عند الاعتماد، لازمة عند طلب التعديل)</span>
              <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ما يجب أن يتغير، أو ما تحب تسجيله مع توقيعك" />
            </label>
            {error && <div className="notice bad">{error}</div>}
            <div className="actions">
              <button className="primary big" disabled={busy || name.trim().length < 2}>
                أعتمد هذه النسخة
              </button>
              <button type="button" className="big" disabled={busy || name.trim().length < 2 || note.trim().length < 3} onClick={(e) => act('changes', e as unknown as FormEvent)}>
                أطلب تعديلا قبل الاعتماد
              </button>
            </div>
            <p className="muted small">الاعتماد يفتح الفيديو النهائي بلا علامة مائية لهذه النسخة بالضبط؛ أي تعديل لاحق يُنتج نسخة جديدة تحتاج توقيعا جديدا.</p>
          </form>
        )}
      </section>

      <p className="disclosure">
        أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
      </p>
      {!done && !already && !requested && canSign && !decisionSeen && (
        <a className="rv-jump" href="#decision" onClick={(e) => { e.preventDefault(); document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
          قرارك في آخر الصفحة: أعتمد أو أطلب تعديلا ↓
        </a>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="review-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <span className="muted small">صفحة المراجع</span>
        </div>
      </header>
      <main className="rv-main">{children}</main>
    </div>
  )
}
