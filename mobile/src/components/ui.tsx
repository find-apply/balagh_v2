import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, I18nManager, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { RefreshControlProps, StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native'
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
/** Text in a left-to-right language (an English version) inside the right-to-left app. Android flips left and
 * right when RTL is forced, so its visual left is 'right'. */
export const ltrText: TextStyle = { textAlign: Platform.OS === 'android' && I18nManager.isRTL ? 'right' : 'left', writingDirection: 'ltr' }

export const P = ({ children, muted, small, strong, ltr }: { children: ReactNode; muted?: boolean; small?: boolean; strong?: boolean; ltr?: boolean }) => {
  const quran = Array.isArray(children) ? children.some(isQuranic) : isQuranic(children)
  const shown = quran ? (Array.isArray(children) ? children.map((c) => (typeof c === 'string' ? shownQuran(c) : c)) : typeof children === 'string' ? shownQuran(children) : children) : children
  return <Text style={[s.p, muted && s.muted, small && s.small, strong && s.strong, quran && (small ? s.quranSmall : s.quran), ltr && ltrText]}>{shown}</Text>
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
  const still = useReducedMotion()
  const [turn] = useState(() => new Animated.Value(0))
  const [back] = useState(() => new Animated.Value(0))
  const [pulse] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const t = setInterval(() => setSeconds(since()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])
  useEffect(() => {
    if (still || error) return
    const loops = [
      Animated.loop(Animated.timing(turn, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(back, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    ]
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [still, error, turn, back, pulse])

  if (error)
    return (
      <View style={s.progressError} accessibilityRole="alert">
        <View style={s.progressErrorHead}>
          <Ionicons name="alert-circle" size={22} color={C.bad} />
          <Text style={[s.h3, { color: C.bad, flex: 1 }]}>تعذّر: {task.title}</Text>
        </View>
        <P>{error}</P>
        {onRetry && <Button title="أعد المحاولة" kind="danger" onPress={onRetry} />}
      </View>
    )
  const stages = task.stages
  const share = task.expected / Math.max(1, stages.length)
  const current = Math.min(Math.floor(seconds / share), stages.length - 1)
  const percent = Math.round(92 * (1 - Math.exp(-seconds / (task.expected * 0.6))))
  const spin = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const spinBack = back.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] })
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
  return (
    <View style={s.progress}>
      <View style={s.progressHero}>
        <View style={s.star} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.View style={[s.starRing, { transform: [{ rotate: spinBack }] }]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.center, { transform: [{ rotate: spin }] }]}>
            <View style={[s.starSquare, { borderColor: C.brand }]} />
            <View style={[s.starSquare, { borderColor: C.gold, transform: [{ rotate: '45deg' }] }]} />
          </Animated.View>
          <View style={s.starDot} />
        </View>
        <Text style={s.progressTitle} accessibilityRole="header">{task.title}</Text>
        <Text style={s.progressTime} accessibilityLiveRegion="polite">
          {seconds} ث من نحو {task.expected < 60 ? `${task.expected} ث` : 'دقيقة'}
        </Text>
      </View>
      <View style={s.bar} accessibilityRole="progressbar" accessibilityLabel="التقدم" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[s.barFill, { width: `${percent}%` }]} />
      </View>
      {stages.length > 0 && (
        <View style={s.stages}>
          {stages.map((stage, i) => {
            const done = i < current
            const now = i === current
            return (
              <View key={stage} style={s.stageRow} accessibilityLabel={`${stage}${done ? '، تمّ' : now ? '، جارٍ الآن' : ''}`}>
                <View style={[s.stageDot, (done || now) && { borderColor: C.brand }, done && { backgroundColor: C.brand }]}>
                  {done && <Ionicons name="checkmark" size={13} color="#fff" />}
                  {now && <Animated.View style={[s.stagePulse, { opacity: still ? 1 : glow }]} />}
                </View>
                <Text style={[s.stage, done && s.stageDone, now && s.stageNow]}>{stage}</Text>
              </View>
            )
          })}
        </View>
      )}
      <View style={s.progressNote}>
        <Ionicons name="information-circle-outline" size={20} color={C.brand} />
        <Text style={s.progressNoteText}>يمكنك الخروج من هذه الشاشة، والعمل يستمر.</Text>
      </View>
    </View>
  )
}

/** Whether the system asks for less motion; the progress card then holds still. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced, () => undefined)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => sub.remove()
  }, [])
  return reduced
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
  bar: { height: 8, borderRadius: 4, backgroundColor: '#ebe8df', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.brand },
  stage: { flex: 1, fontSize: 14, color: '#8a938f', lineHeight: 22, fontFamily: F.medium, paddingTop: 1 },
  stageDone: { color: '#3d4a45' },
  stageNow: { color: C.ink, fontFamily: F.bold },
  progress: { gap: 20 },
  progressHero: { alignItems: 'center', gap: 14, paddingTop: 16 },
  star: { width: 112, height: 112 },
  center: { alignItems: 'center', justifyContent: 'center' },
  starRing: { position: 'absolute', top: 4, left: 4, width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderStyle: 'dashed', borderColor: C.line },
  starSquare: { position: 'absolute', width: 44, height: 44, borderWidth: 2.5 },
  starDot: { position: 'absolute', top: 50, left: 50, width: 12, height: 12, borderRadius: 6, backgroundColor: C.brand },
  progressTitle: { fontSize: 20, lineHeight: 30, fontFamily: F.bold, color: C.ink, textAlign: 'center' },
  progressTime: { fontSize: 14, color: C.muted, fontFamily: F.regular },
  stages: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 14 },
  stageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stageDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  stagePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand },
  progressNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.brandSoft, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  progressNoteText: { flex: 1, fontSize: 13, lineHeight: 22, color: '#0c4a3d', fontFamily: F.regular },
  progressError: { backgroundColor: C.badBg, borderRadius: 18, padding: 16, gap: 10 },
  progressErrorHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
