import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { IdeaList } from './IdeaList'
import { Progress, ScriptSkeleton } from './Progress'
import { Icon } from './Icon'
import { ScriptView } from './ScriptView'
import { nextStep } from '../flow'
import type { Tab } from './ScriptView'
import { projectTitle } from '../history'
import { KNOWLEDGE, LANGUAGES, PLATFORMS, scriptLabel } from '../labels'
import { go, projectHash } from '../route'
import type { Busy } from '../tasks'
import type { Idea, LocalizeRequest, Project, ReviewRole, VideoTemplate } from '../types'

const STEPS = ['الموجز', 'الأفكار', 'السيناريو', 'القالب', 'فيديو المعاينة', 'المراجعة', 'الاعتماد', 'الفيديو النهائي']

/** Which part of the script each step opens; the brief (0) and the ideas (1) are not script parts. */
const STEP_TAB: Record<number, Tab> = { 2: 'script', 3: 'template', 4: 'video', 5: 'review', 6: 'approve', 7: 'video' }

/** The stepper is the navigation too: steps already done are ticked, and clicking any step opens its part.
 * It replaced a second row of tabs that repeated the same names. */
function Stepper({ progress, selected, onSelect }: { progress: number; selected: number; onSelect: (i: number) => void }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    ref.current?.querySelector('li.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])
  return (
    <ol className="stepper" ref={ref} aria-label="خطوات المشروع">
      {STEPS.map((s, i) => (
        <li key={s} className={`${i < progress ? 'done' : ''}${i === selected ? ' on' : ''}`}>
          <button type="button" className="step" disabled={i === 0} aria-current={i === selected ? 'step' : undefined} onClick={() => onSelect(i)}>
            <span className="step-num">{i < progress ? '✓' : i + 1}</span>
            <span className="step-label">{s}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

/** Everything that changes a project. Leaving `actions` out shows the project read-only, as the admin does. */
export interface WorkspaceActions {
  autoReview: boolean
  onAutoReview: (on: boolean) => void
  onReuse: () => void
  onPick: (idea: Idea) => void
  onReview: (scriptId: string) => void
  onRevise: (scriptId: string, notes: string | null) => void
  onLocalize: (scriptId: string, body: LocalizeRequest) => void
  onApprove: (scriptId: string, role: ReviewRole, name: string) => void
  onTemplate: (scriptId: string, template: VideoTemplate) => void
  onStory: (scriptId: string, notes: string | null) => void
}

interface Props {
  project: Project
  scriptId: string | null
  busy?: Busy | null
  templates?: VideoTemplate[] | null
  actions?: WorkspaceActions
  /** Where a project or one of its scripts lives, so the same view can be mounted under another route. */
  hashFor?: (projectId: string, scriptId?: string | null) => string
}

export function Workspace({ project, scriptId, busy = null, templates = null, actions, hashFor = projectHash }: Props) {
  const here = busy?.projectId === project.id ? busy : null
  const writing = here?.kind === 'script'
  const pending = scriptId === 'new'
  const active = scriptId && !pending ? (project.scripts[scriptId] ?? null) : null
  const source = active?.localized_from ? (project.scripts[active.localized_from] ?? null) : null
  const reviewing = (here?.kind === 'review' || here?.kind === 'story') && here.scriptId === active?.id

  // Originals first, then localized versions; revisions follow the version they correct.
  const scripts = Object.values(project.scripts).sort(
    (a, b) => Number(Boolean(a.localized_from)) - Number(Boolean(b.localized_from)) || a.version - b.version,
  )
  // One tab per line of work (an original, or a localization), showing its newest version; a line's older
  // versions open from a list under the tabs. Nine near-identical tabs were unreadable.
  const superseded = new Set(scripts.map((s) => s.revised_from).filter(Boolean))
  const heads = scripts.filter((s) => !superseded.has(s.id))
  const lineOf = (s: (typeof scripts)[number]) => {
    const chain = [s]
    let cur = s
    while (cur.revised_from && project.scripts[cur.revised_from]) {
      cur = project.scripts[cur.revised_from]
      chain.push(cur)
    }
    return chain
  }
  const activeHead = active ? heads.find((h) => lineOf(h).some((v) => v.id === active.id)) ?? active : null
  const activeLine = activeHead ? lineOf(activeHead) : []
  const tabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    tabsRef.current?.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [scriptId])
  // Whether the open version already has a finished video: the last step is done then.
  // Which finished videos the open version has: a watermarked preview (before approval) and the final one.
  const [videosOf, setVideosOf] = useState<{ id: string; preview: boolean; final: boolean } | null>(null)
  useEffect(() => {
    if (!active?.template) return
    const id = active.id
    api.videos(project.id, id).then(
      (vs) => setVideosOf({ id, preview: vs.some((v) => v.status === 'done' && v.preview), final: vs.some((v) => v.status === 'done' && !v.preview) }),
      () => {},
    )
  }, [project.id, active?.id, active?.template, active?.approved])
  const vids = active && videosOf?.id === active.id ? videosOf : null
  const step = pending && writing ? 2 : !active ? 1 : !active.template ? 3 : !vids?.preview && !vids?.final ? 4 : !active.review ? 5 : !active.approved ? 6 : vids?.final ? 8 : 7
  const brief = project.brief

  // The open part of the script; the stepper shows it as the selected step.
  const [tab, setTab] = useState<Tab>('script')
  const selected = !active ? 1 : tab === 'video' ? (active.approved ? 7 : 4) : (Object.entries(STEP_TAB).find(([, t]) => t === tab)?.[0] ?? '2')
  const openTab = (t: Tab) => {
    setTab(t)
    document.getElementById('script-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const selectStep = (i: number) => {
    if (i === 1) return go(hashFor(project.id))
    const target = STEP_TAB[i]
    if (!target) return
    if (!active) {
      const first = heads[0]
      if (!first) return
      go(hashFor(project.id, first.id))
    }
    openTab(target)
  }

  return (
    <div className="workspace">
      <header className="ws-head">
        <div className="ws-title">
          <span className="eyebrow">مشروع</span>
          <h1 dir="auto" className="clamp2" title={projectTitle(project)}>{projectTitle(project)}</h1>
          <div className="badges">
            <span className="badge">{brief.audience}</span>
            <span className="badge">
              {LANGUAGES[brief.language]}
              {brief.dialect ? ` · ${brief.dialect}` : ''}
            </span>
            <span className="badge">{KNOWLEDGE[brief.audience_knowledge]}</span>
            <span className="badge">{brief.platforms.map((p) => PLATFORMS[p]).join('، ')}</span>
          </div>
          {project.source && (
            <p className="muted small source-line" dir="auto">
              <span className="badge info">{project.source.kind === 'youtube' ? 'مصدر الإلهام: فيديو' : 'مصدر الإلهام: ملف'}</span>{' '}
              {project.source.url ? (
                <a href={project.source.url} target="_blank" rel="noreferrer">{project.source.label}</a>
              ) : (
                project.source.label
              )}
              {project.source.summary && <> · {project.source.summary}</>}
            </p>
          )}
          {project.source?.digest && (
            <details className="muted small source-digest">
              <summary>ما قُرئ من المصدر ({project.source.digest.examples.length} أمثلة، {project.source.digest.citations.length} نصوص يستشهد بها)</summary>
              <ul>
                {project.source.digest.argument.map((a, i) => (
                  <li key={i} dir="auto">{a}</li>
                ))}
              </ul>
              {project.source.digest.examples.length > 0 && (
                <ul>
                  {project.source.digest.examples.map((e, i) => (
                    <li key={i} dir="auto"><span className="badge" dir="ltr">{e.locus}</span> {e.text}</li>
                  ))}
                </ul>
              )}
              {project.source.digest.citations.length > 0 && (
                <p dir="auto">
                  نصوص يستشهد بها المصدر كما وردت فيه، ولا يوثّقها وروده: {project.source.digest.citations.map((c) => `«${c.text}» (${c.attributed_to}، ${c.locus})`).join('؛ ')}
                </p>
              )}
            </details>
          )}
        </div>
        {actions && (
        <div className="ws-tools">
          <label className="switch" title="بعد كل سيناريو أو نسخة جديدة، يشغّل بلاغ المراجعين الثلاثة مباشرة">
            <input type="checkbox" checked={actions.autoReview} onChange={(e) => actions.onAutoReview(e.target.checked)} />
            <span className="track" />
            مراجعة آلية تلقائية
          </label>
          <button type="button" onClick={actions.onReuse} disabled={busy?.kind === 'ideas'} title="يفتح توليدا جديدا بنفس الجمهور والمنصات">
            <Icon name="copy" size={16} /> توليد بنفس الموجز
          </button>
        </div>
        )}
      </header>

      <Stepper progress={step} selected={Number(selected)} onSelect={selectStep} />

      {/* One tab per line of work, shown only once there is more than one: an original alone needs no tab. */}
      {(heads.length > 1 || writing) && (
      <nav className="tabs" aria-label="نسخ المشروع" ref={tabsRef}>
        <button className={!scriptId ? 'tab on' : 'tab'} onClick={() => go(hashFor(project.id))}>
          <span>الأفكار</span>
          <small>{project.ideas.length} أفكار</small>
        </button>
        {heads.map((s) => {
          const line = lineOf(s)
          const shown = activeHead?.id === s.id && active ? active : s
          return (
            <button key={s.id} className={`tab${activeHead?.id === s.id ? ' on' : ''}${shown.approved ? ' approved' : ''}`} onClick={() => go(hashFor(project.id, s.id))}>
              <span dir="auto">{s.title}</span>
              <small>
                <i className={shown.approved ? 'state ok' : shown.review ? 'state warn' : 'state'} />
                {shown.approved ? 'معتمدة · ' : ''}
                {scriptLabel(shown)}
                {line.length > 1 && ` · ${line.length} نسخ`}
              </small>
            </button>
          )
        })}
        {writing && (
          <button className={pending ? 'tab on' : 'tab'} onClick={() => go(hashFor(project.id, 'new'))}>
            <span>
              <span className="spinner brand mini" /> نسخة جديدة
            </span>
            <small>قيد الكتابة</small>
          </button>
        )}
      </nav>
      )}

      {pending && writing && here && (
        <div className="gen-flow">
          <Progress key={here.task.title} task={here.task} step={here.step} />
          <ScriptSkeleton />
        </div>
      )}

      {(!scriptId || (pending && !writing) || (scriptId && !pending && !active)) && (
        <IdeaList ideas={project.ideas} disabled={busy !== null} onPick={actions?.onPick} />
      )}

      {active && activeLine.length > 1 && (
        <label className="versions">
          <span className="muted small">نسخ هذا الخط:</span>
          <select value={active.id} onChange={(e) => go(hashFor(project.id, e.target.value))}>
            {activeLine.map((v) => (
              <option key={v.id} value={v.id}>
                النسخة {v.version}
                {v.approved ? ' · معتمدة' : v.review?.blocking ? ` · ${v.review.blocking} مانعة` : v.review ? ' · مراجَعة' : ''}
                {v.id === activeHead?.id ? ' · الأحدث' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {active && (
        <>
          {reviewing && here && <Progress key={here.task.title} task={here.task} step={here.step} />}
          <ScriptView
            key={active.id}
            projectId={project.id}
            script={active}
            source={source}
            templates={templates}
            disabled={busy !== null}
            tab={tab}
            onTab={openTab}
            actions={
              actions && {
                onReview: () => actions.onReview(active.id),
                onRevise: (notes) => actions.onRevise(active.id, notes),
                onLocalize: (body) => actions.onLocalize(active.id, body),
                onApprove: (role, name) => actions.onApprove(active.id, role, name),
                onTemplate: (template) => actions.onTemplate(active.id, template),
                onStory: (notes) => actions.onStory(active.id, notes),
              }
            }
          />
        </>
      )}

      {active && actions && (() => {
        const next = nextStep(active)
        const prev = Number(selected) - 1
        const run = () => {
          if (next.action.kind === 'review') return actions.onReview(active.id)
          openTab(next.action.kind === 'findings' ? 'review' : next.action.kind)
        }
        return (
          <div className={`flowbar ${next.tone}`}>
            <button type="button" className="ghost" disabled={prev < 1} onClick={() => selectStep(prev)}>
              → السابق
            </button>
            <div className="flowbar-text">
              <strong>{next.title}</strong>
              <span className="muted small">{next.hint}</span>
            </div>
            <button type="button" className="primary" disabled={busy !== null} onClick={run}>
              {next.action.label} ←
            </button>
          </div>
        )
      })()}
    </div>
  )
}
