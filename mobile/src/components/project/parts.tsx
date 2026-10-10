import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Href } from 'expo-router'
import { C, F } from '@/theme'

/** A route that exists in src/app but may be missing from the generated route types until the dev server
 * regenerates them (.expo/types/router.d.ts). */
export const href = (pathname: string, params?: Record<string, string>) => ({ pathname, params }) as unknown as Href

/** A white section of a form or a screen. */
export function Section({ children, style, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <View style={[p.section, style]} accessibilityLabel={label}>
      {children}
    </View>
  )
}

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Text style={p.sectionTitle} accessibilityRole="header">
    {children}
  </Text>
)

/** A pill to choose one value among several (or to toggle one), at least 44 points tall. */
export function Choice({ label, on, onPress, radio, disabled }: { label: string; on: boolean; onPress: () => void; radio?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: on, disabled } : { selected: on, disabled }}
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [p.choice, on && p.choiceOn, pressed && !disabled && { opacity: 0.8 }]}
    >
      <Text style={[p.choiceText, on && { color: C.brandInk }]}>{label}</Text>
    </Pressable>
  )
}

export const Choices = ({ children, radio, label }: { children: ReactNode; radio?: boolean; label?: string }) => (
  <View style={p.choices} accessibilityRole={radio ? 'radiogroup' : undefined} accessibilityLabel={label}>
    {children}
  </View>
)

/** A section that opens on its title, such as the earlier versions or the other ideas. */
export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <View style={p.collapsible}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={p.summary}>
        <Text style={p.summaryText}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
      </Pressable>
      {open && <View style={{ paddingBottom: 8 }}>{children}</View>}
    </View>
  )
}

/** A row inside a collapsible: a title, a line under it, and a chevron toward what it opens. */
export function LinkRow({ title, sub, subColor, onPress, hint, first }: { title: string; sub?: string; subColor?: string; onPress: () => void; hint?: string; first?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [p.linkRow, !first && p.linkRowLine, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={p.linkTitle}>{title}</Text>
        {!!sub && <Text style={[p.linkSub, subColor ? { color: subColor, fontFamily: F.semibold } : null]}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-back" size={18} color={C.muted} />
    </Pressable>
  )
}

/** A note on a soft background with an icon at its start. */
export function Note({ children, icon = 'information-circle-outline', tone = 'brand' }: { children: ReactNode; icon?: keyof typeof Ionicons.glyphMap; tone?: 'brand' | 'info' | 'gold' | 'plain' }) {
  const t = NOTE[tone]
  return (
    <View style={[p.note, { backgroundColor: t.bg }]}>
      <Ionicons name={icon} size={20} color={t.icon} style={{ marginTop: 2 }} />
      <Text style={[p.noteText, { color: t.fg }]}>{children}</Text>
    </View>
  )
}

const NOTE = {
  brand: { bg: C.brandSoft, fg: '#0c4a3d', icon: C.brand },
  info: { bg: C.infoBg, fg: '#1f3f7e', icon: C.info },
  gold: { bg: C.goldSoft, fg: '#5a3d00', icon: C.gold },
  plain: { bg: C.bg, fg: '#3d4a45', icon: C.muted },
}

/** The main action of a screen: a tall filled button. */
export function BigButton({ title, onPress, disabled, kind = 'primary', hint }: { title: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'ghost'; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={hint}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [p.big, kind === 'ghost' ? p.bigGhost : { backgroundColor: disabled ? '#a9b3ae' : C.brand }, pressed && !disabled && { opacity: 0.85 }]}
    >
      <Text style={[p.bigText, kind === 'ghost' && { color: C.brand, fontFamily: F.semibold, fontSize: 15 }]}>{title}</Text>
    </Pressable>
  )
}

export const p = StyleSheet.create({
  section: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: F.bold, color: C.ink },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  choiceOn: { backgroundColor: C.brand, borderColor: C.brand },
  choiceText: { fontSize: 13, fontFamily: F.semibold, color: C.ink },
  collapsible: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 16 },
  summary: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { fontSize: 15, fontFamily: F.bold, color: C.ink },
  linkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  linkRowLine: { borderTopWidth: 1, borderTopColor: '#ebe8df' },
  linkTitle: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  linkSub: { fontSize: 12, fontFamily: F.regular, color: C.muted },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 22, fontFamily: F.regular },
  big: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  bigGhost: { minHeight: 48, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  bigText: { fontSize: 16, fontFamily: F.bold, color: C.brandInk, textAlign: 'center' },
  muted: { fontSize: 13, lineHeight: 21, color: C.muted, fontFamily: F.regular },
  body: { fontSize: 14, lineHeight: 24, color: '#3d4a45', fontFamily: F.regular },
})
