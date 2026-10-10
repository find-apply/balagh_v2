import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { P } from '@/components/ui'
import { LEVELS } from '@/shared/labels'
import type { Evidence, Idea } from '@/shared/types'
import { C, F } from '@/theme'

/** The level in words, without its letter ("أ · معلومات مستقرة" → "معلومات مستقرة"). */
export const levelWords = (idea: Pick<Idea, 'content_level'>) => LEVELS[idea.content_level].split(' · ').pop() ?? ''
export const ideaMeta = (idea: Idea) => `${idea.duration_seconds} ث · ${levelWords(idea)}`
const KIND = { quran: 'آية', hadith: 'حديث' }

/** One of the project's ideas, chosen like a radio button; its texts and concept open under it. */
export function IdeaCard({ idea, n, selected, onSelect }: { idea: Idea; n: number; selected: boolean; onSelect: () => void }) {
  const [more, setMore] = useState(false)
  return (
    <View style={[st.card, selected && st.cardOn]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`الفكرة ${n}: ${idea.title}. ${ideaMeta(idea)}`}
        onPress={onSelect}
        style={st.head}
      >
        <View style={st.topLine}>
          <View style={[st.radio, selected && st.radioOn]}>{selected && <Ionicons name="checkmark" size={12} color="#fff" />}</View>
          <Text style={[st.tag, selected && { color: C.brand }]}>الفكرة {n}</Text>
          <Text style={st.meta}>{ideaMeta(idea)}</Text>
        </View>
        <Text style={st.title}>{idea.title}</Text>
        <Text style={st.hook}>{idea.hook}</Text>
      </Pressable>

      <View style={st.body}>
        {!!idea.source_locus && (
          <View style={st.locus}>
            <Ionicons name="sparkles-outline" size={13} color={C.info} />
            <Text style={st.locusText}>من المصدر: {idea.source_locus}</Text>
          </View>
        )}
        {idea.evidence.map((e) => (
          <EvidenceChip key={e.id} evidence={e} />
        ))}
        {idea.unverified.length > 0 && (
          <View style={st.unverified}>
            <Ionicons name="information-circle-outline" size={14} color={C.muted} style={{ marginTop: 3 }} />
            <Text style={st.unverifiedText}>جزء لم يجد له بلاغ مصدرا موثّقا، فلن يُستعمل في السيناريو.</Text>
          </View>
        )}
        {more && <Text style={st.concept}>{idea.concept}</Text>}
        {more && idea.source_mentions.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={st.mentionsHead}>ذكرها المصدر وهي خارج نطاق مصادرنا الحالية (ليس تضعيفا)، فلن تُستعمل:</Text>
            {idea.source_mentions.map((m) => (
              <Text key={m} style={st.unverifiedText}>
                • {m}
              </Text>
            ))}
          </View>
        )}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} accessibilityLabel={more ? 'أقل' : 'المزيد عن الفكرة'} onPress={() => setMore(!more)} style={st.more} hitSlop={6}>
          <Text style={st.moreText}>{more ? 'أقل' : 'المزيد'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function EvidenceChip({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState(false)
  const label = `${KIND[evidence.kind]} · ${evidence.source}`
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`نص موثّق: ${label}`} onPress={() => setOpen(!open)} style={st.evidence}>
        <Ionicons name="checkmark" size={14} color={C.ok} />
        <Text style={st.evidenceText}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={C.ok} />
      </Pressable>
      {open && (
        <View style={st.quote}>
          <P strong>{evidence.text}</P>
        </View>
      )}
    </>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.line, borderRadius: 18, overflow: 'hidden' },
  cardOn: { borderColor: C.brand, shadowColor: C.brand, shadowOpacity: 0.12, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  head: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c9c4b6', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.brand, backgroundColor: C.brand },
  tag: { fontSize: 12, fontFamily: F.bold, color: C.muted },
  meta: { marginStart: 'auto', fontSize: 12, fontFamily: F.regular, color: C.muted },
  title: { fontSize: 17, lineHeight: 26, fontFamily: F.bold, color: C.ink },
  hook: { fontSize: 15, lineHeight: 26, fontFamily: F.regular, color: '#3d4a45' },
  body: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  evidence: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.okBg, flexDirection: 'row', alignItems: 'center', gap: 6 },
  evidenceText: { fontSize: 12, fontFamily: F.bold, color: C.ok, flexShrink: 1 },
  quote: { backgroundColor: '#f2f8f4', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  unverified: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  unverifiedText: { flex: 1, fontSize: 12, lineHeight: 19, fontFamily: F.regular, color: C.muted },
  locus: { alignSelf: 'flex-start', minHeight: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.infoBg, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locusText: { fontSize: 12, fontFamily: F.semibold, color: C.info, flexShrink: 1 },
  mentionsHead: { fontSize: 12, lineHeight: 19, fontFamily: F.bold, color: C.ink },
  concept: { fontSize: 14, lineHeight: 25, fontFamily: F.regular, color: '#3d4a45' },
  more: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  moreText: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
})
