import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { api } from '../api'
import type { HistoryEntry } from '../api'
import { Badge, Button, Card, H1, H3, Notice, P, Row, Screen } from '../components/ui'
import { LANGUAGES } from '../shared/labels'
import { C, F } from '../theme'

/** Home: this device's projects, newest first, and the way to start one. */
export default function Home() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await api.listProjects())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
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
      {items && items.length === 0 && <P muted>لا مشاريع على هذا الجهاز بعد.</P>}
      {items && items.length > 0 && <H3>مشاريعي</H3>}
      {items?.map((p) => (
        <Pressable key={p.id} onPress={() => router.push({ pathname: '/p/[id]', params: { id: p.id } })} style={({ pressed }) => [st.item, pressed && { opacity: 0.85 }]}>
          <Text style={st.title} numberOfLines={2}>
            {p.title || '…'}
          </Text>
          <Row>
            <Badge>{p.audience}</Badge>
            <Badge>{LANGUAGES[p.language]}</Badge>
            {p.scripts > 0 && <Badge tone="info">{p.scripts} سيناريو</Badge>}
            {p.approved > 0 && <Badge tone="ok">{p.approved} معتمد</Badge>}
          </Row>
          <View />
        </Pressable>
      ))}
    </Screen>
  )
}

const st = StyleSheet.create({
  item: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { fontSize: 16, fontFamily: F.bold, color: C.ink, lineHeight: 26 },
})
