import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { api } from '@/api'
import { HeaderTitle } from '@/components/kit'
import { BigButton, Choice, Choices, Note, p, Section, SectionTitle } from '@/components/project/parts'
import { Notice, P, Progress, Screen } from '@/components/ui'
import { clearJob, run, useJob } from '@/jobs'
import { GROUPS } from '@/shared/audiences'
import { LANGUAGES } from '@/shared/labels'
import { TASKS } from '@/shared/tasks'
import type { Language, Script } from '@/shared/types'

/** An approved version, adapted for another language or audience: a new version in the same project. */
export default function Localize() {
  const { id, sid } = useLocalSearchParams<{ id: string; sid: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>('en')
  const [group, setGroup] = useState(0)
  const key = `localize:${sid}`
  const job = useJob(key)

  useEffect(() => {
    api.getProject(id).then(
      (pr) => {
        const sc = pr.scripts[sid]
        if (!sc) return setError('لم توجد هذه النسخة.')
        setScript(sc)
        // Start from something other than what the version already speaks.
        setLanguage(sc.target.language === 'ar' ? 'en' : 'ar')
        const other = GROUPS.findIndex((g) => g.label !== sc.target.audience)
        setGroup(Math.max(0, other))
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [id, sid])

  const localize = async () => {
    const g = GROUPS[group]
    const next = await run(key, TASKS.localize, () =>
      api.localize(id, sid, { audience: g.label, audience_knowledge: g.knowledge, language, dialect: null, tone: null }),
    )
    if (next) router.replace({ pathname: '/p/[id]/[sid]', params: { id, sid: next.id } })
  }

  const header = script && (
    <Stack.Screen
      options={{ headerTitle: () => <HeaderTitle title="انشره لجمهور آخر" sub={`من: ${script.title}${script.approved ? ' · ✓ معتمدة' : ''}`} /> }}
    />
  )

  if (job && !job.error)
    return (
      <Screen>
        {header}
        <Progress task={job.task} started={job.started} />
      </Screen>
    )
  if (!script) return <Screen>{error ? <Notice tone="bad">{error}</Notice> : <P muted>يحمّل…</P>}</Screen>

  return (
    <Screen>
      {header}
      {job?.error && (
        <Progress
          task={job.task}
          started={job.started}
          error={job.error}
          onRetry={() => {
            clearJob(key)
            void localize()
          }}
        />
      )}
      <Text style={p.body}>يكيّف بلاغ الأمثلة وأسلوب الشرح للجمهور الجديد، ويُدرج الترجمات المعتمدة للنصوص الشرعية من مصادرها، مع الحفاظ على المعنى.</Text>
      <Section>
        <SectionTitle>اللغة</SectionTitle>
        <Choices radio label="اللغة">
          {(Object.keys(LANGUAGES) as Language[]).map((l) => (
            <Choice key={l} radio label={LANGUAGES[l]} on={language === l} onPress={() => setLanguage(l)} />
          ))}
        </Choices>
        <SectionTitle>الجمهور</SectionTitle>
        <Choices radio label="الجمهور">
          {GROUPS.map((g, i) => (
            <Choice key={g.label} radio label={g.label} on={group === i} onPress={() => setGroup(i)} />
          ))}
        </Choices>
      </Section>
      <Note tone="info">النسخة الموطّنة تحتاج توقيع مراجع لغوي وثقافي، لأن الملاءمة اللغوية لا تُفحص آليا.</Note>
      <BigButton title={`وطّن السيناريو · ${LANGUAGES[language]}`} onPress={() => void localize()} />
      <Text style={[p.muted, { textAlign: 'center', fontSize: 12 }]}>يأخذ نحو دقيقة، وتظهر النسخة الجديدة في المشروع نفسه.</Text>
    </Screen>
  )
}
