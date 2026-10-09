import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { api } from '@/api'
import { clearJob, run, useJob } from '@/jobs'
import { loadPrefs } from '@/prefs'
import { Badge, Button, Card, H2, H3, Notice, P, Progress, Row, Screen, s } from '@/components/ui'
import { KNOWLEDGE, LANGUAGES, LEVELS, scriptLabel } from '@/shared/labels'
import { TASKS } from '@/shared/tasks'
import type { Idea, Project } from '@/shared/types'

/** A project: its versions so far, and the three ideas with the texts each one rests on. */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = `script:${id}`
  const job = useJob(key)

  const load = useCallback(async () => {
    try {
      setProject(await api.getProject(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const pick = async (idea: Idea) => {
    const script = await run(key, TASKS.script, () => api.createScript(id, idea.id))
    if (!script) return
    router.push({ pathname: '/p/[id]/[sid]', params: { id, sid: script.id } })
    // With automatic review on (Settings), the three reviewers start as soon as the script exists, as on the site.
    if ((await loadPrefs()).autoReview) void run(`review:${script.id}`, TASKS.review, () => api.review(id, script.id))
  }

  if (!project) return <Screen>{error ? <Notice tone="bad">{error}</Notice> : <P muted>يحمّل…</P>}</Screen>
  const scripts = Object.values(project.scripts).reverse()
  const title = project.brief.idea || project.ideas[0]?.title || 'مشروع'

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Row>
        <Badge>{project.brief.audience}</Badge>
        <Badge>{LANGUAGES[project.brief.language]}</Badge>
        <Badge>{KNOWLEDGE[project.brief.audience_knowledge]}</Badge>
      </Row>

      {job && <Progress task={job.task} started={job.started} error={job.error} onRetry={() => clearJob(key)} />}

      {scripts.length > 0 && (
        <Card>
          <H3>السيناريوهات</H3>
          {scripts.map((sc) => (
            <Pressable key={sc.id} onPress={() => router.push({ pathname: '/p/[id]/[sid]', params: { id, sid: sc.id } })} style={{ gap: 6, paddingVertical: 6 }}>
              <Text style={s.h3}>{sc.title}</Text>
              <Row>
                <Badge>{scriptLabel(sc)}</Badge>
                {sc.approved ? <Badge tone="ok">✓ معتمد</Badge> : sc.review?.blocking ? <Badge tone="bad">{sc.review.blocking} ملاحظة مانعة</Badge> : sc.review ? <Badge tone="info">رُوجع</Badge> : <Badge tone="warn">لم يُراجع</Badge>}
              </Row>
            </Pressable>
          ))}
        </Card>
      )}

      <H2>الأفكار الثلاث</H2>
      {project.ideas.map((idea, n) => (
        <Card key={idea.id}>
          <Row>
            <Badge tone="brand">الفكرة {n + 1}</Badge>
            <Badge>{LEVELS[idea.content_level]}</Badge>
            <Badge>{idea.duration_seconds} ث</Badge>
          </Row>
          <H3>{idea.title}</H3>
          <P>{idea.hook}</P>
          <P muted small>{idea.concept}</P>
          {idea.evidence.map((e) => (
            <Card key={e.id} tone="ok" style={{ padding: 12, gap: 4 }}>
              <P strong>{e.text}</P>
              <P small muted>✓ {e.source}</P>
            </Card>
          ))}
          {idea.unverified.length > 0 && <Notice tone="warn">لم يُوثَّق، فلن يُستعمل: {idea.unverified.join('، ')}</Notice>}
          <Button title="اكتب السيناريو من هذه الفكرة" kind={n === 0 ? 'primary' : 'ghost'} disabled={!!job && !job.error} onPress={() => void pick(idea)} />
        </Card>
      ))}
    </Screen>
  )
}
