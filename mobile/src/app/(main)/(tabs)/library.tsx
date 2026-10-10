import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useFocusEffect } from 'expo-router'
import type { Href } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api, BASE } from '@/api'
import type { LibraryItem } from '@/api'
import { duration } from '@/components/tabs/format'
import { refreshLibrary, useLibrary, useUnseen } from '@/components/tabs/libraryFeed'
import type { VideoTemplate } from '@/shared/types'
import { Badge, Notice, P, Row } from '@/components/ui'
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

// Templates change rarely: fetched once per run of the app.
let knownTemplates: VideoTemplate[] | null = null

const STEPS = ['اكتب موضوعك واختر جمهورك', 'اختر فكرة، ويكتب بلاغ السيناريو', 'اختر قالبا، ويصنع الفيديو']

/** Before the first video: what the library will hold, and how to get there. */
function Empty() {
  return (
    <View style={st.empty}>
      <View style={st.stack} importantForAccessibility="no-hide-descendants">
        <View style={[st.ghostCard, { right: 0, transform: [{ rotate: '8deg' }] }]} />
        <View style={[st.ghostCard, { left: 0, transform: [{ rotate: '-8deg' }] }]} />
        <View style={st.frontCard}>
          <View style={st.frontIcon}>
            <Ionicons name="play" size={20} color={C.brand} />
          </View>
        </View>
      </View>
      <Text style={st.emptyTitle} accessibilityRole="header">
        لا فيديوهات بعد
      </Text>
      <Text style={st.emptyText}>حين يجهز فيديو لأحد مشاريعك يظهر هنا، مرتّبا من الأحدث.</Text>
      <View style={st.steps}>
        {STEPS.map((s, i) => (
          <View key={s} style={st.step}>
            <View style={st.stepNum}>
              <Text style={st.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={st.stepText}>{s}</Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/new')} style={({ pressed }) => [st.start, pressed && { opacity: 0.85 }]}>
        <Ionicons name="add" size={22} color={C.brandInk} />
        <Text style={st.startText}>ابدأ مشروعك الأول</Text>
      </Pressable>
    </View>
  )
}

/** The library: every finished video of the account's projects, newest first. A video opens on its details. */
export default function Library() {
  const { items, error } = useLibrary()
  const unseen = useUnseen()
  // A video's frame is its template's: the story and blackboard templates are wide, the reels tall.
  const [templates, setTemplates] = useState<VideoTemplate[]>(knownTemplates ?? [])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (knownTemplates) return
    api.templates().then(
      (t) => {
        knownTemplates = t
        setTemplates(t)
      },
      () => undefined,
    )
  }, [])
  useFocusEffect(
    useCallback(() => {
      void refreshLibrary()
    }, []),
  )

  const template = (i: LibraryItem) => templates.find((t) => t.id === i.video.template)
  const isWide = (i: LibraryItem) => template(i)?.aspect === '16:9'

  const card = (item: LibraryItem, wide: boolean) => {
    const fresh = unseen.has(item.video.id)
    const date = new Date(item.video.created_at).toLocaleDateString('ar', { day: 'numeric', month: 'long' })
    return (
      <Pressable
        key={item.video.id}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${fresh ? '، جديد' : ''}`}
        style={({ pressed }) => [st.card, wide ? st.cardWide : st.cardTall, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: '/details', params: { projectId: item.project_id, scriptId: item.script_id, videoId: item.video.id } } as unknown as Href)}
      >
        <View style={[st.frame, { aspectRatio: wide ? 16 / 9 : 9 / 13 }]}>
          {item.video.frames[0] ? <Image source={{ uri: BASE + item.video.frames[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={[st.play, wide && st.playWide]}>
            <Ionicons name="play" size={wide ? 22 : 20} color="#fff" style={{ marginLeft: 3 }} />
          </View>
          {fresh && (
            <View style={st.fresh}>
              <Text style={st.freshText}>جديد</Text>
            </View>
          )}
          {item.video.duration_seconds != null && <Text style={st.time}>{duration(item.video.duration_seconds)}</Text>}
        </View>
        <View style={{ padding: wide ? 12 : 10, gap: 6 }}>
          <Text style={[st.title, wide && { fontSize: 14 }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Row gap={4}>
            {item.video.preview ? <Badge tone="warn">معاينة</Badge> : <Badge tone="ok">نهائي</Badge>}
            {item.approved && <Badge tone="ok">✓ معتمد</Badge>}
            {wide && <Badge>16:9</Badge>}
          </Row>
          <Text style={st.meta}>
            {template(item)?.name ?? item.video.template} · {date}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={st.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.brand}
          colors={[C.brand]}
          onRefresh={async () => {
            setRefreshing(true)
            await refreshLibrary()
            setRefreshing(false)
          }}
        />
      }
    >
      {error && <Notice tone="bad">{error}</Notice>}
      {items === null && !error && <P muted>يحمّل…</P>}
      {items?.length === 0 && <Empty />}
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
  list: { padding: 16, paddingTop: 4, gap: 12, paddingBottom: 32 },
  pair: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  cardTall: { flex: 1 },
  cardWide: { width: '100%' },
  frame: { width: '100%', backgroundColor: '#0f1512' },
  play: { position: 'absolute', top: '50%', left: '50%', width: 44, height: 44, marginTop: -22, marginLeft: -22, borderRadius: 22, backgroundColor: 'rgba(12,90,74,0.92)', alignItems: 'center', justifyContent: 'center' },
  playWide: { width: 48, height: 48, marginTop: -24, marginLeft: -24, borderRadius: 24 },
  fresh: { position: 'absolute', top: 8, right: 8, backgroundColor: C.bad, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  freshText: { color: '#fff', fontFamily: F.bold, fontSize: 11 },
  time: { position: 'absolute', bottom: 8, right: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, fontFamily: F.semibold, fontSize: 11, overflow: 'hidden' },
  title: { fontFamily: F.bold, fontSize: 13, color: C.ink, lineHeight: 20 },
  meta: { fontFamily: F.regular, fontSize: 11, color: C.muted },
  empty: { alignItems: 'center', gap: 16, paddingHorizontal: 12, paddingTop: 36 },
  stack: { width: 168, height: 200 },
  ghostCard: { position: 'absolute', top: 16, width: 92, height: 164, borderRadius: 14, backgroundColor: '#ebe8df' },
  frontCard: { position: 'absolute', top: 0, left: 38, width: 92, height: 164, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#b9c9c1', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  frontIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: F.bold, fontSize: 22, lineHeight: 34, color: C.ink, marginTop: 8 },
  emptyText: { fontFamily: F.regular, fontSize: 15, lineHeight: 27, color: '#3d4a45', textAlign: 'center', maxWidth: 290 },
  steps: { alignSelf: 'stretch', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 10, marginTop: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: F.bold, fontSize: 12, color: C.brand },
  stepText: { flex: 1, fontFamily: F.regular, fontSize: 14, color: C.ink },
  start: { alignSelf: 'stretch', minHeight: 54, borderRadius: 14, backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startText: { fontFamily: F.bold, fontSize: 16, color: C.brandInk },
})
