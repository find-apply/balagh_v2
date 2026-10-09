import Ionicons from '@expo/vector-icons/Ionicons'
import { DrawerContentScrollView, useDrawerStatus } from 'expo-router/drawer'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { api } from '@/api'
import type { HistoryEntry } from '@/api'
import { LANGUAGES } from '@/shared/labels'
import { C, F } from '@/theme'

/** The side bar: this device's history, newest first, reloaded each time it opens. A long press takes a project
 * off the list (the project itself stays on the server). */
export function HistoryDrawer({ navigation }: DrawerContentComponentProps) {
  const open = useDrawerStatus() === 'open'
  const [items, setItems] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.listProjects().then(
      (rows) => {
        setItems(rows)
        setError(null)
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])
  useEffect(() => {
    if (open) load()
  }, [open, load])

  const go = (path: Parameters<typeof router.push>[0]) => {
    navigation.closeDrawer()
    router.push(path)
  }
  const hide = (p: HistoryEntry) =>
    Alert.alert('إزالة من السجل؟', p.title, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'أزل', style: 'destructive', onPress: () => void api.hideProject(p.id).then(load, load) },
    ])

  // Grouped by day, as the site's history is.
  const groups: { label: string; rows: HistoryEntry[] }[] = []
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  for (const p of items ?? []) {
    const d = new Date(p.at).toDateString()
    const label = d === today ? 'اليوم' : d === yesterday ? 'أمس' : new Date(p.at).toLocaleDateString('ar', { day: 'numeric', month: 'long' })
    const last = groups[groups.length - 1]
    if (last?.label === label) last.rows.push(p)
    else groups.push({ label, rows: [p] })
  }

  return (
    <DrawerContentScrollView contentContainerStyle={st.inner}>
      <View style={st.brand}>
        <View style={st.mark}>
          <Text style={st.markText}>ب</Text>
        </View>
        <Text style={st.brandText}>بلاغ</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => go('/new')} style={({ pressed }) => [st.new, pressed && { opacity: 0.85 }]}>
        <Ionicons name="add" size={20} color={C.brandInk} />
        <Text style={st.newText}>مشروع جديد</Text>
      </Pressable>

      <Text style={st.heading}>السجل</Text>
      {error && <Text style={st.muted}>{error}</Text>}
      {items === null && !error && <Text style={st.muted}>يحمّل…</Text>}
      {items?.length === 0 && <Text style={st.muted}>لا مشاريع على هذا الجهاز بعد.</Text>}
      {groups.map((g) => (
        <View key={g.label} style={{ gap: 2 }}>
          <Text style={st.day}>{g.label}</Text>
          {g.rows.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => go({ pathname: '/p/[id]', params: { id: p.id } })}
              onLongPress={() => hide(p)}
              style={({ pressed }) => [st.item, pressed && { backgroundColor: C.brandSoft }]}
            >
              <Text style={st.title} numberOfLines={2}>
                {p.title || '…'}
              </Text>
              <Text style={st.meta} numberOfLines={1}>
                {p.approved > 0 ? '● ' : p.scripts > 0 ? '○ ' : ''}
                {LANGUAGES[p.language]} · {p.scripts > 0 ? `${p.scripts} سيناريو` : 'أفكار'}
                {p.approved > 0 ? ` · ${p.approved} معتمد` : ''}
                {p.shared ? ' · مشترك' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
      {items && items.length > 0 && <Text style={[st.muted, { marginTop: 8 }]}>اضغط مطولا على مشروع لإزالته من السجل.</Text>}
    </DrawerContentScrollView>
  )
}

const st = StyleSheet.create({
  inner: { padding: 16, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  mark: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  markText: { color: C.brandInk, fontFamily: F.bold, fontSize: 20 },
  brandText: { color: C.brand, fontFamily: F.bold, fontSize: 22 },
  new: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brand, borderRadius: 12, minHeight: 46 },
  newText: { color: C.brandInk, fontFamily: F.bold, fontSize: 15 },
  heading: { fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 8 },
  day: { fontFamily: F.semibold, fontSize: 12, color: C.muted, marginTop: 6 },
  item: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, gap: 2 },
  title: { fontFamily: F.semibold, fontSize: 14, color: C.ink, lineHeight: 22 },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  muted: { fontFamily: F.regular, fontSize: 13, color: C.muted },
})
