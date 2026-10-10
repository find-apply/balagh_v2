import Ionicons from '@expo/vector-icons/Ionicons'
import { StyleSheet, Text, View } from 'react-native'
import { Badge, Button, Card, H3, P, Progress } from '@/components/ui'
import type { Job } from '@/jobs'
import { REVIEWERS } from '@/shared/labels'
import type { Finding, Script } from '@/shared/types'
import { C, F } from '@/theme'

const KEYS = Object.keys(REVIEWERS) as Finding['reviewer'][]

/** The automated review: what each of the three reviewers found, and the correction when something blocks.
 * For a specialist a blocking finding is a warning they may overrule; for a creator it blocks. */
export function ReviewPart({ script, reviewing, revising, onReview, onRevise, onClear, onNext }: {
  script: Script
  reviewing: Job | null
  revising: Job | null
  onReview: () => void
  onRevise: () => void
  onClear: () => void
  onNext: () => void
}) {
  const job = revising ?? reviewing
  if (job) return <Progress task={job.task} started={job.started} error={job.error} onRetry={onClear} />
  const r = script.review
  if (!r)
    return (
      <Card>
        <H3>لم تُراجع هذه النسخة بعد</H3>
        <P muted>ثلاثة مراجعين آليين يفحصونها: علمي، وجمهور، ومعنى.</P>
        <Button title="راجع آليا" onPress={onReview} />
      </Card>
    )
  const specialist = script.author === 'specialist'
  const blockTone = specialist ? { bg: C.warnBg, fg: C.warn, border: '#ead9a8' } : { bg: C.badBg, fg: C.bad, border: '#f0c9c3' }

  return (
    <>
      <View style={st.tiles} accessibilityRole="summary">
        {KEYS.map((k) => {
          const mine = r.findings.filter((f) => f.reviewer === k)
          const blocks = mine.some((f) => f.severity === 'blocking')
          const look = mine.length === 0 ? { bg: C.okBg, fg: C.ok } : blocks ? { bg: blockTone.bg, fg: blockTone.fg } : { bg: '#f0eee7', fg: '#3d4a45' }
          return (
            <View
              key={k}
              style={st.tile}
              accessible
              accessibilityLabel={`${REVIEWERS[k]}: ${mine.length === 0 ? 'لا ملاحظات' : `${mine.length} ملاحظة`}`}
            >
              <View style={[st.count, { backgroundColor: look.bg }]}>
                {mine.length === 0 ? <Ionicons name="checkmark" size={17} color={look.fg} /> : <Text style={[st.countText, { color: look.fg }]}>{mine.length}</Text>}
              </View>
              <Text style={st.tileLabel}>{REVIEWERS[k]}</Text>
            </View>
          )
        })}
      </View>

      {r.blocking > 0 ? (
        <View style={[st.alert, { backgroundColor: blockTone.bg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={20} color={blockTone.fg} style={{ marginTop: 2 }} />
          <Text style={[st.alertText, { color: blockTone.fg }]}>
            {specialist
              ? `تنبيه لا يُلزمك: ${r.blocking} ملاحظة مانعة من المراجعة الآلية. صحّحها في نسخة جديدة، أو اعتمد النسخة كما هي على مسؤوليتك العلمية.`
              : `${r.blocking} ملاحظة مانعة: صحّحها في نسخة جديدة قبل الاعتماد.`}
          </Text>
        </View>
      ) : (
        <View style={[st.alert, { backgroundColor: C.okBg }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={C.ok} style={{ marginTop: 2 }} />
          <Text style={[st.alertText, { color: C.ok }]}>لا ملاحظات مانعة.</Text>
        </View>
      )}

      {r.findings.map((f, i) => {
        const blocking = f.severity === 'blocking'
        return (
          <View key={i} style={[st.finding, blocking && { borderColor: blockTone.border }]}>
            <View style={st.badges}>
              <Badge tone={blocking ? (specialist ? 'warn' : 'bad') : 'plain'}>{blocking ? 'مانعة' : 'اقتراح'}</Badge>
              <Badge>{REVIEWERS[f.reviewer]}</Badge>
              {f.scene > 0 && <Badge>المشهد {f.scene}</Badge>}
            </View>
            <P>{f.issue}</P>
            {!!f.fix && (
              <P small muted>
                التصحيح: {f.fix}
              </P>
            )}
          </View>
        )
      })}

      {r.blocking > 0 && <Button title="صحّح في نسخة جديدة" onPress={onRevise} />}
      {(r.blocking === 0 || specialist) && (
        <Button
          title={r.blocking === 0 ? 'التالي: الفيديو' : 'تابع دون تصحيح: الاعتماد'}
          kind={r.blocking === 0 ? 'primary' : 'ghost'}
          onPress={onNext}
        />
      )}
    </>
  )
}

const st = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, alignItems: 'center', gap: 4 },
  count: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: F.bold, fontSize: 14 },
  tileLabel: { fontFamily: F.semibold, fontSize: 12, lineHeight: 18, color: C.ink, textAlign: 'center' },
  alert: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { flex: 1, fontFamily: F.semibold, fontSize: 14, lineHeight: 24 },
  finding: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})
