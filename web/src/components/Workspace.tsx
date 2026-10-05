import { IdeaList } from './IdeaList'
import { Progress, ScriptSkeleton } from './Progress'
import { ScriptView } from './ScriptView'
import { projectTitle } from '../history'
import { KNOWLEDGE, LANGUAGES, PLATFORMS, scriptLabel } from '../labels'
import { go, projectHash } from '../route'
import type { Busy } from '../tasks'
import type { Idea, LocalizeRequest, Project, ReviewRole } from '../types'

const STEPS = ['الموجز', 'الأفكار', 'السيناريو', 'المراجعة', 'الاعتماد']

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'now' : ''}>
          <span className="step-num">{i < current ? '✓' : i + 1}</span>
          <span className="step-label">{s}</span>
        </li>
      ))}
    </ol>
  )
}

interface Props {
  project: Project
  scriptId: string | null
  busy: Busy | null
  autoReview: boolean
  onAutoReview: (on: boolean) => void
  onReuse: () => void
  onPick: (idea: Idea) => void
  onReview: (scriptId: string) => void
  onRevise: (scriptId: string, notes: string | null) => void
  onLocalize: (scriptId: string, body: LocalizeRequest) => void
  onApprove: (scriptId: string, role: ReviewRole, name: string) => void
}

export function Workspace({ project, scriptId, busy, autoReview, onAutoReview, onReuse, onPick, onReview, onRevise, onLocalize, onApprove }: Props) {
  const here = busy?.projectId === project.id ? busy : null
  const writing = here?.kind === 'script'
  const pending = scriptId === 'new'
  const active = scriptId && !pending ? (project.scripts[scriptId] ?? null) : null
  const source = active?.localized_from ? (project.scripts[active.localized_from] ?? null) : null
  const reviewing = here?.kind === 'review' && here.scriptId === active?.id

  // Originals first, then localized versions; revisions follow the version they correct.
  const scripts = Object.values(project.scripts).sort(
    (a, b) => Number(Boolean(a.localized_from)) - Number(Boolean(b.localized_from)) || a.version - b.version,
  )
  const step = pending && writing ? 2 : !active ? 1 : !active.review ? 3 : !active.approved ? 4 : 5
  const brief = project.brief

  return (
    <div className="workspace">
      <header className="ws-head">
        <div className="ws-title">
          <span className="eyebrow">مشروع</span>
          <h1 dir="auto">{projectTitle(project)}</h1>
          <div className="badges">
            <span className="badge">{brief.audience}</span>
            <span className="badge">
              {LANGUAGES[brief.language]}
              {brief.dialect ? ` · ${brief.dialect}` : ''}
            </span>
            <span className="badge">{KNOWLEDGE[brief.audience_knowledge]}</span>
            <span className="badge">{brief.platforms.map((p) => PLATFORMS[p]).join('، ')}</span>
          </div>
        </div>
        <div className="ws-tools">
          <label className="switch" title="بعد كل سيناريو أو نسخة جديدة، يشغّل بلاغ المراجعين الثلاثة مباشرة">
            <input type="checkbox" checked={autoReview} onChange={(e) => onAutoReview(e.target.checked)} />
            <span className="track" />
            مراجعة آلية تلقائية
          </label>
          <button type="button" onClick={onReuse} disabled={busy?.kind === 'ideas'} title="يفتح توليدا جديدا بنفس الجمهور والمنصات">
            ⧉ توليد بنفس الموجز
          </button>
        </div>
      </header>

      <Stepper current={step} />

      <nav className="tabs" aria-label="نسخ المشروع">
        <button className={!scriptId ? 'tab on' : 'tab'} onClick={() => go(projectHash(project.id))}>
          <span>الأفكار</span>
          <small>{project.ideas.length} أفكار</small>
        </button>
        {scripts.map((s) => (
          <button key={s.id} className={s.id === scriptId ? 'tab on' : 'tab'} onClick={() => go(projectHash(project.id, s.id))}>
            <span dir="auto">{s.title}</span>
            <small>
              <i className={s.approved ? 'state ok' : s.review ? 'state warn' : 'state'} />
              {scriptLabel(s)}
            </small>
          </button>
        ))}
        {writing && (
          <button className={pending ? 'tab on' : 'tab'} onClick={() => go(projectHash(project.id, 'new'))}>
            <span>
              <span className="spinner brand mini" /> نسخة جديدة
            </span>
            <small>قيد الكتابة</small>
          </button>
        )}
      </nav>

      {pending && writing && here && (
        <div className="gen-flow">
          <Progress key={here.task.title} task={here.task} step={here.step} />
          <ScriptSkeleton />
        </div>
      )}

      {(!scriptId || (pending && !writing) || (scriptId && !pending && !active)) && (
        <IdeaList ideas={project.ideas} disabled={busy !== null} onPick={onPick} />
      )}

      {active && (
        <>
          {reviewing && here && <Progress key={here.task.title} task={here.task} step={here.step} />}
          <ScriptView
            key={active.id}
            script={active}
            source={source}
            disabled={busy !== null}
            onReview={() => onReview(active.id)}
            onRevise={(notes) => onRevise(active.id, notes)}
            onLocalize={(body) => onLocalize(active.id, body)}
            onApprove={(role, name) => onApprove(active.id, role, name)}
            shareUrl={`${location.origin}${location.pathname}${projectHash(project.id, active.id)}`}
          />
        </>
      )}
    </div>
  )
}
