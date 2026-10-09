import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { api, BASE } from '@/api'
import type { LibraryItem } from '@/api'
import { Badge, Button, Notice, P, Row } from '@/components/ui'
import { C, F } from '@/theme'

/** The library: every finished video of this device's projects, newest first. A video opens on its version's
 * video part, where it plays and is rated. */
export default function Library() {
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const load = useCallback(async () => {
    try {
      setItems(await api.library())
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

  const empty = (
    <View style={{ gap: 12, padding: 8 }}>
      {error ? <Notice tone="bad">{error}</Notice> : items === null ? <P muted>يحمّل…</P> : <P muted>لا فيديوهات بعد. حين يجهز فيديو لأحد مشاريعك يظهر هنا.</P>}
      {items?.length === 0 && <Button title="مشروع جديد +" onPress={() => router.push('/new')} />}
    </View>
  )

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={st.list}
      data={items ?? []}
      keyExtractor={(i) => i.video.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      ListEmptyComponent={empty}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [st.card, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/p/[id]/[sid]', params: { id: item.project_id, sid: item.script_id, part: 'video' } })}
        >
          <View style={st.frame}>
            {item.video.frames[0] ? <Image source={{ uri: BASE + item.video.frames[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <View style={st.play}>
              <Text style={st.playIcon}>▶</Text>
            </View>
            {item.video.duration_seconds != null && <Text style={st.time}>{Math.round(item.video.duration_seconds)} ث</Text>}
          </View>
          <View style={{ padding: 10, gap: 6 }}>
            <Text style={st.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Row gap={4}>
              {item.video.preview ? <Badge tone="warn">معاينة</Badge> : <Badge tone="ok">نهائي</Badge>}
              {item.approved && <Badge tone="ok">✓ معتمد</Badge>}
            </Row>
            <Text style={st.meta}>{new Date(item.video.created_at).toLocaleDateString('ar', { day: 'numeric', month: 'long' })}</Text>
          </View>
        </Pressable>
      )}
    />
  )
}

const st = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { flex: 1, maxWidth: '50%', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  frame: { width: '100%', aspectRatio: 9 / 13, backgroundColor: '#0f1512' },
  play: { position: 'absolute', top: '50%', left: '50%', width: 44, height: 44, marginTop: -22, marginLeft: -22, borderRadius: 22, backgroundColor: 'rgba(12,90,74,0.92)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 18, marginLeft: 3 },
  time: { position: 'absolute', bottom: 6, right: 6, color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, borderRadius: 6, fontFamily: F.semibold, fontSize: 11, overflow: 'hidden' },
  title: { fontFamily: F.bold, fontSize: 13, color: C.ink, lineHeight: 20 },
  meta: { fontFamily: F.regular, fontSize: 11, color: C.muted },
})
