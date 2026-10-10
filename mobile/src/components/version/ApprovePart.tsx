import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { api, SITE } from '@/api'
import { IconCircle } from '@/components/kit'
import { Badge, Button, Field, H2, H3, Notice, P, Progress } from '@/components/ui'
import type { Job } from '@/jobs'
import { REVIEWERS, ROLES } from '@/shared/labels'
import type { Script } from '@/shared/types'
import { C, F } from '@/theme'
import { Collapsible, IconButton, message, ROLE_SUBJECT, shortDate } from './common'

interface Props {
  projectId: string
  script: Script
  /** The full name the person gave at sign-up: signatures carry it (the server holds to it too). */
  accountName: string
  revising: Job | null
  onRevise: () => void
  onClearRevise: () => void
  onSigned: () => Promise<void>
  onVideo: () => void
}

const readLink = (projectId: string, s: Script) => `${s.title}\n${SITE}/#/review/${projectId}/${s.id}`

/** Signs this version as its author (the API's creator role), whoever the author is. */
function useSign(projectId: string, script: Script, onSigned: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sign = async (name: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.approve(projectId, script.id, 'creator', name.trim())
      await onSigned()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, sign }
}

export function ApprovePart(props: Props) {
  if (props.revising) return <Progress task={props.revising.task} started={props.revising.started} error={props.revising.error} onRetry={props.onClearRevise} />
  return props.script.author === 'specialist' ? <SpecialistApprove {...props} /> : <CreatorApprove {...props} />
}

function ShareButton({ projectId, script, label = 'شارك رابط القراءة مع مراجع' }: { projectId: string; script: Script; label?: string }) {
  const [sent, setSent] = useState(false)
  return (
    <IconButton
      icon={sent ? 'checkmark' : 'share-outline'}
      kind="ghost"
      title={sent ? '✓ أُرسل رابط القراءة' : label}
      onPress={() =>
        void Share.share({ message: readLink(projectId, script) }).then(
          (r) => r.action === Share.sharedAction && setSent(true),
          () => undefined,
        )
      }
    />
  )
}

/** A reviewer declined this version: what they asked, and the correction. */
function ChangeRequests({ script, onRevise }: { script: Script; onRevise: () => void }) {
  return (
    <>
      {script.change_requests.map((r, i) => (
        <View key={i} style={st.request}>
          <View style={st.requestHead}>
            <View style={st.avatar}>
              <Text style={st.avatarText}>{(r.name.trim()[0] ?? 'م').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.requestTitle}>طلب {ROLE_SUBJECT[r.role]} تعديلا</Text>
              <Text style={st.meta}>
                {r.name}
                {shortDate(r.at) ? ` · ${shortDate(r.at)}` : ''}
              </Text>
            </View>
          </View>
          <View style={st.quote}>
            <P>{r.note}</P>
          </View>
          <P small muted>النسخة غير معتمدة حتى تُصحَّح. في النسخة الجديدة يراجع المراجع نفسه التصحيح قبل التوقيع.</P>
          {i === script.change_requests.length - 1 && <Button title="صحّح في نسخة جديدة" onPress={onRevise} />}
        </View>
      ))}
      <View style={st.summary}>
        <Text style={st.summaryTitle}>التوقيعات</Text>
        {script.required_approvals.map((req, i) => {
          const signed = script.approvals.some((a) => a.role === req.role)
          const asked = script.change_requests.some((c) => c.role === req.role)
          return (
            <View key={req.role} style={[st.summaryRow, i < script.required_approvals.length - 1 && st.rowSep]}>
              <Text style={st.summaryRole}>{ROLES[req.role]}</Text>
              <Text style={[st.summaryState, { color: asked ? C.info : signed ? C.ok : C.warn }]}>{asked ? 'طلب تعديلا' : signed ? '✓ وقّع' : 'ينتظر'}</Text>
            </View>
          )
        })}
      </View>
    </>
  )
}

