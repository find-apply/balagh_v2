import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api'
import { useAccount } from '@/account'
import { HeaderTitle, Stepper } from '@/components/kit'
import type { Step, StepState } from '@/components/kit'
import { Notice, P, Screen } from '@/components/ui'
import { ApprovePart } from '@/components/version/ApprovePart'
import { ACTIVE, PART_KEYS, versionLine } from '@/components/version/common'
import type { Part } from '@/components/version/common'
import { ReviewPart } from '@/components/version/ReviewPart'
import { ScriptPart } from '@/components/version/ScriptPart'
import { VideoPart } from '@/components/version/VideoPart'
import { clearJob, run, useJob } from '@/jobs'
import { TASKS } from '@/shared/tasks'
import type { Project, Script, Video, VideoTemplate } from '@/shared/types'

/** Where an open version stands: the part its next step needs opens first. */
function partFor(sc: Script): Part {
  if (!sc.review || sc.review.blocking > 0) return sc.review ? 'review' : 'script'
  if (!sc.approved && !sc.template) return 'video'
  return sc.approved ? 'video' : 'approve'
}

export default function VersionScreen() {
  const { id, sid, part: asked, video: focus } = useLocalSearchParams<{ id: string; sid: string; part?: Part; video?: string }>()
  const account = useAccount()
  const accountName = 'me' in account ? (account.me.full_name ?? account.me.name ?? '') : ''
  const [project, setProject] = useState<Project | null>(null)
  const [part, setPart] = useState<Part | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<VideoTemplate[] | null>(null)
  const [videos, setVideos] = useState<Video[] | null>(null)
  const reviewKey = `review:${sid}`
  const reviseKey = `revise:${sid}`
  const reviewJob = useJob(reviewKey)
  const reviseJob = useJob(reviseKey)

  const load = useCallback(async () => {
    try {
      const p = await api.getProject(id)
      setProject(p)
      setPart((cur) => cur ?? (asked && PART_KEYS.includes(asked) ? asked : p.scripts[sid] ? partFor(p.scripts[sid]) : 'script'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id, sid, asked])
  const loadVideos = useCallback(() => api.videos(id, sid).then(setVideos, () => setVideos((v) => v ?? [])), [id, sid])
  useFocusEffect(
    useCallback(() => {
      void load()
      void loadVideos()
    }, [load, loadVideos]),
  )
  useEffect(() => {
    api.templates().then(setTemplates, () => setTemplates([]))
  }, [])
  // A render takes minutes: the list is polled while one runs.
  const running = videos?.some((v) => ACTIVE.has(v.status)) ?? false
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => void loadVideos(), 5000)
    return () => clearInterval(t)
  }, [running, loadVideos])

  const script = project?.scripts[sid]
  if (!script || !part) return <Screen>{error ? <Notice tone="bad">{error}</Notice> : <P muted>يحمّل…</P>}</Screen>

  const review = async () => {
    if (await run(reviewKey, TASKS.review, () => api.review(id, sid))) await load()
  }
  const revise = async () => {
    const next = await run(reviseKey, TASKS.revise, () => api.revise(id, sid))
    if (next) router.replace({ pathname: '/p/[id]/[sid]', params: { id, sid: next.id } })
  }
  const clearJobs = () => {
    clearJob(reviewKey)
    clearJob(reviseKey)
  }

  const specialist = script.author === 'specialist'
  const blocking = (script.review?.blocking ?? 0) > 0
  const newest = videos?.[0]
  const changeOpen = script.change_requests.length > 0 && !script.approved
  // Each step's state: a warning, an error or an open request outranks being the one shown.
  const at = (p: Part, own: StepState | null, done: boolean): StepState => own ?? (part === p ? 'current' : done ? 'done' : 'todo')
  const states: Record<Part, StepState> = {
    script: at('script', null, true),
    review: at('review', blocking ? (specialist ? 'warn' : 'error') : null, !!script.review && !blocking),
    video: at('video', newest?.status === 'failed' ? 'error' : null, !!videos?.some((v) => v.status === 'done')),
    approve: at('approve', changeOpen ? 'edit' : null, script.approved),
  }
  const labels: Record<Part, string> = { script: 'السيناريو', review: 'المراجعة', video: 'الفيديو', approve: specialist ? 'اعتمادك' : 'الاعتماد' }
  const steps: Step[] = PART_KEYS.map((p) => ({ label: labels[p], state: states[p], onPress: part === p ? undefined : () => setPart(p) }))

  return (
    <Screen>
      <Stack.Screen options={{ headerTitle: () => <HeaderTitle title={script.title} sub={versionLine(script)} /> }} />
      <Stepper steps={steps} />

      {part === 'script' && (
        <ScriptPart
          script={script}
          reviewing={reviewJob}
          onNext={() => setPart('review')}
          onReview={() => {
            setPart('review')
            void review()
          }}
        />
      )}
      {part === 'review' && (
        <ReviewPart
          script={script}
          reviewing={reviewJob}
          revising={reviseJob}
          onReview={() => void review()}
          onRevise={() => void revise()}
          onClear={clearJobs}
          onNext={() => setPart(blocking ? 'approve' : 'video')}
        />
      )}
      {part === 'video' && (
        <VideoPart
          projectId={id}
          script={script}
          templates={templates}
          videos={videos}
          focus={focus}
          onChanged={load}
          onVideos={loadVideos}
          onNext={() => setPart('approve')}
        />
      )}
      {part === 'approve' && (
        <ApprovePart
          projectId={id}
          script={script}
          accountName={accountName}
          revising={reviseJob}
          onRevise={() => void revise()}
          onClearRevise={clearJobs}
          onSigned={load}
          onVideo={() => setPart('video')}
        />
      )}
    </Screen>
  )
}
