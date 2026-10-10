import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ASPECTS, PLATFORM_ASPECT, PLATFORMS } from '@/shared/labels'
import type { Aspect } from '@/shared/labels'
import type { Platform } from '@/shared/types'
import { C, F } from '@/theme'
import type { IconName } from '@/components/kit'

/** Each platform's logo (from Ionicons, as the app ships them) on its own colour. Shorts and Reels take their
 * parent's logo, which is how the platforms show them. */
const LOOK: Record<Platform, { icon: IconName; tile: string; glyph: string; short: string }> = {
  tiktok: { icon: 'logo-tiktok', tile: '#111111', glyph: '#ffffff', short: 'TikTok' },
  instagram_reels: { icon: 'logo-instagram', tile: '#d6286b', glyph: '#ffffff', short: 'Reels' },
  youtube_shorts: { icon: 'logo-youtube', tile: '#e00000', glyph: '#ffffff', short: 'Shorts' },
  facebook_reels: { icon: 'logo-facebook', tile: '#1877f2', glyph: '#ffffff', short: 'Facebook' },
  snapchat: { icon: 'logo-snapchat', tile: '#fffc00', glyph: '#111111', short: 'Snapchat' },
  youtube: { icon: 'logo-youtube', tile: '#e00000', glyph: '#ffffff', short: 'YouTube' },
  linkedin: { icon: 'logo-linkedin', tile: '#0a66c2', glyph: '#ffffff', short: 'LinkedIn' },
  x: { icon: 'logo-x', tile: '#111111', glyph: '#ffffff', short: 'X' },
}

const GROUPS: { aspect: Aspect; frame: { width: number; height: number } }[] = [
  { aspect: '9:16', frame: { width: 8, height: 13 } },
  { aspect: '16:9', frame: { width: 14, height: 8 } },
]
const COLUMNS = 4
const GAP = 8

/** One platform, chosen from a grid of logos grouped by the video's shape (vertical or wide), since the platform
 * decides the frame. */
export function PlatformPicker({ value, onChange, disabled }: { value: Platform; onChange: (p: Platform) => void; disabled?: boolean }) {
  const [width, setWidth] = useState(0)
  const tile = width ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0
  const all = Object.keys(PLATFORMS) as Platform[]
  const look = LOOK[value]

  return (
    <View style={{ gap: 14 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="radiogroup" accessibilityLabel="المنصة">
      {GROUPS.map((g) => (
        <View key={g.aspect} style={{ gap: 8 }}>
          <View style={st.groupHead}>
            <View style={[st.frame, g.frame]} />
            <Text style={st.groupText}>فيديو {ASPECTS[g.aspect]}</Text>
          </View>
          <View style={st.grid}>
            {tile > 0 &&
              all
                .filter((pl) => PLATFORM_ASPECT[pl] === g.aspect)
                .map((pl) => {
                  const on = value === pl
                  const l = LOOK[pl]
                  return (
                    <Pressable
                      key={pl}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on, disabled }}
                      accessibilityLabel={PLATFORMS[pl]}
                      onPress={() => onChange(pl)}
                      disabled={disabled}
                      style={({ pressed }) => [st.tile, { width: tile }, on && st.tileOn, pressed && { opacity: 0.8 }]}
                    >
                      <View style={[st.logo, { backgroundColor: l.tile }]}>
                        <Ionicons name={l.icon} size={22} color={l.glyph} />
                      </View>
                      <Text style={st.name} numberOfLines={1}>
                        {l.short}
                      </Text>
                      {on && (
                        <View style={st.check}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  )
                })}
          </View>
        </View>
      ))}
      <View style={st.chosen} accessibilityLiveRegion="polite">
        <View style={[st.chosenLogo, { backgroundColor: look.tile }]}>
          <Ionicons name={look.icon} size={17} color={look.glyph} />
        </View>
        <Text style={st.chosenText}>
          {'⁦'}
          {PLATFORMS[value]}
          {'⁩'}: الفيديو {ASPECTS[PLATFORM_ASPECT[value]]}.
        </Text>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  frame: { borderWidth: 1.5, borderColor: '#4a5752', borderRadius: 3 },
  groupText: { fontSize: 12, fontFamily: F.semibold, color: '#4a5752' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    minHeight: 84, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 2, borderRadius: 14, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  tileOn: { borderWidth: 2, borderColor: C.brand, backgroundColor: C.brandSoft },
  logo: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 11, fontFamily: F.semibold, color: C.ink },
  check: {
    position: 'absolute', top: -6, end: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.brand, borderWidth: 2,
    borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.brandSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  chosenLogo: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chosenText: { flex: 1, fontSize: 13, lineHeight: 21, fontFamily: F.regular, color: '#0c4a3d' },
})
