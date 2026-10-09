import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { RefreshControlProps, StyleProp, TextInputProps, ViewStyle } from 'react-native'
import type { ReactElement } from 'react'
import { C, F, R, isQuranic, shownQuran } from '../theme'
import type { Task } from '../shared/tasks'

export function Screen({ children, refresh }: { children: ReactNode; refresh?: ReactElement<RefreshControlProps> }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenInner} refreshControl={refresh} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  )
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'brand' | 'warn' | 'ok' | 'bad' }) {
  return <View style={[s.card, tone && { backgroundColor: TONES[tone].bg, borderColor: TONES[tone].bg }, style]}>{children}</View>
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>
export const H3 = ({ children }: { children: ReactNode }) => <Text style={s.h3}>{children}</Text>
export const P = ({ children, muted, small, strong }: { children: ReactNode; muted?: boolean; small?: boolean; strong?: boolean }) => {
  const quran = Array.isArray(children) ? children.some(isQuranic) : isQuranic(children)
  const shown = quran ? (Array.isArray(children) ? children.map((c) => (typeof c === 'string' ? shownQuran(c) : c)) : typeof children === 'string' ? shownQuran(children) : children) : children
  return <Text style={[s.p, muted && s.muted, small && s.small, strong && s.strong, quran && (small ? s.quranSmall : s.quran)]}>{shown}</Text>
}

export function Button({ title, onPress, kind = 'primary', disabled, busy }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean }) {
  const off = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.button, s[kind], off && s.off, pressed && !off && s.pressed]}
    >
      {busy && <ActivityIndicator color={kind === 'primary' ? C.brandInk : C.brand} />}
      <Text style={[s.buttonText, kind === 'primary' ? s.onBrand : kind === 'danger' ? { color: C.bad } : { color: C.brand }]}>{title}</Text>
    </Pressable>
  )
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && s.onBrand]}>{label}</Text>
    </Pressable>
  )
}

export const Row = ({ children, gap = 8 }: { children: ReactNode; gap?: number }) => <View style={[s.row, { gap }]}>{children}</View>

const TONES = {
  brand: { bg: C.brandSoft, fg: C.brand },
  ok: { bg: C.okBg, fg: C.ok },
  warn: { bg: C.warnBg, fg: C.warn },
  bad: { bg: C.badBg, fg: C.bad },
  info: { bg: C.infoBg, fg: C.info },
  plain: { bg: '#f1efe8', fg: C.muted },
}

export function Badge({ children, tone = 'plain' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <View style={[s.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text style={[s.badgeText, { color: TONES[tone].fg }]}>{children}</Text>
    </View>
  )
}

export function Notice({ children, tone = 'brand' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <View style={[s.notice, { backgroundColor: TONES[tone].bg }]}>
      <Text style={[s.p, { color: TONES[tone].fg }]}>{children}</Text>
    </View>
  )
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.muted} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]} {...props} />
    </View>
  )
}

/** A long request's card: time since it started against the usual time, and what the step does. The server
 * answers in one response, so the stages advance on that estimate, as on the site. */
export function Progress({ task, started, error, onRetry }: { task: Task; started: number; error?: string | null; onRetry?: () => void }) {
  const since = () => Math.max(0, Math.floor((Date.now() - started) / 1000))
  const [seconds, setSeconds] = useState(since)
  useEffect(() => {
    const t = setInterval(() => setSeconds(since()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])
  if (error)
    return (
      <Card tone="bad">
        <H3>تعذّر: {task.title}</H3>
        <P>{error}</P>
        {onRetry && <Button title="أعد المحاولة" kind="ghost" onPress={onRetry} />}
      </Card>
    )
  const share = task.expected / Math.max(1, task.stages.length)
  const current = Math.min(Math.floor(seconds / share), task.stages.length - 1)
  const percent = Math.round(92 * (1 - Math.exp(-seconds / (task.expected * 0.6))))
  return (
    <Card>
      <Row>
        <ActivityIndicator color={C.brand} />
        <View style={{ flex: 1 }}>
          <H3>{task.title}</H3>
        </View>
        <P muted small>
          {seconds} ث من نحو {task.expected < 60 ? `${task.expected} ث` : 'دقيقة'}
        </P>
      </Row>
      <View style={s.bar}>
        <View style={[s.barFill, { width: `${percent}%` }]} />
      </View>
      {task.stages.map((stage, i) => (
        <Text key={stage} style={[s.stage, i < current && s.stageDone, i === current && s.stageNow]}>
          {i < current ? '✓ ' : i === current ? '◉ ' : '○ '}
          {stage}
        </Text>
      ))}
      <P muted small>يمكنك الخروج من هذه الشاشة، والعمل يستمر.</P>
    </Card>
  )
}

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={s.row} accessibilityLabel={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} accessibilityRole={onChange ? 'button' : undefined} accessibilityLabel={`${n} من 5`} hitSlop={4}>
          <Text style={{ fontSize: size, color: n <= value ? C.gold : C.lineStrong }}>★</Text>
        </Pressable>
      ))}
    </View>
  )
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  screenInner: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { backgroundColor: C.surface, borderRadius: R, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  h1: { fontSize: 24, fontFamily: F.bold, color: C.ink, lineHeight: 36 },
  h2: { fontSize: 19, fontFamily: F.bold, color: C.ink, lineHeight: 30 },
  h3: { fontSize: 16, fontFamily: F.bold, color: C.ink, lineHeight: 26 },
  p: { fontSize: 15, lineHeight: 25, color: C.ink, fontFamily: F.regular },
  muted: { color: C.muted },
  small: { fontSize: 13, lineHeight: 20 },
  strong: { fontFamily: F.semibold },
  quran: { fontFamily: F.quran, fontSize: 20, lineHeight: 42 },
  quranSmall: { fontFamily: F.quran, fontSize: 17, lineHeight: 34 },
  label: { fontSize: 14, fontFamily: F.semibold, color: C.muted },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 18, borderRadius: 12 },
  primary: { backgroundColor: C.brand },
  ghost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong },
  danger: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.badBg },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontFamily: F.bold },
  onBrand: { color: C.brandInk },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontSize: 14, color: C.ink, fontFamily: F.medium },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontFamily: F.semibold },
  notice: { borderRadius: 12, padding: 12 },
  input: { fontFamily: F.regular, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: C.surface, color: C.ink },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: C.brand },
  stage: { fontSize: 14, color: C.muted, lineHeight: 22, fontFamily: F.regular },
  stageDone: { color: C.ok },
  stageNow: { color: C.ink, fontFamily: F.bold },
})
