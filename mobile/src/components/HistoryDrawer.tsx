import Ionicons from '@expo/vector-icons/Ionicons'
import { DrawerContentScrollView, useDrawerStatus } from 'expo-router/drawer'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, SITE } from '@/api'
import type { HistoryEntry } from '@/api'
import { IconCircle, Sheet, SheetItem, Snackbar } from '@/components/kit'
import { LANGUAGES } from '@/shared/labels'
import { C, F } from '@/theme'

const LONG_PRESS_MS = 450
const UNDO_MS = 5000
const DAY_MS = 86_400_000

type SheetState = { kind: 'menu'; entry: HistoryEntry } | { kind: 'confirm'; ids: string[] } | null

const meta = (p: HistoryEntry) =>
  `${p.approved > 0 ? '● ' : p.scripts > 0 ? '○ ' : ''}${LANGUAGES[p.language]} · ${p.scripts > 0 ? `${p.scripts} سيناريو` : 'أفكار'}` +
  `${p.approved > 0 ? ` · ${p.approved} معتمد` : ''}${p.shared ? ' · مشترك' : ''}`

/** The side bar: the account's history, newest first and grouped by day, reloaded each time it opens. A long
 * press selects projects to take off the list (the projects themselves stay on the server); the removal waits
 * five seconds for an undo before it reaches the server. */
