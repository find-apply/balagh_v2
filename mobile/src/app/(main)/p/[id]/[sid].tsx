import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Share, View } from 'react-native'
import { api, BASE, SITE } from '../../../api'
import { Feedback } from '../../../components/Feedback'
import { Badge, Button, Card, Chip, Field, H2, H3, Notice, P, Progress, Row, Screen } from '../../../components/ui'
import { VideoPlayer } from '../../../components/VideoPlayer'
import { clearJob, run, useJob } from '../../../jobs'
import { aspectOf, LEVELS, REVIEWERS, ROLES, VIDEO_STATUS, scriptLabel } from '../../../shared/labels'
import { TASKS } from '../../../shared/tasks'
import type { Project, Script, Video, VideoTemplate } from '../../../shared/types'

type Part = 'script' | 'review' | 'video' | 'approve'
const PARTS: Record<Part, string> = { script: 'السيناريو', review: 'المراجعة', video: 'الفيديو', approve: 'الاعتماد' }
const ACTIVE = new Set(['queued', 'voicing', 'imaging', 'rendering'])

/** Where an open version stands: the part its next step needs opens first. */
function partFor(sc: Script): Part {
  if (!sc.review || sc.review.blocking > 0) return sc.review ? 'review' : 'script'
  if (!sc.approved && !sc.template) return 'video'
  return sc.approved ? 'video' : 'approve'
}

