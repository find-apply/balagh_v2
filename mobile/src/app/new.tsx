import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { api } from '../api'
import { clearJob, run, useJob } from '../jobs'
import { Button, Card, Chip, Field, H3, Notice, P, Progress, Row, Screen } from '../components/ui'
import { GROUPS } from '../shared/audiences'
import { AUTHORS, LANGUAGES, PLATFORMS } from '../shared/labels'
import { TASKS } from '../shared/tasks'
import type { AuthorRole, Brief, Language, Platform } from '../shared/types'

const KEY = 'new-project'

/** The brief: everything has an automatic choice, as on the site; the topic may be left to Balagh. */
export default function New() {
  const [idea, setIdea] = useState('')
  const [group, setGroup] = useState(0)
  const [language, setLanguage] = useState<Language>('ar')
  const [platforms, setPlatforms] = useState<Platform[]>(['tiktok', 'instagram_reels'])
  const [author, setAuthor] = useState<AuthorRole>('creator')
  const [referral, setReferral] = useState<string | null>(null)
  const job = useJob(KEY)

  const toggle = (p: Platform) => setPlatforms((all) => (all.includes(p) ? all.filter((x) => x !== p) : [...all, p]))

  const submit = async () => {
    setReferral(null)
    const g = GROUPS[group]
    const brief: Brief = {
      author,
      idea: idea.trim() || null,
      audience: g.label,
      audience_knowledge: g.knowledge,
      language,
      dialect: null,
      tone: null,
      platforms,
      duration_seconds: null,
    }
    const project = await run(KEY, TASKS.ideas, () =>
      api.createProject(brief).catch((e) => {
        // A personal fatwa is referred to a specialist: that is an answer, not a failure.
        if (e?.referral) {
          setReferral(e.message)
          return null
        }
        throw e
      }),
    )
    if (project) router.replace({ pathname: '/p/[id]', params: { id: project.id } })
  }

  if (job && !job.error) return <Screen><Progress task={job.task} started={job.started} /></Screen>

  return (
    <Screen>
      {job?.error && <Progress task={job.task} started={job.started} error={job.error} onRetry={() => { clearJob(KEY); void submit() }} />}
      {referral && <Notice tone="warn">{referral}</Notice>}
      <Card>
        <Field label="الموضوع (اختياري)" placeholder="مثال: الصدق في البيع والشراء" value={idea} onChangeText={setIdea} maxLength={2000} multiline />
        <P muted small>اتركه فارغا ليقترح بلاغ المواضيع حسب جمهورك.</P>
      </Card>
      <Card>
        <H3>الجمهور</H3>
        <Row>
          {GROUPS.map((g, i) => (
            <Chip key={g.label} label={g.label} on={group === i} onPress={() => setGroup(i)} />
          ))}
        </Row>
      </Card>
      <Card>
        <H3>اللغة</H3>
        <Row>
          {(Object.keys(LANGUAGES) as Language[]).map((l) => (
            <Chip key={l} label={LANGUAGES[l]} on={language === l} onPress={() => setLanguage(l)} />
          ))}
        </Row>
        <H3>المنصات</H3>
        <Row>
          {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
            <Chip key={p} label={PLATFORMS[p]} on={platforms.includes(p)} onPress={() => toggle(p)} />
          ))}
        </Row>
      </Card>
      <Card>
        <H3>صفتك</H3>
        <Row>
          {(Object.keys(AUTHORS) as AuthorRole[]).map((a) => (
            <Chip key={a} label={AUTHORS[a].label} on={author === a} onPress={() => setAuthor(a)} />
          ))}
        </Row>
        <P muted small>{AUTHORS[author].hint}</P>
      </Card>
      <View>
        <Button title="اقترح ثلاث أفكار" onPress={() => void submit()} disabled={platforms.length === 0} />
      </View>
    </Screen>
  )
}
