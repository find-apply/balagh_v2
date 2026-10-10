import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { api, ApiError } from '@/api'
import { IconCircle } from '@/components/kit'
import { BigButton, Choice, Choices, p, Section, SectionTitle } from '@/components/project/parts'
import { useRole } from '@/components/project/role'
import { roleLabel } from '@/components/tabs/role'
import { NO_SOURCE, SourcePicker } from '@/components/project/SourcePicker'
import type { Source } from '@/components/project/SourcePicker'
import { Notice, Progress, s, Screen } from '@/components/ui'
import { clearJob, run, useJob } from '@/jobs'
import { GROUPS } from '@/shared/audiences'
import { ASPECTS, aspectOf, LANGUAGES, PLATFORMS } from '@/shared/labels'
import { TASKS } from '@/shared/tasks'
import type { Brief, Language, Platform } from '@/shared/types'
import { C, F } from '@/theme'

const KEY = 'new-project'

/** The brief: a topic (or none), the audience, the language and one platform. The author's standing is the
 * admin's, shown and not chosen. */
export default function New() {
  const [idea, setIdea] = useState('')
  const [group, setGroup] = useState(0)
  const [language, setLanguage] = useState<Language>('ar')
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [paused, setPaused] = useState<string | null>(null)
  const [referral, setReferral] = useState<{ message: string; topic: string } | null>(null)
  const [source, setSource] = useState<Source>(NO_SOURCE)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const input = useRef<TextInput>(null)
  const { role, set } = useRole()
  const job = useJob(KEY)

  useEffect(() => {
    api.status().then(
      (st) => setPaused(st.paused ? st.message || 'أوقفت الإدارة التوليد مؤقتا.' : null),
      () => undefined,
    )
  }, [])

  const submit = async () => {
    if (paused) return
    const g = GROUPS[group]
    const topic = idea.trim()
    const brief: Brief = {
      author: role,
      idea: topic || null,
      audience: g.label,
      audience_knowledge: g.knowledge,
      language,
      dialect: null,
      tone: null,
      platforms: [platform],
      duration_seconds: null,
    }
    setSourceError(null)
    if (source.url.trim()) brief.source_url = source.url.trim()
    if (source.file) {
      setUploading(true)
      try {
        brief.source_file = (await api.upload(source.file)).id
      } catch (e) {
        setSourceError(e instanceof Error ? e.message : String(e))
        return
      } finally {
        setUploading(false)
      }
    }
    const project = await run(KEY, TASKS.ideas, () =>
      api.createProject(brief).catch((e: unknown) => {
        // A personal fatwa is referred to a specialist, and a paused server answers with the admin's message:
        // both are answers, not failures.
        if (e instanceof ApiError && e.referral) {
          setReferral({ message: e.message, topic })
          return null
        }
        if (e instanceof ApiError && e.status === 503) {
          setPaused(e.message)
          return null
        }
        throw e
      }),
    )
    if (project) router.replace({ pathname: '/p/[id]', params: { id: project.id } })
  }

  if (job && !job.error)
    return (
      <Screen>
        <Progress task={job.task} started={job.started} />
      </Screen>
    )

  if (referral)
    return (
      <Screen>
        <Section style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 18, gap: 12 }}>
          <IconCircle icon="people-outline" tone="info" />
          <Text style={[s.h2, { textAlign: 'center' }]} accessibilityRole="header">
            هذا سؤال يجيب عنه مختص
          </Text>
          <Text style={[p.body, { textAlign: 'center' }]}>موضوعك يطلب حكما لحالة شخصية بعينها. بلاغ يصنع محتوى عامّا موثّقا، ولا يصدر فتاوى.</Text>
          {!!referral.topic && (
            <View style={{ alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={p.body}>«{referral.topic}»</Text>
            </View>
          )}
          {!!referral.message && <Text style={[p.muted, { textAlign: 'center' }]}>{referral.message}</Text>}
        </Section>
        <Section>
          <SectionTitle>ما يمكنك فعله</SectionTitle>
          <Text style={p.body}>• اسأل عالما تثق به عن حالتك.</Text>
          <Text style={p.body}>• أو اجعل الموضوع عامّا ليفيد غيرك، مثل: «آداب البيع والشراء» بدل «هل بيعي هذا حلال؟».</Text>
          <BigButton
            title="اجعل الموضوع عامّا"
            onPress={() => {
              clearJob(KEY)
              setIdea('')
              setReferral(null)
              // The form mounts again on the next render; then its topic field takes the focus.
              setTimeout(() => input.current?.focus(), 100)
            }}
          />
        </Section>
      </Screen>
    )

  const aspect = aspectOf([platform])
  const off = paused !== null

  return (
    <Screen>
      {paused !== null && (
        <View style={st.paused} accessibilityRole="alert">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={st.pausedIcon}>
              <Ionicons name="pause" size={18} color="#f2d48a" />
            </View>
            <Text style={st.pausedTitle}>التوليد متوقف مؤقتا</Text>
          </View>
          <Text style={st.pausedText}>{paused}</Text>
          <Text style={st.pausedSmall}>مشاريعك ومكتبتك متاحة كالمعتاد. يعود التوليد حين تفعّله الإدارة.</Text>
        </View>
      )}
      {job?.error && (
        <Progress
          task={job.task}
          started={job.started}
          error={job.error}
          onRetry={() => {
            clearJob(KEY)
            void submit()
          }}
        />
      )}

      <View style={[{ gap: 14 }, off && { opacity: 0.55 }]} pointerEvents={off ? 'none' : 'auto'} accessibilityElementsHidden={off} importantForAccessibility={off ? 'no-hide-descendants' : 'auto'}>
        <Section style={{ gap: 8 }}>
          <Text style={st.label} nativeID="topic-label">
            الموضوع <Text style={{ fontFamily: F.medium, color: C.muted }}>(اختياري)</Text>
          </Text>
          <TextInput
            ref={input}
            accessibilityLabel="الموضوع (اختياري)"
            accessibilityLabelledBy="topic-label"
            placeholder="مثال: الصدق في البيع والشراء"
            placeholderTextColor="#8a938f"
            value={idea}
            onChangeText={setIdea}
            maxLength={2000}
            multiline
            editable={!off}
            style={[s.input, { minHeight: 90, textAlignVertical: 'top', fontSize: 15, lineHeight: 25 }]}
          />
          <Text style={p.muted}>اتركه فارغا ليقترح بلاغ المواضيع حسب جمهورك.</Text>
        </Section>

        <SourcePicker value={source} onChange={(v) => { setSource(v); setSourceError(null) }} error={sourceError} disabled={off || uploading} />

        <Section>
          <SectionTitle>الجمهور</SectionTitle>
          <Choices radio label="الجمهور">
            {GROUPS.map((g, i) => (
              <Choice key={g.label} radio label={g.label} on={group === i} onPress={() => setGroup(i)} disabled={off} />
            ))}
          </Choices>
        </Section>

        <Section>
          <SectionTitle>اللغة</SectionTitle>
          <Choices radio label="اللغة">
            {(Object.keys(LANGUAGES) as Language[]).map((l) => (
              <Choice key={l} radio label={LANGUAGES[l]} on={language === l} onPress={() => setLanguage(l)} disabled={off} />
            ))}
          </Choices>
          <View style={{ marginTop: 6 }}>
            <SectionTitle>المنصة</SectionTitle>
          </View>
          <Choices radio label="المنصة">
            {(Object.keys(PLATFORMS) as Platform[]).map((pl) => (
              <Choice key={pl} radio label={PLATFORMS[pl]} on={platform === pl} onPress={() => setPlatform(pl)} disabled={off} />
            ))}
          </Choices>
          <Text style={p.muted}>الفيديو {ASPECTS[aspect]}.</Text>
        </Section>

        <View style={st.role} accessibilityLabel={`صفتك: ${roleLabel(role)}. ${set ? 'حددتها الإدارة بعد التحقق' : 'لم تحددها الإدارة بعد'}`} accessible>
          <View style={st.roleIcon}>
            <Ionicons name="person-outline" size={18} color={C.brand} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={st.roleTitle}>صفتك: {roleLabel(role)}</Text>
            <Text style={st.roleSub}>
              {set ? 'حددتها الإدارة بعد التحقق. ' : 'لم تحددها الإدارة بعد. '}
              {role === 'specialist' ? 'تعتمد محتواك بنفسك، وتطلب مراجعة غيرك إن شئت.' : 'يراجع كل نسخة مختص شرعي قبل النشر.'}
            </Text>
          </View>
          <Ionicons name="lock-closed-outline" size={16} color="#3d5a50" />
        </View>
      </View>

      {!!sourceError && <Notice tone="bad">{sourceError}</Notice>}
      <BigButton
        title={uploading ? 'يرفع الملف…' : source.url.trim() || source.file ? 'اقترح أفكارا من المصدر' : 'اقترح ثلاث أفكار'}
        onPress={() => void submit()}
        disabled={off || uploading}
      />
      {off && <BigButton kind="ghost" title="عُد إلى مشاريعك" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
    </Screen>
  )
}

const st = {
  label: { fontSize: 15, fontFamily: F.bold, color: C.ink },
  paused: { backgroundColor: C.ink, borderRadius: 18, padding: 18, gap: 10 },
  pausedIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(242,212,138,0.18)', alignItems: 'center' as const, justifyContent: 'center' as const },
  pausedTitle: { fontSize: 17, fontFamily: F.bold, color: '#fff' },
  pausedText: { fontSize: 14, lineHeight: 25, fontFamily: F.regular, color: 'rgba(255,255,255,0.88)' },
  pausedSmall: { fontSize: 12, lineHeight: 20, fontFamily: F.regular, color: 'rgba(255,255,255,0.7)' },
  role: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: C.brandSoft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  roleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  roleTitle: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  roleSub: { fontSize: 12, lineHeight: 20, fontFamily: F.regular, color: '#3d5a50' },
}
