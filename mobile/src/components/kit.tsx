import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps, ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C, F } from '@/theme'

export type IconName = ComponentProps<typeof Ionicons>['name']

/** A Stack header's title with the line under it (the version, its length, its scenes). */
export function HeaderTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ maxWidth: 260 }}>
      <Text numberOfLines={1} style={k.headerTitle}>{title}</Text>
      {!!sub && <Text numberOfLines={1} style={k.headerSub}>{sub}</Text>}
    </View>
  )
}

export function BetaBadge({ onDark }: { onDark?: boolean }) {
  return (
    <View style={[k.beta, onDark && { backgroundColor: C.gold + '33' }]}>
      <Text style={[k.betaText, onDark && { color: '#f2d48a' }]}>تجريبية BETA</Text>
    </View>
  )
}

export type StepState = 'done' | 'current' | 'todo' | 'warn' | 'error' | 'edit'
export interface Step {
  label: string
  state: StepState
  onPress?: () => void
}

/** A version's steps: script, review, video, approval. Done steps carry a check, the current one a ring. */
export function Stepper({ steps, compact }: { steps: Step[]; compact?: boolean }) {
  const size = compact ? 24 : 34
  return (
    <View style={[k.stepper, compact && { padding: 0, borderWidth: 0, backgroundColor: 'transparent' }]} accessibilityRole="tablist">
      {steps.map((st, i) => {
        const color = st.state === 'error' ? C.bad : st.state === 'edit' ? C.info : st.state === 'warn' ? C.gold : C.brand
        const filled = st.state === 'done' || st.state === 'warn'
        const lineOn = filled && i < steps.length - 1
        return (
          <Pressable
            key={st.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: st.state === 'current' || st.state === 'error' || st.state === 'edit' }}
            accessibilityLabel={`${st.label}${st.state === 'done' ? '، مكتمل' : ''}`}
            onPress={st.onPress}
            disabled={!st.onPress}
            style={k.step}
          >
            {i < steps.length - 1 && <View style={[k.line, { top: size / 2 - 1, backgroundColor: lineOn ? C.brand : C.lineStrong }]} />}
            <View
              style={[
                k.dot,
                { width: size, height: size, borderRadius: size / 2 },
                filled
                  ? { backgroundColor: st.state === 'warn' ? C.gold : C.brand, borderColor: 'transparent' }
                  : st.state === 'todo'
                    ? { borderColor: C.lineStrong, backgroundColor: C.surface }
                    : { borderColor: color, backgroundColor: C.surface, shadowColor: color },
                (st.state === 'current' || st.state === 'error' || st.state === 'edit') && { borderWidth: 2, ...k.ring },
              ]}
            >
              {st.state === 'done' ? (
                <Ionicons name="checkmark" size={compact ? 13 : 17} color="#fff" />
              ) : st.state === 'warn' || st.state === 'error' ? (
                <Text style={[k.dotText, { color: st.state === 'warn' ? '#fff' : C.bad }]}>!</Text>
              ) : st.state === 'edit' ? (
                <Ionicons name="create-outline" size={compact ? 12 : 16} color={C.info} />
              ) : (
                <Text style={[k.dotText, { color: st.state === 'todo' ? C.muted : color, fontSize: compact ? 11 : 14 }]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[k.stepLabel, compact && { fontSize: 11 }, { color: st.state === 'todo' ? C.muted : st.state === 'current' ? C.brand : st.state === 'error' ? C.bad : C.ink }, st.state === 'current' && { fontFamily: F.bold }]}>
              {st.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** The video step's own three steps: template, scenes, video. */
export function SubSteps({ labels, current, onPress, error }: { labels: string[]; current: number; onPress?: (i: number) => void; error?: boolean }) {
  return (
    <View style={k.sub}>
      {labels.map((label, i) => {
        const done = i < current
        const now = i === current
        const tint = now && error ? C.bad : done || now ? C.brand : C.lineStrong
        return (
          <Pressable key={label} style={{ flex: 1, gap: 6 }} onPress={onPress ? () => onPress(i) : undefined} disabled={!onPress || now} accessibilityRole="button" accessibilityState={{ selected: now }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: tint }} />
            <Text style={[k.subText, { color: now ? (error ? C.bad : C.brand) : done ? C.ink : C.muted }, now && { fontFamily: F.bold }]}>
              {i + 1} · {label}{done ? ' ✓' : ''}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A sheet that rises from the bottom over a dimmed screen. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={k.scrim} onPress={onClose} accessibilityLabel="إغلاق" />
      <View style={[k.sheet, { paddingBottom: 20 + insets.bottom }]}>
        <View style={k.grip} />
        {children}
      </View>
    </Modal>
  )
}

export function SheetItem({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [k.sheetItem, pressed && { backgroundColor: C.bg }]}>
      <Ionicons name={icon} size={21} color={danger ? C.bad : C.muted} />
      <Text style={[k.sheetItemText, danger && { color: C.bad, fontFamily: F.bold }]}>{label}</Text>
    </Pressable>
  )
}

/** A short message at the bottom with one action, such as undoing a removal. */
export function Snackbar({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={k.snack} accessibilityLiveRegion="polite">
      <Text style={k.snackText}>{text}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" style={k.snackAction} hitSlop={6}>
          <Text style={k.snackActionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

export function IconCircle({ icon, tone = 'brand', size = 64 }: { icon: IconName; tone?: 'brand' | 'warn' | 'bad' | 'ok' | 'info'; size?: number }) {
  const bg = { brand: C.brandSoft, warn: C.warnBg, bad: C.badBg, ok: C.okBg, info: C.infoBg }[tone]
  const fg = { brand: C.brand, warn: C.warn, bad: C.bad, ok: C.ok, info: C.info }[tone]
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.46} color={fg} />
    </View>
  )
}

/** A label and its value on one line, inside a soft panel. */
export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <View style={k.kvBox}>
      {rows.map(([key, value], i) => (
        <View key={key} style={[k.kv, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
          <Text style={k.kvKey}>{key}</Text>
          {typeof value === 'string' || typeof value === 'number' ? <Text style={k.kvValue}>{value}</Text> : value}
        </View>
      ))}
    </View>
  )
}

const k = StyleSheet.create({
  headerTitle: { fontFamily: F.bold, fontSize: 18, color: C.ink },
  headerSub: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  beta: { backgroundColor: C.goldSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'center' },
  betaText: { fontFamily: F.bold, fontSize: 11, color: '#6b4800' },
  stepper: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 4 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  line: { position: 'absolute', height: 2, start: '50%', end: '-50%' },
  dot: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ring: { shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  dotText: { fontFamily: F.bold, fontSize: 14 },
  stepLabel: { fontFamily: F.semibold, fontSize: 12 },
  sub: { flexDirection: 'row', gap: 6 },
  subText: { fontFamily: F.semibold, fontSize: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(20,32,28,0.42)' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, gap: 4 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.lineStrong, marginBottom: 10 },
  sheetItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 12 },
  sheetItemText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  snack: { position: 'absolute', bottom: 20, right: 12, left: 12, backgroundColor: C.ink, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 },
  snackText: { flex: 1, color: '#fff', fontFamily: F.regular, fontSize: 14 },
  snackAction: { paddingHorizontal: 10, paddingVertical: 10 },
  snackActionText: { color: '#f2d48a', fontFamily: F.bold, fontSize: 14 },
  kvBox: { backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10 },
  kvKey: { fontFamily: F.regular, fontSize: 14, color: C.muted },
  kvValue: { fontFamily: F.semibold, fontSize: 14, color: C.ink, flexShrink: 1 },
})
