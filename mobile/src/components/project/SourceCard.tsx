import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { SourceInfo } from '@/shared/types'
import { C, F } from '@/theme'

/** What the ideas were inspired by, and what was read from it, folded until asked for. */
export function SourceCard({ source }: { source: SourceInfo }) {
  const [open, setOpen] = useState(false)
  const digest = source.digest
  const video = source.kind === 'youtube'
  return (
    <View style={st.card}>
      <View style={st.head}>
        <View style={st.icon}>
          <Ionicons name={video ? 'logo-youtube' : 'document-text-outline'} size={18} color={C.info} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.kind}>{video ? 'مصدر الإلهام: فيديو يوتيوب' : 'مصدر الإلهام: ملف'}</Text>
          {source.url ? (
            <Text style={[st.label, st.link]} onPress={() => void Linking.openURL(source.url!).catch(() => undefined)} accessibilityRole="link" numberOfLines={2}>
              {source.label}
            </Text>
          ) : (
            <Text style={st.label} numberOfLines={2}>
              {source.label}
            </Text>
          )}
        </View>
      </View>
      {!!source.summary && <Text style={st.summary}>{source.summary}</Text>}
      {digest && (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={st.more} hitSlop={4}>
            <Text style={st.moreText}>
              ما قُرئ من المصدر ({digest.examples.length} أمثلة، {digest.citations.length} نصوص يستشهد بها)
            </Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.brand} />
          </Pressable>
          {open && (
            <View style={{ gap: 10 }}>
              {digest.argument.length > 0 && (
                <View style={{ gap: 4 }}>
                  <Text style={st.h}>الفكرة كما يعرضها</Text>
                  {digest.argument.map((a, i) => (
                    <Text key={i} style={st.item}>
                      {i + 1}. {a}
                    </Text>
                  ))}
                </View>
              )}
              {digest.examples.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={st.h}>الأمثلة</Text>
                  {digest.examples.map((e, i) => (
                    <View key={i} style={st.row}>
                      <Text style={st.locus}>{'⁦'}{e.locus}{'⁩'}</Text>
                      <Text style={[st.item, { flex: 1 }]}>{e.text}</Text>
                    </View>
                  ))}
                </View>
              )}
              {digest.citations.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={st.h}>نصوص يستشهد بها (تُتحقق قبل أي استعمال)</Text>
                  {digest.citations.map((c, i) => (
                    <View key={i} style={st.row}>
                      <Text style={st.locus}>{'⁦'}{c.locus}{'⁩'}</Text>
                      <Text style={[st.item, { flex: 1 }]}>
                        {c.text}
                        {c.attributed_to ? ` — ${c.attributed_to}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.infoBg, borderRadius: 16, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 12, fontFamily: F.bold, color: C.info },
  label: { fontSize: 14, lineHeight: 22, fontFamily: F.semibold, color: C.ink },
  link: { textDecorationLine: 'underline' },
  summary: { fontSize: 13, lineHeight: 22, fontFamily: F.regular, color: '#1f3f7e' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  moreText: { flexShrink: 1, fontSize: 13, fontFamily: F.semibold, color: C.brand },
  h: { fontSize: 13, fontFamily: F.bold, color: C.ink },
  item: { fontSize: 13, lineHeight: 22, fontFamily: F.regular, color: '#3d4a45' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  locus: { fontSize: 11, fontFamily: F.semibold, color: C.muted, backgroundColor: C.surface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
})