export function HistoryDrawer({ navigation }: DrawerContentComponentProps) {
  const open = useDrawerStatus() === 'open'
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<HistoryEntry[] | null>(null)
  // When the list was fetched: "today" and "yesterday" are read against it, not against the clock at render.
  const [loadedAt, setLoadedAt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [picked, setSelected] = useState<Set<string> | null>(null)
  // Closing the side bar ends a selection.
  const selected = open ? picked : null
  const [sheet, setSheet] = useState<SheetState>(null)
  // Rows taken off the list but not yet off the server, while the undo is offered.
  const [pending, setPending] = useState<string[]>([])
  // How many the undo bar names; 0 hides it.
  const [snack, setSnack] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string[]>([])

  const load = useCallback(() => {
    api.listProjects().then(
      (rows) => {
        setItems(rows)
        setLoadedAt(Date.now())
        setError(null)
        setSelected(null) // a selection does not outlive the side bar's closing
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])
  useEffect(() => {
    if (open) load()
  }, [open, load])

  /** Sends the removals still waiting, at once. */
  const commit = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setSnack(0)
    const ids = pendingRef.current
    pendingRef.current = []
    if (ids.length === 0) return
    void Promise.allSettled(ids.map((id) => api.hideProject(id))).then(() => {
      setPending((p) => p.filter((id) => !ids.includes(id)))
      load()
    })
  }, [load])
  // Leaving the screen sends what is waiting rather than dropping it.
  useEffect(() => commit, [commit])

  const remove = (ids: string[]) => {
    commit() // an earlier removal is no longer undoable once another one starts
    pendingRef.current = ids
    setPending((p) => [...p, ...ids])
    setSnack(ids.length)
    setSelected(null)
    setSheet(null)
    timer.current = setTimeout(commit, UNDO_MS)
  }
  const undo = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setSnack(0)
    const ids = pendingRef.current
    pendingRef.current = []
    setPending((p) => p.filter((id) => !ids.includes(id)))
  }

  const go = (path: Parameters<typeof router.push>[0]) => {
    navigation.closeDrawer()
    router.push(path)
  }
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next.size ? next : null
    })

  const visible = (items ?? []).filter((p) => !pending.includes(p.id))
  const selecting = selected !== null

  // Grouped by day, as the site's history is.
  const groups: { label: string; rows: HistoryEntry[] }[] = []
  const today = new Date(loadedAt).toDateString()
  const yesterday = new Date(loadedAt - DAY_MS).toDateString()
  for (const p of visible) {
    const d = new Date(p.at).toDateString()
    const label = d === today ? 'اليوم' : d === yesterday ? 'أمس' : new Date(p.at).toLocaleDateString('ar', { day: 'numeric', month: 'long' })
    const last = groups[groups.length - 1]
    if (last?.label === label) last.rows.push(p)
    else groups.push({ label, rows: [p] })
  }

  const confirmCount = sheet?.kind === 'confirm' ? sheet.ids.length : 0

  return (
    <View style={{ flex: 1 }}>
      {selecting && (
        <View style={[st.bar, { marginTop: insets.top + 8 }]} accessibilityRole="toolbar" accessibilityLabel="المحدد">
          <Pressable accessibilityRole="button" accessibilityLabel="إلغاء التحديد" onPress={() => setSelected(null)} style={st.barIcon}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={st.barCount} accessibilityLiveRegion="polite">
            {selected.size} محدد
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="حدد الكل" onPress={() => setSelected(new Set(visible.map((p) => p.id)))} style={st.barAll}>
            <Text style={st.barAllText}>الكل</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="احذف المحدد من السجل"
            onPress={() => setSheet({ kind: 'confirm', ids: [...selected] })}
            style={({ pressed }) => [st.barDelete, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={st.barDeleteText}>حذف</Text>
          </Pressable>
        </View>
      )}

      <DrawerContentScrollView contentContainerStyle={[st.inner, selecting && { paddingTop: 8 }]} style={{ flex: 1 }}>
        {!selecting && (
          <>
            <View style={st.brand}>
              <View style={st.mark} importantForAccessibility="no-hide-descendants">
                <Text style={st.markText}>ب</Text>
              </View>
              <Text style={st.brandText}>بلاغ</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => go('/new')} style={({ pressed }) => [st.new, pressed && { opacity: 0.85 }]}>
              <Ionicons name="add" size={20} color={C.brandInk} />
              <Text style={st.newText}>مشروع جديد</Text>
            </Pressable>
            <Text style={st.heading} accessibilityRole="header">
              السجل
            </Text>
          </>
        )}
        {error && <Text style={st.muted}>{error}</Text>}
        {items === null && !error && <Text style={st.muted}>يحمّل…</Text>}
        {items !== null && visible.length === 0 && <Text style={[st.muted, { textAlign: 'center', marginVertical: 16 }]}>لا مشاريع في السجل.</Text>}
        {groups.map((g) => (
          <View key={g.label} style={{ gap: 4 }}>
            <Text style={st.day}>{g.label}</Text>
            {g.rows.map((p) => {
              const on = selected?.has(p.id) ?? false
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole={selecting ? 'checkbox' : 'button'}
                  accessibilityState={selecting ? { checked: on } : undefined}
                  accessibilityHint={selecting ? undefined : 'اضغط مطولا لتحديده'}
                  accessibilityActions={selecting ? undefined : [{ name: 'longpress', label: 'حدد' }]}
                  onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && setSelected(new Set([p.id]))}
                  delayLongPress={LONG_PRESS_MS}
                  onLongPress={() => (selecting ? toggle(p.id) : setSelected(new Set([p.id])))}
                  onPress={() => (selecting ? toggle(p.id) : go({ pathname: '/p/[id]', params: { id: p.id } }))}
                  style={({ pressed }) => [st.item, on && st.itemOn, pressed && !on && { backgroundColor: C.brandSoft }]}
                >
                  {selecting && (
                    <View style={[st.check, on ? { borderColor: C.brand, backgroundColor: C.brand } : { borderColor: '#c9c4b6' }]}>
                      {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.title} numberOfLines={2}>
                      {p.title || '…'}
                    </Text>
                    <Text style={st.meta} numberOfLines={1}>
                      {meta(p)}
                    </Text>
                  </View>
                  {!selecting && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`خيارات: ${p.title}`}
                      onPress={() => setSheet({ kind: 'menu', entry: p })}
                      style={({ pressed }) => [st.more, pressed && { backgroundColor: C.brandSoft }]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
                    </Pressable>
                  )}
                </Pressable>
              )
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      {!selecting && visible.length > 0 && (
        <View style={[st.hint, { paddingBottom: 18 + insets.bottom }]}>
          <Ionicons name="hand-left-outline" size={16} color={C.muted} />
          <Text style={[st.muted, { flex: 1, fontSize: 12 }]}>اضغط مطولا على مشروع لتحديده وحذفه.</Text>
        </View>
      )}

      {snack > 0 && <Snackbar text={`حُذف ${snack} من السجل`} action="تراجع" onAction={undo} />}

      <Sheet visible={sheet !== null} onClose={() => setSheet(null)}>
        {sheet?.kind === 'menu' && (
          <>
            <Text style={st.sheetTitle} numberOfLines={2}>
              {sheet.entry.title || '…'}
            </Text>
            <SheetItem icon="open-outline" label="افتح المشروع" onPress={() => {
              setSheet(null)
              go({ pathname: '/p/[id]', params: { id: sheet.entry.id } })
            }} />
            <SheetItem
              icon="share-social-outline"
              label="شارك رابط القراءة"
              onPress={() => {
                setSheet(null)
                void Share.share({ message: `${sheet.entry.title}\n${SITE}/#/p/${sheet.entry.id}` })
              }}
            />
            <SheetItem icon="trash-outline" label="أزل من السجل" danger onPress={() => setSheet({ kind: 'confirm', ids: [sheet.entry.id] })} />
          </>
        )}
        {sheet?.kind === 'confirm' && (
          <View style={{ gap: 12, paddingHorizontal: 2 }} accessibilityRole="alert">
            <View style={st.confirmHead}>
              <IconCircle icon="trash-outline" tone="bad" size={44} />
              <Text style={st.confirmTitle} accessibilityRole="header">
                حذف {confirmCount} من السجل؟
              </Text>
            </View>
            <Text style={st.confirmText}>تُحذف من سجلك فقط. المشاريع نفسها تبقى محفوظة، وتفتح لمن عنده رابطها.</Text>
            <View style={st.confirmButtons}>
              <Pressable accessibilityRole="button" onPress={() => setSheet(null)} style={({ pressed }) => [st.cancel, pressed && { backgroundColor: C.bg }]}>
                <Text style={st.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => remove(sheet.ids)} style={({ pressed }) => [st.confirmDelete, pressed && { opacity: 0.85 }]}>
                <Text style={st.confirmDeleteText}>احذف</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Sheet>
    </View>
  )
}

const st = StyleSheet.create({
  inner: { padding: 16, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  mark: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  markText: { color: C.brandInk, fontFamily: F.bold, fontSize: 20 },
  brandText: { color: C.brand, fontFamily: F.bold, fontSize: 22 },
  new: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brand, borderRadius: 12, minHeight: 48 },
  newText: { color: C.brandInk, fontFamily: F.bold, fontSize: 15 },
  heading: { fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 8 },
  day: { fontFamily: F.semibold, fontSize: 12, color: C.muted, marginTop: 6, marginHorizontal: 6 },
  item: {
    minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingStart: 10, paddingEnd: 4,
    borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: C.surface,
  },
  itemOn: { backgroundColor: C.brandSoft, borderColor: C.brand },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.semibold, fontSize: 14, color: C.ink, lineHeight: 22 },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  more: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: F.regular, fontSize: 13, lineHeight: 20, color: C.muted },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 12 },
  bar: { marginHorizontal: 10, marginBottom: 4, minHeight: 56, paddingHorizontal: 6, borderRadius: 16, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 4 },
  barIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  barCount: { flex: 1, fontFamily: F.bold, fontSize: 16, color: '#fff' },
  barAll: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  barAllText: { fontFamily: F.bold, fontSize: 13, color: '#f2d48a' },
  barDelete: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#c0392b', flexDirection: 'row', alignItems: 'center', gap: 6 },
  barDeleteText: { fontFamily: F.bold, fontSize: 14, color: '#fff' },
  sheetTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink, paddingHorizontal: 4, paddingBottom: 8 },
  confirmHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmTitle: { flex: 1, fontFamily: F.bold, fontSize: 18, color: C.ink },
  confirmText: { fontFamily: F.regular, fontSize: 14, lineHeight: 25, color: '#3d4a45' },
  confirmButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancel: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  confirmDelete: { flex: 1, minHeight: 50, borderRadius: 12, backgroundColor: C.bad, alignItems: 'center', justifyContent: 'center' },
  confirmDeleteText: { fontFamily: F.bold, fontSize: 15, color: '#fff' },
})
