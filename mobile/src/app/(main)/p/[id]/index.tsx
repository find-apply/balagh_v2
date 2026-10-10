import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api'
import { HeaderTitle } from '@/components/kit'
import { ChangeRequestCard, ContinueCard, planFor, SecondOpinion } from '@/components/project/Continue'
import type { Part } from '@/components/project/Continue'
import { IdeaCard, ideaMeta } from '@/components/project/IdeaCard'
import { BigButton, Collapsible, href, LinkRow, Note, p } from '@/components/project/parts'
import { useRole } from '@/components/project/role'
import { SourceCard } from '@/components/project/SourceCard'
import { Notice, P, Progress, s, Screen } from '@/components/ui'
import { clearJob, run, useJob } from '@/jobs'
import { loadPrefs } from '@/prefs'
import { LANGUAGES, PLATFORMS } from '@/shared/labels'
import { TASKS } from '@/shared/tasks'
import type { Idea, Project, Script } from '@/shared/types'
import { C, F } from '@/theme'

/** A project: with no version yet, the three ideas to choose from; then, the latest version to continue. */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [hasVideo, setHasVideo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Idea | null>(null)
  const { role } = useRole()
  const scriptKey = `script:${id}`
  const ideasKey = `ideas:${id}`
  const scriptJob = useJob(scriptKey)
  const ideasJob = useJob(ideasKey)

  const load = useCallback(async () => {
    try {
      const p = await api.getProject(id)
      setProject(p)
      setError(null)
      const all = Object.values(p.scripts)
      const latest = all[all.length - 1]
      if (latest)
        api.videos(id, latest.id).then(
          (vs) => setHasVideo(vs.some((v) => v.status === 'done')),
          () => setHasVideo(false),
        )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const scripts = project ? Object.values(project.scripts) : []
  const latest: Script | undefined = scripts[scripts.length - 1]
  const reviewJob = useJob(`review:${latest?.id ?? ''}`)

  const write = async (idea: Idea) => {
    setPicked(idea)
    const script = await run(scriptKey, TASKS.script, () => api.createScript(id, idea.id))
    if (!script) return
    router.push({ pathname: '/p/[id]/[sid]', params: { id, sid: script.id } })
    // With automatic review on (Settings), the three reviewers start as soon as the script exists, as on the site.
    if ((await loadPrefs()).autoReview) void run(`review:${script.id}`, TASKS.review, () => api.review(id, script.id))
  }

  const moreIdeas = async () => {
    if (!project) return
    const next = await run(ideasKey, TASKS.ideas, () => api.createProject({ ...project.brief, author: role }))
    if (next) router.replace({ pathname: '/p/[id]', params: { id: next.id } })
  }

  const open = (sid: string, part?: Part) => router.push({ pathname: '/p/[id]/[sid]', params: part ? { id, sid, part } : { id, sid } })

  if (!project) return <Screen>{error ? <Notice tone="bad">{error}</Notice> : <P muted>يحمّل…</P>}</Screen>

  const brief = project.brief
  const title = brief.idea?.trim() || latest?.title || project.ideas[0]?.title || 'مشروع'
  const sub = [brief.audience, LANGUAGES[brief.language], brief.platforms.map((pl) => PLATFORMS[pl]).join('، ')].filter(Boolean).join(' · ')
  const header = <Stack.Screen options={{ headerTitle: () => <HeaderTitle title={title} sub={sub} /> }} />

  // A long job (a script, new ideas) takes the whole screen; leaving it does not stop it.
  const running = (scriptJob && !scriptJob.error ? scriptJob : null) ?? (ideasJob && !ideasJob.error ? ideasJob : null)
  if (running)
    return (
      <Screen>
        {header}
        <Progress task={running.task} started={running.started} />
      </Screen>
    )

  const failed = scriptJob?.error ? (
    <Progress
      task={scriptJob.task}
      started={scriptJob.started}
      error={scriptJob.error}
      onRetry={() => {
        clearJob(scriptKey)
        if (picked) void write(picked)
      }}
    />
  ) : ideasJob?.error ? (
    <Progress
      task={ideasJob.task}
      started={ideasJob.started}
      error={ideasJob.error}
      onRetry={() => {
        clearJob(ideasKey)
        void moreIdeas()
      }}
    />
  ) : null

  if (!latest) return <Choose project={project} header={header} failed={failed} onWrite={(i) => void write(i)} onMore={() => void moreIdeas()} />

  // Versions are numbered in the order they were made; the latest is the one to continue.
  // The version's own number, as the site shows it: a revision counts up from the script it corrects.
  const number = (sid: string) => project.scripts[sid]?.version ?? 1
  const plan = planFor(latest, hasVideo, !!reviewJob && !reviewJob.error)
  const request = !latest.approved ? latest.change_requests[latest.change_requests.length - 1] : undefined
  const earlier = scripts.slice(0, -1).reverse()
  const used = new Set(scripts.map((sc) => sc.idea_id))
  const others = project.ideas.filter((i) => !used.has(i.id))

  return (
    <Screen>
      {header}
      {failed}
      {latest.author === 'specialist' && (
        <Note icon="shield-checkmark-outline">مختص شرعي: تعتمد محتواك بنفسك، والمراجعة الآلية تنبّهك ولا تلزمك.</Note>
      )}
      {request && <ChangeRequestCard request={request} onFix={() => open(latest.id, 'review')} />}
      <ContinueCard script={latest} number={number(latest.id)} plan={plan} onOpen={(part) => open(latest.id, part)} />
      {latest.author === 'specialist' && !latest.approved && <SecondOpinion onPress={() => open(latest.id, 'approve')} />}
      {latest.approved && (
        <BigButton kind="ghost" title="انشره لجمهور آخر" hint="يوطّن السيناريو للغة أو جمهور آخر" onPress={() => router.push(href('/localize', { id, sid: latest.id }))} />
      )}

      {earlier.length > 0 && (
        <Collapsible title={`نسخ سابقة (${earlier.length})`}>
          {earlier.map((sc, i) => {
            const status = versionStatus(sc, scripts, number)
            return <LinkRow key={sc.id} first={i === 0} title={`النسخة ${number(sc.id)} · ${sc.title}`} sub={status.text} subColor={status.color} onPress={() => open(sc.id)} />
          })}
        </Collapsible>
      )}

      {others.length > 0 && (
        <Collapsible title={`الأفكار الأخرى (${others.length})`}>
          {others.map((idea, i) => (
            <LinkRow key={idea.id} first={i === 0} title={idea.title} sub={ideaMeta(idea)} hint="يكتب سيناريو من هذه الفكرة" onPress={() => void write(idea)} />
          ))}
        </Collapsible>
      )}
    </Screen>
  )
}

function versionStatus(sc: Script, all: Script[], number: (sid: string) => number): { text: string; color?: string } {
  const fixed = all.find((o) => o.revised_from === sc.id)
  const after = fixed ? ` · صُحّحت في النسخة ${number(fixed.id)}` : ''
  if (sc.approved) return { text: '✓ معتمدة', color: C.ok }
  if (sc.change_requests.length) return { text: `طلب المراجع تعديلا${after}`, color: C.info }
  if (sc.review?.blocking) return { text: `${sc.review.blocking} ملاحظة مانعة${after}`, color: C.bad }
  if (sc.review) return { text: `رُوجعت${after}` }
  return { text: `لم تُراجع${after}` }
}

/** No version yet: the ideas, one chosen, and the button that writes its script. */
function Choose({ project, header, failed, onWrite, onMore }: { project: Project; header: ReactNode; failed: ReactNode; onWrite: (i: Idea) => void; onMore: () => void }) {
  const [selected, setSelected] = useState(0)
  const insets = useSafeAreaInsets()
  const idea = project.ideas[selected] ?? project.ideas[0]
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header}
      <ScrollView style={s.screen} contentContainerStyle={[s.screenInner, { gap: 12, paddingBottom: 24 }]}>
        {failed}
        <View style={{ gap: 2 }}>
          <Text style={s.h2} accessibilityRole="header">
            اختر فكرة
          </Text>
          <Text style={[p.body, { color: C.muted }]}>اقترح بلاغ ثلاث زوايا. اختر واحدة ليكتب منها السيناريو.</Text>
        </View>
        {project.source && <SourceCard source={project.source} />}
        <View accessibilityRole="radiogroup" accessibilityLabel="الأفكار" style={{ gap: 12 }}>
          {project.ideas.map((it, i) => (
            <IdeaCard key={it.id} idea={it} n={i + 1} selected={selected === i} onSelect={() => setSelected(i)} />
          ))}
        </View>
        {project.ideas.length === 0 && <Notice tone="warn">لم يقترح بلاغ أفكارا لهذا الموضوع.</Notice>}
        <View style={st.again}>
          <Text style={p.muted}>لم تعجبك؟</Text>
          <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => [st.againButton, pressed && { opacity: 0.8 }]}>
            <Ionicons name="refresh" size={15} color={C.brand} />
            <Text style={st.againText}>اقترح أفكارا أخرى</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/new')} style={st.edit}>
            <Text style={st.againText}>عدّل الموضوع</Text>
          </Pressable>
        </View>
      </ScrollView>
      {idea && (
        <View style={[st.bottom, { paddingBottom: 12 + Math.max(insets.bottom, 10) }]}>
          <BigButton title={`اكتب السيناريو من الفكرة ${selected + 1}`} onPress={() => onWrite(idea)} />
        </View>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  again: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 4 },
  againButton: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 22, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  againText: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  edit: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  bottom: { paddingTop: 12, paddingHorizontal: 16, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -8 }, elevation: 8 },
})
