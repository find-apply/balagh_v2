import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from './account'
import { api, ApiError } from './api'
import type { Me } from './api'
import { AdminApp } from './admin/AdminApp'
import { AccountGate, gated } from './components/AccountGate'
import { BriefForm } from './components/BriefForm'
import { HistorySidebar } from './components/HistorySidebar'
import { Landing } from './components/Landing'
import { Showcase } from './components/Showcase'
import { ReviewPage } from './components/ReviewPage'
import { Icon } from './components/Icon'
import { AppShell } from './components/shell/AppShell'
import { IdeaSkeletons, Progress, Toast } from './components/Progress'
import { Workspace } from './components/Workspace'
import { loadHistory, saveHistory, upsertEntry } from './history'
import type { HistoryEntry } from './history'
import { go, parseRoute, projectHash } from './route'
import { TASKS } from './tasks'
import { askToNotify, notifyIfAway } from './notify'
import type { Busy } from './tasks'
import type { Brief, Project, Script, VideoTemplate } from './types'

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
  const [templates, setTemplates] = useState<VideoTemplate[] | null>(null)
  // The last request that failed, so the error notice can offer to run it again.
  const failed = useRef<{ b: Busy; work: () => Promise<void> } | null>(null)

  useEffect(() => {
    api.templates().then(setTemplates, () => setTemplates(null))
  }, [])

  useEffect(() => {
    const sync = () => {
      setRoute(parseRoute())
      setError(null)
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

  // The server keeps the authoritative history: the account's when signed in, else this browser's; the local
  // copy is the offline fallback. Entries only known locally (from before server history existed) are
  // registered by opening them once. It reloads when the account changes.
  const user = useAccount()
  const [me, setMe] = useState<Me | null>(null)
  const lastUid = useRef<string | null>(null)
  useEffect(() => {
    if (user === undefined) return
    const uid = user?.uid ?? null
    const signedOut = lastUid.current !== null && uid === null
    lastUid.current = uid
    if (signedOut) {
      // the account's projects are not this browser's: signing out leaves them with the account
      saveHistory([])
      setHistory([])
    }
    if (!uid) setMe(null)
    ;(uid ? api.me().then(setMe, () => null) : Promise.resolve(null)).then(() => api.listProjects()).then(
      (remote) => {
        const known = new Set(remote.map((r) => r.id))
        const local = loadHistory().filter((e) => !known.has(e.id))
        setHistory([...remote, ...local])
        // Entries this browser kept before server history existed are its own projects: register them as such,
        // and drop the ones the server no longer has.
        for (const e of local) {
          api.openProject(e.id, e.shared).catch((err) => {
            if (err instanceof ApiError && err.status === 404) setHistory((h) => h.filter((x) => x.id !== e.id))
          })
        }
      },
      () => {},
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user === undefined])

  const openId = route.view === 'project' ? route.id : null
  const loaded = openId ? projects[openId] : undefined

  useEffect(() => {
    if (!openId || loaded) return
    // A project this browser has not seen came from someone's review link; opening records it as shared.
    const seen = history.some((e) => e.id === openId)
    ;(seen ? api.getProject(openId) : api.openProject(openId, true)).then(
      (p) => {
        setProjects((all) => ({ ...all, [p.id]: p }))
        setHistory((h) => upsertEntry(h, p, !seen))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- history only decides shared on first open
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
    setBusy({ ...b, started: Date.now() })
    setError(null)
    setReferral(null)
    try {
      await work()
      failed.current = null
    } catch (e) {
      if (e instanceof ApiError && e.referral) setReferral(e.message)
      else {
        failed.current = { b, work }
        setError(e instanceof Error ? e.message : String(e))
      }
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
    askToNotify()
    job({ task: TASKS[kind], projectId: pid, kind: 'script', step }, async () => {
      let script: Script
      try {
        script = await make()
      } catch (e) {
        if (location.hash === pending) go(back, true)
        throw e
      }
      putScript(pid, script)
      notifyIfAway('بلاغ: السيناريو جاهز', script.title)
      if (location.hash === pending) go(projectHash(pid, script.id), true)
      if (autoReview) {
        setBusy({ task: TASKS.review, projectId: pid, kind: 'review', scriptId: script.id, step: 'الخطوة 2 من 2', started: Date.now() })
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
  if (route.view === 'examples') return <Showcase onStart={() => go('#/new')} />
  if (route.view === 'review') return <ReviewPage projectId={route.id} scriptId={route.script} role={route.role} invite={route.invite} />
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
          user={user}
        />
      }
    >
        <main className="main-inner">
          {user && me && gated(me) ? (
            <AccountGate me={me} onChange={setMe} />
          ) : (
          <>
          {error && (
            <div className="notice bad" role="alert">
              <strong>تعذر إكمال الطلب</strong>
              <p>{error}</p>
              {failed.current && (
                <button type="button" disabled={busy !== null} onClick={() => failed.current && job(failed.current.b, failed.current.work)}>
                  أعد المحاولة
                </button>
              )}
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
                  <Progress key={busy.task.title} task={busy.task} since={busy.started} />
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
              templates={templates}
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
                onTemplate: (sid, template) => {
                  // A children's template chosen for the first time writes the story: a real generation step.
                  const writes = template.story && !project.scripts[sid]?.story
                  job(
                    writes
                      ? { task: TASKS.story, projectId: project.id, kind: 'story', scriptId: sid }
                      : { task: TASKS.template, projectId: project.id, kind: 'template' },
                    async () => putScript(project.id, await api.chooseTemplate(project.id, sid, template.id)),
                  )
                },
                onStory: (sid, notes) =>
                  job({ task: TASKS.story, projectId: project.id, kind: 'story', scriptId: sid }, async () =>
                    putScript(project.id, await api.rewriteStory(project.id, sid, notes)),
                  ),
              }}
            />
          )}

          {(busy?.kind === 'approve' || busy?.kind === 'template') && <Toast label={busy.task.title} />}
          </>
          )}

          <p className="disclosure">
            أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة
            يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
          </p>
        </main>
    </AppShell>
  )
}
