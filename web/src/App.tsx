import { useEffect, useState } from 'react'
import { api, ApiError } from './api'
import { BriefForm } from './components/BriefForm'
import { IdeaList } from './components/IdeaList'
import { ScriptView } from './components/ScriptView'
import { scriptLabel } from './labels'
import type { Project, Script, VideoTemplate } from './types'

const STORAGE_KEY = 'balagh.project'
const HISTORY_KEY = 'balagh.projects'

interface Saved {
  id: string
  title: string
  at: string
}

// Earlier projects of this browser, newest first. Projects live on the server; only their ids are kept here.
function loadHistory(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function remember(project: Project) {
  const title = project.brief.idea || project.ideas[0]?.title || 'مشروع'
  const rest = loadHistory().filter((p) => p.id !== project.id)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ id: project.id, title, at: new Date().toISOString() }, ...rest].slice(0, 20)))
  } catch {
    // Storage full or blocked: history is a convenience only.
  }
}

function Busy({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="busy" role="status">
      <span className="spinner" /> {label} <span className="muted">({seconds} ث، قد يستغرق دقيقة)</span>
    </div>
  )
}

function History({ disabled, onOpen }: { disabled: boolean; onOpen: (id: string) => void }) {
  const history = loadHistory()
  if (history.length === 0) return null
  return (
    <details className="card history">
      <summary>مشاريعك السابقة ({history.length})</summary>
      <ul className="plain">
        {history.map((p) => (
          <li key={p.id}>
            <button className="link" disabled={disabled} onClick={() => onOpen(p.id)} dir="auto">
              {p.title}
            </button>{' '}
            <span className="muted small">{new Date(p.at).toLocaleDateString('ar')}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<VideoTemplate[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [referral, setReferral] = useState<string | null>(null)

  useEffect(() => {
    api.templates().then(setTemplates, () => setTemplates(null))
  }, [])

  useEffect(() => {
    // A review link (?project=…&script=…) opens that script directly for the reviewer.
    const params = new URLSearchParams(location.search)
    const shared = params.get('project')
    const saved = shared ?? localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    api.getProject(saved).then(
      (loaded) => {
        setProject(loaded)
        remember(loaded)
        const script = params.get('script')
        if (script && loaded.scripts[script]) setActiveId(script)
      },
      () => (shared ? setError('تعذر فتح رابط المراجعة: المشروع غير موجود.') : localStorage.removeItem(STORAGE_KEY)),
    )
  }, [])

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    setError(null)
    setReferral(null)
    try {
      await task()
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

  const openProject = (id: string) =>
    run('فتح المشروع', async () => {
      const loaded = await api.getProject(id)
      localStorage.setItem(STORAGE_KEY, id)
      remember(loaded)
      setProject(loaded)
    })

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    history.replaceState(null, '', location.pathname)
    setProject(null)
    setActiveId(null)
    setError(null)
    setReferral(null)
  }

  // Originals first, then localized versions; revisions follow the version they correct.
  const scripts = project
    ? Object.values(project.scripts).sort(
        (a, b) => Number(Boolean(a.localized_from)) - Number(Boolean(b.localized_from)) || a.version - b.version,
      )
    : []
  const active = project && activeId ? project.scripts[activeId] : null
  const source = active?.localized_from && project ? (project.scripts[active.localized_from] ?? null) : null
  const pid = project?.id ?? ''

  return (
    <div className="app">
      <header>
        <div>
          <h1>بلاغ</h1>
          <p>مساعد لصناعة محتوى موثّق يعرّف بالإسلام عبر اللغات والثقافات</p>
        </div>
        {project && <button onClick={reset}>مشروع جديد</button>}
      </header>
      <p className="disclosure">
        أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة
        يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
      </p>

      {busy && <Busy label={busy} />}
      {error && <div className="notice bad">{error}</div>}
      {referral && (
        <div className="notice referral" dir="auto">
          <strong>هذه مسألة تحتاج إلى مختص</strong>
          <p>{referral}</p>
        </div>
      )}

      {!project && <History disabled={busy !== null} onOpen={openProject} />}

      {!project && (
        <BriefForm
          disabled={busy !== null}
          onSubmit={(brief) =>
            run('يقترح بلاغ الأفكار ويتحقق من النصوص في المصادر', async () => {
              const created = await api.createProject(brief)
              localStorage.setItem(STORAGE_KEY, created.id)
              remember(created)
              setProject(created)
            })
          }
        />
      )}

      {project && (
        <>
          {scripts.length > 0 && (
            <nav className="tabs">
              <button className={active ? 'tab' : 'tab on'} onClick={() => setActiveId(null)}>
                الأفكار
              </button>
              {scripts.map((s) => (
                <button key={s.id} className={s.id === activeId ? 'tab on' : 'tab'} onClick={() => setActiveId(s.id)}>
                  <span dir="auto">{s.title}</span>
                  <small>{scriptLabel(s)}</small>
                </button>
              ))}
            </nav>
          )}

          {!active && (
            <IdeaList
              ideas={project.ideas}
              disabled={busy !== null}
              onPick={(idea) =>
                run('يكتب بلاغ السيناريو', async () => putScript(await api.createScript(pid, idea.id, null)))
              }
            />
          )}

          {active && (
            <ScriptView
              key={active.id}
              projectId={pid}
              script={active}
              source={source}
              templates={templates}
              disabled={busy !== null}
              onReview={() =>
                run('ثلاثة مراجعين آليين يفحصون السيناريو', async () => {
                  await api.review(pid, active.id)
                  // The review can change who must sign off, so reload the script as the server sees it.
                  setProject(await api.getProject(pid))
                })
              }
              onRevise={(notes) =>
                run('يصحح بلاغ السيناريو في نسخة جديدة', async () => putScript(await api.revise(pid, active.id, notes)))
              }
              onLocalize={(body) =>
                run('يوطّن بلاغ السيناريو للجمهور الجديد', async () => putScript(await api.localize(pid, active.id, body)))
              }
              onTemplate={(template) =>
                run(template.story && !active.story ? 'يكتب بلاغ قصة الأطفال' : 'حفظ القالب', async () =>
                  putScript(await api.chooseTemplate(pid, active.id, template.id), false),
                )
              }
              onStory={(notes) =>
                run('يكتب بلاغ قصة أخرى', async () => putScript(await api.rewriteStory(pid, active.id, notes), false))
              }
              onApprove={(role, name) =>
                run('اعتماد', async () => putScript(await api.approve(pid, active.id, role, name), false))
              }
              shareUrl={`${location.origin}/?project=${pid}&script=${active.id}`}
            />
          )}
        </>
      )}
    </div>
  )
}
