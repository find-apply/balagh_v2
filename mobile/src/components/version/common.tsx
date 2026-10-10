import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import type { IconName } from '@/components/kit'
import { C, F } from '@/theme'
import type { ReviewRole, Script, VideoStatus } from '@/shared/types'

export type Part = 'script' | 'review' | 'video' | 'approve'
export const PART_KEYS: Part[] = ['script', 'review', 'video', 'approve']

/** A render still running: the list is polled until it ends. */
export const ACTIVE = new Set<VideoStatus>(['queued', 'voicing', 'imaging', 'rendering'])

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Seconds as a clock: 8 → 0:08, 75 → 1:15. */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function scenesLabel(n: number): string {
  if (n === 1) return 'مشهد واحد'
  if (n === 2) return 'مشهدان'
  if (n >= 3 && n <= 10) return `${n} مشاهد`
  return `${n} مشهدا`
}

/** The line under the screen's title: the version, its length, its scenes. */
export const versionLine = (s: Script) => `النسخة ${s.version} · ${s.duration_seconds} ثانية · ${scenesLabel(s.scenes.length)}`

/** The reviewer as a sentence's subject: «طلب المراجع الشرعي تعديلا». */
export const ROLE_SUBJECT: Record<ReviewRole, string> = { creator: 'صانع المحتوى', scholar: 'المراجع الشرعي', language: 'المراجع اللغوي' }

export const shortDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ar', { day: 'numeric', month: 'long' })
}

/** Whether the system asks for less motion; previews then hold still. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((r) => alive && setReduce(r), () => undefined)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduce
}

/** A row that opens to show what it holds. */
export function Collapsible({ title, icon, tone = 'plain', children, style, initiallyOpen = false }: {
  title: ReactNode
  icon?: ReactNode
  tone?: 'plain' | 'ok' | 'warn'
  children: ReactNode
  style?: StyleProp<ViewStyle>
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const colors = {
    plain: { bg: C.surface, border: C.line, fg: C.ink, chevron: C.muted },
    ok: { bg: C.okBg, border: C.okBg, fg: '#14503a', chevron: C.ok },
    warn: { bg: C.warnBg, border: C.warnBg, fg: C.warn, chevron: C.warn },
  }[tone]
  return (
    <View style={[st.box, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={st.head}
      >
        {icon}
        <View style={{ flex: 1 }}>
          {typeof title === 'string' ? <Text style={[st.title, { color: colors.fg }]}>{title}</Text> : title}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.chevron} />
      </Pressable>
      {open && <View style={st.body}>{children}</View>}
    </View>
  )
}

/** A text action without a frame, at least 44 points tall. */
export function LinkButton({ title, onPress, icon, color = C.brand }: { title: string; onPress: () => void; icon?: IconName; color?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={4} style={({ pressed }) => [st.link, pressed && { opacity: 0.6 }]}>
      {icon && <Ionicons name={icon} size={17} color={color} />}
      <Text style={[st.linkText, { color }]}>{title}</Text>
    </Pressable>
  )
}

/** A full-width action with an icon, for the places the plain Button has none. */
export function IconButton({ title, icon, onPress, kind = 'primary', disabled, busy }: {
  title: string
  icon: IconName
  onPress: () => void
  kind?: 'primary' | 'ghost' | 'gold'
  disabled?: boolean
  busy?: boolean
}) {
  const off = disabled || busy
  const look = {
    primary: { bg: C.brand, fg: C.brandInk, border: C.brand },
    ghost: { bg: C.surface, fg: C.brand, border: C.lineStrong },
    gold: { bg: C.goldSoft, fg: '#6b4800', border: C.goldSoft },
  }[kind]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [st.iconButton, { backgroundColor: look.bg, borderColor: look.border }, off && { opacity: 0.45 }, pressed && !off && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={19} color={look.fg} />
      <Text style={[st.iconButtonText, { color: look.fg }]}>{title}</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  head: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: F.bold, fontSize: 14 },
  body: { paddingBottom: 16, gap: 8 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, alignSelf: 'center' },
  linkText: { fontFamily: F.semibold, fontSize: 14 },
  iconButton: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  iconButtonText: { fontFamily: F.bold, fontSize: 15 },
})
