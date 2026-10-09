import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api, BASE } from '@/api'
import type { LibraryItem } from '@/api'
import type { VideoTemplate } from '@/shared/types'
import { Badge, Button, Notice, P, Row } from '@/components/ui'
import { C, F } from '@/theme'

/** Rows of the library, in date order: tall (9:16) videos sit two to a row, a wide (16:9) one takes a row of its
 * own at its own shape, so neither is cropped into the other's frame. */
type LibRow = { wide: true; item: LibraryItem } | { wide: false; items: LibraryItem[] }

function rows(items: LibraryItem[], wide: (i: LibraryItem) => boolean): LibRow[] {
  const out: LibRow[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (wide(item)) out.push({ wide: true, item })
    else if (last && !last.wide && last.items.length < 2) last.items.push(item)
    else out.push({ wide: false, items: [item] })
  }
  return out
}

/** The library: every finished video of this device's projects, newest first. A video opens on its version's
 * video part, where it plays and is rated. */
export default function Library() {
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  // A video's frame is its template's: the story and blackboard templates are wide, the reels tall.
  const [templates, setTemplates] = useState<VideoTemplate[]>([])
  const known = useRef<VideoTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const load = useCallback(async () => {
    try {
      const [lib, tpl] = await Promise.all([api.library(), known.current ?? api.templates()])
      known.current = tpl
      setItems(lib)
      setTemplates(tpl)
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

  const isWide = (i: LibraryItem) => templates.find((t) => t.id === i.video.template)?.aspect === '16:9'

  const card = (item: LibraryItem, wide: boolean) => (
    <Pressable
      key={item.video.id}
      style={({ pressed }) => [st.card, wide ? st.cardWide : st.cardTall, pressed && { opacity: 0.85 }]}
      onPress={() => router.push({ pathname: '/p/[id]/[sid]', params: { id: item.project_id, sid: item.script_id, part: 'video', video: item.video.id } })}
    >
      <View style={[st.frame, { aspectRatio: wide ? 16 / 9 : 9 / 13 }]}>
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
          {wide && <Badge>16:9</Badge>}
        </Row>
        <Text style={st.meta}>
          {templates.find((t) => t.id === item.video.template)?.name ?? item.video.template} ·{' '}
          {new Date(item.video.created_at).toLocaleDateString('ar', { day: 'numeric', month: 'long' })}
        </Text>
      </View>
    </Pressable>
  )

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={st.list}
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
    >
      {!items?.length && empty}
      {rows(items ?? [], isWide).map((r) =>
        r.wide ? (
          card(r.item, true)
        ) : (
          <View key={r.items[0].video.id} style={st.pair}>
            {r.items.map((i) => card(i, false))}
            {r.items.length === 1 && <View style={st.cardTall} />}
          </View>
        ),
      )}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  pair: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  cardTall: { flex: 1 },
  cardWide: { width: '100%' },
  frame: { width: '100%', backgroundColor: '#0f1512' },
  play: { position: 'absolute', top: '50%', left: '50%', width: 44, height: 44, marginTop: -22, marginLeft: -22, borderRadius: 22, backgroundColor: 'rgba(12,90,74,0.92)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 18, marginLeft: 3 },
  time: { position: 'absolute', bottom: 6, right: 6, color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, borderRadius: 6, fontFamily: F.semibold, fontSize: 11, overflow: 'hidden' },
  title: { fontFamily: F.bold, fontSize: 13, color: C.ink, lineHeight: 20 },
  meta: { fontFamily: F.regular, fontSize: 11, color: C.muted },
})
