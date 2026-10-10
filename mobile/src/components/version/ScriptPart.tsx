import Ionicons from '@expo/vector-icons/Ionicons'
import { StyleSheet, Text, View } from 'react-native'
import { Badge, Button, ltrText, Notice, P } from '@/components/ui'
import type { Job } from '@/jobs'
import { C, F } from '@/theme'
import type { Reference, Script } from '@/shared/types'
import { clock, Collapsible } from './common'

function referencesTitle(refs: Reference[]): string {
  const n = refs.length
  const exact = refs.every((r) => r.usage === 'quoted')
  if (n === 1) return exact ? 'نص شرعي واحد، منقول حرفيا من مصدره' : 'نص شرعي واحد، من مصدره'
  if (n === 2) return exact ? 'نصان شرعيان، منقولان حرفيا من مصدرهما' : 'نصان شرعيان، من مصدرهما'
  const count = n <= 10 ? `${n} نصوص شرعية` : `${n} نصا شرعيا`
  return exact ? `${count}، منقولة حرفيا من مصدرها` : `${count}، من مصادرها`
}

/** The version as it will be said: the hook, then each scene's voice-over at its second. */
export function ScriptPart({ script, reviewing, onNext, onReview }: {
  script: Script
  reviewing: Job | null
  onNext: () => void
  onReview: () => void
}) {
  const ltr = script.target.language === 'en'
  return (
    <>
      <View style={st.article}>
        <Text style={[st.hook, ltr && ltrText]} accessibilityRole="header">{script.hook}</Text>
        {script.scenes.map((sc, i) => {
          const last = i === script.scenes.length - 1
          return (
            <View key={i} style={st.scene} accessibilityLabel={`المشهد ${i + 1}، عند ${clock(sc.start_second)}`}>
              <View style={st.rail}>
                <Text style={st.time}>{clock(sc.start_second)}</Text>
                {!last && <View style={st.railLine} />}
              </View>
              <View style={[st.sceneText, !last && { paddingBottom: 18 }]}>
                <P ltr={ltr}>{sc.voiceover || sc.on_screen_text}</P>
              </View>
            </View>
          )
        })}
      </View>

      {script.references.length === 0 ? (
        <P muted small>هذه النسخة لا تقتبس نصا شرعيا.</P>
      ) : (
        <Collapsible tone="ok" title={referencesTitle(script.references)} icon={<Ionicons name="checkmark" size={18} color={C.ok} />}>
          {script.references.map((r, i) => (
            <View key={r.evidence_id} style={[st.ref, i > 0 && st.refSep]}>
              {r.usage !== 'quoted' && <Badge tone="warn">بالمعنى</Badge>}
              <P strong>{r.arabic || r.text}</P>
              <Text style={st.source}>{r.source}</Text>
              {r.tafsir.map((t, j) => (
                <P key={j} small muted>
                  {t.source}: {t.text}
                </P>
              ))}
              {r.sharh && (
                <P small muted>
                  {r.sharh.source}
                  {r.sharh.grade ? ` (${r.sharh.grade})` : ''}: {r.sharh.text}
                </P>
              )}
            </View>
          ))}
        </Collapsible>
      )}

      {script.unverified_claims.length > 0 && <Notice tone="warn">وقائع لم يُتحقق منها: {script.unverified_claims.join('، ')}</Notice>}

      {script.review || reviewing ? (
        <Button title="التالي: المراجعة" onPress={onNext} />
      ) : (
        <Button title="راجع آليا" onPress={onReview} />
      )}

      <Text style={st.disclosure}>{script.ai_disclosure}</Text>
    </>
  )
}

const st = StyleSheet.create({
  article: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingVertical: 20, paddingHorizontal: 18 },
  hook: { fontFamily: F.bold, fontSize: 19, lineHeight: 32, color: C.ink, marginBottom: 18 },
  scene: { flexDirection: 'row', gap: 12 },
  rail: { width: 40, alignItems: 'center' },
  time: { fontFamily: F.bold, fontSize: 12, color: C.brand },
  railLine: { flex: 1, width: 2, backgroundColor: C.line, marginVertical: 6 },
  sceneText: { flex: 1 },
  ref: { gap: 6 },
  refSep: { borderTopWidth: 1, borderTopColor: '#cfe6da', paddingTop: 10 },
  source: { fontFamily: F.semibold, fontSize: 13, color: C.ok },
  disclosure: { fontFamily: F.regular, fontSize: 12, lineHeight: 20, color: C.muted, textAlign: 'center' },
})
