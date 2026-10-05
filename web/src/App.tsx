import { useEffect, useState } from 'react'
import { api, ApiError } from './api'
import { BriefForm } from './components/BriefForm'
import { IdeaList } from './components/IdeaList'
import { Landing, Logo } from './components/Landing'
import { Progress } from './components/Progress'
import { ScriptView } from './components/ScriptView'
import { LANGUAGES, PLATFORMS, scriptLabel } from './labels'
import { TASKS } from './tasks'
import type { Task } from './tasks'
import type { Project, Script } from './types'

const STORAGE_KEY = 'balagh.project'

const STEPS = ['الموجز', 'الأفكار', 'السيناريو', 'المراجعة', 'الاعتماد']

// The studio opens on #studio, or directly on a review link (?project=…&script=…).
const isStudio = () => location.hash === '#studio' || new URLSearchParams(location.search).has('project')

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

export default function App() {
  const [studio, setStudio] = useState(isStudio)
  const [project, setProject] = useState<Project | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [referral, setReferral] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setStudio(isStudio())
    addEventListener('popstate', sync)
    addEventListener('hashchange', sync)
    return () => {
      removeEventListener('popstate', sync)
      removeEventListener('hashchange', sync)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const shared = params.get('project')
    const saved = shared ?? localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    api.getProject(saved).then(
      (loaded) => {
        setProject(loaded)
        const script = params.get('script')
        if (script && loaded.scripts[script]) setActiveId(script)
      },
      () => (shared ? setError('تعذر فتح رابط المراجعة: المشروع غير موجود.') : localStorage.removeItem(STORAGE_KEY)),
    )
  }, [])

  useEffect(() => {
    scrollTo({ top: 0 })
  }, [studio, activeId, project?.id])

  async function run(task: Task, work: () => Promise<void>) {
    setBusy(task)
    setError(null)
    setReferral(null)
    try {
      await work()
    } catch (e) {
      if (e instanceof ApiError && e.referral) setReferral(e.message)
      else setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const putScript = (script: Script, activate = true) => {
    setProject((p) => p && { ...p, scripts: { ...p.scripts, [script.id]: script } })
    if (activate) setActiveId(script.id)
  }

  const openStudio = () => {
    location.hash = 'studio'
    setStudio(true)
  }

  const openLanding = () => {
    history.pushState(null, '', location.pathname)
    setStudio(false)
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    history.replaceState(null, '', `${location.pathname}#studio`)
    setProject(null)
    setActiveId(null)
    setError(null)
    setReferral(null)
  }

  if (!studio) return <Landing onStart={openStudio} resume={project !== null} />

  // Originals first, then localized versions; revisions follow the version they correct.
  const scripts = project
    ? Object.values(project.scripts).sort(
        (a, b) => Number(Boolean(a.localized_from)) - Number(Boolean(b.localized_from)) || a.version - b.version,
      )
    : []
  const active = project && activeId ? project.scripts[activeId] : null
  const source = active?.localized_from && project ? (project.scripts[active.localized_from] ?? null) : null
  const pid = project?.id ?? ''
  const step = !project ? 0 : !active ? 1 : !active.review ? 3 : !active.approved ? 4 : 5

  return (
    <div className="studio">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="logo-button" onClick={openLanding} aria-label="الصفحة الرئيسية">
            <Logo />
          </button>
          <Stepper current={step} />
          {project ? (
            <button onClick={reset}>+ مشروع جديد</button>
          ) : (
            <span className="topbar-spacer" />
          )}
        </div>
      </header>

      {busy && <Progress key={busy.title} task={busy} />}

      <main className="studio-main">
        {error && (
          <div className="notice bad" role="alert">
            <strong>تعذر إكمال الطلب</strong>
            <p>{error}</p>
          </div>
        )}
        {referral && (
          <div className="notice referral" dir="auto">
            <strong>هذه مسألة تحتاج إلى مختص</strong>
            <p>{referral}</p>
          </div>
        )}

        {!project && (
          <BriefForm
            disabled={busy !== null}
            onSubmit={(brief) =>
              run(TASKS.ideas, async () => {
                const created = await api.createProject(brief)
                localStorage.setItem(STORAGE_KEY, created.id)
                setProject(created)
              })
            }
          />
        )}

        {project && (
          <div className="workspace">
            <aside className="sidebar">
              <div className="side-card">
                <span className="side-title">الموجز</span>
                <p dir="auto">{project.brief.idea ?? 'مواضيع يقترحها بلاغ'}</p>
                <p className="muted small" dir="auto">
                  {project.brief.audience} · {LANGUAGES[project.brief.language]}
                </p>
                <p className="muted small">{project.brief.platforms.map((p) => PLATFORMS[p]).join('، ')}</p>
              </div>
              <nav className="side-card side-nav">
                <span className="side-title">المشروع</span>
                <button className={active ? 'nav-item' : 'nav-item on'} onClick={() => setActiveId(null)}>
                  <span>الأفكار</span>
                  <small>{project.ideas.length} أفكار</small>
                </button>
                {scripts.length > 0 && <span className="side-title">السيناريوهات</span>}
                {scripts.map((s) => (
                  <button key={s.id} className={s.id === activeId ? 'nav-item on' : 'nav-item'} onClick={() => setActiveId(s.id)}>
                    <span dir="auto">{s.title}</span>
                    <small>
                      {scriptLabel(s)}
                      <i className={s.approved ? 'state ok' : s.review ? 'state warn' : 'state'} />
                    </small>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="content">
              {!active && (
                <IdeaList
                  ideas={project.ideas}
                  disabled={busy !== null}
                  onPick={(idea) => run(TASKS.script, async () => putScript(await api.createScript(pid, idea.id, null)))}
                />
              )}

              {active && (
                <ScriptView
                  key={active.id}
                  script={active}
                  source={source}
                  disabled={busy !== null}
                  onReview={() =>
                    run(TASKS.review, async () => {
                      await api.review(pid, active.id)
                      // The review can change who must sign off, so reload the script as the server sees it.
                      setProject(await api.getProject(pid))
                    })
                  }
                  onRevise={(notes) => run(TASKS.revise, async () => putScript(await api.revise(pid, active.id, notes)))}
                  onLocalize={(body) => run(TASKS.localize, async () => putScript(await api.localize(pid, active.id, body)))}
                  onApprove={(role, name) =>
                    run(TASKS.approve, async () => putScript(await api.approve(pid, active.id, role, name), false))
                  }
                  shareUrl={`${location.origin}/?project=${pid}&script=${active.id}`}
                />
              )}
            </section>
          </div>
        )}

        <p className="disclosure">
          أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة
          يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
        </p>
      </main>
    </div>
  )
}