/** The signatures this version needs, who signed, and who is still awaited. */
function Signatures({ script, skipCreator }: { script: Script; skipCreator?: boolean }) {
  const list = script.required_approvals.filter((r) => !(skipCreator && r.role === 'creator'))
  if (list.length === 0) return null
  return (
    <View style={st.list} accessibilityLabel="التوقيعات المطلوبة">
      {list.map((r, i) => {
        const a = script.approvals.find((x) => x.role === r.role)
        return (
          <View key={r.role} style={[st.item, i < list.length - 1 && st.rowSep]}>
            <View style={[st.mark, { backgroundColor: a ? C.okBg : C.warnBg }]}>
              <Ionicons name={a ? 'checkmark' : 'time-outline'} size={18} color={a ? C.ok : C.warn} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={st.itemHead}>
                <Text style={st.itemRole}>{ROLES[r.role]}</Text>
                {a ? <Badge tone="ok">{a.role === 'creator' ? '✓ أكّد' : '✓ اعتمد'}: {a.name}</Badge> : <Badge tone="warn">ينتظر</Badge>}
              </View>
              <Text style={st.reason}>{r.reason}</Text>
              {r.role === 'scholar' && !a && <Text style={[st.reason, { color: C.ink }]}>تعيّن المنصة مراجعا شرعيا مختصا، ويصله رابط دعوة خاص به.</Text>}
            </View>
          </View>
        )
      })}
    </View>
  )
}

/** Whose name the signature carries: the account's full name, shown and not typed. An account from before
 * sign-up details were asked has none, and types it once here. */
function SignerName({ name, typed, onType }: { name: string; typed: string; onType: (v: string) => void }) {
  if (!name) return <Field label="اسمك كما يظهر مع التوقيع" value={typed} onChangeText={onType} maxLength={80} autoComplete="name" />
  return (
    <View style={st.signer}>
      <Ionicons name="person-circle-outline" size={22} color={C.brand} />
      <Text style={st.signerText}>
        يُسجَّل باسمك: <Text style={{ fontFamily: F.bold, color: C.ink }}>{name}</Text>
      </Text>
    </View>
  )
}

function CreatorApprove({ projectId, script, accountName, onRevise, onSigned }: Props) {
  const [typed, setTyped] = useState('')
  const name = accountName || typed
  const { busy, error, sign } = useSign(projectId, script, onSigned)
  const mine = script.required_approvals.some((r) => r.role === 'creator') && !script.approvals.some((a) => a.role === 'creator')

  if (script.change_requests.length > 0 && !script.approved) return <ChangeRequests script={script} onRevise={onRevise} />

  return (
    <>
      {script.approved ? (
        <Notice tone="ok">النسخة معتمدة: وقّع كل من تتطلبه.</Notice>
      ) : (
        <View style={st.info}>
          <Ionicons name="information-circle-outline" size={20} color={C.brand} />
          <Text style={st.infoText}>لا تُنشر النسخة حتى يوقّع كل من تتطلبه باسمه.</Text>
        </View>
      )}
      <Signatures script={script} />
      {mine && (
        <View style={st.form}>
          <View style={{ gap: 2 }}>
            <H2>تأكيدك كصاحب المحتوى</H2>
            <P muted small>تؤكد أن هذه النسخة جاهزة من جهتك. الاعتماد بعدها للمراجع الشرعي.</P>
          </View>
          <SignerName name={accountName} typed={typed} onType={setTyped} />
          {error && <Notice tone="bad">{error}</Notice>}
          <IconButton icon="checkmark" title="أؤكد هذه النسخة" onPress={() => void sign(name)} disabled={name.trim().length < 2} busy={busy} />
        </View>
      )}
      <ShareButton projectId={projectId} script={script} />
    </>
  )
}

