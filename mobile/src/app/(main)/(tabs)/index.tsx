import Ionicons from '@expo/vector-icons/Ionicons'
import { DrawerActions } from 'expo-router/react-navigation'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useAccount } from '@/account'
import { api, BASE } from '@/api'
import type { HistoryEntry } from '@/api'
import { VIEWER_ROLES } from '@/components/Feedback'
import { StarPattern } from '@/components/tabs/StarPattern'
import { roleLabel } from '@/components/tabs/role'
import { Badge, Card, Notice, P, Row, Screen, Stars } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { LANGUAGES } from '@/shared/labels'
import type { PublicShowcase } from '@/shared/types'
import { C, F } from '@/theme'

/** The white button on a green card. */
function OnBrandButton({ title, icon, onPress }: { title: string; icon?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.heroButton, pressed && { opacity: 0.85 }]}>
      {icon && <Ionicons name="add" size={22} color={C.brand} />}
      <Text style={st.heroButtonText}>{title}</Text>
    </Pressable>
  )
}

const FIRST_STEPS = ['اكتب موضوعك، أو اتركه لبلاغ', 'اختر فكرة من ثلاث، بنصوص موثّقة', 'راجع، واختر قالبا، واصنع الفيديو']

/** Home: start a project, pick up the last ones, and what the platform has published. Before the first project
 * it walks through the three steps instead. */
