import { useEffect, useState } from 'react'
import { api, ApiError } from './api'
import { BriefForm } from './components/BriefForm'
import { IdeaList } from './components/IdeaList'
import { ScriptView } from './components/ScriptView'
import { scriptLabel } from './labels'
import type { Project, Script } from './types'

const STORAGE_KEY = 'balagh.project'

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

export default function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [referral, setReferral] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) api.getProject(saved).then(setProject, () => localStorage.removeItem(STORAGE_KEY))
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

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
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

      {!project && (
        <BriefForm
          disabled={busy !== null}
          onSubmit={(brief) =>
            run('يقترح بلاغ الأفكار ويتحقق من النصوص في المصادر', async () => {
              const created = await api.createProject(brief)
              localStorage.setItem(STORAGE_KEY, created.id)
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
              script={active}
              source={source}
              disabled={busy !== null}
              onReview={() =>
                run('ثلاثة مراجعين آليين يفحصون السيناريو', async () => {
                  const review = await api.review(pid, active.id)
                  putScript({ ...active, review }, false)
                })
              }
              onRevise={(notes) =>
                run('يصحح بلاغ السيناريو في نسخة جديدة', async () => putScript(await api.revise(pid, active.id, notes)))
              }
              onLocalize={(body) =>
                run('يوطّن بلاغ السيناريو للجمهور الجديد', async () => putScript(await api.localize(pid, active.id, body)))
              }
              onApprove={() => run('اعتماد', async () => putScript(await api.approve(pid, active.id), false))}
            />
          )}
        </>
      )}
    </div>
  )
}
