import { DrawerActions } from 'expo-router/react-navigation'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { api, BASE } from '@/api'
import type { HistoryEntry } from '@/api'
import { VIEWER_ROLES } from '@/components/Feedback'
import { Badge, Button, Card, H1, H3, Notice, P, Row, Screen, Stars } from '@/components/ui'
import { LANGUAGES } from '@/shared/labels'
import type { PublicShowcase } from '@/shared/types'
import { C, F } from '@/theme'

/** Home: start a project, pick up the last ones, and what the platform has published. */
export default function Home() {
  const nav = useNavigation()
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

  return (
    <Screen
      refresh={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
        />
      }
    >
      <Card tone="brand">
        <H1>محتوى إسلامي موثّق</H1>
        <P>اكتب موضوعك واختر جمهورك: يقترح بلاغ ثلاث أفكار، ويكتب السيناريو بنصوص من القرآن والصحيحين حرفيا، ثم يراجعه ويصنع الفيديو.</P>
        <Button title="مشروع جديد +" onPress={() => router.push('/new')} />
      </Card>

      {error && <Notice tone="bad">{error}</Notice>}

      {recent && recent.length > 0 && (
        <>
          <Row>
            <View style={{ flex: 1 }}>
              <H3>آخر مشاريعك</H3>
            </View>
            <Pressable onPress={() => nav.dispatch(DrawerActions.openDrawer())} hitSlop={8}>
              <Text style={st.link}>كل السجل</Text>
            </Pressable>
          </Row>
          {recent.slice(0, 3).map((p) => (
            <Pressable key={p.id} onPress={() => router.push({ pathname: '/p/[id]', params: { id: p.id } })} style={({ pressed }) => [st.item, pressed && { opacity: 0.85 }]}>
              <Text style={st.title} numberOfLines={2}>
                {p.title || '…'}
              </Text>
              <Row>
                <Badge>{LANGUAGES[p.language]}</Badge>
                {p.scripts > 0 && <Badge tone="info">{p.scripts} سيناريو</Badge>}
                {p.approved > 0 && <Badge tone="ok">{p.approved} معتمد</Badge>}
              </Row>
            </Pressable>
          ))}
        </>
      )}

      {picks && picks.projects.length > 0 && (
        <>
          <H3>من أعمال بلاغ</H3>
          {picks.projects.map((p) => (
            <Card key={p.project_id} style={{ padding: 0, overflow: 'hidden' }}>
              {p.poster && <Image source={{ uri: BASE + p.poster }} style={st.poster} resizeMode="cover" />}
              <View style={{ padding: 16, gap: 8 }}>
                <Row>
                  {p.approved ? <Badge tone="ok">✓ معتمد من مراجع</Badge> : <Badge tone="warn">بانتظار الاعتماد</Badge>}
                  <Badge>{p.audience}</Badge>
                </Row>
                <H3>{p.title}</H3>
                <P muted small>{p.hook}</P>
              </View>
            </Card>
          ))}
        </>
      )}

      {picks && picks.ratings.length > 0 && (
        <>
          <H3>ما قاله من شاهد</H3>
          {picks.ratings.map((r, i) => (
            <Card key={i}>
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
  item: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { fontSize: 16, fontFamily: F.bold, color: C.ink, lineHeight: 26 },
  link: { fontFamily: F.semibold, color: C.brand, fontSize: 14 },
  poster: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0f1512' },
})
