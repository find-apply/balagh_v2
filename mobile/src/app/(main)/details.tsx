import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import type { Href } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { api, BASE } from '@/api'
import { HeaderTitle, Stepper } from '@/components/kit'
import { Badge, Button, Notice, P } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { duration } from '@/components/tabs/format'
import { markVideosSeen } from '@/prefs'
import { GROUPS } from '@/shared/audiences'
import { aspectOf, ASPECTS, AUTHORS, LANGUAGES, PLATFORMS, REVIEWERS, ROLES } from '@/shared/labels'
import type { Language, Platform, Project, Video, VideoTemplate } from '@/shared/types'
import { C, F } from '@/theme'

const MUTED_BRAND = '#9fb8ae'

const day = (iso: string) => new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'long' })
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`

type SectionKey = 'script' | 'review' | 'video' | 'approve'

/** A read-only section: a muted number (or icon), its title and a lock. */
function Section({ mark, title, children, onLayout }: { mark: ReactNode; title: string; children: ReactNode; onLayout?: (y: number) => void }) {
  return (
    <View style={st.card} onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}>
      <View style={st.sectionHead}>
        <View style={st.sectionMark}>{typeof mark === 'string' || typeof mark === 'number' ? <Text style={st.sectionMarkText}>{mark}</Text> : mark}</View>
        <Text style={st.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <Ionicons name="lock-closed-outline" size={16} color={C.muted} accessibilityLabel="للعرض فقط" />
      </View>
      {children}
    </View>
  )
}

/** The choices the video was made with: the chosen one marked, the others greyed out, none pressable. */
function ReadChips({ labels, chosen }: { labels: string[]; chosen: (label: string) => boolean }) {
  return (
    <View style={st.chips}>
      {labels.map((label) => {
        const on = chosen(label)
        return (
          <View key={label} style={[st.chip, on && st.chipOn]} accessibilityState={{ selected: on, disabled: true }} accessible accessibilityLabel={label}>
            <Text style={[st.chipText, on && st.chipTextOn]}>{on ? `✓ ${label}` : label}</Text>
          </View>
        )
      })}
    </View>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={st.groupLabel}>{label}</Text>
      {children}
    </View>
  )
}

/** A library video's details: the video itself, then the choices it was made with, read-only. */
export default function Details() {
  const { projectId, scriptId, videoId } = useLocalSearchParams<{ projectId: string; scriptId: string; videoId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [templates, setTemplates] = useState<VideoTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const scroll = useRef<ScrollView>(null)
  const [offsets, setOffsets] = useState<Partial<Record<SectionKey, number>>>({})

  useEffect(() => {
    if (videoId) void markVideosSeen([videoId])
  }, [videoId])

  useEffect(() => {
    let live = true
    Promise.all([api.getProject(projectId), api.video(videoId)]).then(
      ([p, v]) => {
        if (!live) return
        setProject(p)
        setVideo(v)
      },
      (e) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    api.templates().then((t) => live && setTemplates(t), () => undefined)
    return () => {
      live = false
    }
  }, [projectId, videoId])

  const script = project?.scripts[scriptId]

  if (error || !project || !video || !script) {
    return (
      <View style={st.center}>
        {error ? <Notice tone="bad">{error}</Notice> : project && !script ? <Notice tone="bad">لم توجد هذه النسخة في المشروع.</Notice> : <ActivityIndicator color={C.brand} size="large" />}
      </View>
    )
  }

  const template = templates.find((t) => t.id === video.template)
  const aspect = template?.aspect === '16:9' || template?.aspect === '9:16' ? template.aspect : aspectOf(script.platforms)
  const tall = aspect !== '16:9'
  const others = templates.filter((t) => t.id !== video.template && t.ready && !t.story && (t.aspect === aspect || t.aspect === 'any')).slice(0, 3)
  const audiences = GROUPS.map((g) => g.label)
  if (!audiences.includes(script.target.audience)) audiences.unshift(script.target.audience)
  const findings = script.review?.findings ?? []
  const scrollTo = (key: SectionKey) => scroll.current?.scrollTo({ y: Math.max(0, (offsets[key] ?? 0) - 8), animated: true })
  const at = (key: SectionKey) => (y: number) => setOffsets((o) => (o[key] === y ? o : { ...o, [key]: y }))

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <HeaderTitle title={script.title} sub={`النسخة ${script.version} · ${video.preview ? 'معاينة' : 'الفيديو النهائي'} · ${day(video.created_at)}`} />
          ),
        }}
      />
      <ScrollView ref={scroll} style={{ backgroundColor: C.bg }} contentContainerStyle={st.inner}>
        <View style={st.card}>
          {video.url ? (
            <VideoPlayer uri={BASE + video.url} poster={video.frames[0] ? BASE + video.frames[0] : null} tall={tall} seconds={video.duration_seconds} />
          ) : (
            <Notice tone="warn">الفيديو غير متاح للتشغيل.</Notice>
          )}
          <View style={st.badges}>
            {script.approved && <Badge tone="ok">✓ معتمد</Badge>}
            {video.preview && <Badge tone="warn">معاينة</Badge>}
            <Badge>{template?.name ?? video.template}</Badge>
            {video.duration_seconds != null && <Badge>{duration(video.duration_seconds)}</Badge>}
          </View>
          <View style={st.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="قيّم الفيديو"
              onPress={() => router.push({ pathname: '/rate', params: { vid: video.id, title: script.title } } as unknown as Href)}
              style={({ pressed }) => [st.action, st.rate, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="star" size={17} color="#6b4800" />
              <Text style={[st.actionText, { color: '#6b4800' }]}>قيّم</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="شارك الفيديو"
              disabled={!video.url}
              onPress={() => void Share.share({ message: `${script.title}\n${BASE + video.url}` })}
              style={({ pressed }) => [st.action, st.share, !video.url && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="share-social-outline" size={18} color={C.brand} />
              <Text style={[st.actionText, { color: C.brand, fontFamily: F.semibold }]}>شارك</Text>
            </Pressable>
          </View>
        </View>

        <View style={st.note} accessibilityRole="text">
          <Ionicons name="eye-outline" size={20} color="#3d4a45" />
          <Text style={st.noteText}>
            <Text style={{ fontFamily: F.bold, color: C.ink }}>للعرض فقط. </Text>
            هذه الاختيارات التي صُنع بها الفيديو، ولا تُعدَّل من هنا.
          </Text>
        </View>

        <Stepper
          steps={[
            { label: 'السيناريو', state: 'done', onPress: () => scrollTo('script') },
            { label: 'المراجعة', state: 'done', onPress: () => scrollTo('review') },
            { label: 'الفيديو', state: 'done', onPress: () => scrollTo('video') },
            { label: 'الاعتماد', state: 'done', onPress: () => scrollTo('approve') },
          ]}
        />

        <Section mark={<Ionicons name="document-text-outline" size={15} color="#fff" />} title="الطلب">
          <View style={{ gap: 6 }}>
            <Text style={st.groupLabel}>الموضوع</Text>
            <View style={st.readField}>
              <Text style={st.readFieldText}>{project.brief.idea || 'اختاره بلاغ'}</Text>
            </View>
          </View>
          <Group label="الجمهور">
            <ReadChips labels={audiences} chosen={(l) => l === script.target.audience} />
          </Group>
          <Group label="اللغة">
            <ReadChips labels={(Object.keys(LANGUAGES) as Language[]).map((l) => LANGUAGES[l])} chosen={(l) => l === LANGUAGES[script.target.language]} />
          </Group>
          <Group label="المنصة">
            <ReadChips
              labels={(Object.keys(PLATFORMS) as Platform[]).map((p) => PLATFORMS[p])}
              chosen={(l) => script.platforms.some((p) => PLATFORMS[p] === l)}
            />
          </Group>
          <View style={st.kvLine}>
            <Text style={st.groupLabel}>صفة صانع المحتوى</Text>
            <Text style={st.kvValue}>{AUTHORS[script.author].label}</Text>
          </View>
        </Section>

        <Section mark={1} title="السيناريو" onLayout={at('script')}>
          <P strong>{script.hook}</P>
          <View style={{ gap: 10 }}>
            {script.scenes.map((sc, i) => (
              <View key={i} style={st.scene}>
                <Text style={st.sceneTime}>{clock(sc.start_second)}</Text>
                <View style={{ flex: 1 }}>
                  <P small>{sc.voiceover || sc.on_screen_text || sc.visual}</P>
                </View>
              </View>
            ))}
          </View>
          {script.references.map((r) => (
            <Text key={r.evidence_id} style={st.reference}>
              ✓ {r.source} · {r.usage === 'quoted' ? 'منقول حرفيا' : 'بالمعنى'}
            </Text>
          ))}
        </Section>

        <Section mark={2} title="المراجعة" onLayout={at('review')}>
          {script.review ? (
            <>
              <View style={st.reviewers}>
                {(Object.keys(REVIEWERS) as (keyof typeof REVIEWERS)[]).map((k) => {
                  const blocking = findings.filter((f) => f.reviewer === k && f.severity === 'blocking').length
                  return (
                    <View key={k} style={st.reviewer} accessible accessibilityLabel={`${REVIEWERS[k]}: ${blocking ? `${blocking} ملاحظة مانعة` : 'لا ملاحظات مانعة'}`}>
                      <Ionicons name={blocking ? 'alert-circle' : 'checkmark'} size={17} color={blocking ? C.warn : C.ok} />
                      <Text style={st.reviewerText}>{REVIEWERS[k]}</Text>
                    </View>
                  )
                })}
              </View>
              <P small muted>
                {script.review.blocking ? `${script.review.blocking} ملاحظة مانعة.` : 'لا ملاحظات مانعة.'}
                {findings.some((f) => f.severity === 'suggestion') ? ` ${findings.filter((f) => f.severity === 'suggestion').length} اقتراح.` : ''}
                {script.review.note ? ` ${script.review.note}` : ''}
              </P>
            </>
          ) : (
            <P small muted>لم تُشغَّل المراجعة الآلية على هذه النسخة.</P>
          )}
        </Section>

        <Section mark={3} title="الفيديو" onLayout={at('video')}>
          <View style={st.templates}>
            <View style={st.template} accessible accessibilityLabel={`القالب المختار: ${template?.name ?? video.template}`}>
              <View style={[st.templateFrame, { aspectRatio: tall ? 9 / 16 : 16 / 9 }, st.templateOn]}>
                {video.frames[0] && <Image source={{ uri: BASE + video.frames[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                <View style={st.templateCheck}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              </View>
              <Text style={[st.templateName, { color: '#3d4a45', fontFamily: F.bold }]}>{template?.name ?? video.template}</Text>
            </View>
            {others.slice(0, tall ? 1 : 0).map((t) => (
              <View key={t.id} style={[st.template, { opacity: 0.4 }]} importantForAccessibility="no-hide-descendants">
                <View style={[st.templateFrame, { aspectRatio: 9 / 16, backgroundColor: '#1b1a2e' }]} />
                <Text style={st.templateName}>{t.name}</Text>
              </View>
            ))}
            {tall && others.length === 0 && <View style={st.template} />}
          </View>
          <P small muted>
            {script.scenes.length} مشاهد · {ASPECTS[aspect]}
            {video.duration_seconds != null ? ` · ${duration(video.duration_seconds)}` : ''}
          </P>
        </Section>

        <Section mark={4} title="الاعتماد" onLayout={at('approve')}>
          <View>
            {script.required_approvals.length === 0 && script.approvals.length === 0 && <P small muted>لا توقيعات على هذه النسخة.</P>}
            {[...new Set([...script.required_approvals.map((r) => r.role), ...script.approvals.map((a) => a.role)])].map((role, i, all) => {
              const a = script.approvals.find((x) => x.role === role)
              return (
                <View key={role} style={[st.kvLine, { paddingVertical: 10, paddingTop: 10, borderTopWidth: 0 }, i < all.length - 1 && st.divider]}>
                  <Text style={st.signRole}>{ROLES[role]}</Text>
                  <Text style={[st.signValue, !a && { color: C.muted }]}>{a ? `✓ ${a.name} · ${day(a.at)}` : 'لم يوقّع بعد'}</Text>
                </View>
              )
            })}
          </View>
        </Section>

        <Button title="افتح المشروع لصنع نسخة جديدة" kind="ghost" onPress={() => router.push({ pathname: '/p/[id]', params: { id: projectId } })} />
      </ScrollView>
    </>
  )
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 16 },
  inner: { padding: 16, paddingTop: 8, gap: 14, paddingBottom: 32 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rate: { backgroundColor: C.goldSoft },
  share: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong },
  actionText: { fontFamily: F.bold, fontSize: 15 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ebe8df', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  noteText: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 22, color: '#3d4a45' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: MUTED_BRAND, alignItems: 'center', justifyContent: 'center' },
  sectionMarkText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  sectionTitle: { flex: 1, fontFamily: F.bold, fontSize: 16, color: C.ink },
  groupLabel: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  readField: { minHeight: 46, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.bg, justifyContent: 'center' },
  readFieldText: { fontFamily: F.regular, fontSize: 15, color: '#3d4a45' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: '#ebe8df', backgroundColor: '#f4f3ef', justifyContent: 'center' },
  chipOn: { borderWidth: 1.5, borderColor: MUTED_BRAND, backgroundColor: C.brandSoft },
  chipText: { fontFamily: F.medium, fontSize: 12, color: '#a3aaa6' },
  chipTextOn: { fontFamily: F.bold, color: '#2f5a4d' },
  kvLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ebe8df' },
  kvValue: { fontFamily: F.bold, fontSize: 14, color: '#3d4a45' },
  scene: { flexDirection: 'row', gap: 10 },
  sceneTime: { width: 38, fontFamily: F.bold, fontSize: 12, color: C.muted, paddingTop: 2 },
  reference: { fontFamily: F.semibold, fontSize: 13, color: C.ok },
  reviewers: { flexDirection: 'row', gap: 8 },
  reviewer: { flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  reviewerText: { fontFamily: F.semibold, fontSize: 12, color: '#3d4a45', textAlign: 'center' },
  templates: { flexDirection: 'row', gap: 10 },
  template: { flex: 1, gap: 6 },
  templateFrame: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#10241e' },
  templateOn: { borderWidth: 3, borderColor: MUTED_BRAND },
  templateCheck: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: MUTED_BRAND, alignItems: 'center', justifyContent: 'center' },
  templateName: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  divider: { borderBottomWidth: 1, borderBottomColor: '#ebe8df' },
  signRole: { fontFamily: F.semibold, fontSize: 14, color: '#3d4a45' },
  signValue: { flexShrink: 1, fontFamily: F.semibold, fontSize: 13, color: C.ok },
})
