import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './api'
import { AdminApp } from './admin/AdminApp'
import { BriefForm } from './components/BriefForm'
import { HistorySidebar } from './components/HistorySidebar'
import { Landing } from './components/Landing'
import { Icon } from './components/Icon'
import { AppShell } from './components/shell/AppShell'
import { IdeaSkeletons, Progress, Toast } from './components/Progress'
import { Workspace } from './components/Workspace'
import { loadHistory, saveHistory, upsertEntry } from './history'
import type { HistoryEntry } from './history'
import { go, parseRoute, projectHash } from './route'
import { TASKS } from './tasks'
import type { Busy } from './tasks'
import type { Brief, Project, Script } from './types'

const AUTO_REVIEW_KEY = 'balagh.autoReview'

function readAutoReview(): boolean {
  try {
    return localStorage.getItem(AUTO_REVIEW_KEY) !== 'off'
  } catch {
    return true
  }
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [projects, setProjects] = useState<Record<string, Project>>({})
  const [busy, setBusy] = useState<Busy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [referral, setReferral] = useState<string | null>(null)
  const [autoReview, setAutoReview] = useState(readAutoReview)
  // A brief copied from an existing project; changing formKey gives the composer a fresh start.
  const [draft, setDraft] = useState<Brief | null>(null)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    const sync = () => {
      setRoute(parseRoute())
      scrollTo({ top: 0 })
    }
    addEventListener('popstate', sync)
    addEventListener('hashchange', sync)
    return () => {
      removeEventListener('popstate', sync)
      removeEventListener('hashchange', sync)
    }
  }, [])

  // Entries show the live title and counts of projects loaded in this session.
  const entries = useMemo(
    () => history.map((e) => (projects[e.id] ? upsertEntry([e], projects[e.id])[0] : e)),
    [history, projects],
  )
  useEffect(() => saveHistory(entries), [entries])

  // The server keeps the authoritative history for this browser; the local copy is the offline fallback.
  // Entries only known locally (from before server history existed) are registered by opening them once.
  useEffect(() => {
    api.listProjects().then(
      (remote) => {
        setHistory((local) => {
          const known = new Set(remote.map((r) => r.id))
          for (const e of local) if (!known.has(e.id)) api.getProject(e.id).catch(() => {})
          return [...remote, ...local.filter((e) => !known.has(e.id))]
        })
      },
      () => {},
    )
  }, [])

  const openId = route.view === 'project' ? route.id : null
  const loaded = openId ? projects[openId] : undefined

  useEffect(() => {
    if (!openId || loaded) return
    api.getProject(openId).then(
      (p) => {
        setProjects((all) => ({ ...all, [p.id]: p }))
        // A project this browser has not seen came from someone's review link.
        setHistory((h) => upsertEntry(h, p, !h.some((e) => e.id === p.id)))
      },
      (e) => {
        // Only a 404 means the project is gone; a network error keeps it in history for a retry.
        if (e instanceof ApiError && e.status === 404) {
          setHistory((h) => h.filter((x) => x.id !== openId))
          setError('تعذر فتح المشروع: لم يعد موجودا على الخادم.')
          go('#/new', true)
        } else setError(e instanceof Error ? e.message : String(e))
      },
    )
  }, [openId, loaded])

  function cache(p: Project, shared = false) {
    setProjects((all) => ({ ...all, [p.id]: p }))
    setHistory((h) => upsertEntry(h, p, shared))
  }

  function putScript(pid: string, script: Script) {
    setProjects((all) => {
      const p = all[pid]
      return p ? { ...all, [pid]: { ...p, scripts: { ...p.scripts, [script.id]: script } } } : all
    })
  }

  async function job(b: Busy, work: () => Promise<void>) {
    setBusy(b)
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

  async function reviewNow(pid: string, scriptId: string) {
    await api.review(pid, scriptId)
    // The review can change who must sign off, so reload the project as the server sees it.
    cache(await api.getProject(pid))
  }

  function createProject(brief: Brief) {
    job({ task: TASKS.ideas, projectId: 'new', kind: 'ideas' }, async () => {
      const p = await api.createProject(brief)
      cache(p)
      setDraft(null)
      setFormKey((k) => k + 1)
      if (parseRoute().view === 'new') go(projectHash(p.id), true)
    })
  }

  /** Writes a new version, opens it, and (when enabled) reviews it straight away so the flow never stops between steps. */
  function produce(pid: string, kind: 'script' | 'revise' | 'localize', make: () => Promise<Script>) {
    const back = location.hash
    const pending = projectHash(pid, 'new')
    go(pending)
    const step = autoReview ? 'الخطوة 1 من 2' : undefined
    job({ task: TASKS[kind], projectId: pid, kind: 'script', step }, async () => {
      let script: Script
      try {
        script = await make()
      } catch (e) {
        if (location.hash === pending) go(back, true)
        throw e
      }
      putScript(pid, script)
      if (location.hash === pending) go(projectHash(pid, script.id), true)
      if (autoReview) {
        setBusy({ task: TASKS.review, projectId: pid, kind: 'review', scriptId: script.id, step: 'الخطوة 2 من 2' })
        await reviewNow(pid, script.id)
      }
    })
  }

  const toggleAutoReview = (on: boolean) => {
    setAutoReview(on)
    try {
      localStorage.setItem(AUTO_REVIEW_KEY, on ? 'on' : 'off')
    } catch {
      // The preference then lasts for this session only.
    }
  }

  const hide = (id: string) => {
    setHistory((h) => h.filter((e) => e.id !== id))
    api.hideProject(id).catch(() => {})
    if (id === openId) go('#/new')
  }

  if (route.view === 'admin') return <AdminApp path={route.path} />
  if (route.view === 'landing') return <Landing onStart={() => go('#/new')} resume={history.length > 0} />

  const project = loaded ?? null
  const creating = busy?.kind === 'ideas'

  return (
    <AppShell
      menuLabel="السجل"
      action={
        <button onClick={() => go('#/new')}>
          <Icon name="sparkles" size={15} /> جديد
        </button>
      }
      rail={
        <HistorySidebar
          entries={entries}
          activeId={openId}
          busyId={busy ? busy.projectId : null}
          composing={route.view === 'new'}
          onNew={() => go('#/new')}
          onOpen={(id) => go(projectHash(id))}
          onHide={hide}
          onHome={() => go('')}
        />
      }
    >
        <main className="main-inner">
          {error && (
            <div className="notice bad" role="alert">
              <strong>تعذر إكمال الطلب</strong>
              <p>{error}</p>
            </div>
          )}
          {referral && route.view === 'new' && (
            <div className="notice referral" dir="auto">
              <strong>هذه مسألة تحتاج إلى مختص</strong>
              <p>{referral}</p>
            </div>
          )}

          {route.view === 'new' && (
            <>
              {creating && busy && (
                <div className="gen-flow">
                  <Progress key={busy.task.title} task={busy.task} />
                  <IdeaSkeletons />
                </div>
              )}
              {/* Stays mounted while generating so a failed request keeps the brief as the user left it. */}
              <div hidden={creating}>
                <BriefForm key={formKey} disabled={busy !== null} initial={draft} onSubmit={createProject} />
              </div>
            </>
          )}

          {route.view === 'project' && !project && !error && (
            <div className="loading-view">
              <span className="spinner brand" /> يفتح المشروع…
            </div>
          )}

          {project && (
            <Workspace
              project={project}
              scriptId={route.view === 'project' ? route.script : null}
              busy={busy}
              actions={{
                autoReview,
                onAutoReview: toggleAutoReview,
                onReuse: () => {
                  setDraft(project.brief)
                  setFormKey((k) => k + 1)
                  go('#/new')
                },
                onPick: (idea) => produce(project.id, 'script', () => api.createScript(project.id, idea.id, null)),
                onReview: (sid) =>
                  job({ task: TASKS.review, projectId: project.id, kind: 'review', scriptId: sid }, () => reviewNow(project.id, sid)),
                onRevise: (sid, notes) => produce(project.id, 'revise', () => api.revise(project.id, sid, notes)),
                onLocalize: (sid, body) => produce(project.id, 'localize', () => api.localize(project.id, sid, body)),
                onApprove: (sid, role, name) =>
                  job({ task: TASKS.approve, projectId: project.id, kind: 'approve' }, async () =>
                    putScript(project.id, await api.approve(project.id, sid, role, name)),
                  ),
              }}
            />
          )}

          {busy?.kind === 'approve' && <Toast label={busy.task.title} />}

          <p className="disclosure">
            أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة
            يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
          </p>
        </main>
    </AppShell>
  )
}