function SpecialistApprove({ projectId, script, accountName, onRevise, onSigned, onVideo }: Props) {
  const [typed, setTyped] = useState('')
  const name = accountName || typed
  const [ack, setAck] = useState(false)
  const { busy, error, sign } = useSign(projectId, script, onSigned)
  const mine = script.approvals.find((a) => a.role === 'creator')
  const blocking = script.review?.findings.filter((f) => f.severity === 'blocking') ?? []
  const needsAck = (script.review?.blocking ?? 0) > 0
  const ready = name.trim().length >= 2 && (!needsAck || ack)

  if (script.change_requests.length > 0 && !script.approved) return <ChangeRequests script={script} onRevise={onRevise} />

  return (
    <>
      {mine ? (
        <View style={[st.form, { alignItems: 'center' }]} accessibilityRole="summary">
          <IconCircle icon="checkmark-done" tone="ok" size={56} />
          <H2>{script.approved ? 'اعتُمدت النسخة' : 'وقّعت هذه النسخة'}</H2>
          <P muted>
            {script.approved
              ? `وقّعت باسم ${mine.name}. يمكنك الآن صنع الفيديو النهائي بلا علامة مائية ونشره.`
              : `وقّعت باسم ${mine.name}. تبقى توقيعات أخرى تتطلبها هذه النسخة.`}
          </P>
          {script.approved && (
            <View style={{ alignSelf: 'stretch' }}>
              <Button title="أنشئ الفيديو النهائي" onPress={onVideo} />
            </View>
          )}
        </View>
      ) : (
        <View style={st.form}>
          <View style={{ gap: 2 }}>
            <H2>اعتمادك يكفي للنشر</H2>
            <P muted small>أنت مختص شرعي: لا تحتاج توقيع أحد غيرك.</P>
          </View>
          {needsAck && (
            <Collapsible
              tone="warn"
              icon={
                <View style={st.bang}>
                  <Text style={st.bangText}>!</Text>
                </View>
              }
              title={`ملاحظة من المراجعة الآلية${blocking.length > 1 ? ` (${blocking.length})` : ''}`}
            >
              {blocking.map((f, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <Text style={st.findingMeta}>
                    {REVIEWERS[f.reviewer]}
                    {f.scene > 0 ? ` · المشهد ${f.scene}` : ''}
                  </Text>
                  <P small>{f.issue}</P>
                  {!!f.fix && <P small muted>التصحيح المقترح: {f.fix}</P>}
                </View>
              ))}
              <Button title="صحّح في نسخة جديدة" kind="ghost" onPress={onRevise} />
            </Collapsible>
          )}
          {needsAck && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ack }}
              onPress={() => setAck((a) => !a)}
              style={st.ack}
            >
              <View style={[st.box, ack && { backgroundColor: C.brand, borderColor: C.brand }]}>
                {ack && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={st.ackText}>اطّلعت على الملاحظة، وأعتمد النسخة كما هي على مسؤوليتي العلمية.</Text>
            </Pressable>
          )}
          <SignerName name={accountName} typed={typed} onType={setTyped} />
          {error && <Notice tone="bad">{error}</Notice>}
          <IconButton icon="checkmark-done" title="أعتمد هذه النسخة" onPress={() => void sign(name)} disabled={!ready} busy={busy} />
        </View>
      )}

      {mine && <Signatures script={script} skipCreator />}

      <View style={st.form}>
        <View style={st.itemHead}>
          <H3>رأي مراجع آخر</H3>
          <Badge>اختياري</Badge>
        </View>
        <P muted small>أرسل رابط القراءة لمن تريد رأيه. رأيه يصلك هنا، ولا يوقف اعتمادك ولا النشر.</P>
        <ShareButton projectId={projectId} script={script} label="شارك رابط القراءة" />
      </View>
    </>
  )
}

const st = StyleSheet.create({
  signer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brandSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  signerText: { flex: 1, fontSize: 14, lineHeight: 22, fontFamily: F.regular, color: '#0c4a3d' },
  info: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.brandSoft, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  infoText: { flex: 1, fontFamily: F.semibold, fontSize: 14, lineHeight: 24, color: C.brand },
  list: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 16 },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  rowSep: { borderBottomWidth: 1, borderBottomColor: '#ebe8df' },
  mark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  itemHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemRole: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  reason: { fontFamily: F.regular, fontSize: 13, lineHeight: 21, color: C.muted },
  form: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 14 },
  request: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.info, borderRadius: 18, padding: 18, gap: 12 },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.infoBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.bold, fontSize: 16, color: C.info },
  requestTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  quote: { backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  summary: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  summaryTitle: { fontFamily: F.bold, fontSize: 14, color: C.ink, marginTop: 10, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  summaryRole: { fontFamily: F.regular, fontSize: 14, color: C.ink },
  summaryState: { fontFamily: F.bold, fontSize: 13 },
  bang: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  bangText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  findingMeta: { fontFamily: F.semibold, fontSize: 13, color: C.warn },
  ack: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  ackText: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 24, color: C.ink },
  hint: { fontFamily: F.regular, fontSize: 12, color: C.muted },
})