export default function ScriptScreen() {
  const { id, sid } = useLocalSearchParams<{ id: string; sid: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [part, setPart] = useState<Part | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reviewKey = `review:${sid}`
  const reviseKey = `revise:${sid}`
  const reviewJob = useJob(reviewKey)
  const reviseJob = useJob(reviseKey)

  const load = useCallback(async () => {
    try {
      const p = await api.getProject(id)
      setProject(p)
      setPart((cur) => cur ?? (p.scripts[sid] ? partFor(p.scripts[sid]) : 'script'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id, sid])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const script = project?.scripts[sid]
  if (!script) return <Screen>{error ? <Notice tone="bad">{error}</Notice> : <P muted>يحمّل…</P>}</Screen>

  const review = async () => {
    if (await run(reviewKey, TASKS.review, () => api.review(id, sid))) await load()
  }
  const revise = async () => {
    const next = await run(reviseKey, TASKS.revise, () => api.revise(id, sid))
    if (next) router.replace({ pathname: '/p/[id]/[sid]', params: { id, sid: next.id } })
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: script.title }} />
      <Row>
        <Badge>{scriptLabel(script)}</Badge>
        <Badge>{LEVELS[script.content_level]}</Badge>
        <Badge>{script.duration_seconds} ث</Badge>
        {script.approved && <Badge tone="ok">✓ معتمد</Badge>}
      </Row>
      <Row>
        {(Object.keys(PARTS) as Part[]).map((p) => (
          <Chip key={p} label={PARTS[p]} on={part === p} onPress={() => setPart(p)} />
        ))}
      </Row>

      {part === 'script' && <ScriptPart script={script} />}
      {part === 'review' && (
        <ReviewPart
          script={script}
          reviewing={reviewJob}
          revising={reviseJob}
          onReview={() => void review()}
          onRevise={() => void revise()}
          onClear={() => {
            clearJob(reviewKey)
            clearJob(reviseKey)
          }}
        />
      )}
      {part === 'video' && <VideoPart projectId={id} script={script} onChanged={load} />}
      {part === 'approve' && <ApprovePart projectId={id} script={script} onSigned={load} />}

      {part === 'script' && !script.review && !reviewJob && (
        <Button
          title="راجع آليا ←"
          onPress={() => {
            setPart('review')
            void review()
          }}
        />
      )}
    </Screen>
  )
}

function ScriptPart({ script }: { script: Script }) {
  return (
    <>
      <Card tone="brand">
        <P strong>{script.hook}</P>
      </Card>
      {script.scenes.map((sc, i) => (
        <Card key={i}>
          <Row>
            <Badge tone="brand">المشهد {i + 1}</Badge>
            <Badge>
              {sc.start_second}–{sc.end_second} ث
            </Badge>
          </Row>
          {!!sc.voiceover && <P>{sc.voiceover}</P>}
          {!!sc.on_screen_text && (
            <P small muted>
              على الشاشة: {sc.on_screen_text}
            </P>
          )}
        </Card>
      ))}
      <H2>النصوص الشرعية</H2>
      {script.references.length === 0 && <P muted>هذه النسخة لا تقتبس نصا شرعيا.</P>}
      {script.references.map((r) => (
        <Card key={r.evidence_id} tone="ok">
          <Badge tone="ok">{r.usage === 'quoted' ? 'اقتباس حرفي من المصدر' : 'بالمعنى'}</Badge>
          <P strong>{r.arabic}</P>
          <P small>✓ {r.source}</P>
          {r.tafsir.map((t, i) => (
            <P key={i} small muted>
              {t.source}: {t.text}
            </P>
          ))}
          {r.sharh && (
            <P small muted>
              {r.sharh.source}: {r.sharh.text}
            </P>
          )}
        </Card>
      ))}
      {script.unverified_claims.length > 0 && <Notice tone="warn">وقائع لم يُتحقق منها: {script.unverified_claims.join('، ')}</Notice>}
      <P muted small>{script.ai_disclosure}</P>
    </>
  )
}

function ReviewPart({ script, reviewing, revising, onReview, onRevise, onClear }: {
  script: Script
  reviewing: ReturnType<typeof useJob>
  revising: ReturnType<typeof useJob>
  onReview: () => void
  onRevise: () => void
  onClear: () => void
}) {
  const job = revising ?? reviewing
  if (job) return <Progress task={job.task} started={job.started} error={job.error} onRetry={onClear} />
  const r = script.review
  if (!r)
    return (
      <Card>
        <H3>لم تُراجع هذه النسخة بعد</H3>
        <P muted>ثلاثة مراجعين آليين يفحصونها: علمي، وجمهور، ومعنى.</P>
        <Button title="راجع آليا" onPress={onReview} />
      </Card>
    )
  return (
    <>
      {r.blocking > 0 ? (
        <Notice tone="bad">{r.blocking} ملاحظة مانعة: صحّحها في نسخة جديدة قبل الاعتماد.</Notice>
      ) : (
        <Notice tone="ok">لا ملاحظات مانعة.</Notice>
      )}
      {r.findings.map((f, i) => (
        <Card key={i}>
          <Row>
            <Badge tone={f.severity === 'blocking' ? 'bad' : 'plain'}>{f.severity === 'blocking' ? 'مانعة' : 'اقتراح'}</Badge>
            <Badge>{REVIEWERS[f.reviewer]}</Badge>
            {f.scene > 0 && <Badge>المشهد {f.scene}</Badge>}
          </Row>
          <P>{f.issue}</P>
          <P small muted>
            التصحيح: {f.fix}
          </P>
        </Card>
      ))}
      {r.blocking > 0 && <Button title="صحّح في نسخة جديدة" onPress={onRevise} />}
    </>
  )
}

function VideoPart({ projectId, script, onChanged }: { projectId: string; script: Script; onChanged: () => Promise<void> }) {
  const [templates, setTemplates] = useState<VideoTemplate[] | null>(null)
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.templates().then(setTemplates, () => setTemplates([]))
  }, [])
  const loadVideos = useCallback(() => api.videos(projectId, script.id).then(setVideos, () => setVideos([])), [projectId, script.id])
  useEffect(() => {
    void loadVideos()
  }, [loadVideos])
  // A render takes minutes: the list is polled while one runs.
  const running = videos?.some((v) => ACTIVE.has(v.status))
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => void loadVideos(), 5000)
    return () => clearInterval(t)
  }, [running, loadVideos])

  const tall = aspectOf(script.platforms) === '9:16'
  // Story templates need their own story written first; the app offers the others.
  const usable = (templates ?? []).filter((t) => t.ready && !t.story && (t.aspect === (tall ? '9:16' : '16:9') || t.aspect === 'any'))
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const latest = videos?.[0]
  const chosen = templates?.find((t) => t.id === script.template)

  return (
    <>
      <Card>
        <H3>القالب</H3>
        {templates === null && <P muted>يحمّل…</P>}
        {(usable.length ? usable : (templates ?? []).filter((t) => t.ready && !t.story)).map((t) => (
          <Chip
            key={t.id}
            label={`${script.template === t.id ? '✓ ' : ''}${t.name}`}
            on={script.template === t.id}
            onPress={() => void act(async () => {
              await api.chooseTemplate(projectId, script.id, t.id)
              await onChanged()
            })}
          />
        ))}
        {chosen && <P small muted>{chosen.description}</P>}
      </Card>
      {error && <Notice tone="bad">{error}</Notice>}
      {script.template && !running && (
        <Button
          title={script.approved ? 'أنشئ الفيديو النهائي' : 'أنشئ فيديو المعاينة (بعلامة مائية)'}
          busy={busy}
          onPress={() => void act(async () => {
            await api.createVideo(projectId, script.id, script.template!)
            await loadVideos()
          })}
        />
      )}
      {latest && (
        <Card>
          <Row>
            <Badge tone={latest.status === 'done' ? 'ok' : latest.status === 'failed' ? 'bad' : 'info'}>{VIDEO_STATUS[latest.status]}</Badge>
            <Badge tone={latest.preview ? 'warn' : 'ok'}>{latest.preview ? 'معاينة بعلامة مائية' : 'الفيديو النهائي'}</Badge>
            {latest.duration_seconds != null && <Badge>{Math.round(latest.duration_seconds)} ث</Badge>}
          </Row>
          {ACTIVE.has(latest.status) && <P muted>يُصنع الفيديو، يأخذ عادة بضع دقائق. يمكنك الخروج والعودة.</P>}
          {latest.error && <Notice tone="bad">{latest.error}</Notice>}
          {latest.status === 'done' && latest.url && (
            <>
              <VideoPlayer uri={BASE + latest.url} poster={latest.frames[0] ? BASE + latest.frames[0] : null} tall={tall} seconds={latest.duration_seconds} />
              <Button title="شارك الفيديو" kind="ghost" onPress={() => void Share.share({ message: `${script.title}\n${BASE + latest.url}` })} />
            </>
          )}
        </Card>
      )}
      {latest?.status === 'done' && <Feedback videoId={latest.id} />}
    </>
  )
}