export default function Home() {
  const nav = useNavigation()
  const account = useAccount()
  const role = account.kind === 'approved' ? account.me.role : null
  const [recent, setRecent] = useState<HistoryEntry[] | null>(null)
  const [picks, setPicks] = useState<PublicShowcase | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [h, s] = await Promise.allSettled([api.listProjects(), api.showcase()])
    if (h.status === 'fulfilled') setRecent(h.value)
    if (s.status === 'fulfilled') setPicks(s.value)
    setError(h.status === 'rejected' ? (h.reason as Error).message : null)
  }, [])
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const firstTime = recent !== null && recent.length === 0

  return (
    <Screen
      refresh={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.brand}
          colors={[C.brand]}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
        />
      }
    >
      {firstTime ? (
        <View style={st.hero}>
          <StarPattern />
          <Text style={st.heroTitle} accessibilityRole="header">
            أول فيديو لك في دقائق
          </Text>
          <View style={{ gap: 10 }}>
            {FIRST_STEPS.map((step, i) => (
              <View key={step} style={st.heroStep}>
                <View style={st.heroNum}>
                  <Text style={st.heroNumText}>{i + 1}</Text>
                </View>
                <Text style={st.heroStepText}>{step}</Text>
              </View>
            ))}
          </View>
          <OnBrandButton title="ابدأ مشروعك الأول" onPress={() => router.push('/new')} />
        </View>
      ) : (
        <View style={st.hero}>
          <StarPattern />
          <Text style={st.heroTitle} accessibilityRole="header">
            محتوى إسلامي موثّق
          </Text>
          <Text style={st.heroText}>اكتب موضوعك واختر جمهورك: يقترح بلاغ ثلاث أفكار، ويكتب السيناريو بنصوص من القرآن والصحيحين حرفيا، ثم يراجعه ويصنع الفيديو.</Text>
          <OnBrandButton title="مشروع جديد" icon onPress={() => router.push('/new')} />
        </View>
      )}

      {firstTime && (
        <Card style={st.roleCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={C.brand} />
          <Text style={st.roleText}>
            {role ? (
              <>
                صفتك: <Text style={{ fontFamily: F.bold }}>{roleLabel(role)}</Text>.{' '}
                {role === 'specialist' ? 'تراجع محتواك بنفسك وتعتمده.' : 'كل نسخة يراجعها مختص شرعي قبل النشر.'}
              </>
            ) : (
              'صفتك تحددها الإدارة بعد التحقق من حسابك.'
            )}
          </Text>
        </Card>
      )}

      {error && <Notice tone="bad">{error}</Notice>}

      {recent && recent.length > 0 && (
        <>
          <View style={st.sectionHead}>
            <Text style={st.h2} accessibilityRole="header">
              آخر مشاريعك
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="كل السجل" onPress={() => nav.dispatch(DrawerActions.openDrawer())} style={st.link}>
              <Text style={st.linkText}>كل السجل</Text>
            </Pressable>
          </View>
          {recent.slice(0, 3).map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/p/[id]', params: { id: p.id } })}
              style={({ pressed }) => [st.item, pressed && { opacity: 0.85 }]}
            >
              <Text style={st.title} numberOfLines={2}>
                {p.title || '…'}
              </Text>
              <Row gap={6}>
                <Badge>{LANGUAGES[p.language]}</Badge>
                {p.scripts > 0 ? <Badge tone="info">{p.scripts} سيناريو</Badge> : <Badge>أفكار</Badge>}
                {p.approved > 0 && <Badge tone="ok">{p.approved} معتمد</Badge>}
              </Row>
            </Pressable>
          ))}
        </>
      )}

      {picks && (picks.projects.length > 0 || firstTime) && (
        <Text style={[st.h2, { marginTop: 8 }]} accessibilityRole="header">
          من أعمال بلاغ
        </Text>
      )}
      {firstTime && picks?.projects.length === 0 && <P muted small>أمثلة منشورة لتعرف ما يمكن صنعه. تظهر هنا حين تنشر الإدارة أعمالا.</P>}
      {picks?.projects.map((p) => (
        <Card key={p.project_id} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          {p.poster && p.video_url ? (
            <VideoPlayer uri={BASE + p.video_url} poster={BASE + p.poster} tall={false} />
          ) : (
            <View style={st.posterEmpty}>
              <Ionicons name="film-outline" size={32} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          <View style={{ padding: 16, gap: 8 }}>
            <Row gap={6}>
              {p.approved ? <Badge tone="ok">✓ معتمد من مراجع</Badge> : <Badge tone="warn">بانتظار الاعتماد</Badge>}
              <Badge>{p.audience}</Badge>
            </Row>
            <Text style={st.title}>{p.title}</Text>
            <P muted small>
              {p.hook}
            </P>
          </View>
        </Card>
      ))}

      {picks && picks.ratings.length > 0 && (
        <>
          <Text style={[st.h2, { marginTop: 8 }]} accessibilityRole="header">
            ما قاله من شاهد
          </Text>
          {picks.ratings.map((r, i) => (
            <Card key={i} style={{ gap: 8 }}>
              <Stars value={r.stars} size={16} />
              <P>«{r.comment}»</P>
              <P small muted>
                {r.name} · {VIEWER_ROLES[r.role]}
              </P>
            </Card>
          ))}
        </>
      )}
    </Screen>
  )
}

const st = StyleSheet.create({
  hero: { backgroundColor: C.brand, borderRadius: 22, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, gap: 12, overflow: 'hidden' },
  heroTitle: { fontFamily: F.bold, fontSize: 25, lineHeight: 36, color: '#fff' },
  heroText: { fontFamily: F.regular, fontSize: 15, lineHeight: 27, color: 'rgba(255,255,255,0.88)' },
  heroButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  heroButtonText: { fontFamily: F.bold, fontSize: 16, color: C.brand },
  heroStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroNumText: { fontFamily: F.bold, fontSize: 12, color: '#fff' },
  heroStepText: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: '#fff' },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleText: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 22, color: '#3d4a45' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  h2: { fontFamily: F.bold, fontSize: 18, lineHeight: 28, color: C.ink },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { fontFamily: F.semibold, color: C.brand, fontSize: 14 },
  item: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { fontSize: 16, fontFamily: F.bold, color: C.ink, lineHeight: 26 },
  posterEmpty: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0f1512', alignItems: 'center', justifyContent: 'center' },
})