function ApprovePart({ projectId, script, onSigned }: { projectId: string; script: Script; onSigned: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signed = new Set(script.approvals.map((a) => a.role))
  const mine = script.required_approvals.some((r) => r.role === 'creator') && !signed.has('creator')

  const sign = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.approve(projectId, script.id, 'creator', name.trim())
      await onSigned()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {script.approved ? <Notice tone="ok">النسخة معتمدة: وقّع كل من تتطلبه.</Notice> : <Notice>لا تُنشر النسخة حتى يوقّع كل من تتطلبه باسمه.</Notice>}
      {script.required_approvals.map((r) => {
        const a = script.approvals.find((x) => x.role === r.role)
        return (
          <Card key={r.role}>
            <Row>
              <H3>{ROLES[r.role]}</H3>
              {a ? <Badge tone="ok">✓ وقّع: {a.name}</Badge> : <Badge tone="warn">ينتظر</Badge>}
            </Row>
            <P small muted>{r.reason}</P>
            {r.role === 'scholar' && !a && <P small>تعيّن المنصة مراجعا شرعيا مختصا، ويصله رابط دعوة خاص به.</P>}
          </Card>
        )
      })}
      {mine && (
        <Card>
          <H3>وقّع بصفتك صانع المحتوى</H3>
          <Field label="اسمك" value={name} onChangeText={setName} maxLength={80} />
          {error && <Notice tone="bad">{error}</Notice>}
          <Button title="أعتمد هذه النسخة" onPress={() => void sign()} disabled={name.trim().length < 2} busy={busy} />
        </Card>
      )}
      <View>
        <Button
          title="شارك رابط القراءة مع مراجع"
          kind="ghost"
          onPress={() => void Share.share({ message: `${script.title}\n${SITE}/#/review/${projectId}/${script.id}` })}
        />
      </View>
    </>
  )
}
